import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, clearOptions } from '../api';
import { Field, DataTable, Toolbar, Tabs, Msg, Modal } from '../components';

/**
 * Generic master form page — renders any of the 78 masters from server config.
 * Toolbar follows the manual (New/Save/Modify/Query/Execute/Clear/First/Prev/Next/Last/Delete).
 * Complex masters (Agency, Client, Retainer, ...) additionally get their detail tabs
 * (Commission Details, Pay Mode, Contacts, Bank Guarantee, ...).
 */
export default function MasterPage({ masters }) {
  const { key } = useParams();
  const meta = masters.find((m) => m.key === key);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({});
  const [mode, setMode] = useState('new'); // new | view | edit | query
  const [selId, setSelId] = useState(null);
  const [children, setChildren] = useState({});
  const [childTab, setChildTab] = useState(null);
  const [childForm, setChildForm] = useState({});
  const [msg, setMsg] = useState({});
  const [q, setQ] = useState('');

  const load = async (search) => {
    const d = await api.get(`/api/masters/${key}?q=${encodeURIComponent(search || '')}`);
    setRows(d.rows);
    return d.rows;
  };

  useEffect(() => {
    if (!meta) return;
    setForm({}); setMode('new'); setSelId(null); setChildren({}); setMsg({}); setQ('');
    setChildTab(meta.children?.[0]?.table || null);
    load('');
    // eslint-disable-next-line
  }, [key, meta && meta.key]);

  if (!meta) return <div className="panel">Loading master configuration…</div>;

  const set = (name, val) => setForm((f) => ({ ...f, [name]: val }));

  const openRecord = async (r) => {
    const d = await api.get(`/api/masters/${key}/${r.id}`);
    setForm(d.row); setChildren(d.children || {}); setSelId(r.id); setMode('view'); setMsg({});
  };

  const doNew = () => { setForm({}); setSelId(null); setChildren({}); setMode('new'); setMsg({}); };

  const doSave = async () => {
    setMsg({});
    try {
      if (mode === 'edit' && selId) {
        await api.put(`/api/masters/${key}/${selId}`, form);
        setMsg({ ok: 'Record modified successfully.' });
        setMode('view');
      } else {
        const d = await api.post(`/api/masters/${key}`, form);
        setSelId(d.id); setMode('view');
        setMsg({ ok: `Record saved. Code: ${d.id}` });
        const fresh = await api.get(`/api/masters/${key}/${d.id}`);
        setForm(fresh.row); setChildren(fresh.children || {});
      }
      clearOptions(key);
      load(q);
    } catch (e) { setMsg({ err: e.message }); }
  };

  const doDelete = async () => {
    if (!selId || !window.confirm('Delete this record?')) return;
    try {
      await api.del(`/api/masters/${key}/${selId}`);
      clearOptions(key);
      setMsg({ ok: 'Record deleted.' }); doNew(); load(q);
    } catch (e) { setMsg({ err: e.message.includes('FOREIGN') ? 'Record is in use and cannot be deleted.' : e.message }); }
  };

  const nav = async (where) => {
    if (!rows.length) return;
    const idx = rows.findIndex((r) => r.id === selId);
    let next;
    if (where === 'first') next = rows[rows.length - 1];        // rows are DESC; "first" = oldest
    else if (where === 'last') next = rows[0];
    else if (where === 'prev') next = rows[Math.min(rows.length - 1, (idx < 0 ? 0 : idx + 1))];
    else next = rows[Math.max(0, (idx < 0 ? rows.length - 1 : idx - 1))];
    if (next) openRecord(next);
  };

  const addChild = async () => {
    if (!selId || !childTab) return;
    try {
      await api.post(`/api/masters/${key}/${selId}/${childTab}`, childForm);
      const d = await api.get(`/api/masters/${key}/${selId}`);
      setChildren(d.children || {}); setChildForm({});
      setMsg({ ok: 'Detail row added.' });
    } catch (e) { setMsg({ err: e.message }); }
  };

  const delChild = async (cid) => {
    await api.del(`/api/masters/${key}/${selId}/${childTab}/${cid}`);
    const d = await api.get(`/api/masters/${key}/${selId}`);
    setChildren(d.children || {});
  };

  const childMeta = (meta.children || []).find((c) => c.table === childTab);
  const listCols = meta.fields.slice(0, 6).map((f) => ({
    key: f.name, label: f.label,
    render: (r) => (f.type === 'select' ? (r[`${f.name}__name`] ?? r[f.name]) : r[f.name]),
  }));

  return (
    <div>
      <h2>{meta.label} Master</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Section {meta.section} · {meta.group}</div>
      {meta.help && <div className="help">{meta.help}</div>}
      <Msg {...msg} />

      <div className="panel">
        <Toolbar
          onNew={doNew}
          onSave={doSave}
          canSave={mode !== 'view'}
          onModify={() => setMode('edit')}
          onDelete={doDelete}
          onClear={() => { setForm({}); setMsg({}); if (mode === 'edit') setMode('view'); }}
          nav={nav}
          mode={mode}
          extra={
            <>
              <input style={{ width: 220 }} placeholder="🔍 Query (type & press Enter)" value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load(q)} />
              <button className="btn sec sm" onClick={() => load(q)}>⚡ Execute</button>
            </>
          }
        />
        <div className="grid g4">
          <div className="field">
            <label>Code</label>
            <input readOnly className="ro" value={selId ?? '(auto generated)'} />
          </div>
          {meta.fields.map((f) => (
            <div key={f.name} className={f.type === 'textarea' ? 'span2' : ''}>
              <Field f={f} value={form[f.name]} onChange={set} disabled={mode === 'view'} />
            </div>
          ))}
        </div>
      </div>

      {meta.children?.length > 0 && (
        <div className="panel">
          <h3>Detail Tabs {selId ? '' : '(save the main record first)'}</h3>
          <Tabs tabs={meta.children.map((c) => c.label)}
            active={childMeta?.label}
            onChange={(label) => { setChildTab(meta.children.find((c) => c.label === label).table); setChildForm({}); }} />
          {childMeta && selId && (
            <>
              <div className="grid g4" style={{ marginBottom: 10 }}>
                {childMeta.fields.map((f) => (
                  <Field key={f.name} f={f} value={childForm[f.name]}
                    onChange={(n, v) => setChildForm((c) => ({ ...c, [n]: v }))} />
                ))}
                <div style={{ alignSelf: 'end' }}>
                  <button className="btn sm" onClick={addChild}>➕ Submit</button>{' '}
                  <button className="btn sec sm" onClick={() => setChildForm({})}>Clear</button>
                </div>
              </div>
              <DataTable
                rows={children[childTab] || []}
                columns={[
                  ...childMeta.fields.map((f) => ({ key: f.name, label: f.label })),
                  { key: '_del', label: '', render: (r) => <button className="btn danger sm" onClick={() => delChild(r.id)}>✕</button> },
                ]}
              />
            </>
          )}
        </div>
      )}

      <div className="panel">
        <h3>Records ({rows.length})</h3>
        <DataTable rows={rows} columns={[{ key: 'id', label: 'Code' }, ...listCols]} selectedId={selId} onRowClick={openRecord} maxHeight="40vh" />
      </div>
    </div>
  );
}
