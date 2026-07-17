import React, { useEffect, useState } from 'react';
import { api, today } from '../api';
import { DataTable, Msg, RefSelect, Modal } from '../components';

function Page({ title, section, help, children }) {
  return (
    <div>
      <h2>{title}</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Manual section {section} · Application Settings</div>
      {help && <div className="help">{help}</div>}
      {children}
    </div>
  );
}

/* 9.1 Create User */
export function UsersPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ status: 'ACTIVE', edit_line_booking: 'NO', date_format: 'DD/MM/YYYY' });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState({});
  const load = () => api.get('/api/settings/users').then(setRows);
  useEffect(() => { load(); }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setMsg({});
    try {
      if (editId) { await api.put(`/api/settings/users/${editId}`, form); setMsg({ ok: 'User modified.' }); }
      else { await api.post('/api/settings/users', form); setMsg({ ok: 'User created.' }); }
      setForm({ status: 'ACTIVE', edit_line_booking: 'NO', date_format: 'DD/MM/YYYY' }); setEditId(null); load();
    } catch (e) { setMsg({ err: e.message }); }
  };

  return (
    <Page title="Create User" section="9.1" help="Create application users, link them to a branch, company, currency and role. Roles carry the form permissions.">
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g4">
          <div className="field"><label>User Name *</label><input value={form.username ?? ''} disabled={!!editId} onChange={(e) => set('username', e.target.value)} /></div>
          <div className="field"><label>Password {editId ? '(blank = keep)' : '*'}</label><input type="password" value={form.password ?? ''} onChange={(e) => set('password', e.target.value)} /></div>
          <div className="field"><label>First Name</label><input value={form.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} /></div>
          <div className="field"><label>Last Name</label><input value={form.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} /></div>
          <div className="field"><label>Email</label><input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="field"><label>EMP Code</label><input value={form.emp_code ?? ''} onChange={(e) => set('emp_code', e.target.value)} /></div>
          <div className="field"><label>Branch</label><RefSelect refTable="branch" value={form.branch_id} onChange={(v) => set('branch_id', v)} /></div>
          <div className="field"><label>Company</label><RefSelect refTable="company" value={form.company_id} onChange={(v) => set('company_id', v)} /></div>
          <div className="field"><label>Currency</label><RefSelect refTable="currency" value={form.currency_id} onChange={(v) => set('currency_id', v)} /></div>
          <div className="field"><label>Role Name</label><RefSelect refTable="user_role" value={form.role_id} onChange={(v) => set('role_id', v)} /></div>
          <div className="field"><label>Agency (if agency login)</label><RefSelect refTable="agency" value={form.agency_id} onChange={(v) => set('agency_id', v)} /></div>
          <div className="field"><label>Date Format</label>
            <select value={form.date_format} onChange={(e) => set('date_format', e.target.value)}>
              {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((o) => <option key={o}>{o}</option>)}
            </select></div>
          <div className="field"><label>Discount Allowed %</label><input type="number" value={form.discount_allowed ?? ''} onChange={(e) => set('discount_allowed', e.target.value)} /></div>
          <div className="field"><label>Edit Line in Booking</label>
            <select value={form.edit_line_booking} onChange={(e) => set('edit_line_booking', e.target.value)}>
              <option>NO</option><option>YES</option>
            </select></div>
          <div className="field"><label>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option>ACTIVE</option><option>INACTIVE</option>
            </select></div>
        </div>
        <div className="toolbar" style={{ marginTop: 10 }}>
          <button className="btn" onClick={save}>💾 {editId ? 'Modify User' : 'Create User'}</button>
          {editId && <button className="btn sec" onClick={() => { setEditId(null); setForm({ status: 'ACTIVE', edit_line_booking: 'NO', date_format: 'DD/MM/YYYY' }); }}>Cancel Edit</button>}
        </div>
      </div>
      <div className="panel">
        <h3>Users</h3>
        <DataTable rows={rows} columns={[
          { key: 'username', label: 'User Name' }, { key: 'first_name', label: 'First Name' },
          { key: 'last_name', label: 'Last Name' }, { key: 'email', label: 'Email' },
          { key: 'role_name', label: 'Role' }, { key: 'branch_name', label: 'Branch' },
          { key: 'status', label: 'Status', render: (r) => <span className={`badge ${r.status === 'ACTIVE' ? 'ok' : 'bad'}`}>{r.status}</span> },
          {
            key: '_act', label: '', render: (r) => (
              <span style={{ whiteSpace: 'nowrap' }}>
                <button className="btn warn sm" onClick={() => { setEditId(r.id); setForm({ ...r, password: '' }); }}>Edit</button>{' '}
                {r.status === 'ACTIVE' && <button className="btn danger sm" onClick={async () => { await api.del(`/api/settings/users/${r.id}`); load(); }}>Deactivate</button>}
              </span>
            ),
          },
        ]} />
      </div>
    </Page>
  );
}

