/** Billing (8.1) and Revised Billing (8.2) */
const express = require('express');
const { db, log } = require('../db');

const router = express.Router();

function rateAuditRequired() {
  const p = db.prepare("SELECT value FROM preference WHERE key = 'rate_audit_required'").get();
  return !p || p.value === 'YES';
}

/* bookings ready for billing */
router.get('/pending', (req, res) => {
  const { ad_type, from, to, agency_id, center_id } = req.query;
  const where = ["b.status = 'BOOKED'", "b.bill_status = 'PENDING'", "b.audit_status = 'AUDITED'"];
  const params = [];
  if (rateAuditRequired()) where.push("b.rate_audit_status = 'PASSED'");
  where.push("EXISTS (SELECT 1 FROM insertion i WHERE i.booking_id = b.id AND i.status = 'PUBLISHED')");
  if (ad_type) { where.push('b.ad_type = ?'); params.push(ad_type); }
  if (from) { where.push('b.booking_date >= ?'); params.push(from); }
  if (to) { where.push('b.booking_date <= ?'); params.push(to); }
  if (agency_id) { where.push('b.agency_id = ?'); params.push(agency_id); }
  if (center_id) { where.push('br.pub_center_id = ?'); params.push(center_id); }
  const rows = db.prepare(`
    SELECT b.id, b.booking_no, b.ad_type, b.booking_date, b.publish_date, b.ro_no, b.caption,
           b.gross_amount, b.trade_discount, b.addl_agency_comm, b.bill_amount, b.bill_to,
           a.name AS agency_name, COALESCE(c.name, b.client_name) AS client_name,
           (SELECT COUNT(*) FROM insertion i WHERE i.booking_id = b.id AND i.status='PUBLISHED') AS published_insertions
    FROM booking b
    LEFT JOIN agency a ON a.id = b.agency_id
    LEFT JOIN client c ON c.id = b.client_id
    LEFT JOIN branch br ON br.id = b.branch_id
    WHERE ${where.join(' AND ')} ORDER BY b.id DESC`).all(...params);
  res.json({ rows, rate_audit_required: rateAuditRequired() });
});

function nextBillNo() {
  const c = db.prepare('SELECT COUNT(*) c FROM bill').get().c;
  const yr = new Date().getFullYear().toString().slice(-2);
  return `BILL-${yr}-${1000 + c + 1}`;
}

/* generate bills for selected bookings */
router.post('/generate', (req, res) => {
  const { ids = [], tax_pct = 5 } = req.body || {};
  const today = new Date().toISOString().slice(0, 10);
  const created = [];
  for (const id of ids) {
    const b = db.prepare('SELECT * FROM booking WHERE id = ?').get(id);
    if (!b || b.bill_status === 'BILLED') continue;
    const insCount = db.prepare("SELECT COUNT(*) c FROM insertion WHERE booking_id = ? AND status='PUBLISHED'").get(id).c;
    const taxable = (b.gross_amount || 0) - (b.trade_discount || 0) - (b.addl_agency_comm || 0);
    const tax = +(taxable * (Number(tax_pct) || 0) / 100).toFixed(2);
    const bill_no = nextBillNo();
    db.prepare(`INSERT INTO bill (bill_no, bill_date, booking_id, agency_id, client_id, bill_to, insertions_count,
      gross_amount, trade_discount, addl_comm, tax_pct, tax_amount, net_amount, status, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      bill_no, today, id, b.agency_id, b.client_id, b.bill_to, insCount,
      b.gross_amount || 0, b.trade_discount || 0, b.addl_agency_comm || 0,
      Number(tax_pct) || 0, tax, +(taxable + tax).toFixed(2), 'ACTIVE', req.user.username);
    db.prepare("UPDATE booking SET bill_status='BILLED' WHERE id = ?").run(id);
    db.prepare("UPDATE insertion SET status='BILLED' WHERE booking_id = ? AND status='PUBLISHED'").run(id);
    log(req.user.username, 'Billing', 'GENERATE', bill_no, `Booking ${b.booking_no}`);
    created.push(bill_no);
  }
  res.json({ ok: true, bills: created });
});

/* bill register / list */
router.get('/bills', (req, res) => {
  const { from, to, agency_id, status, bill_no } = req.query;
  const where = []; const params = [];
  if (from) { where.push('bl.bill_date >= ?'); params.push(from); }
  if (to) { where.push('bl.bill_date <= ?'); params.push(to); }
  if (agency_id) { where.push('bl.agency_id = ?'); params.push(agency_id); }
  if (status) { where.push('bl.status = ?'); params.push(status); }
  if (bill_no) { where.push('bl.bill_no LIKE ?'); params.push(`%${bill_no}%`); }
  const rows = db.prepare(`
    SELECT bl.*, b.booking_no, b.ad_type, b.caption, b.ro_no,
           a.name AS agency_name, COALESCE(c.name, b.client_name) AS client_name
    FROM bill bl
    JOIN booking b ON b.id = bl.booking_id
    LEFT JOIN agency a ON a.id = bl.agency_id
    LEFT JOIN client c ON c.id = bl.client_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY bl.id DESC LIMIT 500`).all(...params);
  res.json(rows);
});

/* revised billing: cancel existing bill, regenerate with new number (8.2) */
router.post('/revise', (req, res) => {
  const { bill_no, tax_pct } = req.body || {};
  const old = db.prepare("SELECT * FROM bill WHERE bill_no = ? AND status = 'ACTIVE'").get(bill_no || '');
  if (!old) return res.status(404).json({ error: 'Active bill not found for this number' });
  db.prepare("UPDATE bill SET status='CANCELLED' WHERE id = ?").run(old.id);
  const b = db.prepare('SELECT * FROM booking WHERE id = ?').get(old.booking_id);
  const taxP = tax_pct != null ? Number(tax_pct) : old.tax_pct;
  const taxable = (b.gross_amount || 0) - (b.trade_discount || 0) - (b.addl_agency_comm || 0);
  const tax = +(taxable * taxP / 100).toFixed(2);
  const newNo = nextBillNo();
  db.prepare(`INSERT INTO bill (bill_no, bill_date, booking_id, agency_id, client_id, bill_to, insertions_count,
    gross_amount, trade_discount, addl_comm, tax_pct, tax_amount, net_amount, status, revised_from, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newNo, new Date().toISOString().slice(0, 10), b.id, b.agency_id, b.client_id, b.bill_to, old.insertions_count,
    b.gross_amount || 0, b.trade_discount || 0, b.addl_agency_comm || 0, taxP, tax, +(taxable + tax).toFixed(2),
    'ACTIVE', old.bill_no, req.user.username);
  log(req.user.username, 'Revised Billing', 'REVISE', newNo, `was ${old.bill_no}`);
  res.json({ ok: true, old_bill: old.bill_no, new_bill: newNo });
});

module.exports = router;
