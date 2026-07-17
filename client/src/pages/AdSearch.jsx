import React, { useState } from 'react';
import { api, fmt, today } from '../api';
import { DataTable, RefSelect } from '../components';
import { BookingDetail } from './WorkflowPages';

/* 7.1 Ad Search — find any booking/insertion by matter, agency, date, executive etc. */
export default function AdSearch() {
  const [f, setF] = useState({ q: '', from: '', to: '', date_field: 'booking_date', ad_type: '', agency_id: '', client_id: '' });
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    const qs = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    setRows(await api.get(`/api/bookings?${qs}`));
    setSearched(true);
  };

  return (
    <div>
      <h2>Ad Search</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Manual 7.1 — search an advertisement by matter, agency, client, date or executive. Click a receipt to view booking details.</div>
      <div className="panel">
        <div className="grid g4" style={{ marginBottom: 10 }}>
          <div className="field span2"><label>Search text (booking no / RO / caption / matter / agency / client)</label>
            <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && run()} autoFocus /></div>
          <div className="field"><label>Ad Type</label>
            <select value={f.ad_type} onChange={(e) => setF({ ...f, ad_type: e.target.value })}>
              {['', 'DISPLAY', 'CLASSIFIED'].map((o) => <option key={o} value={o}>{o || '-- all --'}</option>)}
            </select></div>
          <div className="field"><label>Date Based On</label>
            <select value={f.date_field} onChange={(e) => setF({ ...f, date_field: e.target.value })}>
              <option value="booking_date">Booking Date</option>
              <option value="publish_date">Publish Date</option>
              <option value="ro_date">RO Date</option>
            </select></div>
          <div className="field"><label>From</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="field"><label>To</label><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div className="field"><label>Agency</label><RefSelect refTable="agency" value={f.agency_id} onChange={(v) => setF({ ...f, agency_id: v })} /></div>
          <div className="field"><label>Client</label><RefSelect refTable="client" value={f.client_id} onChange={(v) => setF({ ...f, client_id: v })} /></div>
        </div>
        <button className="btn" onClick={run}>🔍 Submit</button>
      </div>
      {searched && (
        <div className="panel">
          <h3>Results ({rows.length})</h3>
          <DataTable rows={rows} onRowClick={(r) => setDetail(r.id)} columns={[
            { key: 'booking_no', label: 'Receipt/Booking No' }, { key: 'ad_type', label: 'Type' },
            { key: 'booking_date', label: 'Booked' }, { key: 'publish_date', label: 'Publish' },
            { key: 'agency_name', label: 'Agency' },
            { key: 'client', label: 'Client', render: (r) => r.client_master_name || r.client_name },
            { key: 'executive_name', label: 'Executive' }, { key: 'caption', label: 'Caption' },
            { key: 'gross_amount', label: 'Gross', render: (r) => fmt(r.gross_amount) },
            { key: 'status', label: 'Status', render: (r) => <span className={`badge ${r.status === 'BOOKED' ? 'ok' : 'bad'}`}>{r.status}</span> },
          ]} />
        </div>
      )}
      {detail && <BookingDetail id={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