/* 9.3 Change Password */
export function ChangePassword() {
  const [f, setF] = useState({});
  const [msg, setMsg] = useState({});
  const save = async () => {
    setMsg({});
    try { await api.post('/api/settings/change-password', f); setMsg({ ok: 'Password changed successfully.' }); setF({}); }
    catch (e) { setMsg({ err: e.message }); }
  };
  return (
    <Page title="Change Password" section="9.3">
      <Msg {...msg} />
      <div className="panel" style={{ maxWidth: 420 }}>
        <div className="field"><label>Old Password</label><input type="password" value={f.old_password ?? ''} onChange={(e) => setF({ ...f, old_password: e.target.value })} /></div>
        <div className="field" style={{ marginTop: 8 }}><label>New Password</label><input type="password" value={f.new_password ?? ''} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></div>
        <div className="field" style={{ marginTop: 8 }}><label>Confirm Password</label><input type="password" value={f.confirm_password ?? ''} onChange={(e) => setF({ ...f, confirm_password: e.target.value })} /></div>
        <button className="btn" style={{ marginTop: 12 }} onClick={save}>💾 Change Password</button>
      </div>
    </Page>
  );
}

/* 9.4 / 9.5 / 9.6 permissions (role + user + master privilege in one screen) */
export function Permissions() {
  const [mode, setMode] = useState('ROLE');
  const [target, setTarget] = useState('');
  const [forms, setForms] = useState([]);
  const [perms, setPerms] = useState({});
  const [msg, setMsg] = useState({});
  useEffect(() => { api.get('/api/settings/forms').then(setForms); }, []);

  const loadPerms = async (t) => {
    if (!t) return;
    const url = mode === 'ROLE' ? `/api/settings/role-permissions/${t}` : `/api/settings/user-permissions/${t}`;
    const rows = await api.get(url);
    const map = {};
    for (const r of rows) map[r.form_key] = r;
    setPerms(map);
  };
  useEffect(() => { setPerms({}); setTarget(''); }, [mode]);

  const toggle = (key, field) => {
    setPerms((p) => {
      const cur = p[key] || { form_key: key, can_view: 0, can_add: 0, can_edit: 0, can_delete: 0 };
      return { ...p, [key]: { ...cur, [field]: cur[field] ? 0 : 1 } };
    });
  };

  const save = async () => {
    if (!target) { setMsg({ err: `Select a ${mode.toLowerCase()} first.` }); return; }
    const url = mode === 'ROLE' ? `/api/settings/role-permissions/${target}` : `/api/settings/user-permissions/${target}`;
    await api.post(url, { permissions: Object.values(perms).filter((p) => p.can_view || p.can_add || p.can_edit || p.can_delete) });
    setMsg({ ok: 'Permissions saved.' });
  };

  const grantAll = () => {
    const map = {};
    for (const f of forms) map[f.key] = { form_key: f.key, can_view: 1, can_add: 1, can_edit: 1, can_delete: 0 };
    setPerms(map);
  };

  const modules = {};
  for (const f of forms) (modules[f.module] = modules[f.module] || []).push(f);

  return (
    <Page title="Master Privilege / User Permission / Role Permission" section="9.4 – 9.6"
      help="Assign form-level permissions. Grant to a ROLE so every user with that role inherits it (e.g. all 'Accounts Executive' users), or grant special permissions to a single USER.">
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g4" style={{ marginBottom: 10 }}>
          <div className="field"><label>Assign To</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="ROLE">ROLE (Role Permission)</option>
              <option value="USER">USER (User Permission)</option>
            </select></div>
          <div className="field">
            <label>{mode === 'ROLE' ? 'Role Name' : 'User'}</label>
            {mode === 'ROLE'
              ? <RefSelect refTable="user_role" value={target} onChange={(v) => { setTarget(v); loadPerms(v); }} placeholder="-- select role --" />
              : <UserSelect value={target} onChange={(v) => { setTarget(v); loadPerms(v); }} />}
          </div>
          <div style={{ alignSelf: 'end', display: 'flex', gap: 8 }}>
            <button className="btn sec" onClick={grantAll}>Grant All (view/add/edit)</button>
            <button className="btn" onClick={save}>💾 Save Permissions</button>
          </div>
        </div>
        {Object.entries(modules).map(([mod, items]) => (
          <details key={mod} open={mod !== 'Masters'}>
            <summary style={{ fontWeight: 700, padding: '6px 0', cursor: 'pointer' }}>{mod} ({items.length} forms)</summary>
            <div className="dt-wrap" style={{ maxHeight: 300, marginBottom: 8 }}>
              <table className="dt">
                <thead><tr><th>Form</th><th>View</th><th>Add</th><th>Edit</th><th>Delete</th></tr></thead>
                <tbody>
                  {items.map((f) => {
                    const p = perms[f.key] || {};
                    return (
                      <tr key={f.key}>
                        <td>{f.label}</td>
                        {['can_view', 'can_add', 'can_edit', 'can_delete'].map((c) => (
                          <td key={c}><input type="checkbox" style={{ width: 'auto' }} checked={!!p[c]} onChange={() => toggle(f.key, c)} /></td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </Page>
  );
}

function UserSelect({ value, onChange }) {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get('/api/settings/users').then(setUsers); }, []);
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- select user --</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.username} ({u.first_name || ''})</option>)}
    </select>
  );
}

/* 9.2 Log */
export function LogPage() {
  const [f, setF] = useState({ from: today(-7), to: today(), user: '', process: '' });
  const [rows, setRows] = useState([]);
  const run = () => api.get(`/api/settings/log?from=${f.from}&to=${f.to}&user=${f.user}&process=${f.process}`).then(setRows);
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);
  return (
    <Page title="Log" section="9.2" help="Audit trail of everything users did — logins, master changes, bookings, audits, billing.">
      <div className="panel">
        <div className="grid g5" style={{ marginBottom: 10 }}>
          <div className="field"><label>From</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="field"><label>To</label><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div className="field"><label>User</label><input value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} /></div>
          <div className="field"><label>Process</label><input value={f.process} onChange={(e) => setF({ ...f, process: e.target.value })} placeholder="e.g. Display Booking" /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={run}>Submit</button></div>
        </div>
        <DataTable rows={rows} columns={[
          { key: 'at', label: 'Time' }, { key: 'username', label: 'User' },
          { key: 'process', label: 'Process' }, { key: 'action', label: 'Action' },
          { key: 'record_id', label: 'Record / Booking Id' }, { key: 'detail', label: 'Detail' }]} />
      </div>
    </Page>
  );
}

/* 9.9 Preferences */
export function Preferences() {
  const [prefs, setPrefs] = useState({});
  const [msg, setMsg] = useState({});
  useEffect(() => { api.get('/api/settings/preferences').then(setPrefs); }, []);
  const save = async () => {
    const { seeded, ...rest } = prefs;
    await api.post('/api/settings/preferences', rest);
    setMsg({ ok: 'Preferences saved.' });
  };
  const set = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));
  return (
    <Page title="Preferences" section="9.9" help="System behaviour switches. 'Rate Audit required' controls whether bookings must pass Rate Audit before they appear in Billing.">
      <Msg {...msg} />
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="field"><label>Rate Audit required?</label>
          <select value={prefs.rate_audit_required ?? 'YES'} onChange={(e) => set('rate_audit_required', e.target.value)}>
            <option>YES</option><option>NO</option>
          </select></div>
        <div className="field" style={{ marginTop: 8 }}><label>Company Name (report header)</label>
          <input value={prefs.company_name ?? ''} onChange={(e) => set('company_name', e.target.value)} /></div>
        <div className="field" style={{ marginTop: 8 }}><label>Default Currency</label>
          <input value={prefs.default_currency ?? ''} onChange={(e) => set('default_currency', e.target.value)} /></div>
        <div className="field" style={{ marginTop: 8 }}><label>Financial Year</label>
          <input value={prefs.financial_year ?? ''} onChange={(e) => set('financial_year', e.target.value)} /></div>
        <button className="btn" style={{ marginTop: 12 }} onClick={save}>💾 Save Preferences</button>
      </div>
    </Page>
  );
}

