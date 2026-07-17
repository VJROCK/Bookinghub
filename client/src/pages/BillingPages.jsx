import React, { useEffect, useState } from 'react';
import { api, fmt, today, downloadCSV } from '../api';
import { DataTable, Msg, RefSelect } from '../components';
import { BookingDetail } from './WorkflowPages';

/* 8.1 Billing */
export function Billing() {
  const [f, setF] = useState({ ad_type: '', from: '', to: '', agency_id: '' });
  const [pending, setPending] = useState({ rows: [], rate_audit_required: true });
  const [bills, setBills] = useState([]);
  const [sel, setSel] = useState([]);
  const [taxPct, setTaxPct] = useState(5);
  const [msg, setMsg] = useState({});
  const [detail, setDetail] = useState(null);

  const load = async () => {
    const qs = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&');
    setPending(await api.get(`/api/billing/pending?${qs}`));
    setBills(await api.get('/api/billing/bills'));
    setSel([]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const generate = async () => {
    if (!sel.length) { setMsg({ err: 'Select bookings to bill.' }); return; }
    try {
      const d = await api.post('/api/billing/generate', { ids: sel, tax_pct: taxPct });
      setMsg({ ok: `Generated ${d.bills.length} bill(s): ${d.bills.join(', ')}` });
      load();
    } catch (e) { setMsg({ err: e.message }); }
  };

  return (
    <div>
      <h2>Billing</h2>
      <div className="muted" style={{ marginBottom: 8 }}>
        Manual 8.1 — audited{pending.rate_audit_required ? ' + rate-audit passed' : ''} bookings with published insertions appear here for final billing.
      </div>
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g5" style={{ marginBottom: 10 }}>
          <div className="field"><label>Ad Type</label>
            <select value={f.ad_type} onChange={(e) => setF({ ...f, ad_type: e.target.value })}>
              {['', 'DISPLAY', 'CLASSIFIED'].map((o) => <option key={o} value={o}>{o || '-- all --'}</option>)}
            </select></div>
          <div className="field"><label>From (booking date)</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="field"><label>To</label><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div className="field"><label>Agency</label><RefSelect refTable="agency" value={f.agency_id} onChange={(v) => setF({ ...f, agency_id: v })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={load}>Submit</button></div>
        </div>
        <h3>Ready for Billing ({pending.rows.length})</h3>
        <DataTable rows={pending.rows} selectable selected={sel}
          onToggle={(id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])}
          onRowClick={(r) => setDetail(r.id)}
          columns={[
            { key: 'booking_no', label: 'Booking' }, { key: 'ad_type', label: 'Type' },
            { key: 'ro_no', label: 'RO No' }, { key: 'agency_name', label: 'Agency' },
            { key: 'client_name', label: 'Client' }, { key: 'caption', label: 'Caption' },
            { key: 'published_insertions', label: 'Published Ins.' },
            { key: 'gross_amount', label: 'Gross', render: (r) => fmt(r.gross_amount) },
            { key: 'trade_discount', label: 'Trade Disc', render: (r) => fmt(r.trade_discount) },
            { key: 'bill_amount', label: 'Bill Amount', render: (r) => fmt(r.bill_amount) },
            { key: 'bill_to', label: 'Bill To' },
          ]} />
        <div className="toolbar" style={{ marginTop: 10 }}>
          <div className="field" style={{ width: 120 }}><label>Tax %</label>
            <input type="number" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} /></div>
          <button className="btn" style={{ alignSelf: 'end' }} onClick={generate}>🧾 Generate Bills</button>
          <button className="btn sec" style={{ alignSelf: 'end' }} onClick={() => setSel(pending.rows.map((r) => r.id))}>Select All</button>
        </div>
      </div>
      <div className="panel">
        <h3>Bill Register</h3>
        <div className="toolbar"><button className="btn sec sm" onClick={() => downloadCSV(bills, 'bill_register.csv')}>⬇ Export CSV</button></div>
        <DataTable rows={bills} columns={[
          { key: 'bill_no', label: 'Bill No' }, { key: 'bill_date', label: 'Date' },
          { key: 'booking_no', label: 'Booking' }, { key: 'agency_name', label: 'Agency' },
          { key: 'client_name', label: 'Client' },
          { key: 'gross_amount', label: 'Gross', render: (r) => fmt(r.gross_amount) },
          { key: 'trade_discount', label: 'Trade Disc', render: (r) => fmt(r.trade_discount) },
          { key: 'tax_amount', label: 'Tax', render: (r) => fmt(r.tax_amount) },
          { key: 'net_amount', label: 'Net', render: (r) => fmt(r.net_amount) },
          { key: 'status', label: 'Status', render: (r) => <span className={`badge ${r.status === 'ACTIVE' ? 'ok' : 'bad'}`}>{r.status}</span> },
          { key: 'revised_from', label: 'Revised From' },
        ]} />
      </div>
      {detail && <BookingDetail id={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* 8.2 Revised Billing */
export function RevisedBilling() {
  const [billNo, setBillNo] = useState('');
  const [taxPct, setTaxPct] = useState('');
  const [msg, setMsg] = useState({});
  const [bills, setBills] = useState([]);
  const load = () => api.get('/api/billing/bills').then(setBills);
  useEffect(() => { load(); }, []);
  const revise = async () => {
    setMsg({});
    try {
      const d = await api.post('/api/billing/revise', { bill_no: billNo, tax_pct: taxPct === '' ? null : taxPct });
      setMsg({ ok: `Bill ${d.old_bill} cancelled — new bill ${d.new_bill} generated with current booking amounts.` });
      setBillNo(''); load();
    } catch (e) { setMsg({ err: e.message }); }
  };
  return (
    <div>
      <h2>Revised Billing</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Manual 8.2 — cancel an existing bill and regenerate it with a new bill number after the booking was corrected.</div>
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g4">
          <div className="field"><label>Bill No.</label>
            <input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="e.g. BILL-26-1001" /></div>
          <div className="field"><label>New Tax % (blank = keep)</label>
            <input type="number" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={revise}>↺ Go (Regenerate Bill)</button></div>
        </div>
      </div>
      <div className="panel">
        <h3>All Bills</h3>
        <DataTable rows={bills} onRowClick={(r) => setBillNo(r.bill_no)} columns={[
          { key: 'bill_no', label: 'Bill No' }, { key: 'bill_date', label: 'Date' },
          { key: 'booking_no', label: 'Booking' }, { key: 'agency_name', label: 'Agency' },
          { key: 'net_amount', label: 'Net', render: (r) => fmt(r.net_amount) },
          { key: 'status', label: 'Status', render: (r) => <span className={`badge ${r.status === 'ACTIVE' ? 'ok' : 'bad'}`}>{r.status}</span> },
          { key: 'revised_from', label: 'Revised From' },
        ]} />
      </div>
    </div>
  );
}
