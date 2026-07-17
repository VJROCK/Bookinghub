import React from 'react';
import { Link } from 'react-router-dom';
import { api, fmt, today } from '../api';
import { useAsync, DataTable } from '../components';

export default function Dashboard() {
  const { data: bookings } = useAsync(() => api.get('/api/bookings?limit=8'), []);
  const { data: rev } = useAsync(() => api.post('/api/reports/issue_wise_business', {}), []);
  const { data: pending } = useAsync(() => api.get('/api/billing/pending'), []);

  const totalGross = (bookings || []).reduce((s, b) => s + (b.gross_amount || 0), 0);
  const unaudited = (bookings || []).filter((b) => b.audit_status === 'UNAUDITED').length;

  return (
    <div>
      <h2>Welcome to BookingHub</h2>
      <div className="muted" style={{ marginBottom: 14 }}>Advertisement Booking System — Masters · Transactions · Reports · Settings</div>
      <div className="kpis">
        <div className="kpi"><div className="v">{bookings?.length ?? '…'}</div><div className="l">Recent Bookings</div></div>
        <div className="kpi"><div className="v">₹ {fmt(totalGross)}</div><div className="l">Gross (recent)</div></div>
        <div className="kpi"><div className="v">{unaudited}</div><div className="l">Pending Audit</div></div>
        <div className="kpi"><div className="v">{pending?.rows?.length ?? '…'}</div><div className="l">Ready for Billing</div></div>
      </div>
      <div className="panel">
        <h3>Quick Actions</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn" to="/transactions/display-booking">➕ Display Booking</Link>
          <Link className="btn" to="/transactions/classified-booking">➕ Classified Booking</Link>
          <Link className="btn sec" to="/transactions/qbc">⚡ QBC Quick Booking</Link>
          <Link className="btn sec" to="/transactions/booking-audit">✔ Booking Audit</Link>
          <Link className="btn sec" to="/billing">🧾 Billing</Link>
          <Link className="btn sec" to="/reports">📊 Reports</Link>
        </div>
      </div>
      <div className="panel">
        <h3>Latest Bookings</h3>
        <DataTable
          rows={bookings || []}
          columns={[
            { key: 'booking_no', label: 'Booking No' }, { key: 'ad_type', label: 'Type' },
            { key: 'booking_date', label: 'Date' },
            { key: 'agency_name', label: 'Agency' },
            { key: 'client_name', label: 'Client', render: (r) => r.client_master_name || r.client_name },
            { key: 'caption', label: 'Caption' },
            { key: 'gross_amount', label: 'Gross', render: (r) => fmt(r.gross_amount) },
            { key: 'audit_status', label: 'Audit', render: (r) => <span className={`badge ${r.audit_status === 'AUDITED' ? 'ok' : 'pend'}`}>{r.audit_status}</span> },
            { key: 'bill_status', label: 'Bill', render: (r) => <span className={`badge ${r.bill_status === 'BILLED' ? 'ok' : 'pend'}`}>{r.bill_status}</span> },
          ]}
        />
      </div>
      <div className="panel">
        <h3>Edition Wise Business (all time)</h3>
        <DataTable rows={rev?.rows || []} />
      </div>
    </div>
  );
}