/* 9.7 Form Name */
export function FormNames() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({});
  const [msg, setMsg] = useState({});
  const load = () => api.get('/api/settings/forms').then((all) => setRows(all.filter((x) => x.key.startsWith('custom:'))));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { await api.post('/api/settings/forms', f); setMsg({ ok: 'Form registered.' }); setF({}); load(); }
    catch (e) { setMsg({ err: e.message }); }
  };
  return (
    <Page title="Form Name" section="9.7" help="Admin/developer form registry — register new form names to use in the permission module.">
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g5">
          <div className="field"><label>Form Type</label>
            <select value={f.form_type ?? ''} onChange={(e) => setF({ ...f, form_type: e.target.value })}>
              {['', 'MASTER', 'TRANSACTION', 'REPORT', 'SERVICE'].map((o) => <option key={o}>{o}</option>)}
            </select></div>
          <div className="field"><label>Module Code</label><input value={f.module_code ?? ''} onChange={(e) => setF({ ...f, module_code: e.target.value })} /></div>
          <div className="field"><label>Form Name *</label><input value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>Form Alias</label><input value={f.alias ?? ''} onChange={(e) => setF({ ...f, alias: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={save}>💾 Save</button></div>
        </div>
      </div>
      <div className="panel"><h3>Registered Custom Forms</h3>
        <DataTable rows={rows} idKey="key" columns={[{ key: 'label', label: 'Form Name' }, { key: 'module', label: 'Module' }]} />
      </div>
    </Page>
  );
}

/* 9.8 Generate Ref File */
export function GenerateRefFile() {
  const [f, setF] = useState({ publication_date: today(1) });
  const [out, setOut] = useState(null);
  const [msg, setMsg] = useState({});
  const run = async () => {
    setMsg({});
    try { setOut(await api.post('/api/settings/generate-ref-file', f)); }
    catch (e) { setMsg({ err: e.message }); }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out.content], { type: 'text/plain' }));
    a.download = `classified_ref_${f.publication_date}.txt`;
    a.click();
  };
  return (
    <Page title="Generate Ref File" section="9.8"
      help="Creates the reference text file of all classified ads for a publication date — this file is used to flow classified ads onto the page (Quark/InDesign).">
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g4">
          <div className="field"><label>Publication Date</label>
            <input type="date" value={f.publication_date} onChange={(e) => setF({ ...f, publication_date: e.target.value })} /></div>
          <div style={{ alignSelf: 'end', display: 'flex', gap: 8 }}>
            <button className="btn" onClick={run}>⚙ Generate</button>
            {out && <button className="btn sec" onClick={download}>⬇ Download .txt ({out.count} ads)</button>}
          </div>
        </div>
        {out && <pre style={{ background: '#0f172a', color: '#a7f3d0', padding: 12, borderRadius: 6, maxHeight: '46vh', overflow: 'auto', marginTop: 12 }}>{out.content}</pre>}
      </div>
    </Page>
  );
}

