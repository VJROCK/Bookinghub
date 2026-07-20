import React, { useEffect, useState } from 'react';
import { api, setSession } from '../api';

/* Premium Login — Split layout with branded sidebar */
export default function Login({ onLogin }) {
  const [boot, setBoot] = useState({ centers: [], branches: [] });
  const [form, setForm] = useState({ center_id: '', branch_id: '', username: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/auth/bootstrap')
      .then((d) => setBoot({ centers: [], branches: [], ...d }))
      .catch(() => {});
  }, []);
  const branches = (boot.branches || []).filter((b) => !form.center_id || b.pub_center_id === Number(form.center_id));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const d = await api.post('/api/auth/login', form);
      setSession(d.token, d.user);
      onLogin();
    } catch (ex) { setErr(ex.message); setForm((f) => ({ ...f, password: '' })); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      {/* Floating decorative elements */}
      <div className="login-decor">
        <div className="decor-circle c1" />
        <div className="decor-circle c2" />
        <div className="decor-circle c3" />
      </div>

      <form className="login-box" onSubmit={submit}>
        <div className="login-header">
          <div className="logo">Booking<span>Hub</span></div>
          <div className="sub">Advertisement Booking System</div>
          <div className="sub-detail">Classified & Display Management Platform</div>
        </div>

        {err && <div className="login-err">⚠ {err}</div>}

        <div className="login-fields">
          <div className="field">
            <label>Publication Center</label>
            <div className="input-icon">
              <span className="icon">🏢</span>
              <select id="center" name="center" value={form.center_id} onChange={(e) => set('center_id', e.target.value)}>
                <option value="">— Select Center —</option>
                {(boot.centers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Branch Office</label>
            <div className="input-icon">
              <span className="icon">📍</span>
              <select id="branch" name="branch" value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                <option value="">— Select Branch —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Username</label>
            <div className="input-icon">
              <span className="icon">👤</span>
              <input id="username" name="username" autoFocus autoComplete="username" placeholder="Enter your username" value={form.username} onChange={(e) => set('username', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <div className="input-icon">
              <span className="icon">🔒</span>
              <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={(e) => set('password', e.target.value)} />
            </div>
          </div>
        </div>

        <button className="btn login-btn" style={{ width: '100%', marginTop: 8 }} disabled={busy}>
          {busy ? (
            <><span className="spinner" /> Authenticating...</>
          ) : (
            'Sign In →'
          )}
        </button>

        <div className="hint">
          <div className="hint-label">Demo Credentials</div>
          <div className="hint-creds">
            <span><b>admin</b> / admin123</span>
            <span><b>booking</b> / booking123</span>
            <span><b>auditor</b> / audit123</span>
          </div>
        </div>
      </form>
    </div>
  );
}
