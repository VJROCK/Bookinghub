import React, { useState } from 'react';
import { api, fmt, today } from '../api';
import { DataTable, Modal, Msg, RefSelect } from '../components';

/* Shared booking-detail viewer (click a booking id anywhere in the workflow screens) */
export function BookingDetail({ id, onClose }) {
  const [b, setB] = useState(null);
  React.useEffect(() => { api.get(`/api/bookings/${id}`).then(setB); }, [id]);
  if (!b) return null;
  const L = ({ l, v }) => <div><label>{l}</label><div>{v ?? '—'}</div></div>;
  return (
    <Modal title={`Booking ${b.booking_no}`} wide onClose={onClose}>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <L l="Ad Type" v={b.ad_type} /><L l="Booking Date" v={b.booking_date} />
        <L l="RO No / Date" v={`${b.ro_no || b.dockit_no || ''} ${b.ro_date || ''}`} /><L l="RO Status" v={b.ro_status} />
        <L l="Agency" v={b.agency_name} /><L l="Client" v={b.client_master_name || b.client_name} />
        <L l="Category" v={b.category_name} /><L l="Color / UOM" v={`${b.color_name || ''} / ${b.uom_name || ''}`} />
        <L l="Caption" v={b.caption} /><L l="Size" v={b.no_of_lines ? `${b.no_of_lines} lines` : `${b.height || ''}×${b.width || ''}`} />
        <L l="Insertions" v={`${b.no_of_insertions} (paid ${b.paid_insertions})`} /><L l="Card Rate" v={fmt(b.card_rate)} />
        <L l="Gross" v={`₹ ${fmt(b.gross_amount)}`} /><L l="Trade Disc" v={fmt(b.trade_discount)} />
        <L l="Bill Amount" v={`₹ ${fmt(b.bill_amount)}`} /><L l="Status" v={`${b.status} / ${b.audit_status} / Rate: ${b.rate_audit_status} / Bill: ${b.bill_status}`} />
      </div>
      {b.matter && <div className="matter-preview" style={{ marginBottom: 12 }}><b>{b.caption}</b><br />{b.matter}</div>}
      <h3>Insertion Schedule</h3>
      <DataTable rows={b.insertions || []} columns={[
        { key: 'publish_date', label: 'Publish Date' },
        { key: 'edition_alias', label: 'Edition', render: (r) => r.edition_alias || r.edition_name },
        { key: 'amount', label: 'Amount', render: (r) => fmt(r.amount) },
        { key: 'status', label: 'Status', render: (r) => <span className={`badge ${r.status === 'PUBLISHED' || r.status === 'BILLED' ? 'ok' : r.status === 'CANCELLED' ? 'bad' : 'pend'}`}>{r.status}</span> },
      ]} />
    </Modal>
  );
}