/* 9.10 Copy Rate */
export function CopyRate() {
  const [f, setF] = useState({ from_category_id: '', to_category_ids: [], valid_from: '', valid_to: '' });
  const [cats, setCats] = useState([]);
  const [msg, setMsg] = useState({});
  useEffect(() => { api.get('/api/masters/ad_category/options').then(setCats); }, []);
  const run = async () => {
    setMsg({});
    try {
      const d = await api.post('/api/settings/copy-rate', f);
      setMsg({ ok: `${d.copied} rate row(s) copied.` });
    } catch (e) { setMsg({ err: e.message }); }
  };
  return (
    <Page title="Copy Rate" section="9.10"
      help="If two or more categories have the same rates, copy them here instead of opening each rate one by one in Rate Master — a time saving process.">
      <Msg {...msg} />
      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="field"><label>Source Category (copy FROM)</label>
          <select value={f.from_category_id} onChange={(e) => setF({ ...f, from_category_id: e.target.value })}>
            <option value="">--</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div className="field" style={{ marginTop: 8 }}><label>Target Categories (copy TO — multi-select)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cats.filter((c) => String(c.id) !== String(f.from_category_id)).map((c) => (
              <label key={c.id} className="chip" style={{ cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto', marginRight: 4 }}
                  checked={f.to_category_ids.includes(c.id)}
                  onChange={(e) => setF({ ...f, to_category_ids: e.target.checked ? [...f.to_category_ids, c.id] : f.to_category_ids.filter((x) => x !== c.id) })} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
        <div className="grid g2" style={{ marginTop: 8 }}>
          <div className="field"><label>New Valid From (optional)</label><input type="date" value={f.valid_from} onChange={(e) => setF({ ...f, valid_from: e.target.value })} /></div>
          <div className="field"><label>New Valid To (optional)</label><input type="date" value={f.valid_to} onChange={(e) => setF({ ...f, valid_to: e.target.value })} /></div>
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={run}>⧉ Copy Rates</button>
      </div>
    </Page>
  );
}
