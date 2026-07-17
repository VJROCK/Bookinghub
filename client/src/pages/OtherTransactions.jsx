import React, { useEffect, useState } from 'react';
import { api, fmt, today } from '../api';
import { DataTable, Msg, RefSelect, Modal } from '../components';
import { BookingDetail } from './WorkflowPages';

function Page({ title, section, help, children }) {
  return (
    <div>
      <h2>{title}</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Manual section {section}</div>
      {help && <div className="help">{help}</div>}
      {children}
    </div>
  );
}

/* 5.4 Payment Gateway (offline payments register) */
export function PaymentGateway() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ booking_id: '', mode: 'CASH', amount: '', ref_no: '', bank: '', document: '', date: today() });
  const [msg, setMsg] = useState({});
  const load = () => api.get('/api/bookings/payments/list').then(setRows);
  useEffect(() => { load(); }, []);
  const save = async () => {
    setMsg({});
    try {
      await api.post('/api/bookings/payments', f);
      setMsg({ ok: 'Payment recorded.' }); setF({ ...f, amount: '', ref_no: '', document: '' }); load();
    } catch (e) { setMsg({ err: e.message }); }
  };
  return (
    <Page title="Payment Gateway" section="5.4" help="Record payments received against bookings (cash / cheque / online). Offline agencies appear in the Offline Mode report.">
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g5">
          <div className="field"><label>Date</label><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="field"><label>Booking ID (numeric)</label><input value={f.booking_id} onChange={(e) => setF({ ...f, booking_id: e.target.value })} /></div>
          <div className="field"><label>Mode</label>
            <select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
              {['CASH', 'CHEQUE', 'DEMAND DRAFT', 'ONLINE', 'NEFT/RTGS'].map((m) => <option key={m}>{m}</option>)}
            </select></div>
          <div className="field"><label>Amount</label><input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="field"><label>Ref / Cheque No.</label><input value={f.ref_no} onChange={(e) => setF({ ...f, ref_no: e.target.value })} /></div>
          <div className="field"><label>Bank</label><input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></div>
          <div className="field"><label>Document (file ref)</label><input value={f.document} onChange={(e) => setF({ ...f, document: e.target.value })} placeholder="e.g. cheque_scan.pdf" /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={save}>💾 Save Payment</button></div>
        </div>
      </div>
      <div className="panel"><h3>Payments Received</h3>
        <DataTable rows={rows} columns={[
          { key: 'date', label: 'Date' }, { key: 'booking_no', label: 'Booking' }, { key: 'agency_name', label: 'Agency' },
          { key: 'mode', label: 'Mode' }, { key: 'amount', label: 'Amount', render: (r) => fmt(r.amount) },
          { key: 'ref_no', label: 'Ref' }, { key: 'received_by', label: 'Received By' }]} />
      </div>
    </Page>
  );
}

/* 5.9 Proof Reading */
export function ProofReading() {
  const [f, setF] = useState({ from: today(-7), to: today(7), ad_category_id: '' });
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const run = () => api.get(`/api/bookings?ad_type=CLASSIFIED&from=${f.from}&to=${f.to}&date_field=publish_date${f.ad_category_id ? `&ad_category_id=${f.ad_category_id}` : ''}`).then(setRows);
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);
  return (
    <Page title="Proof Reading" section="5.9" help="Verify the matter of classified ads before printing. Click a booking to read the composed matter; use Mis Updation to correct any words.">
      <div className="panel">
        <div className="grid g5" style={{ marginBottom: 10 }}>
          <div className="field"><label>From</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="field"><label>To</label><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={run}>Submit</button></div>
        </div>
        <DataTable rows={rows.filter((r) => r.matter)} onRowClick={(r) => setDetail(r.id)} columns={[
          { key: 'booking_no', label: 'Booking ID' }, { key: 'category_name', label: 'Category' },
          { key: 'caption', label: 'Caption' },
          { key: 'matter', label: 'Matter (click row to proof)', render: (r) => (r.matter || '').slice(0, 80) + ((r.matter || '').length > 80 ? '…' : '') },
          { key: 'publish_date', label: 'Publish' }]} />
      </div>
      {detail && <BookingDetail id={detail} onClose={() => setDetail(null)} />}
    </Page>
  );
}

/* 5.10 Deal Audit + 5.11 Deal Provision — contract views */
function DealsBase({ title, section, help, provision }) {
  const [f, setF] = useState({ from: '', to: '', agency_id: '', client_id: '', status: '' });
  const [data, setData] = useState({ rows: [] });
  const run = () => api.post('/api/reports/deal_report', f).then(setData);
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);
  return (
    <Page title={title} section={section} help={help}>
      <div className="panel">
        <div className="grid g5" style={{ marginBottom: 10 }}>
          <div className="field"><label>Valid From</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="field"><label>Valid To</label><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div className="field"><label>Agency</label><RefSelect refTable="agency" value={f.agency_id} onChange={(v) => setF({ ...f, agency_id: v })} /></div>
          <div className="field"><label>Status</label>
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {['', 'CONFIRM', 'RESERVATION', 'CLOSED'].map((o) => <option key={o} value={o}>{o || '-- all --'}</option>)}
            </select></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={run}>Submit</button></div>
        </div>
        <DataTable rows={data.rows || []} />
        {provision && <div className="help" style={{ marginTop: 10 }}>Provision = business consumed vs contract value. See MIS → PI Contract Report for consumed/balance amounts.</div>}
      </div>
    </Page>
  );
}
export const DealAudit = () => <DealsBase title="Deal Audit" section="5.10" help="Check deals (contracts) with agencies and clients — validity, value and status." />;
export const DealProvision = () => <DealsBase title="Deal Provision" section="5.11" provision help="Provision view of running deals." />;

