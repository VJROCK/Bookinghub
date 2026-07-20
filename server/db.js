/**
 * BookingHub database layer.
 * Uses better-sqlite3 — works both locally and on Vercel Serverless Functions.
 * Master tables are generated from mastersConfig.js; transaction/system tables are defined here.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { MASTERS } = require('./mastersConfig');

/* On Vercel serverless, the bundled filesystem is read-only.
   We copy the DB to /tmp so SQLite can open it in WAL mode.            */
const IS_SERVERLESS = !!process.env.VERCEL;
const BUNDLED_DB = path.join(__dirname, 'db', 'bookinghub.sqlite');
const TMP_DB = '/tmp/bookinghub.sqlite';

let DB_PATH;
if (IS_SERVERLESS) {
  if (!fs.existsSync(TMP_DB) && fs.existsSync(BUNDLED_DB)) {
    fs.copyFileSync(BUNDLED_DB, TMP_DB);
  }
  DB_PATH = TMP_DB;
} else {
  DB_PATH = process.env.BOOKINGHUB_DB || path.join(__dirname, 'db', 'bookinghub.sqlite');
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


const colType = (t) => (t === 'number' ? 'REAL' : t === 'check' ? 'INTEGER' : t === 'select' ? 'INTEGER' : 'TEXT');

function createMasterTables() {
  for (const m of MASTERS) {
    const cols = m.fields.map((fl) => `${fl.name} ${colType(fl.type)}`).join(', ');
    db.exec(`CREATE TABLE IF NOT EXISTS ${m.key} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${cols}, created_at TEXT DEFAULT (datetime('now')))`);
    for (const c of m.children || []) {
      const ccols = c.fields.map((fl) => `${fl.name} ${colType(fl.type)}`).join(', ');
      db.exec(`CREATE TABLE IF NOT EXISTS ${c.table} (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER NOT NULL, ${ccols}, created_at TEXT DEFAULT (datetime('now')))`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${c.table}_parent ON ${c.table}(parent_id)`);
    }
  }
}

function createSystemTables() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT, last_name TEXT, email TEXT, emp_code TEXT,
    agency_id INTEGER, branch_id INTEGER, currency_id INTEGER,
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    company_id INTEGER, discount_allowed REAL DEFAULT 0,
    role_id INTEGER, edit_line_booking TEXT DEFAULT 'NO',
    cashier_account_head TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS app_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT, process TEXT, action TEXT, record_id TEXT, detail TEXT,
    at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS form_name (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_type TEXT, module_code TEXT, name TEXT NOT NULL, alias TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS role_permission (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL, form_key TEXT NOT NULL,
    can_view INTEGER DEFAULT 1, can_add INTEGER DEFAULT 1, can_edit INTEGER DEFAULT 1, can_delete INTEGER DEFAULT 0,
    UNIQUE(role_id, form_key)
  );
  CREATE TABLE IF NOT EXISTS user_permission (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, form_key TEXT NOT NULL,
    can_view INTEGER DEFAULT 1, can_add INTEGER DEFAULT 1, can_edit INTEGER DEFAULT 1, can_delete INTEGER DEFAULT 0,
    UNIQUE(user_id, form_key)
  );
  CREATE TABLE IF NOT EXISTS preference (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE IF NOT EXISTS booking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_no TEXT UNIQUE,
    ad_type TEXT NOT NULL,               -- DISPLAY | CLASSIFIED
    source TEXT DEFAULT 'BOOKING',       -- BOOKING | QBC
    booking_date TEXT,
    branch_id INTEGER, booked_by TEXT,
    prev_booking_id INTEGER,
    agency_id INTEGER,
    client_id INTEGER, client_name TEXT, client_address TEXT, client_mobile TEXT,
    ro_no TEXT, ro_date TEXT,
    ro_status TEXT DEFAULT 'CONFIRM',    -- CONFIRM | RESERVATION
    dockit_no TEXT, key_no TEXT,
    executive_id INTEGER, retainer_id INTEGER,
    booking_type TEXT DEFAULT 'NORMAL',  -- NORMAL | FMG | IN HOUSE
    fmg_reason_id INTEGER,
    color_id INTEGER, bg_color_id INTEGER,
    ad_category_id INTEGER, ad_sub_category_id INTEGER,
    ad_sub_category3_id INTEGER, ad_sub_category4_id INTEGER, ad_sub_category5_id INTEGER,
    uom_id INTEGER, product_id INTEGER, brand_id INTEGER, variant_id INTEGER,
    campaign TEXT, caption TEXT, material_status TEXT, matter TEXT,
    coupon_ad INTEGER DEFAULT 0,
    publish_date TEXT, tfn INTEGER DEFAULT 0,
    no_of_insertions INTEGER DEFAULT 1, repeating_day INTEGER DEFAULT 1,
    free_insertions INTEGER DEFAULT 0, paid_insertions INTEGER DEFAULT 1,
    currency_id INTEGER, contract_id INTEGER, print_remark TEXT,
    ad_size_id INTEGER, height REAL, width REAL, no_of_columns INTEGER,
    page_premium_id INTEGER, position_premium_id INTEGER,
    total_area REAL, page_no INTEGER, page_type_id INTEGER,
    eye_catcher_id INTEGER, eye_catcher_prem REAL DEFAULT 0, no_of_lines REAL,
    scheme_id INTEGER, rate_code_id INTEGER,
    card_rate REAL DEFAULT 0, card_amount REAL DEFAULT 0,
    contract_rate REAL, deviation REAL DEFAULT 0,
    agreed_rate REAL, agreed_amount REAL,
    discount REAL DEFAULT 0, discount_pct REAL DEFAULT 0,
    premium_amount REAL DEFAULT 0, premium_pct REAL DEFAULT 0,
    special_discount REAL DEFAULT 0, space_discount REAL DEFAULT 0,
    special_charges REAL DEFAULT 0,
    addl_agency_comm REAL DEFAULT 0, retainer_comm REAL DEFAULT 0,
    gross_amount REAL DEFAULT 0,
    bill_cycle TEXT DEFAULT 'MONTHLY',
    revenue_center_id INTEGER, payment_type_id INTEGER,
    bill_status TEXT DEFAULT 'PENDING',  -- PENDING | BILLED
    cash_received REAL, chq_no TEXT, chq_amount REAL, bank_name TEXT, our_bank TEXT,
    billable_size TEXT, bill_to TEXT DEFAULT 'AGENCY',
    trade_discount REAL DEFAULT 0, bill_amount REAL DEFAULT 0, bill_remarks TEXT,
    box_id INTEGER, box_no TEXT, box_address TEXT, box_charges REAL DEFAULT 0,
    vts_copies INTEGER, no_of_invoices INTEGER, billing_address TEXT,
    audit_status TEXT DEFAULT 'UNAUDITED',      -- UNAUDITED | AUDITED
    audit_by TEXT, audit_comments TEXT,
    rate_audit_status TEXT DEFAULT 'PENDING',   -- PENDING | PASSED | REJECTED
    rate_audit_by TEXT, rate_audit_comments TEXT,
    status TEXT DEFAULT 'BOOKED',               -- BOOKED | CANCELLED
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS booking_package (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    package_id INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bp_booking ON booking_package(booking_id);
  CREATE TABLE IF NOT EXISTS insertion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    edition_id INTEGER,
    publish_date TEXT NOT NULL,
    status TEXT DEFAULT 'BOOKED',   -- BOOKED | PUBLISHED | CANCELLED | BILLED
    amount REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ins_booking ON insertion(booking_id);
  CREATE INDEX IF NOT EXISTS idx_ins_date ON insertion(publish_date);
  CREATE TABLE IF NOT EXISTS bill (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_no TEXT UNIQUE,
    bill_date TEXT,
    booking_id INTEGER NOT NULL,
    agency_id INTEGER, client_id INTEGER, bill_to TEXT,
    insertions_count INTEGER DEFAULT 0,
    gross_amount REAL DEFAULT 0,
    trade_discount REAL DEFAULT 0,
    addl_comm REAL DEFAULT 0,
    tax_pct REAL DEFAULT 0, tax_amount REAL DEFAULT 0,
    net_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',   -- ACTIVE | CANCELLED
    revised_from TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS follow_up (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT, agency_id INTEGER, client_id INTEGER, booking_id INTEGER,
    remarks TEXT, next_date TEXT, status TEXT DEFAULT 'OPEN',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS payment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER, bill_id INTEGER,
    date TEXT, mode TEXT, amount REAL DEFAULT 0,
    ref_no TEXT, bank TEXT, document TEXT, received_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  `);
}

function log(username, process_, action, recordId, detail) {
  try {
    db.prepare('INSERT INTO app_log (username, process, action, record_id, detail) VALUES (?,?,?,?,?)')
      .run(username || 'system', process_ || '', action || '', String(recordId ?? ''), detail || '');
  } catch (e) { /* logging never blocks */ }
}

createMasterTables();
createSystemTables();

module.exports = { db, log, DB_PATH };
