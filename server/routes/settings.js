/** Application Settings / Services (section 9): users, permissions, log, preferences, copy rate, ref file. */
const express = require('express');
const { db, log } = require('../db');
const { MASTERS } = require('../mastersConfig');

const router = express.Router();

/* ---------- 9.1 users ---------- */
router.get('/users', (_req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.emp_code, u.status,
           u.role_id, u.branch_id, u.company_id, u.currency_id, u.date_format,
           u.discount_allowed, u.edit_line_booking, u.agency_id, u.cashier_account_head,
           r.name AS role_name, b.name AS branch_name
    FROM users u LEFT JOIN user_role r ON r.id=u.role_id LEFT JOIN branch b ON b.id=u.branch_id
    ORDER BY u.username`).all();
  res.json(rows);
});

router.post('/users', (req, res) => {
  const u = req.body || {};
  if (!u.username || !u.password) return res.status(400).json({ error: 'User name and password are mandatory' });
  try {
    const info = db.prepare(`INSERT INTO users (username, password, first_name, last_name, email, emp_code,
      agency_id, branch_id, currency_id, date_format, company_id, discount_allowed, role_id, edit_line_booking, cashier_account_head, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      u.username, u.password, u.first_name || null, u.last_name || null, u.email || null, u.emp_code || null,
      u.agency_id || null, u.branch_id || null, u.currency_id || null, u.date_format || 'DD/MM/YYYY',
      u.company_id || null, u.discount_allowed || 0, u.role_id || null, u.edit_line_booking || 'NO',
      u.cashier_account_head || null, u.status || 'ACTIVE');
    log(req.user.username, 'Create User', 'CREATE', info.lastInsertRowid, u.username);
    res.json({ id: Number(info.lastInsertRowid) });
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'User name already exists' : e.message });
  }
});

router.put('/users/:id', (req, res) => {
  const u = req.body || {};
  const fields = ['first_name', 'last_name', 'email', 'emp_code', 'agency_id', 'branch_id', 'currency_id',
    'date_format', 'company_id', 'discount_allowed', 'role_id', 'edit_line_booking', 'cashier_account_head', 'status'];
  const sets = []; const vals = [];
  for (const f of fields) if (u[f] !== undefined) { sets.push(`${f} = ?`); vals.push(u[f] === '' ? null : u[f]); }
  if (u.password) { sets.push('password = ?'); vals.push(u.password); }
  if (sets.length) db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id);
  log(req.user.username, 'Create User', 'MODIFY', req.params.id, '');
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  db.prepare("UPDATE users SET status='INACTIVE' WHERE id = ?").run(req.params.id);
  log(req.user.username, 'Create User', 'DEACTIVATE', req.params.id, '');
  res.json({ ok: true });
});