/* 5.12 Rate Expiry */
export function RateExpiry() {
  const [f, setF] = useState({ expiring_before: today(90) });
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState({});
  const run = async () => {
    const d = await api.get('/api/masters/rate_master?limit=500');
    setRows(d.rows.filter((r) => !f.expiring_before || (r.valid_to && r.valid_to <= f.expiring_before)));
  };
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);
  const extend = async (r) => {
    const nd = window.prompt('Extend Valid To (YYYY-MM-DD):', r.valid_to);
    if (!nd) return;
    await api.put(`/api/masters/rate_master/${r.id}`, { valid_to: nd });
    setMsg({ ok: `Rate #${r.id} extended to ${nd}` }); run();
  };
  return (
    <Page title="Rate Expiry" section="5.12" help="Rates expiring before the selected date. Extend validity without re-opening the whole rate.">
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g5" style={{ marginBottom: 10 }}>
          <div className="field"><label>Expiring Before</label><input type="date" value={f.expiring_before} onChange={(e) => setF({ ...f, expiring_before: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={run}>Submit</button></div>
        </div>
        <DataTable rows={rows} columns={[
          { key: 'id', label: 'Rate ID' },
          { key: 'package_id__name', label: 'Package' }, { key: 'ad_category_id__name', label: 'Category' },
          { key: 'uom_id__name', label: 'UOM' }, { key: 'color_id__name', label: 'Color' },
          { key: 'rate', label: 'Rate', render: (r) => fmt(r.rate) },
          { key: 'valid_from', label: 'Valid From' }, { key: 'valid_to', label: 'Valid To' },
          { key: '_x', label: '', render: (r) => <button className="btn sm" onClick={() => extend(r)}>Extend</button> }]} />
      </div>
    </Page>
  );
}

/* 5.13 Follow Up */
export function FollowUp() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ date: today(), agency_id: '', client_id: '', remarks: '', next_date: '' });
  const [msg, setMsg] = useState({});
  const load = () => api.get('/api/bookings/followups/list').then(setRows);
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { await api.post('/api/bookings/followups', f); setMsg({ ok: 'Follow up saved.' }); setF({ ...f, remarks: '' }); load(); }
    catch (e) { setMsg({ err: e.message }); }
  };
  return (
    <Page title="Follow Up" section="5.13" help="Track follow ups with agencies / clients (expiring ads, pending ROs, payments).">
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g5">
          <div className="field"><label>Date</label><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="field"><label>Agency</label><RefSelect refTable="agency" value={f.agency_id} onChange={(v) => setF({ ...f, agency_id: v })} /></div>
          <div className="field"><label>Client</label><RefSelect refTable="client" value={f.client_id} onChange={(v) => setF({ ...f, client_id: v })} /></div>
          <div className="field"><label>Next Follow Up</label><input type="date" value={f.next_date} onChange={(e) => setF({ ...f, next_date: e.target.value })} /></div>
          <div className="field span2"><label>Remarks</label><input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={save}>💾 Save</button></div>
        </div>
      </div>
      <div className="panel"><h3>Follow Ups</h3>
        <DataTable rows={rows} columns={[
          { key: 'date', label: 'Date' }, { key: 'agency_name', label: 'Agency' }, { key: 'client_name', label: 'Client' },
          { key: 'booking_no', label: 'Booking' }, { key: 'remarks', label: 'Remarks' }, { key: 'next_date', label: 'Next Date' },
          { key: 'status', label: 'Status', render: (r) => <span className={`badge ${r.status === 'OPEN' ? 'pend' : 'ok'}`}>{r.status}</span> },
          { key: '_x', label: '', render: (r) => r.status === 'OPEN' && <button className="btn sm" onClick={async () => { await api.post(`/api/bookings/followups/${r.id}/close`); load(); }}>Close</button> }]} />
      </div>
    </Page>
  );
}

