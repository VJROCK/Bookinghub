/**
 * Report engine — all reports of section 6 of the manual, driven from one config.
 * Every report is based on the transaction tables (booking / insertion / bill)
 * joined with the masters.
 */
const express = require('express');
const { db } = require('../db');

const router = express.Router();

/* shared filter definitions */
const F = {
  from: { name: 'from', label: 'From Date', type: 'date' },
  to: { name: 'to', label: 'To Date', type: 'date' },
  ad_type: { name: 'ad_type', label: 'Ad Type', type: 'option', options: ['', 'DISPLAY', 'CLASSIFIED'] },
  agency: { name: 'agency_id', label: 'Agency', type: 'select', ref: 'agency' },
  client: { name: 'client_id', label: 'Client', type: 'select', ref: 'client' },
  publication: { name: 'publication_id', label: 'Publication', type: 'select', ref: 'publication' },
  edition: { name: 'edition_id', label: 'Edition', type: 'select', ref: 'edition' },
  center: { name: 'center_id', label: 'Publication Center', type: 'select', ref: 'pub_center' },
  branch: { name: 'branch_id', label: 'Branch', type: 'select', ref: 'branch' },
  category: { name: 'ad_category_id', label: 'Ad Category', type: 'select', ref: 'ad_category' },
  executive: { name: 'executive_id', label: 'Executive', type: 'select', ref: 'executive' },
  retainer: { name: 'retainer_id', label: 'Retainer', type: 'select', ref: 'retainer' },
  status: { name: 'status', label: 'Insertion Status', type: 'option', options: ['', 'BOOKED', 'PUBLISHED', 'BILLED', 'CANCELLED'] },
  date_based: { name: 'date_based', label: 'Date Based On', type: 'option', options: ['PUBLISH DATE', 'BOOKING DATE'] },
  rows: { name: 'top_n', label: 'No. of Rows', type: 'number' },
};

/* base insertion-level select used by most ad reports */
const INS_BASE = `
  FROM insertion i
  JOIN booking b ON b.id = i.booking_id
  LEFT JOIN edition e ON e.id = i.edition_id
  LEFT JOIN publication p ON p.id = e.publication_id
  LEFT JOIN agency a ON a.id = b.agency_id
  LEFT JOIN client c ON c.id = b.client_id
  LEFT JOIN ad_category cat ON cat.id = b.ad_category_id
  LEFT JOIN executive ex ON ex.id = b.executive_id
  LEFT JOIN retainer rt ON rt.id = b.retainer_id
  LEFT JOIN branch br ON br.id = b.branch_id
  LEFT JOIN color col ON col.id = b.color_id
  LEFT JOIN uom u ON u.id = b.uom_id
`;
const INS_COLS = `
  b.booking_no AS "Booking No", b.ro_no AS "RO No", b.ad_type AS "Ad Type",
  i.publish_date AS "Publish Date", e.alias AS "Edition", p.name AS "Publication",
  a.name AS "Agency", COALESCE(c.name, b.client_name) AS "Client",
  cat.name AS "Category", col.name AS "Color", u.name AS "UOM",
  b.caption AS "Caption", b.total_area AS "Area", b.no_of_lines AS "Lines",
  i.status AS "Status", i.amount AS "Amount"
`;

function insWhere(p, dateField = 'i.publish_date') {
  const where = ["b.status != 'CANCELLED'"]; const params = [];
  if (p.from) { where.push(`${dateField} >= ?`); params.push(p.from); }
  if (p.to) { where.push(`${dateField} <= ?`); params.push(p.to); }
  if (p.ad_type) { where.push('b.ad_type = ?'); params.push(p.ad_type); }
  if (p.agency_id) { where.push('b.agency_id = ?'); params.push(p.agency_id); }
  if (p.client_id) { where.push('b.client_id = ?'); params.push(p.client_id); }
  if (p.publication_id) { where.push('e.publication_id = ?'); params.push(p.publication_id); }
  if (p.edition_id) { where.push('i.edition_id = ?'); params.push(p.edition_id); }
  if (p.ad_category_id) { where.push('b.ad_category_id = ?'); params.push(p.ad_category_id); }
  if (p.executive_id) { where.push('b.executive_id = ?'); params.push(p.executive_id); }
  if (p.retainer_id) { where.push('b.retainer_id = ?'); params.push(p.retainer_id); }
  if (p.branch_id) { where.push('b.branch_id = ?'); params.push(p.branch_id); }
  if (p.center_id) { where.push('br.pub_center_id = ?'); params.push(p.center_id); }
  if (p.status) { where.push('i.status = ?'); params.push(p.status); }
  return { where: 'WHERE ' + where.join(' AND '), params };
}

