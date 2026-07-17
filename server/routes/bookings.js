/** Booking transactions: display/classified/QBC bookings, confirm, audits, publish, ad search. */
const express = require('express');
const { db, log } = require('../db');
const { saveBooking, pickRate, pickContractRate, computeAmounts } = require('../bookingEngine');

const router = express.Router();

const BOOKING_LIST_SQL = `
  SELECT b.*, a.name AS agency_name, c.name AS client_master_name,
         cat.name AS category_name, e.name AS executive_name, r.name AS retainer_name,
         br.name AS branch_name, col.name AS color_name, u.name AS uom_name
  FROM booking b
  LEFT JOIN agency a ON a.id = b.agency_id
  LEFT JOIN client c ON c.id = b.client_id
  LEFT JOIN ad_category cat ON cat.id = b.ad_category_id
  LEFT JOIN executive e ON e.id = b.executive_id
  LEFT JOIN retainer r ON r.id = b.retainer_id
  LEFT JOIN branch br ON br.id = b.branch_id
  LEFT JOIN color col ON col.id = b.color_id
  LEFT JOIN uom u ON u.id = b.uom_id
`;

/* ---------- rate helper for the booking form ---------- */
router.post('/get-rate', (req, res) => {
  const b = req.body || {};
  const rate = pickRate({
    ad_type: b.ad_type, ad_category_id: b.ad_category_id,
    package_id: (b.package_ids || [])[0] || b.package_id,
    uom_id: b.uom_id, color_id: b.color_id, date: b.publish_date || b.booking_date, qty: b.qty,
  });
  const contract_rate = b.contract_id ? pickContractRate({
    contract_id: b.contract_id, ad_category_id: b.ad_category_id,
    package_id: (b.package_ids || [])[0] || b.package_id, color_id: b.color_id,
  }) : null;
  const amounts = computeAmounts(b);
  res.json({ rate: rate || null, contract_rate, amounts });
});

/* ---------- agency / client info panel for booking header ---------- */
router.get('/party-info', (req, res) => {
  const out = {};
  if (req.query.agency_id) {
    const a = db.prepare(`
      SELECT a.*, t.name AS type_name, t.credit_days AS type_credit_days, t.commission_rate,
             pa.name AS parent_name
      FROM agency a LEFT JOIN agency_type t ON t.id = a.agency_type_id
      LEFT JOIN agency pa ON pa.id = a.ac_agency_id
      WHERE a.id = ?`).get(req.query.agency_id);
    if (a) {
      const paymodes = db.prepare('SELECT p.name FROM agency_paymode ap JOIN payment_mode p ON p.id = ap.payment_mode_id WHERE ap.parent_id = ?').all(a.id).map((r) => r.name);
      const outstanding = db.prepare(`
        SELECT COALESCE(SUM(bl.net_amount),0) o FROM bill bl WHERE bl.agency_id = ? AND bl.status='ACTIVE'`).get(a.id).o;
      const credit = db.prepare('SELECT balance FROM agency_credit WHERE agency_id = ? ORDER BY date DESC LIMIT 1').get(a.id);
      out.agency = {
        id: a.id, name: a.name, address: [a.address1, a.address2, a.street].filter(Boolean).join(', '),
        type: a.type_name, status: a.status, credit_days: a.credit_days || a.type_credit_days,
        commission_rate: a.commission_rate, paymode: paymodes.join(', '),
        outstanding: credit ? credit.balance : outstanding, alert: a.alert,
        parent: a.parent_name || a.name,
      };
      const contracts = db.prepare(`SELECT id, name, contract_type_id FROM contract WHERE agency_id = ? AND (valid_to IS NULL OR valid_to >= date('now'))`).all(a.id);
      out.contracts = contracts;
    }
  }
  if (req.query.client_id) {
    const c = db.prepare('SELECT * FROM client WHERE id = ?').get(req.query.client_id);
    if (c) {
      out.client = { id: c.id, name: c.name, address: [c.address1, c.street].filter(Boolean).join(', '), status: c.status, alert: c.alert };
      out.client_products = db.prepare('SELECT product_id, executive_id FROM client_product WHERE parent_id = ?').all(c.id);
      out.client_brands = db.prepare('SELECT product_id, brand_id, executive_id FROM client_brand WHERE parent_id = ?').all(c.id);
    }
  }
  res.json(out);
});

