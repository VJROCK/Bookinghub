import React, { useEffect, useState } from 'react';
import { api, options as loadOptions, fmt, today } from '../api';
import { DataTable, Lookup, Msg } from '../components';

/* 5.3 QBC — Quick Booking Center: everything on one screen for walk-in classified ads */
export default function QBC() {
  const [b, setB] = useState({ ad_type: 'CLASSIFIED', source: 'QBC', booking_date: today(), publish_date: today(1), no_of_insertions: 1, repeating_day: 1, package_ids: [], bill_to: 'CLIENT', register_client: false });
  const [lists, setLists] = useState({});
  const [amounts, setAmounts] = useState({});
  const [msg, setMsg] = useState({});
  const [recent, setRecent] = useState([]);
  const set = (k, v) => setB((x) => ({ ...x, [k]: v }));
  const setMany = (o) => setB((x) => ({ ...x, ...o }));

  useEffect(() => {
    (async () => {
      const [cats, uoms, packages, boxes, bullets, colors, bgColors, payModes, branches] = await Promise.all([
        api.get('/api/masters/ad_category?limit=500'), api.get('/api/masters/uom?limit=100'),
        api.get('/api/masters/package?limit=500'), loadOptions('box'), loadOptions('bullet'),
        loadOptions('color'), loadOptions('bg_color'), loadOptions('payment_mode'), loadOptions('branch'),
      ]);
      setLists({
        cats: cats.rows, uoms: uoms.rows.filter((u) => (u.uom_type || '').toUpperCase() !== 'DISPLAY'),
        packages: packages.rows.filter((p) => p.status !== 'INACTIVE'),
        boxes, bullets, colors, bgColors, payModes, branches,
      });
    })().catch((e) => setMsg({ err: e.message }));
    loadRecent();
  }, []);

  const loadRecent = () => api.get('/api/bookings?source=QBC&limit=30').then(setRecent);

  const uom = (lists.uoms || []).find((u) => u.id === b.uom_id);
  const uomStr = `${uom?.name || ''} ${uom?.description || ''}`.toUpperCase();
  const isLine = ['ROL', 'ROW', 'ROC', 'LINE', 'WORD'].some((k) => uomStr.includes(k));
  const words = (b.matter || '').trim() ? b.matter.trim().split(/\s+/).length : 0;

  const getRate = async () => {
    try {
      const qty = isLine ? Number(b.no_of_lines) || Math.ceil(words / 5) : (Number(b.height) || 0) * (Number(b.width) || 0);
      const d = await api.post('/api/bookings/get-rate', { ...b, qty, no_of_lines: b.no_of_lines || Math.ceil(words / 5) });
      setAmounts(d.amounts || {});
      setMany({ card_rate: d.amounts?.card_rate });
      if (!d.rate) setMsg({ err: 'No rate found for this selection.' }); else setMsg({});
    } catch (e) { setMsg({ err: e.message }); }
  };

  const save = async () => {
    setMsg({});
    try {
      const payload = { ...b, no_of_lines: b.no_of_lines || (isLine ? Math.ceil(words / 5) : null), total_area: (Number(b.height) || 0) * (Number(b.width) || 0) || null };
      const d = await api.post('/api/bookings', payload);
      setMsg({ ok: `Receipt No: ${d.booking_no} — Gross ₹${fmt(d.gross_amount)}, Net ₹${fmt(d.bill_amount)}` });
      setB({ ad_type: 'CLASSIFIED', source: 'QBC', booking_date: today(), publish_date: today(1), no_of_insertions: 1, repeating_day: 1, package_ids: [], bill_to: 'CLIENT', register_client: false });
      setAmounts({}); loadRecent();
    } catch (e) { setMsg({ err: e.message }); }
  };

  const F = ({ label, children, req }) => (
    <div className="field"><label>{label}{req && <span style={{ color: '#b91c1c' }}> *</span>}</label>{children}</div>
  );

  return (
    <div>
      <h2>QBC — Quick Booking Center</h2>
      <div className="muted" style={{ marginBottom: 8 }}>Manual 5.3 — book walk-in classified ads quickly on one screen.</div>
      <Msg {...msg} />
      <div className="panel">
        <div className="grid g4">
          <Lookup label="Name (Client)" refTable="client" value={b.client_id}
            display={b.client_id ? (b._clientName || '…') : undefined}
            allowFreeText freeText={b.client_name}
            onFreeText={(v) => setMany({ client_name: v, client_id: null })}
            onPick={(r) => setMany({ client_id: r ? r.id : null, _clientName: r?.name, client_name: r ? null : b.client_name })} />
          <F label="Address"><input value={b.client_address ?? ''} onChange={(e) => set('client_address', e.target.value)} /></F>
          <F label="Mobile No."><input value={b.client_mobile ?? ''} onChange={(e) => set('client_mobile', e.target.value)} /></F>
          <F label="Register walk-in client?">
            <input type="checkbox" style={{ width: 'auto' }} checked={!!b.register_client} onChange={(e) => set('register_client', e.target.checked)} />
          </F>
          <F label="Branch">
            <select value={b.branch_id ?? ''} onChange={(e) => set('branch_id', Number(e.target.value) || null)}>
              <option value="">--</option>{(lists.branches || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </F>
          <F label="Receipt No."><input readOnly className="ro" value="(auto generated)" /></F>
          <F label="Date"><input type="date" value={b.booking_date} onChange={(e) => set('booking_date', e.target.value)} /></F>
          <Lookup label="Agency (optional)" refTable="agency" value={b.agency_id}
            display={b.agency_id ? (b._agName || '…') : ''}
            onPick={(r) => setMany({ agency_id: r ? r.id : null, _agName: r?.name })} />
          <F label="RO No."><input value={b.ro_no ?? ''} onChange={(e) => set('ro_no', e.target.value)} /></F>
          <F label="RO Date"><input type="date" value={b.ro_date ?? ''} onChange={(e) => set('ro_date', e.target.value)} /></F>
          <F label="Ad Category" req>
            <select value={b.ad_category_id ?? ''} onChange={(e) => set('ad_category_id', Number(e.target.value) || null)}>
              <option value="">--</option>{(lists.cats || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </F>
          <F label="UOM" req>
            <select value={b.uom_id ?? ''} onChange={(e) => set('uom_id', Number(e.target.value) || null)}>
              <option value="">--</option>{(lists.uoms || []).map((o) => <option key={o.id} value={o.id}>{o.name} — {o.description}</option>)}
            </select>
          </F>
          <F label="Color">
            <select value={b.color_id ?? ''} onChange={(e) => set('color_id', Number(e.target.value) || null)}>
              <option value="">--</option>{(lists.colors || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </F>
          <F label="Back Ground Color">
            <select value={b.bg_color_id ?? ''} onChange={(e) => set('bg_color_id', Number(e.target.value) || null)}>
              <option value="">--</option>{(lists.bgColors || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </F>
          <F label="Eye Catcher">
            <select value={b.eye_catcher_id ?? ''} onChange={(e) => set('eye_catcher_id', Number(e.target.value) || null)}>
              <option value="">--</option>{(lists.bullets || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </F>
          <F label="Box Code">
            <select value={b.box_id ?? ''} onChange={(e) => set('box_id', Number(e.target.value) || null)}>
              <option value="">--</option>{(lists.boxes || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </F>
          <F label="Start With (Publish Date)" req><input type="date" value={b.publish_date ?? ''} onChange={(e) => set('publish_date', e.target.value)} /></F>
          <F label="No. of Insertions"><input type="number" value={b.no_of_insertions ?? 1} onChange={(e) => set('no_of_insertions', e.target.value)} /></F>
          <F label="Repeating Day"><input type="number" value={b.repeating_day ?? 1} onChange={(e) => set('repeating_day', e.target.value)} /></F>
          <F label="Material Status">
            <select value={b.material_status ?? ''} onChange={(e) => set('material_status', e.target.value)}>
              {['', 'CD', 'HARD COPY', 'SOFT COPY'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </F>
          {isLine
            ? <F label="No. of Words/Lines"><input type="number" value={b.no_of_lines ?? (Math.ceil(words / 5) || '')} onChange={(e) => set('no_of_lines', e.target.value)} /></F>
            : (<><F label="Height"><input type="number" value={b.height ?? ''} onChange={(e) => set('height', e.target.value)} /></F>
              <F label="Width"><input type="number" value={b.width ?? ''} onChange={(e) => set('width', e.target.value)} /></F></>)}
          <F label="No. of Columns"><input type="number" value={b.no_of_columns ?? ''} onChange={(e) => set('no_of_columns', e.target.value)} /></F>
          <F label="Payment Mode">
            <select value={b.payment_type_id ?? ''} onChange={(e) => set('payment_type_id', Number(e.target.value) || null)}>
              <option value="">--</option>{(lists.payModes || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </F>
          <F label="Cash Received"><input type="number" value={b.cash_received ?? ''} onChange={(e) => set('cash_received', e.target.value)} /></F>
        </div>

        <h3>Caption &amp; Matter (Editor)</h3>
        <div className="grid g2">
          <div className="field"><label>Caption</label><input value={b.caption ?? ''} onChange={(e) => set('caption', e.target.value)} /></div>
          <div className="field"><label>Matter — words: {words}</label>
            <textarea rows={3} value={b.matter ?? ''} onChange={(e) => set('matter', e.target.value)} /></div>
        </div>

        <h3>Packages Available <span style={{ color: '#b91c1c' }}>*</span></h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          {(lists.packages || []).map((p) => (
            <label key={p.id} style={{ textTransform: 'none', fontWeight: 400, display: 'flex', gap: 5, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 5, padding: '4px 8px' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={b.package_ids.includes(p.id)}
                onChange={(e) => set('package_ids', e.target.checked ? [...b.package_ids, p.id] : b.package_ids.filter((x) => x !== p.id))} />
              {p.name}
            </label>
          ))}
        </div>

        <div className="toolbar" style={{ marginTop: 8 }}>
          <button className="btn sec" onClick={getRate}>⚡ Get Rate</button>
          <button className="btn" onClick={save}>💾 Save &amp; Issue Receipt</button>
        </div>
        <div className="total-strip">
          <span>Card Rate: <b>{amounts.card_rate ?? '—'}</b></span>
          <span>Box Charges: <b>{amounts.box_charges ?? '—'}</b></span>
          <span>Paid Ins.: <b>{amounts.paid_insertions ?? '—'}</b></span>
          <span>Gross Amount: <b>₹ {amounts.gross_amount != null ? fmt(amounts.gross_amount) : '—'}</b></span>
          <span>Net Amount: <b>₹ {amounts.bill_amount != null ? fmt(amounts.bill_amount) : '—'}</b></span>
        </div>
      </div>

      <div className="panel">
        <h3>Recent QBC Receipts</h3>
        <DataTable rows={recent} columns={[
          { key: 'booking_no', label: 'Receipt No' }, { key: 'booking_date', label: 'Date' },
          { key: 'client_name', label: 'Client', render: (r) => r.client_master_name || r.client_name },
          { key: 'caption', label: 'Caption' }, { key: 'publish_date', label: 'Publish' },
          { key: 'gross_amount', label: 'Gross', render: (r) => fmt(r.gross_amount) },
          { key: 'cash_received', label: 'Cash', render: (r) => fmt(r.cash_received) },
        ]} />
      </div>
    </div>
  );
}
