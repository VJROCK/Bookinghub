import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, today, downloadCSV, fmt } from '../api';
import { DataTable, Msg, RefSelect } from '../components';

/* 6.1 Report Menu — four groups: Ad, MIS, Schedule Register, Billing */
export function ReportsMenu({ reports }) {
  const groups = {};
  for (const r of reports) (groups[r.group] = groups[r.group] || []).push(r);
  const desc = {
    'Ad Reports': 'Daily need reports required from the advertisement department.',
    'MIS Reports': 'Key reports required by the management.',
    'Schedule Register': 'Schedule registers and dynamic exports.',
    'Billing Reports': 'All reports related to billing.',
  };
  return (
    <div>
      <h2>Reports Menu</h2>
      <div className="muted" style={{ marginBottom: 12 }}>Manual 6.1 — all reports are generated from the transaction data (bookings, insertions, bills) joined with the masters.</div>
      {Object.entries(groups).map(([g, items]) => (
        <div className="panel" key={g}>
          <h3>{g}</h3>
          <div className="muted" style={{ marginBottom: 8 }}>{desc[g]}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {items.map((r) => (
              <Link key={r.id} className="btn sec sm" to={`/reports/${r.id}`}>{r.section} · {r.title}</Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* generic report runner: renders filter parameters + output grid + CSV export */
export function ReportRunner({ reports }) {
  const { id } = useParams();
  const meta = reports.find((r) => r.id === id);
  const [params, setParams] = useState({});
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const init = {};
    for (const f of meta?.filters || []) {
      if (f.name === 'from') init.from = today(-30);
      if (f.name === 'to') init.to = today(30);
      if (f.type === 'option' && !f.options.includes('')) init[f.name] = f.options[0];
    }
    setParams(init); setData(null); setMsg({});
  }, [id, meta]);

  if (!meta) return <div className="panel">Loading report…</div>;

  const run = async () => {
    setBusy(true); setMsg({});
    try { setData(await api.post(`/api/reports/${id}`, params)); }
    catch (e) { setMsg({ err: e.message }); }
    finally { setBusy(false); }
  };

  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }));
  const numericTotals = data?.rows?.length
    ? Object.keys(data.rows[0]).filter((k) => data.rows.every((r) => r[k] == null || typeof r[k] === 'number'))
    : [];

  return (
    <div>
      <h2>{meta.title}</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Report {meta.section} · {meta.group}</div>
      {meta.help && <div className="help">{meta.help}</div>}
      <Msg {...msg} />
      <div className="panel">
        <h3>Report Filter Parameters</h3>
        <div className="grid g4" style={{ marginBottom: 10 }}>
          {meta.filters.map((f) => (
            <div className="field" key={f.name}>
              <label>{f.label}</label>
              {f.type === 'date' && <input type="date" value={params[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />}
              {f.type === 'number' && <input type="number" value={params[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder="10" />}
              {f.type === 'text' && <input value={params[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />}
              {f.type === 'option' && (
                <select value={params[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                  {f.options.map((o) => <option key={o} value={o}>{o || '-- all --'}</option>)}
                </select>
              )}
              {f.type === 'select' && <RefSelect refTable={f.ref} value={params[f.name]} onChange={(v) => set(f.name, v)} />}
            </div>
          ))}
        </div>
        <div className="toolbar">
          <button className="btn" disabled={busy} onClick={run}>{busy ? 'Running…' : '▶ Run Report (Screen)'}</button>
          {data?.rows?.length > 0 && (
            <button className="btn sec" onClick={() => downloadCSV(data.rows, `${id}.csv`)}>⬇ Destination: Excel/CSV</button>
          )}
        </div>
      </div>
      {data && (
        <div className="panel">
          <h3>Output — {data.rows.length} row(s)</h3>
          <DataTable rows={data.rows} maxHeight="58vh" idKey="__i" />
          {data.rows.length > 0 && numericTotals.length > 0 && (
            <div className="total-strip">
              {numericTotals.slice(0, 6).map((k) => (
                <span key={k}>{k}: <b>{fmt(data.rows.reduce((s, r) => s + (r[k] || 0), 0))}</b></span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
