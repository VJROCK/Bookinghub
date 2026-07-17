/** Generic, config-driven CRUD for all 78 master forms. */
const express = require('express');
const { db, log } = require('../db');
const { MASTERS } = require('../mastersConfig');

const router = express.Router();
const byKey = Object.fromEntries(MASTERS.map((m) => [m.key, m]));

/* meta for the client: full config of all masters */
router.get('/_meta', (_req, res) => {
  res.json(MASTERS.map((m) => ({
    key: m.key, label: m.label, group: m.group, section: m.section, help: m.help,
    fields: m.fields, children: (m.children || []).map((c) => ({ table: c.table, label: c.label, fields: c.fields })),
  })));
});

/* lightweight options list for dropdowns: /api/masters/:key/options */
router.get('/:key/options', (req, res) => {
  const m = byKey[req.params.key];
  if (!m) return res.status(404).json({ error: 'Unknown master' });
  const nameCol = m.fields.find((f) => f.name === 'name') ? 'name' : m.fields[0].name;
  const rows = db.prepare(`SELECT id, ${nameCol} AS name FROM ${m.key} ORDER BY ${nameCol}`).all();
  res.json(rows);
});

/* list with search + query-by-example */
router.get('/:key', (req, res) => {
  const m = byKey[req.params.key];
  if (!m) return res.status(404).json({ error: 'Unknown master' });
  const { q, limit = 500, offset = 0, ...filters } = req.query;
  const where = []; const params = [];
  if (q) {
    const textCols = m.fields.filter((f) => ['text', 'textarea', 'option'].includes(f.type)).map((f) => f.name);
    if (textCols.length) {
      where.push('(' + textCols.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
      textCols.forEach(() => params.push(`%${q}%`));
    }
  }
  for (const [k, v] of Object.entries(filters)) {
    if (v === '' || v == null) continue;
    const fl = m.fields.find((f) => f.name === k);
    if (!fl) continue;
    if (['text', 'textarea'].includes(fl.type)) { where.push(`${k} LIKE ?`); params.push(`%${v}%`); }
    else { where.push(`${k} = ?`); params.push(v); }
  }
  const sql = `SELECT * FROM ${m.key} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, Number(limit), Number(offset));

  // resolve display names for select fields
  const selects = m.fields.filter((f) => f.type === 'select' && f.ref);
  const lookups = {};
  for (const s of selects) {
    if (!byKey[s.ref] && !['users'].includes(s.ref)) continue;
    const refCfg = byKey[s.ref];
    const nameCol = refCfg && !refCfg.fields.find((f) => f.name === 'name') ? refCfg.fields[0].name : 'name';
    lookups[s.name] = Object.fromEntries(db.prepare(`SELECT id, ${nameCol} FROM ${s.ref}`).all().map((r) => [r.id, r[nameCol]]));
  }
  for (const r of rows) for (const s of selects) if (lookups[s.name]) r[`${s.name}__name`] = lookups[s.name][r[s.name]] || null;
  const total = db.prepare(`SELECT COUNT(*) c FROM ${m.key} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`).get(...params).c;
  res.json({ rows, total });
});

router.get('/:key/:id', (req, res) => {
  const m = byKey[req.params.key];
  if (!m) return res.status(404).json({ error: 'Unknown master' });
  const row = db.prepare(`SELECT * FROM ${m.key} WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  const children = {};
  for (const c of m.children || []) {
    children[c.table] = db.prepare(`SELECT * FROM ${c.table} WHERE parent_id = ? ORDER BY id`).all(req.params.id);
  }
  res.json({ row, children });
});

function pickValues(m, body) {
  const cols = []; const vals = [];
  for (const fl of m.fields) {
    if (fl.ro) continue;
    if (body[fl.name] === undefined) continue;
    cols.push(fl.name);
    vals.push(body[fl.name] === '' ? null : body[fl.name]);
  }
  return { cols, vals };
}

function applyHooks(m, id, body, username) {
  // Change Package Status writes through to the package master
  if (m.key === 'change_package_status' && body.package_id && body.status) {
    db.prepare('UPDATE package SET status = ? WHERE id = ?').run(body.status, body.package_id);
  }
  // Edition page area = height x width
  if (m.key === 'edition') {
    const r = db.prepare('SELECT height, width FROM edition WHERE id = ?').get(id);
    if (r && r.height && r.width) db.prepare('UPDATE edition SET page_area = ? WHERE id = ?').run(r.height * r.width, id);
    autoAlias('edition', id);
  }
  if (m.key === 'supplement') autoAliasSupplement(id);
  if (m.key === 'package') {
    const c = db.prepare('SELECT COUNT(*) c FROM package_edition WHERE parent_id = ?').get(id).c;
    db.prepare('UPDATE package SET no_of_editions = ? WHERE id = ?').run(c, id);
  }
}

function autoAlias(_t, id) {
  // Manual 4.47: alias = first char of each word of publication + first 3 chars of edition
  const r = db.prepare('SELECT e.id, e.alias, e.name, p.name AS pub FROM edition e LEFT JOIN publication p ON p.id = e.publication_id WHERE e.id = ?').get(id);
  if (r && !r.alias && r.pub) {
    const pfx = r.pub.split(/\s+/).map((w) => w[0]).join('').toUpperCase();
    db.prepare('UPDATE edition SET alias = ? WHERE id = ?').run(`${pfx}-${(r.name || '').slice(0, 3).toUpperCase()}`, id);
  }
}
function autoAliasSupplement(id) {
  const r = db.prepare(`SELECT s.id, s.alias, s.name, p.name AS pub, e.name AS ed FROM supplement s
    LEFT JOIN publication p ON p.id = s.publication_id LEFT JOIN edition e ON e.id = s.edition_id WHERE s.id = ?`).get(id);
  if (r && !r.alias && r.pub) {
    const pfx = r.pub.split(/\s+/).map((w) => w[0]).join('').toUpperCase();
    db.prepare('UPDATE supplement SET alias = ? WHERE id = ?').run(`${pfx}-${(r.name || '').slice(0, 3).toUpperCase()}-${(r.ed || '').slice(0, 3).toUpperCase()}`, id);
  }
}

router.post('/:key', (req, res) => {
  const m = byKey[req.params.key];
  if (!m) return res.status(404).json({ error: 'Unknown master' });
  for (const fl of m.fields) {
    if (fl.req && (req.body[fl.name] === undefined || req.body[fl.name] === '' || req.body[fl.name] === null)) {
      return res.status(400).json({ error: `${fl.label} is mandatory` });
    }
  }
  const { cols, vals } = pickValues(m, req.body);
  const info = db.prepare(`INSERT INTO ${m.key} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
  const id = Number(info.lastInsertRowid);
  applyHooks(m, id, req.body, req.user.username);
  log(req.user.username, m.label, 'CREATE', id, '');
  res.json({ id });
});

router.put('/:key/:id', (req, res) => {
  const m = byKey[req.params.key];
  if (!m) return res.status(404).json({ error: 'Unknown master' });
  const { cols, vals } = pickValues(m, req.body);
  if (!cols.length) return res.json({ ok: true });
  db.prepare(`UPDATE ${m.key} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...vals, req.params.id);
  applyHooks(m, Number(req.params.id), req.body, req.user.username);
  log(req.user.username, m.label, 'MODIFY', req.params.id, '');
  res.json({ ok: true });
});

router.delete('/:key/:id', (req, res) => {
  const m = byKey[req.params.key];
  if (!m) return res.status(404).json({ error: 'Unknown master' });
  for (const c of m.children || []) db.prepare(`DELETE FROM ${c.table} WHERE parent_id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM ${m.key} WHERE id = ?`).run(req.params.id);
  log(req.user.username, m.label, 'DELETE', req.params.id, '');
  res.json({ ok: true });
});

/* ---- child tables (detail tabs) ---- */
router.post('/:key/:id/:child', (req, res) => {
  const m = byKey[req.params.key];
  const c = (m?.children || []).find((x) => x.table === req.params.child);
  if (!c) return res.status(404).json({ error: 'Unknown detail table' });
  const cols = ['parent_id']; const vals = [req.params.id];
  for (const fl of c.fields) {
    if (req.body[fl.name] === undefined) continue;
    cols.push(fl.name); vals.push(req.body[fl.name] === '' ? null : req.body[fl.name]);
  }
  const info = db.prepare(`INSERT INTO ${c.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
  applyHooks(m, Number(req.params.id), req.body, req.user.username);
  log(req.user.username, `${m.label} - ${c.label}`, 'CREATE', info.lastInsertRowid, '');
  res.json({ id: Number(info.lastInsertRowid) });
});

router.delete('/:key/:id/:child/:childId', (req, res) => {
  const m = byKey[req.params.key];
  const c = (m?.children || []).find((x) => x.table === req.params.child);
  if (!c) return res.status(404).json({ error: 'Unknown detail table' });
  db.prepare(`DELETE FROM ${c.table} WHERE id = ? AND parent_id = ?`).run(req.params.childId, req.params.id);
  applyHooks(m, Number(req.params.id), req.body || {}, req.user.username);
  res.json({ ok: true });
});

module.exports = router;