/* ---------- 9.3 change password ---------- */
router.post('/change-password', (req, res) => {
  const { old_password, new_password, confirm_password } = req.body || {};
  if (!new_password) return res.status(400).json({ error: 'New password is mandatory' });
  if (new_password !== confirm_password) return res.status(400).json({ error: 'New password and confirm password do not match' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!u || u.password !== old_password) return res.status(400).json({ error: 'Old password is incorrect' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(new_password, req.user.id);
  log(req.user.username, 'Change Password', 'MODIFY', req.user.id, '');
  res.json({ ok: true });
});

/* ---------- 9.2 log ---------- */
router.get('/log', (req, res) => {
  const { from, to, user, process, record_id } = req.query;
  const where = ['1=1']; const params = [];
  if (from) { where.push('date(at) >= ?'); params.push(from); }
  if (to) { where.push('date(at) <= ?'); params.push(to); }
  if (user) { where.push('username LIKE ?'); params.push(`%${user}%`); }
  if (process) { where.push('process LIKE ?'); params.push(`%${process}%`); }
  if (record_id) { where.push('record_id LIKE ?'); params.push(`%${record_id}%`); }
  const rows = db.prepare(`SELECT * FROM app_log WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 500`).all(...params);
  res.json(rows);
});

/* ---------- forms list (for permissions) ---------- */
router.get('/forms', (_req, res) => {
  const masters = MASTERS.map((m) => ({ key: `master:${m.key}`, label: m.label, module: 'Masters' }));
  const txns = ['Display Booking', 'Classified Booking', 'QBC', 'Payment Gateway', 'Confirm Ads', 'Booking Audit',
    'Publish Audit', 'Rate Audit', 'Follow Up', 'Ad Search', 'Billing', 'Revised Billing']
    .map((t) => ({ key: `txn:${t.toLowerCase().replace(/\s+/g, '_')}`, label: t, module: 'Transactions' }));
  const custom = db.prepare('SELECT * FROM form_name ORDER BY name').all()
    .map((r) => ({ key: `custom:${r.id}`, label: r.name, module: r.module_code || 'Custom' }));
  res.json([...masters, ...txns, ...custom]);
});

router.post('/forms', (req, res) => {
  const { form_type, module_code, name, alias } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Form name is mandatory' });
  const info = db.prepare('INSERT INTO form_name (form_type, module_code, name, alias) VALUES (?,?,?,?)')
    .run(form_type || null, module_code || null, name, alias || null);
  res.json({ id: Number(info.lastInsertRowid) });
});

/* ---------- 9.4-9.6 permissions ---------- */
router.get('/role-permissions/:roleId', (req, res) => {
  res.json(db.prepare('SELECT * FROM role_permission WHERE role_id = ?').all(req.params.roleId));
});

router.post('/role-permissions/:roleId', (req, res) => {
  const { permissions = [] } = req.body || {};
  const del = db.prepare('DELETE FROM role_permission WHERE role_id = ?');
  del.run(req.params.roleId);
  const ins = db.prepare('INSERT INTO role_permission (role_id, form_key, can_view, can_add, can_edit, can_delete) VALUES (?,?,?,?,?,?)');
  for (const p of permissions) ins.run(req.params.roleId, p.form_key, p.can_view ? 1 : 0, p.can_add ? 1 : 0, p.can_edit ? 1 : 0, p.can_delete ? 1 : 0);
  log(req.user.username, 'Role Permission', 'MODIFY', req.params.roleId, `${permissions.length} forms`);
  res.json({ ok: true });
});

router.get('/user-permissions/:userId', (req, res) => {
  res.json(db.prepare('SELECT * FROM user_permission WHERE user_id = ?').all(req.params.userId));
});

router.post('/user-permissions/:userId', (req, res) => {
  const { permissions = [] } = req.body || {};
  db.prepare('DELETE FROM user_permission WHERE user_id = ?').run(req.params.userId);
  const ins = db.prepare('INSERT INTO user_permission (user_id, form_key, can_view, can_add, can_edit, can_delete) VALUES (?,?,?,?,?,?)');
  for (const p of permissions) ins.run(req.params.userId, p.form_key, p.can_view ? 1 : 0, p.can_add ? 1 : 0, p.can_edit ? 1 : 0, p.can_delete ? 1 : 0);
  log(req.user.username, 'User Permission', 'MODIFY', req.params.userId, `${permissions.length} forms`);
  res.json({ ok: true });
});

/* ---------- 9.9 preferences ---------- */
router.get('/preferences', (_req, res) => {
  const rows = db.prepare('SELECT * FROM preference').all();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

router.post('/preferences', (req, res) => {
  const up = db.prepare('INSERT INTO preference (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(req.body || {})) up.run(k, String(v));
  log(req.user.username, 'Preferences', 'MODIFY', '', JSON.stringify(req.body));
  res.json({ ok: true });
});

/* ---------- 9.10 copy rate ---------- */
router.post('/copy-rate', (req, res) => {
  const { from_category_id, to_category_ids = [], valid_from, valid_to } = req.body || {};
  if (!from_category_id || !to_category_ids.length) return res.status(400).json({ error: 'Select source and target categories' });
  const src = db.prepare('SELECT * FROM rate_master WHERE ad_category_id = ?').all(from_category_id);
  let count = 0;
  for (const target of to_category_ids) {
    for (const r of src) {
      const { id, created_at, ...rest } = r;
      rest.ad_category_id = Number(target);
      if (valid_from) rest.valid_from = valid_from;
      if (valid_to) rest.valid_to = valid_to;
      const cols = Object.keys(rest);
      db.prepare(`INSERT INTO rate_master (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
        .run(...cols.map((c) => rest[c]));
      count++;
    }
  }
  log(req.user.username, 'Copy Rate', 'COPY', from_category_id, `${count} rates copied`);
  res.json({ ok: true, copied: count });
});

/* ---------- 9.8 generate ref file (classified ads text export) ---------- */
router.post('/generate-ref-file', (req, res) => {
  const { publication_date, edition_ids = [] } = req.body || {};
  if (!publication_date) return res.status(400).json({ error: 'Publication date is mandatory' });
  const where = ["b.ad_type = 'CLASSIFIED'", 'i.publish_date = ?', "i.status IN ('BOOKED','PUBLISHED')"];
  const params = [publication_date];
  if (edition_ids.length) { where.push(`i.edition_id IN (${edition_ids.map(() => '?').join(',')})`); params.push(...edition_ids); }
  const rows = db.prepare(`
    SELECT b.booking_no, e.alias AS edition, cat.name AS category, sc.name AS sub_category, b.caption, b.matter, u.name AS uom
    FROM insertion i JOIN booking b ON b.id=i.booking_id
    LEFT JOIN edition e ON e.id=i.edition_id
    LEFT JOIN ad_category cat ON cat.id=b.ad_category_id
    LEFT JOIN ad_sub_category sc ON sc.id=b.ad_sub_category_id
    LEFT JOIN uom u ON u.id=b.uom_id
    WHERE ${where.join(' AND ')} ORDER BY e.alias, cat.name`).all(...params);
  let text = `REFERENCE FILE — CLASSIFIED ADS — ${publication_date}\r\n${'='.repeat(60)}\r\n`;
  let lastCat = '';
  for (const r of rows) {
    if (r.category !== lastCat) { text += `\r\n** ${r.category || 'UNCATEGORISED'} **\r\n`; lastCat = r.category; }
    text += `[${r.booking_no}|${r.edition || ''}|${r.uom || ''}] ${r.caption || ''}\r\n${(r.matter || '').trim()}\r\n---\r\n`;
  }
  log(req.user.username, 'Generate Ref File', 'EXPORT', publication_date, `${rows.length} ads`);
  res.json({ count: rows.length, content: text });
});

module.exports = router;
