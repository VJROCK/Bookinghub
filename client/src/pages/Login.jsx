import React, { useEffect, useState } from 'react';
import { api, setSession } from '../api';

/* Manual 3.1 — Login screen with Center, Branch, User Name, Password */
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
      <form className="login-box" onSubmit={submit}>
        <div className="logo">Booking<span>Hub</span></div>
        <div className="sub">Advertisement Booking System — Classified &amp; Display</div>
        {err && <div className="login-err">{err}</div>}
        <div className="field">
          <label>Center</label>
          <select value={form.center_id} onChange={(e) => set('center_id', e.target.value)}>
            <option value="">-- select publication center --</option>
            {(boot.centers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Branch</label>
          <select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
            <option value="">-- select branch --</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>User Name</label>
          <input autoFocus value={form.username} onChange={(e) => set('username', e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
        </div>
        <button className="btn" style={{ width: '100%', marginTop: 6, padding: 9 }} disabled={busy}>
          {busy ? 'Checking...' : 'Submit'}
        </button>
        <div className="hint">Demo users: <b>admin/admin123</b> · booking/booking123 · auditor/audit123</div>
      </form>
    </div>
  );
}