const REPORTS = [
  /* ------------------- 6.1.1 AD REPORTS ------------------- */
  {
    id: 'all_ads_of_day', group: 'Ad Reports', title: 'All Ads of A Day', section: '6.1.1.1',
    help: 'Booking details based on publish date — insertions to be published on any date.',
    filters: [F.from, F.to, F.ad_type, F.publication, F.edition, F.category],
    run(p) { const w = insWhere(p); return db.prepare(`SELECT ${INS_COLS} ${INS_BASE} ${w.where} ORDER BY i.publish_date, e.alias`).all(...w.params); },
  },
  {
    id: 'ads_of_agency', group: 'Ad Reports', title: 'All Ads of the Agency', section: '6.1.1.2',
    filters: [F.from, F.to, F.agency, F.publication, F.category, F.ad_type],
    run(p) { const w = insWhere(p); w.where += ' AND b.agency_id IS NOT NULL'; return db.prepare(`SELECT ${INS_COLS} ${INS_BASE} ${w.where} ORDER BY a.name, i.publish_date`).all(...w.params); },
  },
  {
    id: 'ads_of_client', group: 'Ad Reports', title: 'All Ads of the Client', section: '6.1.1.3',
    filters: [F.from, F.to, F.client, F.publication, F.category, F.ad_type],
    run(p) { const w = insWhere(p); return db.prepare(`SELECT ${INS_COLS} ${INS_BASE} ${w.where} ORDER BY "Client", i.publish_date`).all(...w.params); },
  },
  {
    id: 'status_based_ads', group: 'Ad Reports', title: 'Status Based Ad List', section: '6.1.1.4',
    help: 'Insertions with status Booked / Published / Billed / Cancelled between two dates.',
    filters: [F.from, F.to, F.status, F.ad_type, F.publication],
    run(p) { const w = insWhere(p); return db.prepare(`SELECT ${INS_COLS} ${INS_BASE} ${w.where} ORDER BY i.status, i.publish_date`).all(...w.params); },
  },
  {
    id: 'deviation', group: 'Ad Reports', title: 'Deviation Report', section: '6.1.1.5',
    help: 'Bookings where the agreed/contract rate deviates from the card rate.',
    filters: [F.from, F.to, F.ad_type, F.agency],
    run(p) {
      const w = insWhere(p, 'b.booking_date');
      return db.prepare(`
        SELECT b.booking_no AS "Booking No", b.booking_date AS "Booking Date", a.name AS "Agency",
          COALESCE(c.name,b.client_name) AS "Client", b.card_rate AS "Card Rate",
          COALESCE(b.agreed_rate, b.contract_rate) AS "Agreed/Contract Rate",
          ROUND(b.card_rate - COALESCE(b.agreed_rate, b.contract_rate), 2) AS "Deviation",
          CASE WHEN b.card_rate > 0 THEN ROUND((b.card_rate - COALESCE(b.agreed_rate, b.contract_rate)) * 100.0 / b.card_rate, 2) END AS "Deviation %",
          b.gross_amount AS "Gross Amount"
        FROM booking b LEFT JOIN agency a ON a.id=b.agency_id LEFT JOIN client c ON c.id=b.client_id
        LEFT JOIN branch br ON br.id=b.branch_id
        ${w.where.replace(/i\./g, 'b.')} AND (b.agreed_rate IS NOT NULL OR b.contract_rate IS NOT NULL)
        ORDER BY b.booking_date DESC`).all(...w.params);
    },
  },
  {
    id: 'page_premium', group: 'Ad Reports', title: 'Page Premium Report', section: '6.1.1.6',
    help: 'Ads booked on premium pages for a period.',
    filters: [F.from, F.to, { name: 'premium_id', label: 'Page Premium', type: 'select', ref: 'ad_page_premium' }],
    run(p) {
      const where = ["b.page_premium_id IS NOT NULL", "b.status != 'CANCELLED'"]; const params = [];
      if (p.from) { where.push('b.publish_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.publish_date <= ?'); params.push(p.to); }
      if (p.premium_id) { where.push('b.page_premium_id = ?'); params.push(p.premium_id); }
      return db.prepare(`
        SELECT b.booking_no AS "Booking No", b.publish_date AS "Publish Date", pp.name AS "Premium Page",
          a.name AS "Agency", COALESCE(c.name,b.client_name) AS "Client", b.caption AS "Caption",
          b.premium_amount AS "Premium Amount", b.gross_amount AS "Gross Amount"
        FROM booking b JOIN ad_page_premium pp ON pp.id = b.page_premium_id
        LEFT JOIN agency a ON a.id=b.agency_id LEFT JOIN client c ON c.id=b.client_id
        WHERE ${where.join(' AND ')} ORDER BY b.publish_date`).all(...params);
    },
  },
  {
    id: 'issue_wise_business', group: 'Ad Reports', title: 'Issue Wise Business Report', section: '6.1.1.7',
    help: 'Edition wise net business between two dates.',
    filters: [F.from, F.to, F.publication, F.ad_type, F.center],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT p.name AS "Publication", e.alias AS "Edition", COUNT(i.id) AS "Total Ads",
          ROUND(SUM(i.amount),2) AS "Gross Business",
          ROUND(SUM(i.amount) - SUM(b.trade_discount * 1.0 / NULLIF((SELECT COUNT(*) FROM insertion x WHERE x.booking_id=b.id),0)), 2) AS "Net Business"
        ${INS_BASE} ${w.where} GROUP BY e.id ORDER BY "Net Business" DESC`).all(...w.params);
    },
  },
  {
    id: 'revenue_summary', group: 'Ad Reports', title: 'Revenue Summary Report', section: '6.1.1.8',
    help: 'Edition wise net and actual business (net less retainer/executive commission).',
    filters: [F.from, F.to, F.publication, F.ad_type],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT p.name AS "Publication", e.alias AS "Edition", COUNT(i.id) AS "Ads",
          ROUND(SUM(i.amount),2) AS "Gross",
          ROUND(SUM(i.amount) - SUM((b.trade_discount + b.addl_agency_comm) * 1.0 / NULLIF((SELECT COUNT(*) FROM insertion x WHERE x.booking_id=b.id),0)),2) AS "Net Amount",
          ROUND(SUM(i.amount) - SUM((b.trade_discount + b.addl_agency_comm + b.retainer_comm) * 1.0 / NULLIF((SELECT COUNT(*) FROM insertion x WHERE x.booking_id=b.id),0)),2) AS "Actual Business"
        ${INS_BASE} ${w.where} GROUP BY e.id ORDER BY "Net Amount" DESC`).all(...w.params);
    },
  },
  {
    id: 'top_agency_client', group: 'Ad Reports', title: 'Top Agency/Client Analysis', section: '6.1.1.9',
    filters: [F.from, F.to, { name: 'by', label: 'Analyze', type: 'option', options: ['AGENCY', 'CLIENT'] }, F.rows],
    run(p) {
      const w = insWhere(p);
      const grp = p.by === 'CLIENT' ? 'COALESCE(c.name, b.client_name)' : 'a.name';
      const lim = Number(p.top_n) || 10;
      return db.prepare(`
        SELECT ${grp} AS "${p.by === 'CLIENT' ? 'Client' : 'Agency'}", COUNT(DISTINCT b.id) AS "Bookings",
          COUNT(i.id) AS "Insertions", ROUND(SUM(i.amount),2) AS "Business"
        ${INS_BASE} ${w.where} AND ${grp} IS NOT NULL GROUP BY ${grp}
        ORDER BY "Business" DESC LIMIT ${lim}`).all(...w.params);
    },
  },
  {
    id: 'executive_wise', group: 'Ad Reports', title: 'Executive Wise Report', section: '6.1.1.10',
    help: 'Total area and gross amount booked by each executive per ad category.',
    filters: [F.from, F.to, F.executive],
    run(p) {
      const w = insWhere(p, 'b.booking_date');
      return db.prepare(`
        SELECT ex.name AS "Executive", cat.name AS "Ad Category", COUNT(DISTINCT b.id) AS "Bookings",
          ROUND(SUM(b.total_area),2) AS "Total Area", ROUND(SUM(b.gross_amount),2) AS "Gross Amount"
        FROM booking b LEFT JOIN executive ex ON ex.id=b.executive_id LEFT JOIN ad_category cat ON cat.id=b.ad_category_id
        LEFT JOIN branch br ON br.id = b.branch_id
        ${w.where.replace(/i\./g, 'b.')} AND b.executive_id IS NOT NULL
        GROUP BY ex.id, cat.id ORDER BY ex.name`).all(...w.params);
    },
  },
  {
    id: 'space_available', group: 'Ad Reports', title: 'Available Premium Date (Space Booked)', section: '6.1.1.11',
    help: 'Date wise space booked and space available per edition.',
    filters: [F.from, F.to, F.publication],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT i.publish_date AS "Date", e.alias AS "Edition", e.height*e.width AS "Page Area",
          ROUND(SUM(COALESCE(b.total_area,0)),2) AS "Space Booked",
          ROUND(e.height*e.width - SUM(COALESCE(b.total_area,0)),2) AS "Space Available (1 pg)"
        ${INS_BASE} ${w.where} AND i.status != 'CANCELLED'
        GROUP BY i.publish_date, e.id ORDER BY i.publish_date`).all(...w.params);
    },
  },
  {
    id: 'agency_category_wise', group: 'Ad Reports', title: 'Agency Category Wise Report', section: '6.1.1.12',
    filters: [F.from, F.to, { name: 'agency_type_id', label: 'Agency Type', type: 'select', ref: 'agency_type' }],
    run(p) {
      const where = ["b.status != 'CANCELLED'", 'b.agency_id IS NOT NULL']; const params = [];
      if (p.from) { where.push('i.publish_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('i.publish_date <= ?'); params.push(p.to); }
      if (p.agency_type_id) { where.push('a.agency_type_id = ?'); params.push(p.agency_type_id); }
      return db.prepare(`
        SELECT t.name AS "Agency Type", a.name AS "Agency", COUNT(i.id) AS "Insertions",
          ROUND(SUM(i.amount),2) AS "Business"
        FROM insertion i JOIN booking b ON b.id=i.booking_id
        JOIN agency a ON a.id=b.agency_id LEFT JOIN agency_type t ON t.id=a.agency_type_id
        WHERE ${where.join(' AND ')} GROUP BY a.id ORDER BY t.name, "Business" DESC`).all(...params);
    },
  },
  {
    id: 'status_daily_summary', group: 'Ad Reports', title: 'Status Wise Daily Summarized Report', section: '6.1.1.13',
    filters: [F.from, F.to, F.publication],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT i.publish_date AS "Date", i.status AS "Status", b.booking_type AS "Booking Type",
          COUNT(i.id) AS "Total Ads", ROUND(SUM(b.total_area),2) AS "Area", ROUND(SUM(i.amount),2) AS "Gross Amount"
        ${INS_BASE} ${w.where} GROUP BY i.publish_date, i.status, b.booking_type ORDER BY i.publish_date DESC`).all(...w.params);
    },
  },
  {
    id: 'deal_report', group: 'Ad Reports', title: 'Deal Report', section: '6.1.1.14',
    help: 'Contracts/deals with validity information.',
    filters: [F.from, F.to, F.ad_type, F.agency, F.client, { name: 'status', label: 'Status', type: 'option', options: ['', 'CONFIRM', 'RESERVATION', 'CLOSED'] }],
    run(p) {
      const where = ['1=1']; const params = [];
      if (p.from) { where.push('ct.valid_from >= ?'); params.push(p.from); }
      if (p.to) { where.push('ct.valid_to <= ?'); params.push(p.to); }
      if (p.agency_id) { where.push('ct.agency_id = ?'); params.push(p.agency_id); }
      if (p.client_id) { where.push('ct.client_id = ?'); params.push(p.client_id); }
      if (p.status) { where.push('ct.status = ?'); params.push(p.status); }
      return db.prepare(`
        SELECT ct.name AS "Deal/Contract", tp.name AS "Type", a.name AS "Agency", c.name AS "Client",
          ct.valid_from AS "Valid From", ct.valid_to AS "Valid To",
          CAST(julianday(ct.valid_to) - julianday(date('now')) AS INTEGER) AS "Days Remaining",
          ct.total_value AS "Value", ct.total_volume AS "Volume", ct.status AS "Status"
        FROM contract ct LEFT JOIN contract_type tp ON tp.id=ct.contract_type_id
        LEFT JOIN agency a ON a.id=ct.agency_id LEFT JOIN client c ON c.id=ct.client_id
        WHERE ${where.join(' AND ')} ORDER BY ct.valid_to`).all(...params);
    },
  },
  {
    id: 'unregistered_client', group: 'Ad Reports', title: 'Unregistered Client', section: '6.1.1.15',
    help: 'Walk-in clients entered at booking time without registration in Client master.',
    filters: [F.from, F.to, F.branch, F.ad_type],
    run(p) {
      const where = ['b.client_id IS NULL', 'b.client_name IS NOT NULL']; const params = [];
      if (p.from) { where.push('b.booking_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.booking_date <= ?'); params.push(p.to); }
      if (p.branch_id) { where.push('b.branch_id = ?'); params.push(p.branch_id); }
      if (p.ad_type) { where.push('b.ad_type = ?'); params.push(p.ad_type); }
      return db.prepare(`
        SELECT b.booking_no AS "Booking No", b.booking_date AS "Booking Date", b.client_name AS "Client Name",
          b.client_address AS "Address", b.client_mobile AS "Mobile", b.caption AS "Caption", b.gross_amount AS "Gross Amount"
        FROM booking b WHERE ${where.join(' AND ')} ORDER BY b.booking_date DESC`).all(...params);
    },
  },
  {
    id: 'box_register', group: 'Ad Reports', title: 'Box Register', section: '6.1.1.16',
    filters: [F.from, F.to],
    run(p) {
      const where = ['b.box_id IS NOT NULL']; const params = [];
      if (p.from) { where.push('b.booking_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.booking_date <= ?'); params.push(p.to); }
      return db.prepare(`
        SELECT b.booking_no AS "Booking No", b.box_no AS "Box No", bx.name AS "Box Type",
          b.box_address AS "Box Address", b.box_charges AS "Box Charges",
          a.name AS "Agency", COALESCE(c.name, b.client_name) AS "Client", b.publish_date AS "Publish Date"
        FROM booking b JOIN box bx ON bx.id=b.box_id
        LEFT JOIN agency a ON a.id=b.agency_id LEFT JOIN client c ON c.id=b.client_id
        WHERE ${where.join(' AND ')} ORDER BY b.booking_date DESC`).all(...params);
    },
  },
  {
    id: 'auditor_comment', group: 'Ad Reports', title: 'Auditor Comment', section: '6.1.1.17',
    filters: [F.from, F.to, F.ad_type, F.branch],
    run(p) {
      const where = ["(b.audit_comments IS NOT NULL OR b.rate_audit_comments IS NOT NULL)"]; const params = [];
      if (p.from) { where.push('b.booking_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.booking_date <= ?'); params.push(p.to); }
      if (p.ad_type) { where.push('b.ad_type = ?'); params.push(p.ad_type); }
      if (p.branch_id) { where.push('b.branch_id = ?'); params.push(p.branch_id); }
      return db.prepare(`
        SELECT b.booking_no AS "Booking No", b.audit_status AS "Audit Status", b.audit_by AS "Auditor",
          b.audit_comments AS "Audit Comments", b.rate_audit_status AS "Rate Audit", b.rate_audit_comments AS "Rate Audit Comments"
        FROM booking b WHERE ${where.join(' AND ')} ORDER BY b.id DESC`).all(...params);
    },
  },
  {
    id: 'ro_approval', group: 'Ad Reports', title: 'RO Approval Detail', section: '6.1.1.18',
    filters: [F.from, F.to],
    run(p) {
      const where = ['1=1']; const params = [];
      if (p.from) { where.push('b.booking_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.booking_date <= ?'); params.push(p.to); }
      return db.prepare(`
        SELECT b.booking_no AS "Booking No", b.ro_no AS "RO No", b.ro_date AS "RO Date", b.ro_status AS "RO Status",
          b.dockit_no AS "Dockit No", a.name AS "Agency", b.audit_status AS "Audit Status", b.gross_amount AS "Gross"
        FROM booking b LEFT JOIN agency a ON a.id=b.agency_id WHERE ${where.join(' AND ')} ORDER BY b.id DESC`).all(...params);
    },
  },
  {
    id: 'user_list', group: 'Ad Reports', title: 'User List Report', section: '6.1.1.19',
    filters: [{ name: 'status', label: 'Status', type: 'option', options: ['', 'ACTIVE', 'INACTIVE'] }],
    run(p) {
      const where = ['1=1']; const params = [];
      if (p.status) { where.push('u.status = ?'); params.push(p.status); }
      return db.prepare(`
        SELECT u.username AS "User Name", u.first_name AS "First Name", u.last_name AS "Last Name",
          u.email AS "Email", u.emp_code AS "Employee Code", r.name AS "Role Name",
          br.name AS "Branch", u.discount_allowed AS "Discount Allowed", u.status AS "Status"
        FROM users u LEFT JOIN user_role r ON r.id=u.role_id LEFT JOIN branch br ON br.id=u.branch_id
        WHERE ${where.join(' AND ')} ORDER BY u.username`).all(...params);
    },
  },
  {
    id: 'card_rate', group: 'Ad Reports', title: 'Card Rate Report', section: '6.1.1.20',
    filters: [F.from, F.to, F.ad_type, F.category, { name: 'package_id', label: 'Package', type: 'select', ref: 'package' }],
    run(p) {
      const where = ['1=1']; const params = [];
      if (p.from) { where.push('r.valid_to >= ?'); params.push(p.from); }
      if (p.to) { where.push('r.valid_from <= ?'); params.push(p.to); }
      if (p.ad_type) { where.push('t.name = ?'); params.push(p.ad_type); }
      if (p.ad_category_id) { where.push('r.ad_category_id = ?'); params.push(p.ad_category_id); }
      if (p.package_id) { where.push('r.package_id = ?'); params.push(p.package_id); }
      return db.prepare(`
        SELECT t.name AS "Ad Type", pk.name AS "Package/Edition", cat.name AS "Category",
          u.name AS "UOM", col.name AS "Color", rc.name AS "Rate Code",
          r.rate AS "Rate", r.min_rate AS "Min Rate", r.extra_rate AS "Extra Rate",
          r.weekend_rate AS "Weekend Rate", r.valid_from AS "Valid From", r.valid_to AS "Valid To"
        FROM rate_master r
        LEFT JOIN ad_type t ON t.id=r.ad_type_id LEFT JOIN package pk ON pk.id=r.package_id
        LEFT JOIN ad_category cat ON cat.id=r.ad_category_id LEFT JOIN uom u ON u.id=r.uom_id
        LEFT JOIN color col ON col.id=r.color_id LEFT JOIN rate_code rc ON rc.id=r.rate_code_id
        WHERE ${where.join(' AND ')} ORDER BY t.name, pk.name`).all(...params);
    },
  },

  /* ------------------- 6.1.2 MIS REPORTS ------------------- */
  {
    id: 'pi_report', group: 'MIS Reports', title: 'PI Report (Product Wise)', section: '6.1.2.1',
    help: 'Product wise advertisement booking revenue.',
    filters: [F.from, F.to, { name: 'product_id', label: 'Product', type: 'select', ref: 'product' }],
    run(p) {
      const where = ["b.status != 'CANCELLED'", 'b.product_id IS NOT NULL']; const params = [];
      if (p.from) { where.push('b.booking_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.booking_date <= ?'); params.push(p.to); }
      if (p.product_id) { where.push('b.product_id = ?'); params.push(p.product_id); }
      return db.prepare(`
        SELECT ind.name AS "Industry", pr.name AS "Product", brd.name AS "Brand",
          COUNT(b.id) AS "Bookings", ROUND(SUM(b.gross_amount),2) AS "Revenue Booked"
        FROM booking b JOIN product pr ON pr.id=b.product_id
        LEFT JOIN industry ind ON ind.id=pr.industry_id LEFT JOIN brand brd ON brd.id=b.brand_id
        WHERE ${where.join(' AND ')} GROUP BY pr.id, brd.id ORDER BY "Revenue Booked" DESC`).all(...params);
    },
  },
  {
    id: 'pi_contract', group: 'MIS Reports', title: 'PI Contract Report', section: '6.1.2.2',
    filters: [F.from, F.to],
    run(p) {
      const where = ['b.contract_id IS NOT NULL']; const params = [];
      if (p.from) { where.push('b.booking_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.booking_date <= ?'); params.push(p.to); }
      return db.prepare(`
        SELECT ct.name AS "Contract", ct.total_value AS "Contract Value",
          COUNT(b.id) AS "Bookings", ROUND(SUM(b.gross_amount),2) AS "Consumed",
          ROUND(ct.total_value - SUM(b.gross_amount),2) AS "Balance"
        FROM booking b JOIN contract ct ON ct.id=b.contract_id
        WHERE ${where.join(' AND ')} GROUP BY ct.id`).all(...params);
    },
  },
  {
    id: 'exec_retainer_business', group: 'MIS Reports', title: 'Executive / Retainer Wise Business', section: '6.1.2.3',
    filters: [F.from, F.to, { name: 'by', label: 'Report For', type: 'option', options: ['EXECUTIVE', 'RETAINER'] }],
    run(p) {
      const col = p.by === 'RETAINER' ? 'rt.name' : 'ex.name';
      const join = p.by === 'RETAINER' ? 'JOIN retainer rt ON rt.id=b.retainer_id' : 'JOIN executive ex ON ex.id=b.executive_id';
      const where = ["b.status != 'CANCELLED'"]; const params = [];
      if (p.from) { where.push('b.booking_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.booking_date <= ?'); params.push(p.to); }
      return db.prepare(`
        SELECT ${col} AS "${p.by === 'RETAINER' ? 'Retainer' : 'Executive'}",
          COUNT(b.id) AS "Bookings", ROUND(SUM(b.total_area),2) AS "Area",
          ROUND(SUM(b.gross_amount),2) AS "Gross Business", ROUND(SUM(b.retainer_comm),2) AS "Retainer Comm."
        FROM booking b ${join} WHERE ${where.join(' AND ')} GROUP BY ${col} ORDER BY "Gross Business" DESC`).all(...params);
    },
  },
  {
    id: 'issue_printing_center', group: 'MIS Reports', title: 'Issue Wise Printing Center Wise', section: '6.1.2.4',
    filters: [F.from, F.to],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT pc.name AS "Printing Center", p.name AS "Publication", e.alias AS "Edition",
          COUNT(i.id) AS "Total Ads", ROUND(SUM(i.amount),2) AS "Business"
        ${INS_BASE} LEFT JOIN pub_center pc ON pc.id = e.printing_center_id
        ${w.where} GROUP BY pc.id, e.id ORDER BY pc.name`).all(...w.params);
    },
  },
  {
    id: 'offline_mode', group: 'MIS Reports', title: 'Offline Mode (Payments) Report', section: '6.1.2.5',
    filters: [F.from, F.to],
    run(p) {
      const where = ['1=1']; const params = [];
      if (p.from) { where.push('p.date >= ?'); params.push(p.from); }
      if (p.to) { where.push('p.date <= ?'); params.push(p.to); }
      return db.prepare(`
        SELECT p.date AS "Date", b.booking_no AS "Booking No", a.name AS "Agency",
          b.gross_amount AS "Booking Amount", p.amount AS "Amount Received", p.mode AS "Mode",
          p.ref_no AS "Ref No", p.document AS "Document", b.bill_status AS "Booking Status"
        FROM payment p LEFT JOIN booking b ON b.id=p.booking_id LEFT JOIN agency a ON a.id=b.agency_id
        WHERE ${where.join(' AND ')} ORDER BY p.date DESC`).all(...params);
    },
  },
  {
    id: 'vts_report', group: 'MIS Reports', title: 'VTS Report', section: '6.1.2.6',
    filters: [F.from, F.to, F.agency, F.ad_type],
    run(p) {
      const where = ['b.vts_copies IS NOT NULL AND b.vts_copies > 0']; const params = [];
      if (p.from) { where.push('b.booking_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.booking_date <= ?'); params.push(p.to); }
      if (p.agency_id) { where.push('b.agency_id = ?'); params.push(p.agency_id); }
      if (p.ad_type) { where.push('b.ad_type = ?'); params.push(p.ad_type); }
      return db.prepare(`
        SELECT b.booking_no AS "Booking No", a.name AS "Agency", COALESCE(c.name,b.client_name) AS "Client",
          b.vts_copies AS "VTS Copies", b.no_of_invoices AS "No. of Invoices", b.publish_date AS "Publish Date"
        FROM booking b LEFT JOIN agency a ON a.id=b.agency_id LEFT JOIN client c ON c.id=b.client_id
        WHERE ${where.join(' AND ')} ORDER BY b.id DESC`).all(...params);
    },
  },
  {
    id: 'booking_report', group: 'MIS Reports', title: 'Booking Report', section: '6.1.2.7',
    filters: [F.from, F.to, F.agency, F.client, F.branch, F.edition],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`SELECT ${INS_COLS} ${INS_BASE} ${w.where} ORDER BY i.publish_date DESC`).all(...w.params);
    },
  },
  {
    id: 'issue_edition_wise', group: 'MIS Reports', title: 'Issue Edition Wise Report', section: '6.1.2.8',
    filters: [F.from, F.to, F.publication, F.edition],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT i.publish_date AS "Issue Date", p.name AS "Publication", e.alias AS "Edition",
          COUNT(i.id) AS "Ads", ROUND(SUM(i.amount),2) AS "Amount"
        ${INS_BASE} ${w.where} GROUP BY i.publish_date, e.id ORDER BY i.publish_date DESC`).all(...w.params);
    },
  },
  {
    id: 'category_wise', group: 'MIS Reports', title: 'Category Wise Report', section: '6.1.2.9',
    filters: [F.from, F.to, F.ad_type, F.category, F.executive],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT b.ad_type AS "Ad Type", cat.name AS "Category", sc.name AS "Sub Category",
          COUNT(i.id) AS "Insertions", ROUND(SUM(i.amount),2) AS "Business"
        ${INS_BASE} LEFT JOIN ad_sub_category sc ON sc.id = b.ad_sub_category_id
        ${w.where} GROUP BY b.ad_type, cat.id, sc.id ORDER BY "Business" DESC`).all(...w.params);
    },
  },

  /* ------------------- 6.1.3 SCHEDULE REGISTER ------------------- */
  {
    id: 'schedule_register', group: 'Schedule Register', title: 'Schedule Register', section: '6.1.3.1',
    help: 'Insertions scheduled before publishing — check ads before production day.',
    filters: [F.from, F.to, F.publication, F.edition, F.ad_type],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT i.publish_date AS "Publish Date", e.alias AS "Edition", b.booking_no AS "Booking No",
          b.ro_no AS "RO No", cat.name AS "Category", col.name AS "Color",
          b.height AS "Height", b.width AS "Width", b.no_of_columns AS "Columns", b.no_of_lines AS "Lines",
          b.page_no AS "Page", a.name AS "Agency", COALESCE(c.name,b.client_name) AS "Client",
          b.caption AS "Caption", i.status AS "Status"
        ${INS_BASE} ${w.where} AND i.status IN ('BOOKED','PUBLISHED')
        ORDER BY i.publish_date, e.alias, b.page_no`).all(...w.params);
    },
  },
  {
    id: 'complete_report', group: 'Schedule Register', title: 'Complete Report (Dynamic)', section: '6.1.3.2',
    help: 'Full booking + billing dump — export to CSV for any custom analysis.',
    filters: [F.from, F.to, F.ad_type],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT ${INS_COLS}, b.booking_date AS "Booking Date", b.booking_type AS "Booking Type",
          b.card_rate AS "Card Rate", b.agreed_rate AS "Agreed Rate", b.gross_amount AS "Booking Gross",
          b.trade_discount AS "Trade Discount", b.bill_amount AS "Bill Amount", b.bill_status AS "Bill Status",
          ex.name AS "Executive", rt.name AS "Retainer", br.name AS "Branch"
        ${INS_BASE} ${w.where} ORDER BY i.publish_date DESC`).all(...w.params);
    },
  },
  {
    id: 'net_amount', group: 'Schedule Register', title: 'Net Amount Report (Pivot)', section: '6.1.3.3',
    help: 'Choose Row and Column dimensions — business amount pivot.',
    filters: [F.from, F.to,
      { name: 'row_dim', label: 'Row Name', type: 'option', options: ['AGENCY', 'CLIENT', 'EDITION', 'CATEGORY', 'EXECUTIVE'] },
      { name: 'col_dim', label: 'Column', type: 'option', options: ['AD TYPE', 'STATUS', 'MONTH'] }],
    run(p) {
      const dims = {
        AGENCY: "COALESCE(a.name,'(none)')", CLIENT: "COALESCE(c.name, b.client_name,'(none)')",
        EDITION: "COALESCE(e.alias,'(none)')", CATEGORY: "COALESCE(cat.name,'(none)')", EXECUTIVE: "COALESCE(ex.name,'(none)')",
      };
      const cols = { 'AD TYPE': 'b.ad_type', STATUS: 'i.status', MONTH: "strftime('%Y-%m', i.publish_date)" };
      const rd = dims[p.row_dim] || dims.AGENCY;
      const cd = cols[p.col_dim] || cols['AD TYPE'];
      const w = insWhere(p);
      const raw = db.prepare(`
        SELECT ${rd} AS rname, ${cd} AS cname, ROUND(SUM(i.amount),2) AS amt
        ${INS_BASE} ${w.where} GROUP BY rname, cname`).all(...w.params);
      const colVals = [...new Set(raw.map((r) => r.cname))].sort();
      const rowsMap = new Map();
      for (const r of raw) {
        if (!rowsMap.has(r.rname)) rowsMap.set(r.rname, { [p.row_dim || 'AGENCY']: r.rname });
        rowsMap.get(r.rname)[r.cname || '(none)'] = r.amt;
      }
      for (const row of rowsMap.values()) {
        row.Total = colVals.reduce((s, cv) => s + (row[cv] || 0), 0);
      }
      return [...rowsMap.values()];
    },
  },
  {
    id: 'ro_report', group: 'Schedule Register', title: 'RO Report', section: '6.1.3.4',
    filters: [F.from, F.to, F.agency],
    run(p) {
      const where = ['b.ro_no IS NOT NULL']; const params = [];
      if (p.from) { where.push('b.ro_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.ro_date <= ?'); params.push(p.to); }
      if (p.agency_id) { where.push('b.agency_id = ?'); params.push(p.agency_id); }
      return db.prepare(`
        SELECT b.ro_no AS "RO No", b.ro_date AS "RO Date", b.ro_status AS "RO Status", b.booking_no AS "Booking No",
          a.name AS "Agency", COALESCE(c.name,b.client_name) AS "Client", b.publish_date AS "First Publish",
          b.no_of_insertions AS "Insertions", b.gross_amount AS "Gross Amount"
        FROM booking b LEFT JOIN agency a ON a.id=b.agency_id LEFT JOIN client c ON c.id=b.client_id
        WHERE ${where.join(' AND ')} ORDER BY b.ro_date DESC`).all(...params);
    },
  },
  {
    id: 'attendance_register', group: 'Schedule Register', title: 'Attendance Register', section: '6.1.3.5',
    help: 'Which ads attended (appeared) edition wise between two dates.',
    filters: [F.from, F.to, F.ad_type, F.publication, F.edition, F.branch],
    run(p) {
      const w = insWhere(p);
      return db.prepare(`
        SELECT e.alias AS "Edition", i.publish_date AS "Date",
          SUM(CASE WHEN i.status IN ('PUBLISHED','BILLED') THEN 1 ELSE 0 END) AS "Published",
          SUM(CASE WHEN i.status = 'BOOKED' THEN 1 ELSE 0 END) AS "Pending",
          SUM(CASE WHEN i.status = 'CANCELLED' THEN 1 ELSE 0 END) AS "Cancelled",
          COUNT(i.id) AS "Total"
        ${INS_BASE} ${w.where} GROUP BY e.id, i.publish_date ORDER BY i.publish_date DESC`).all(...w.params);
    },
  },

  /* ------------------- 6.1.4 BILLING REPORTS ------------------- */
  {
    id: 'billing_register', group: 'Billing Reports', title: 'Billing Register', section: '6.1.4.1',
    filters: [F.from, F.to, F.agency, { name: 'status', label: 'Bill Status', type: 'option', options: ['', 'ACTIVE', 'CANCELLED'] }],
    run(p) {
      const where = ['1=1']; const params = [];
      if (p.from) { where.push('bl.bill_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('bl.bill_date <= ?'); params.push(p.to); }
      if (p.agency_id) { where.push('bl.agency_id = ?'); params.push(p.agency_id); }
      if (p.status) { where.push('bl.status = ?'); params.push(p.status); }
      return db.prepare(`
        SELECT bl.bill_no AS "Bill No", bl.bill_date AS "Bill Date", b.booking_no AS "Booking No", b.ro_no AS "RO No",
          a.name AS "Agency", COALESCE(c.name,b.client_name) AS "Client", bl.insertions_count AS "Insertions",
          bl.gross_amount AS "Gross", bl.trade_discount AS "Trade Disc", bl.tax_amount AS "Tax",
          bl.net_amount AS "Net Amount", bl.status AS "Status", bl.revised_from AS "Revised From"
        FROM bill bl JOIN booking b ON b.id=bl.booking_id
        LEFT JOIN agency a ON a.id=bl.agency_id LEFT JOIN client c ON c.id=bl.client_id
        WHERE ${where.join(' AND ')} ORDER BY bl.id DESC`).all(...params);
    },
  },
  {
    id: 'booking_type_billing', group: 'Billing Reports', title: 'Booking Type Wise Report', section: '6.1.4.2',
    filters: [F.from, F.to],
    run(p) {
      const where = ["bl.status = 'ACTIVE'"]; const params = [];
      if (p.from) { where.push('bl.bill_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('bl.bill_date <= ?'); params.push(p.to); }
      return db.prepare(`
        SELECT b.booking_type AS "Booking Type", COUNT(bl.id) AS "Bills",
          ROUND(SUM(bl.gross_amount),2) AS "Gross", ROUND(SUM(bl.net_amount),2) AS "Net"
        FROM bill bl JOIN booking b ON b.id=bl.booking_id
        WHERE ${where.join(' AND ')} GROUP BY b.booking_type`).all(...params);
    },
  },
  {
    id: 'rebate_report', group: 'Billing Reports', title: 'Rebate Report', section: '6.1.4.3',
    help: 'All bookings where discount was given to the customer.',
    filters: [F.from, F.to],
    run(p) {
      const where = ['(b.discount > 0 OR b.special_discount > 0 OR b.space_discount > 0)']; const params = [];
      if (p.from) { where.push('b.booking_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('b.booking_date <= ?'); params.push(p.to); }
      return db.prepare(`
        SELECT b.booking_no AS "Booking No", b.booking_date AS "Date", a.name AS "Agency",
          COALESCE(c.name,b.client_name) AS "Client", b.card_amount AS "Card Amount",
          b.discount AS "Discount", b.discount_pct AS "Discount %",
          b.special_discount AS "Special Discount", b.space_discount AS "Space Discount", b.gross_amount AS "Gross"
        FROM booking b LEFT JOIN agency a ON a.id=b.agency_id LEFT JOIN client c ON c.id=b.client_id
        WHERE ${where.join(' AND ')} ORDER BY b.booking_date DESC`).all(...params);
    },
  },
  {
    id: 'retainer_commission', group: 'Billing Reports', title: 'Retainer Commission Report', section: '6.1.4.4',
    filters: [F.from, F.to, F.retainer],
    run(p) {
      const where = ['b.retainer_id IS NOT NULL', "bl.status='ACTIVE'"]; const params = [];
      if (p.from) { where.push('bl.bill_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('bl.bill_date <= ?'); params.push(p.to); }
      if (p.retainer_id) { where.push('b.retainer_id = ?'); params.push(p.retainer_id); }
      return db.prepare(`
        SELECT rt.name AS "Retainer", bl.bill_no AS "Bill No", bl.bill_date AS "Bill Date",
          b.booking_no AS "Booking No", bl.net_amount AS "Bill Amount", b.retainer_comm AS "Commission"
        FROM bill bl JOIN booking b ON b.id=bl.booking_id JOIN retainer rt ON rt.id=b.retainer_id
        WHERE ${where.join(' AND ')} ORDER BY rt.name, bl.bill_date`).all(...params);
    },
  },
  {
    id: 'money_receive', group: 'Billing Reports', title: 'Money Receive Report', section: '6.1.4.5',
    help: 'Cash received — end of day cashier summary.',
    filters: [F.from, F.to, { name: 'user', label: 'User', type: 'text' }],
    run(p) {
      const where = ['1=1']; const params = [];
      if (p.from) { where.push('p.date >= ?'); params.push(p.from); }
      if (p.to) { where.push('p.date <= ?'); params.push(p.to); }
      if (p.user) { where.push('p.received_by LIKE ?'); params.push(`%${p.user}%`); }
      return db.prepare(`
        SELECT p.date AS "Date", p.received_by AS "Received By", p.mode AS "Mode",
          COUNT(p.id) AS "Receipts", ROUND(SUM(p.amount),2) AS "Amount"
        FROM payment p WHERE ${where.join(' AND ')} GROUP BY p.date, p.received_by, p.mode ORDER BY p.date DESC`).all(...params);
    },
  },
  {
    id: 'datewise_billing', group: 'Billing Reports', title: 'Date Wise Billing Report', section: '6.1.4.6',
    filters: [F.from, F.to, F.ad_type],
    run(p) {
      const where = ["bl.status='ACTIVE'"]; const params = [];
      if (p.from) { where.push('bl.bill_date >= ?'); params.push(p.from); }
      if (p.to) { where.push('bl.bill_date <= ?'); params.push(p.to); }
      if (p.ad_type) { where.push('b.ad_type = ?'); params.push(p.ad_type); }
      return db.prepare(`
        SELECT bl.bill_date AS "Bill Date", b.ad_type AS "Ad Type", COUNT(bl.id) AS "Bills",
          ROUND(SUM(bl.gross_amount),2) AS "Gross", ROUND(SUM(bl.tax_amount),2) AS "Tax", ROUND(SUM(bl.net_amount),2) AS "Net"
        FROM bill bl JOIN booking b ON b.id=bl.booking_id
        WHERE ${where.join(' AND ')} GROUP BY bl.bill_date, b.ad_type ORDER BY bl.bill_date DESC`).all(...params);
    },
  },
  {
    id: 'week_pub_revenue', group: 'Billing Reports', title: 'Week Wise & Publication Wise Revenue', section: '6.1.4.7',
    filters: [F.from, F.to, F.publication, F.date_based],
    run(p) {
      const df = p.date_based === 'BOOKING DATE' ? 'b.booking_date' : 'i.publish_date';
      const w = insWhere(p, df);
      return db.prepare(`
        SELECT strftime('%Y-W%W', ${df}) AS "Week", p.name AS "Publication",
          COUNT(i.id) AS "Insertions", ROUND(SUM(i.amount),2) AS "Revenue"
        ${INS_BASE} ${w.where} GROUP BY "Week", p.id ORDER BY "Week" DESC`).all(...w.params);
    },
  },
];

router.get('/_meta', (_req, res) => {
  res.json(REPORTS.map(({ id, group, title, section, help, filters }) => ({ id, group, title, section, help, filters })));
});

router.post('/:id', (req, res) => {
  const r = REPORTS.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Unknown report' });
  try {
    const rows = r.run(req.body || {});
    res.json({ title: r.title, rows });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