/* ---------- list / search ---------- */
router.get('/', (req, res) => {
  const { ad_type, source, status, ro_status, audit_status, rate_audit_status, bill_status,
    agency_id, client_id, from, to, date_field = 'booking_date', q, branch_id, limit = 300 } = req.query;
  const where = []; const params = [];
  if (ad_type) { where.push('b.ad_type = ?'); params.push(ad_type); }
  if (source) { where.push('b.source = ?'); params.push(source); }
  if (status) { where.push('b.status = ?'); params.push(status); }
  if (ro_status) { where.push('b.ro_status = ?'); params.push(ro_status); }
  if (audit_status) { where.push('b.audit_status = ?'); params.push(audit_status); }
  if (rate_audit_status) { where.push('b.rate_audit_status = ?'); params.push(rate_audit_status); }
  if (bill_status) { where.push('b.bill_status = ?'); params.push(bill_status); }
  if (agency_id) { where.push('b.agency_id = ?'); params.push(agency_id); }
  if (client_id) { where.push('b.client_id = ?'); params.push(client_id); }
  if (branch_id) { where.push('b.branch_id = ?'); params.push(branch_id); }
  const df = ['booking_date', 'publish_date', 'ro_date'].includes(date_field) ? date_field : 'booking_date';
  if (from) { where.push(`b.${df} >= ?`); params.push(from); }
  if (to) { where.push(`b.${df} <= ?`); params.push(to); }
  if (q) {
    where.push('(b.booking_no LIKE ? OR b.ro_no LIKE ? OR b.caption LIKE ? OR b.matter LIKE ? OR b.client_name LIKE ? OR a.name LIKE ? OR c.name LIKE ?)');
    for (let i = 0; i < 7; i++) params.push(`%${q}%`);
  }
  const rows = db.prepare(`${BOOKING_LIST_SQL} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.id DESC LIMIT ?`).all(...params, Number(limit));
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${BOOKING_LIST_SQL} WHERE b.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Booking not found' });
  row.package_ids = db.prepare('SELECT package_id FROM booking_package WHERE booking_id = ?').all(row.id).map((r) => r.package_id);
  row.insertions = db.prepare(`
    SELECT i.*, e.name AS edition_name, e.alias AS edition_alias
    FROM insertion i LEFT JOIN edition e ON e.id = i.edition_id
    WHERE i.booking_id = ? ORDER BY i.publish_date`).all(row.id);
  res.json(row);
});

/* ---------- create / modify ---------- */
router.post('/', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.ad_type) return res.status(400).json({ error: 'Ad type is mandatory' });
    if (!b.agency_id && !b.client_id && !b.client_name) return res.status(400).json({ error: 'Select an Agency or Client (or enter walk-in client name)' });
    if (!b.publish_date) return res.status(400).json({ error: 'Publish Date is mandatory' });
    if (!(b.package_ids || []).length) return res.status(400).json({ error: 'Select at least one Package/Edition' });
    if (b.ro_date && b.booking_date && b.ro_date > b.booking_date) return res.status(400).json({ error: 'RO Date should be less than or equal to Booking Date' });

    // walk-in client registration (manual 5.1.1)
    if (!b.client_id && b.client_name && b.register_client) {
      const info = db.prepare('INSERT INTO client (name, address1, phone, status) VALUES (?,?,?,?)')
        .run(b.client_name.toUpperCase(), b.client_address || null, b.client_mobile || null, 'ACTIVE');
      b.client_id = Number(info.lastInsertRowid);
    }
    const result = saveBooking(b, req.user.username);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