/* 5.14 Mis Updation + 5.16 CD Upload share the booking-field correction pattern */
function MisBase({ title, section, help, fields }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState({});
  const run = () => api.get(`/api/bookings?q=${encodeURIComponent(q)}&limit=100`).then(setRows);
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);
  const save = async () => {
    try {
      await api.patch(`/api/bookings/${edit.id}/mis`, form);
      setMsg({ ok: `Booking ${edit.booking_no} updated.` }); setEdit(null); setForm({}); run();
    } catch (e) { setMsg({ err: e.message }); }
  };
  return (
    <Page title={title} section={section} help={help}>
      <Msg {...msg} />
      <div className="panel">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input style={{ maxWidth: 340 }} placeholder="Search booking no / RO / caption / agency..." value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
          <button className="btn" onClick={run}>Search</button>
        </div>
        <DataTable rows={rows} onRowClick={(r) => { setEdit(r); setForm({}); }} columns={[
          { key: 'booking_no', label: 'Booking ID' }, { key: 'ad_type', label: 'Type' },
          { key: 'agency_name', label: 'Agency' },
          { key: 'client', label: 'Client', render: (r) => r.client_master_name || r.client_name },
          { key: 'caption', label: 'Caption' }, { key: 'material_status', label: 'Material' },
          { key: 'executive_name', label: 'Executive' }, { key: 'publish_date', label: 'Publish' }]} />
      </div>
      {edit && (
        <Modal title={`Update ${edit.booking_no}`} onClose={() => setEdit(null)}
          footer={<button className="btn" onClick={save}>💾 Save Changes</button>}>
          <div className="grid g2">
            {fields.map((fl) => (
              <div className="field" key={fl.name}>
                <label>{fl.label}</label>
                {fl.ref
                  ? <RefSelect refTable={fl.ref} value={form[fl.name] ?? edit[fl.name]} onChange={(v) => setForm({ ...form, [fl.name]: v })} placeholder="-- keep / none --" />
                  : fl.type === 'textarea'
                    ? <textarea rows={3} value={form[fl.name] ?? edit[fl.name] ?? ''} onChange={(e) => setForm({ ...form, [fl.name]: e.target.value })} />
                    : fl.options
                      ? <select value={form[fl.name] ?? edit[fl.name] ?? ''} onChange={(e) => setForm({ ...form, [fl.name]: e.target.value })}>{fl.options.map((o) => <option key={o}>{o}</option>)}</select>
                      : <input value={form[fl.name] ?? edit[fl.name] ?? ''} onChange={(e) => setForm({ ...form, [fl.name]: e.target.value })} />}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </Page>
  );
}
export const MisUpdation = () => (
  <MisBase title="Mis Updation" section="5.14"
    help="Correct MIS reference fields (executive, product, brand, caption, page no.) on saved bookings without re-booking."
    fields={[
      { name: 'executive_id', label: 'Executive', ref: 'executive' },
      { name: 'retainer_id', label: 'Retainer', ref: 'retainer' },
      { name: 'product_id', label: 'Product', ref: 'product' },
      { name: 'brand_id', label: 'Brand', ref: 'brand' },
      { name: 'caption', label: 'Caption' },
      { name: 'page_no', label: 'Page No.' },
      { name: 'key_no', label: 'Key No.' },
      { name: 'print_remark', label: 'Print Remark' },
    ]} />
);
export const CdUpload = () => (
  <MisBase title="CD Upload" section="5.16"
    help="Attach / correct the material reference (CD, file name) and material status of a booking."
    fields={[
      { name: 'material_status', label: 'Material Status', options: ['', 'CD', 'HARD COPY', 'SOFT COPY', 'EMAIL'] },
      { name: 'matter', label: 'Material Reference / Matter', type: 'textarea' },
      { name: 'page_no', label: 'Page No.' },
    ]} />
);

/* 5.15 Pending for Dummy */
export function PendingDummy() {
  const [f, setF] = useState({ from: today(-7), to: today(14), ad_type: '' });
  const [rows, setRows] = useState([]);
  const run = () => api.get(`/api/bookings/insertions/list?from=${f.from}&to=${f.to}&status=BOOKED&ad_type=${f.ad_type || ''}`).then(setRows);
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);
  return (
    <Page title="Pending For Dummy" section="5.15" help="Insertions still in 'Booked' state — not yet placed on the page dummy for the publish date.">
      <div className="panel">
        <div className="grid g5" style={{ marginBottom: 10 }}>
          <div className="field"><label>From Publish Date</label><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="field"><label>To Publish Date</label><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div className="field"><label>Ad Type</label>
            <select value={f.ad_type} onChange={(e) => setF({ ...f, ad_type: e.target.value })}>
              {['', 'DISPLAY', 'CLASSIFIED'].map((o) => <option key={o} value={o}>{o || '-- all --'}</option>)}
            </select></div>
          <div style={{ alignSelf: 'end' }}><button className="btn" onClick={run}>Submit</button></div>
        </div>
        <DataTable rows={rows} columns={[
          { key: 'publish_date', label: 'Publish Date' },
          { key: 'edition_alias', label: 'Edition', render: (r) => r.edition_alias || r.edition_name },
          { key: 'booking_no', label: 'Booking' }, { key: 'ad_type', label: 'Type' },
          { key: 'agency_name', label: 'Agency' }, { key: 'client_name', label: 'Client' },
          { key: 'caption', label: 'Caption' }, { key: 'amount', label: 'Amount', render: (r) => fmt(r.amount) }]} />
      </div>
    </Page>
  );
}