/* generic filter + grid + bulk-action screen used by all four workflow forms */
function WorkflowScreen({ title, section, help, filters, fetchRows, columns, actions, detailKey = 'id' }) {
  const [f, setF] = useState({ from: today(-30), to: today(30), ...filters?.init });
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState([]);
  const [msg, setMsg] = useState({});
  const [detail, setDetail] = useState(null);
  const [comments, setComments] = useState('');

  const run = async () => {
    setMsg({});
    try { setRows(await fetchRows(f)); setSel([]); } catch (e) { setMsg({ err: e.message }); }
  };
  React.useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  const doAction = async (a) => {
    if (!sel.length) { setMsg({ err: 'Select at least one row first.' }); return; }
    try {
      await a.run(sel, comments);
      setMsg({ ok: `${a.label}: ${sel.length} record(s) processed.` });
      run();
    } catch (e) { setMsg({ err: e.message }); }
  };

  return (
    <div>
      <h2>{title}</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Manual section {section}</div>
      {help && <div className="help">{help}</div>}
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g5" style={{ marginBottom: 10 }}>
          <div className="field"><label>From Date</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="field"><label>To Date</label><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          {(filters?.extra || []).map((x) => (
            <div className="field" key={x.name}>
              <label>{x.label}</label>
              {x.type === 'ref'
                ? <RefSelect refTable={x.ref} value={f[x.name]} onChange={(v) => setF({ ...f, [x.name]: v })} />
                : (
                  <select value={f[x.name] ?? ''} onChange={(e) => setF({ ...f, [x.name]: e.target.value })}>
                    {x.options.map((o) => <option key={o} value={o}>{o || '-- all --'}</option>)}
                  </select>
                )}
            </div>
          ))}
          <div style={{ alignSelf: 'end' }}>
            <button className="btn" onClick={run}>Submit</button>{' '}
            <button className="btn sec" onClick={() => setSel(rows.map((r) => r[detailKey]))}>Select All</button>
          </div>
        </div>
        <DataTable rows={rows} selectable selected={sel} idKey={detailKey}
          onToggle={(id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])}
          onRowClick={(r) => setDetail(r.booking_id || r.id)}
          columns={columns} maxHeight="48vh" />
        <div className="toolbar" style={{ marginTop: 10 }}>
          <input style={{ width: 300 }} placeholder="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
          {actions.map((a) => (
            <button key={a.label} className={`btn ${a.kind || ''}`} onClick={() => doAction(a)}>{a.label}</button>
          ))}
        </div>
      </div>
      {detail && <BookingDetail id={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

const bookingCols = (statusField, statusLabel) => [
  { key: 'booking_no', label: 'Booking ID' }, { key: 'ad_type', label: 'Type' },
  { key: 'booking_date', label: 'Booked' }, { key: 'ro_no', label: 'RO No' },
  { key: 'agency_name', label: 'Agency' },
  { key: 'client', label: 'Client', render: (r) => r.client_master_name || r.client_name },
  { key: 'category_name', label: 'Category' }, { key: 'caption', label: 'Caption' },
  { key: 'publish_date', label: 'Publish' },
  { key: 'gross_amount', label: 'Gross', render: (r) => fmt(r.gross_amount) },
  { key: statusField, label: statusLabel, render: (r) => <span className={`badge ${['AUDITED', 'PASSED', 'CONFIRM'].includes(r[statusField]) ? 'ok' : 'pend'}`}>{r[statusField]}</span> },
];

/* 5.5 Confirm / Unconfirm Ads */
export function ConfirmAds() {
  return (
    <WorkflowScreen
      title="Confirm / Unconfirm Ads" section="5.5"
      help="ROs booked as 'Reservation' (or without RO No.) appear here. Select bookings and click Confirm RO. Click a row to view full booking details."
      filters={{
        init: { ro_status: 'RESERVATION' },
        extra: [
          { name: 'ro_status', label: 'Booking Status', options: ['', 'RESERVATION', 'CONFIRM'] },
          { name: 'agency_id', label: 'Agency', type: 'ref', ref: 'agency' },
        ],
      }}
      fetchRows={(f) => api.get(`/api/bookings?from=${f.from}&to=${f.to}&ro_status=${f.ro_status || ''}&agency_id=${f.agency_id || ''}`)}
      columns={bookingCols('ro_status', 'RO Status')}
      actions={[
        { label: '✔ Confirm RO', run: (ids) => api.post('/api/bookings/confirm', { ids, action: 'CONFIRM' }) },
        { label: 'Unconfirm', kind: 'warn', run: (ids) => api.post('/api/bookings/confirm', { ids, action: 'UNCONFIRM' }) },
      ]}
    />
  );
}

/* 5.6 Booking Audit */
export function BookingAudit() {
  return (
    <WorkflowScreen
      title="Booking Audit" section="5.6"
      help="Audited & passed bookings flow to the page; unaudited ads are not exported. Auditor comments are saved with the booking."
      filters={{
        init: { audit_status: 'UNAUDITED' },
        extra: [
          { name: 'ad_type', label: 'Ad Type', options: ['', 'DISPLAY', 'CLASSIFIED'] },
          { name: 'audit_status', label: 'Audit Type', options: ['', 'UNAUDITED', 'AUDITED'] },
          { name: 'branch_id', label: 'Branch', type: 'ref', ref: 'branch' },
        ],
      }}
      fetchRows={(f) => api.get(`/api/bookings?from=${f.from}&to=${f.to}&ad_type=${f.ad_type || ''}&audit_status=${f.audit_status || ''}&branch_id=${f.branch_id || ''}`)}
      columns={bookingCols('audit_status', 'Audit')}
      actions={[
        { label: '✔ Audit (Pass)', run: (ids, c) => api.post('/api/bookings/audit', { ids, action: 'AUDIT', comments: c }) },
        { label: 'Unaudit (Fail)', kind: 'warn', run: (ids, c) => api.post('/api/bookings/audit', { ids, action: 'UNAUDIT', comments: c }) },
      ]}
    />
  );
}

/* 5.7 Publish Audit — insertion level */
export function PublishAudit() {
  return (
    <WorkflowScreen
      title="Publish Audit" section="5.7"
      help="Change insertion status from Booked to Published once pagination is done. Published insertions flow to Rate Audit / Billing."
      filters={{
        init: { status: 'BOOKED' },
        extra: [
          { name: 'status', label: 'Status Type', options: ['', 'BOOKED', 'PUBLISHED'] },
          { name: 'ad_type', label: 'Ad Type', options: ['', 'DISPLAY', 'CLASSIFIED'] },
          { name: 'publication_id', label: 'Publication', type: 'ref', ref: 'publication' },
          { name: 'edition_id', label: 'Edition', type: 'ref', ref: 'edition' },
        ],
      }}
      fetchRows={(f) => api.get(`/api/bookings/insertions/list?from=${f.from}&to=${f.to}&status=${f.status || ''}&ad_type=${f.ad_type || ''}&publication_id=${f.publication_id || ''}&edition_id=${f.edition_id || ''}`)}
      columns={[
        { key: 'booking_no', label: 'Booking ID' }, { key: 'ro_no', label: 'RO No' },
        { key: 'edition_alias', label: 'Edition', render: (r) => r.edition_alias || r.edition_name },
        { key: 'publish_date', label: 'Publish Date' },
        { key: 'agency_name', label: 'Agency' }, { key: 'client_name', label: 'Client' },
        { key: 'caption', label: 'Caption' },
        { key: 'amount', label: 'Amount', render: (r) => fmt(r.amount) },
        { key: 'status', label: 'Status', render: (r) => <span className={`badge ${r.status === 'PUBLISHED' ? 'ok' : 'pend'}`}>{r.status}</span> },
      ]}
      actions={[
        { label: '📰 Mark Published', run: (ids) => api.post('/api/bookings/insertions/status', { ids, status: 'PUBLISHED' }) },
        { label: 'Mark Booked', kind: 'warn', run: (ids) => api.post('/api/bookings/insertions/status', { ids, status: 'BOOKED' }) },
        { label: 'Cancel Insertion', kind: 'danger', run: (ids) => api.post('/api/bookings/insertions/status', { ids, status: 'CANCELLED' }) },
      ]}
    />
  );
}

/* 5.8 Rate Audit */
export function RateAudit() {
  return (
    <WorkflowScreen
      title="Rate Audit" section="5.8"
      help="Check rate & amount of published ads before billing. Rejected release orders will not appear for billing. (Preferences → 'Rate Audit required' can switch this step off.)"
      filters={{
        init: { rate_audit_status: 'PENDING', audit_status: 'AUDITED' },
        extra: [
          { name: 'ad_type', label: 'Ad Type', options: ['', 'DISPLAY', 'CLASSIFIED'] },
          { name: 'rate_audit_status', label: 'Status', options: ['', 'PENDING', 'PASSED', 'REJECTED'] },
          { name: 'agency_id', label: 'Agency', type: 'ref', ref: 'agency' },
        ],
      }}
      fetchRows={(f) => api.get(`/api/bookings?from=${f.from}&to=${f.to}&ad_type=${f.ad_type || ''}&rate_audit_status=${f.rate_audit_status || ''}&agency_id=${f.agency_id || ''}&audit_status=AUDITED`)}
      columns={[
        ...bookingCols('rate_audit_status', 'Rate Audit').slice(0, -1),
        { key: 'card_rate', label: 'Card Rate', render: (r) => fmt(r.card_rate) },
        { key: 'agreed_rate', label: 'Agreed', render: (r) => fmt(r.agreed_rate) },
        { key: 'rate_audit_status', label: 'Rate Audit', render: (r) => <span className={`badge ${r.rate_audit_status === 'PASSED' ? 'ok' : r.rate_audit_status === 'REJECTED' ? 'bad' : 'pend'}`}>{r.rate_audit_status}</span> },
      ]}
      actions={[
        { label: '✔ Pass', run: (ids, c) => api.post('/api/bookings/rate-audit', { ids, action: 'PASS', comments: c }) },
        { label: '✖ Reject', kind: 'danger', run: (ids, c) => api.post('/api/bookings/rate-audit', { ids, action: 'REJECT', comments: c }) },
      ]}
    />
  );
}
