const express = require('express');
const crypto = require('crypto');
const { db, log } = require('../db');

const router = express.Router();
const sessions = new Map(); // token -> user

router.get('/bootstrap', (_req, res) => {
  // data needed by the login screen (no auth required)
  const centers = db.prepare("SELECT id, name FROM pub_center WHERE status IS NULL OR status='ACTIVE' ORDER BY name").all();
  const branches = db.prepare('SELECT id, name, pub_center_id FROM branch ORDER BY name').all();
  res.json({ centers, branches, app: 'BookingHub' });
});

router.post('/login', (req, res) => {
  const { username, password, center_id, branch_id } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND status = 'ACTIVE'").get(username || '');
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'User name or password does not match with the stored data.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  const role = user.role_id ? db.prepare('SELECT name FROM user_role WHERE id = ?').get(user.role_id) : null;
  const sessionUser = {
    id: user.id, username: user.username,
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
    role: role ? role.name : 'USER', role_id: user.role_id,
    center_id: center_id || null, branch_id: branch_id || user.branch_id || null,
  };
  sessions.set(token, sessionUser);
  log(user.username, 'Login', 'LOGIN', user.id, `center:${center_id || ''} branch:${branch_id || ''}`);
  res.json({ token, user: sessionUser });
});

router.post('/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const u = sessions.get(token);
  if (u) log(u.username, 'Login', 'LOGOUT', u.id, '');
  sessions.delete(token);
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = sessions.get(token);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user;
  next();
}

module.exports = { router, requireAuth };
