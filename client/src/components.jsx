import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, options as loadOptions, fmt } from './api';

/* ---------- generic form field driven by master config ---------- */
export function Field({ f, value, onChange, disabled }) {
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    let live = true;
    if (f.type === 'select' && f.ref) loadOptions(f.ref).then((o) => live && setOpts(o)).catch(() => {});
    return () => { live = false; };
  }, [f.ref, f.type]);

  const common = {
    value: value ?? '',
    disabled: disabled || !!f.ro,
    onChange: (e) => onChange(f.name, e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value),
  };
  let input;
  if (f.type === 'select') {
    input = (
      <select {...common}>
        <option value="">-- select --</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    );
  } else if (f.type === 'option') {
    input = (
      <select {...common}>
        {!f.options.includes('') && <option value="">-- select --</option>}
        {f.options.map((o) => <option key={o} value={o}>{o || '-- any --'}</option>)}
      </select>
    );
  } else if (f.type === 'textarea') {
    input = <textarea rows={2} {...common} />;
  } else if (f.type === 'check') {
    input = <input type="checkbox" checked={!!value} style={{ width: 'auto' }} onChange={common.onChange} disabled={common.disabled} />;
  } else {
    input = <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'} step="any" {...common} className={f.ro ? 'ro' : ''} readOnly={!!f.ro} />;
  }
  return (
    <div className="field">
      <label>{f.label}{f.req ? <span style={{ color: '#b91c1c' }}> *</span> : null}</label>
      {input}
    </div>
  );
}

/* ---------- data table ---------- */
export function DataTable({ rows, columns, onRowClick, selectedId, idKey = 'id', maxHeight, selectable, selected, onToggle, footer }) {
  const cols = columns || (rows.length ? Object.keys(rows[0]).filter((c) => !c.endsWith('__name') && c !== idKey) : []);
  return (
    <div className="dt-wrap" style={maxHeight ? { maxHeight } : undefined}>
      <table className="dt">
        <thead>
          <tr>
            {selectable && <th style={{ width: 30 }}></th>}
            {cols.map((c) => <th key={typeof c === 'string' ? c : c.key}>{typeof c === 'string' ? c.replace(/_/g, ' ') : c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[idKey] ?? JSON.stringify(r)} className={selectedId === r[idKey] ? 'sel' : ''}
              onClick={() => onRowClick && onRowClick(r)} style={onRowClick ? { cursor: 'pointer' } : undefined}>
              {selectable && (
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={selected?.includes(r[idKey]) || false}
                    onChange={() => onToggle(r[idKey])} />
                </td>
              )}
              {cols.map((c) => {
                const key = typeof c === 'string' ? c : c.key;
                const render = typeof c === 'object' && c.render;
                let v = render ? render(r) : r[key];
                if (v == null) v = '';
                const isNum = typeof v === 'number';
                return <td key={key} className={isNum ? 'num' : ''}>{isNum ? fmt(v) : v}</td>;
              })}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={cols.length + (selectable ? 1 : 0)} style={{ textAlign: 'center', color: '#94a3b8', padding: 18 }}>No records found</td></tr>}
        </tbody>
        {footer}
      </table>
    </div>
  );
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={wide ? { width: 'min(1050px,96vw)' } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="m-head">{title}<button className="btn sec sm" onClick={onClose}>✕ Close</button></div>
        <div className="m-body">{children}</div>
        {footer && <div className="m-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- F2-style lookup (manual: press F2 to search agency/client) ---------- */
export function Lookup({ label, refTable, value, display, onPick, allowFreeText, freeText, onFreeText, required }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const search = async (term) => {
    const d = await api.get(`/api/masters/${refTable}?q=${encodeURIComponent(term || '')}&limit=50`);
    setRows(d.rows);
  };
  useEffect(() => { if (open) search(q); /* eslint-disable-next-line */ }, [open]);
  return (
    <div className="field">
      <label>{label}{required && <span style={{ color: '#b91c1c' }}> *</span>} <span className="muted">(F2)</span></label>
      <div style={{ display: 'flex', gap: 5 }}>
        <input
          value={display ?? freeText ?? ''}
          placeholder={allowFreeText ? 'Type walk-in name or press F2' : 'Press F2 or click Search'}
          onKeyDown={(e) => { if (e.key === 'F2') { e.preventDefault(); setOpen(true); } }}
          onChange={(e) => { if (allowFreeText) { onFreeText && onFreeText(e.target.value); } }}
          readOnly={!allowFreeText}
          className={!allowFreeText ? 'ro' : ''}
        />
        <button type="button" className="btn sec sm" onClick={() => setOpen(true)}>🔍</button>
        {value != null && <button type="button" className="btn sec sm" title="Clear" onClick={() => onPick(null)}>✕</button>}
      </div>
      {open && (
        <Modal title={`Search ${label}`} onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input autoFocus placeholder="Type to search..." value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(q)} />
            <button className="btn sm" onClick={() => search(q)}>Search</button>
          </div>
          <DataTable rows={rows} columns={['name', 'alias'].filter((c) => rows.length ? c in rows[0] : true)}
            maxHeight="46vh"
            onRowClick={(r) => { onPick(r); setOpen(false); }} />
        </Modal>
      )}
    </div>
  );
}

/* ---------- toolbar per manual section 3.2 ---------- */
export function Toolbar({ onNew, onSave, onModify, onDelete, onClear, nav, canSave, mode, extra }) {
  return (
    <div className="toolbar">
      {onNew && <button className="btn sec sm" onClick={onNew}>➕ New</button>}
      {onSave && <button className="btn sm" disabled={canSave === false} onClick={onSave}>💾 Save</button>}
      {onModify && <button className="btn warn sm" disabled={mode !== 'view'} onClick={onModify}>✏️ Modify</button>}
      {onDelete && <button className="btn danger sm" disabled={mode !== 'view'} onClick={onDelete}>🗑 Delete</button>}
      {onClear && <button className="btn sec sm" onClick={onClear}>🧹 Clear</button>}
      {nav && (
        <>
          <button className="btn sec sm" onClick={() => nav('first')} title="First">⏮</button>
          <button className="btn sec sm" onClick={() => nav('prev')} title="Previous">◀</button>
          <button className="btn sec sm" onClick={() => nav('next')} title="Next">▶</button>
          <button className="btn sec sm" onClick={() => nav('last')} title="Last">⏭</button>
        </>
      )}
      {extra}
    </div>
  );
}

/* ---------- tabs ---------- */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t} className={active === t ? 'on' : ''} onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  );
}

export function useAsync(fn, deps) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true); setErr(null);
    try { setData(await fn()); } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, deps);
  return { data, err, loading, reload, setData };
}

export function Msg({ ok, err }) {
  if (err) return <div className="msg-err">{err}</div>;
  if (ok) return <div className="msg-ok">{ok}</div>;
  return null;
}

/* select bound to a master options list (for filters etc.) */
export function RefSelect({ refTable, value, onChange, placeholder = '-- all --' }) {
  const [opts, setOpts] = useState([]);
  useEffect(() => { loadOptions(refTable).then(setOpts).catch(() => {}); }, [refTable]);
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}