/* MIS updation (5.13) / CD upload (5.16): correct reference fields without re-booking */
router.patch('/:id/mis', (req, res) => {
  const allowed = ['executive_id', 'retainer_id', 'product_id', 'brand_id', 'variant_id', 'campaign',
    'caption', 'page_no', 'page_type_id', 'material_status', 'matter', 'print_remark', 'key_no'];
  const sets = []; const vals = [];
  for (const k of allowed) if (req.body[k] !== undefined) { sets.push(`${k} = ?`); vals.push(req.body[k] === '' ? null : req.body[k]); }
  if (!sets.length) return res.json({ ok: true });
  db.prepare(`UPDATE booking SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id);
  log(req.user.username, 'Mis Updation', 'MODIFY', req.params.id, sets.join(','));
  res.json({ ok: true });
});

router.post('/:id/cancel', (req, res) => {
  db.prepare("UPDATE booking SET status='CANCELLED' WHERE id = ?").run(req.params.id);
  db.prepare("UPDATE insertion SET status='CANCELLED' WHERE booking_id = ? AND status = 'BOOKED'").run(req.params.id);
  log(req.user.username, 'Booking', 'CANCEL', req.params.id, '');
  res.json({ ok: true });
});

/* ---------- confirm / unconfirm ROs (5.5) ---------- */
router.post('/confirm', (req, res) => {
  const { ids = [], action = 'CONFIRM' } = req.body || {};
  const st = action === 'CONFIRM' ? 'CONFIRM' : 'RESERVATION';
  const stmt = db.prepare('UPDATE booking SET ro_status = ? WHERE id = ?');
  for (const id of ids) { stmt.run(st, id); log(req.user.username, 'Confirm Ads', action, id, ''); }
  res.json({ ok: true, count: ids.length });
});

/* ---------- booking audit (5.6) ---------- */
router.post('/audit', (req, res) => {
  const { ids = [], action = 'AUDIT', comments } = req.body || {};
  const st = action === 'AUDIT' ? 'AUDITED' : 'UNAUDITED';
  const stmt = db.prepare('UPDATE booking SET audit_status = ?, audit_by = ?, audit_comments = COALESCE(?, audit_comments) WHERE id = ?');
  for (const id of ids) { stmt.run(st, req.user.username, comments || null, id); log(req.user.username, 'Booking Audit', action, id, comments || ''); }
  res.json({ ok: true, count: ids.length });
});

/* ---------- publish audit (5.7): insertion level ---------- */
router.get('/insertions/list', (req, res) => {
  const { status, from, to, edition_id, ad_type, publication_id } = req.query;
  const where = []; const params = [];
  if (status) { where.push('i.status = ?'); params.push(status); }
  if (from) { where.push('i.publish_date >= ?'); params.push(from); }
  if (to) { where.push('i.publish_date <= ?'); params.push(to); }
  if (edition_id) { where.push('i.edition_id = ?'); params.push(edition_id); }
  if (ad_type) { where.push('b.ad_type = ?'); params.push(ad_type); }
  if (publication_id) { where.push('e.publication_id = ?'); params.push(publication_id); }
  const rows = db.prepare(`
    SELECT i.*, b.booking_no, b.caption, b.ad_type, b.ro_no, e.name AS edition_name, e.alias AS edition_alias,
           a.name AS agency_name, COALESCE(c.name, b.client_name) AS client_name
    FROM insertion i
    JOIN booking b ON b.id = i.booking_id
    LEFT JOIN edition e ON e.id = i.edition_id
    LEFT JOIN agency a ON a.id = b.agency_id
    LEFT JOIN client c ON c.id = b.client_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY i.publish_date DESC LIMIT 500`).all(...params);
  res.json(rows);
});

router.post('/insertions/status', (req, res) => {
  const { ids = [], status } = req.body || {};
  if (!['BOOKED', 'PUBLISHED', 'CANCELLED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const stmt = db.prepare('UPDATE insertion SET status = ? WHERE id = ?');
  for (const id of ids) stmt.run(status, id);
  log(req.user.username, 'Publish Audit', status, ids.join(','), '');
  res.json({ ok: true, count: ids.length });
});

/* ---------- rate audit (5.8) ---------- */
router.post('/rate-audit', (req, res) => {
  const { ids = [], action = 'PASS', comments } = req.body || {};
  const st = action === 'PASS' ? 'PASSED' : action === 'REJECT' ? 'REJECTED' : 'PENDING';
  const stmt = db.prepare('UPDATE booking SET rate_audit_status = ?, rate_audit_by = ?, rate_audit_comments = COALESCE(?, rate_audit_comments) WHERE id = ?');
  for (const id of ids) { stmt.run(st, req.user.username, comments || null, id); log(req.user.username, 'Rate Audit', st, id, comments || ''); }
  res.json({ ok: true });
});

/* ---------- follow ups (5.12) ---------- */
router.get('/followups/list', (req, res) => {
  const { from, to } = req.query;
  const where = []; const params = [];
  if (from) { where.push('f.date >= ?'); params.push(from); }
  if (to) { where.push('f.date <= ?'); params.push(to); }
  const rows = db.prepare(`
    SELECT f.*, a.name AS agency_name, c.name AS client_name, b.booking_no
    FROM follow_up f LEFT JOIN agency a ON a.id = f.agency_id
    LEFT JOIN client c ON c.id = f.client_id LEFT JOIN booking b ON b.id = f.booking_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY f.date DESC`).all(...params);
  res.json(rows);
});

router.post('/followups', (req, res) => {
  const { date, agency_id, client_id, booking_id, remarks, next_date } = req.body || {};
  const info = db.prepare('INSERT INTO follow_up (date, agency_id, client_id, booking_id, remarks, next_date) VALUES (?,?,?,?,?,?)')
    .run(date || new Date().toISOString().slice(0, 10), agency_id || null, client_id || null, booking_id || null, remarks || null, next_date || null);
  res.json({ id: Number(info.lastInsertRowid) });
});

router.post('/followups/:id/close', (req, res) => {
  db.prepare("UPDATE follow_up SET status='CLOSED' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------- payments (5.4 payment gateway, simplified offline register) ---------- */
router.get('/payments/list', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, b.booking_no, a.name AS agency_name FROM payment p
    LEFT JOIN booking b ON b.id = p.booking_id LEFT JOIN agency a ON a.id = b.agency_id
    ORDER BY p.date DESC LIMIT 300`).all();
  res.json(rows);
});

router.post('/payments', (req, res) => {
  const { booking_id, bill_id, date, mode, amount, ref_no, bank, document } = req.body || {};
  const info = db.prepare('INSERT INTO payment (booking_id, bill_id, date, mode, amount, ref_no, bank, document, received_by) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(booking_id || null, bill_id || null, date || new Date().toISOString().slice(0, 10), mode || 'CASH', amount || 0, ref_no || null, bank || null, document || null, req.user.username);
  log(req.user.username, 'Payment Gateway', 'RECEIVE', info.lastInsertRowid, `Amount:${amount}`);
  res.json({ id: Number(info.lastInsertRowid) });
});

module.exports = router;
