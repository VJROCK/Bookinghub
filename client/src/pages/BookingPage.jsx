import React, { useEffect, useMemo, useState } from 'react';
import { api, options as loadOptions, fmt, today } from '../api';
import { DataTable, Lookup, Modal, Msg, Tabs } from '../components';

/**
 * Main booking form (manual 5.1 Display Booking / 5.2 Classified Booking).
 * The form is divided into the same 8 parts as the manual:
 * Booking Details header + Ad / Package / Page / Rate / Bill / Box / VTS tabs.
 */

const TABS = ['Ad Details', 'Package Details', 'Page Details', 'Rate Details', 'Bill Details', 'Box Details', 'VTS Details', 'Saved Bookings'];

const empty = (adType) => ({
  ad_type: adType, booking_date: today(), ro_status: 'CONFIRM', booking_type: 'NORMAL',
  no_of_insertions: 1, repeating_day: 1, tfn: 0, coupon_ad: 0, bill_cycle: 'MONTHLY',
  bill_to: 'AGENCY', package_ids: [], register_client: false,
});

function Sel({ label, value, onChange, opts, ro, req }) {
  return (
    <div className="field">
      <label>{label}{req && <span style={{ color: '#b91c1c' }}> *</span>}</label>
      <select value={value ?? ''} disabled={ro} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">-- select --</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}
function Inp({ label, value, onChange, type = 'text', ro, req, placeholder }) {
  return (
    <div className="field">
      <label>{label}{req && <span style={{ color: '#b91c1c' }}> *</span>}</label>
      <input type={type} step="any" value={value ?? ''} readOnly={ro} className={ro ? 'ro' : ''}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)} />
    </div>
  );
}
function OptSel({ label, value, onChange, options, ro }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value ?? ''} disabled={ro} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o || '--'}</option>)}
      </select>
    </div>
  );
}

export default function BookingPage({ adType }) {
  const [b, setB] = useState(empty(adType));
  const [tab, setTab] = useState('Ad Details');
  const [msg, setMsg] = useState({});
  const [info, setInfo] = useState({});      // agency/client info panel
  const [amounts, setAmounts] = useState({}); // computed amounts preview
  const [lists, setLists] = useState({});
  const [subcats, setSubcats] = useState({ s2: [], s3: [], s4: [], s5: [] });
  const [saved, setSaved] = useState([]);
  const [lastSaved, setLastSaved] = useState(null);
  const [showMatter, setShowMatter] = useState(false);
  const isClassified = adType === 'CLASSIFIED';

  const set = (k, v) => setB((x) => ({ ...x, [k]: v }));
  const setMany = (obj) => setB((x) => ({ ...x, ...obj }));

  /* ---------- reference lists ---------- */
  useEffect(() => {
    (async () => {
      const [adTypes, cats, colors, bgColors, uoms, products, brands, variants, execs, retainers,
        currencies, packages, sizes, pagePrem, posPrem, pageTypes, bullets, schemes, boxes,
        payModes, branches, fmg, rateCodes, captions] = await Promise.all([
        loadOptions('ad_type'), api.get('/api/masters/ad_category?limit=500'), loadOptions('color'),
        loadOptions('bg_color'), api.get('/api/masters/uom?limit=200'), loadOptions('product'),
        api.get('/api/masters/brand?limit=500'), api.get('/api/masters/variant?limit=500'),
        loadOptions('executive'), loadOptions('retainer'), loadOptions('currency'),
        api.get('/api/masters/package?limit=500'), api.get('/api/masters/ad_size?limit=300'),
        loadOptions('ad_page_premium'), loadOptions('ad_position_type'), loadOptions('page_type'),
        loadOptions('bullet'), loadOptions('scheme'), loadOptions('box'),
        loadOptions('payment_mode'), loadOptions('branch'), loadOptions('fmg_reason'),
        loadOptions('rate_code'), api.get(`/api/masters/caption_master?limit=300`),
      ]);
      const typeId = adTypes.find((t) => t.name?.toUpperCase() === adType)?.id;
      setLists({
        cats: cats.rows.filter((c) => !typeId || c.ad_type_id === typeId),
        colors, bgColors, uoms: uoms.rows.filter((u) => !typeId || !u.ad_type_id || u.ad_type_id === typeId),
        products, brands: brands.rows, variants: variants.rows, execs, retainers, currencies,
        packages: packages.rows.filter((p) => (!typeId || p.ad_type_id === typeId) && p.status !== 'INACTIVE'),
        sizes: sizes.rows, pagePrem, posPrem, pageTypes, bullets, schemes, boxes, payModes, branches, fmg, rateCodes,
        captions: captions.rows,
      });
    })().catch((e) => setMsg({ err: e.message }));
  }, [adType]);

  /* ---------- cascading sub categories ---------- */
  useEffect(() => {
    if (!b.ad_category_id) { setSubcats({ s2: [], s3: [], s4: [], s5: [] }); return; }
    api.get(`/api/masters/ad_sub_category?ad_category_id=${b.ad_category_id}`).then((d) => setSubcats((s) => ({ ...s, s2: d.rows })));
  }, [b.ad_category_id]);
  useEffect(() => {
    if (!b.ad_sub_category_id) { setSubcats((s) => ({ ...s, s3: [], s4: [], s5: [] })); return; }
    api.get(`/api/masters/ad_sub_category3?ad_sub_category_id=${b.ad_sub_category_id}`).then((d) => setSubcats((s) => ({ ...s, s3: d.rows })));
  }, [b.ad_sub_category_id]);
  useEffect(() => {
    if (!b.ad_sub_category3_id) { setSubcats((s) => ({ ...s, s4: [], s5: [] })); return; }
    api.get(`/api/masters/ad_sub_category4?ad_sub_category3_id=${b.ad_sub_category3_id}`).then((d) => setSubcats((s) => ({ ...s, s4: d.rows })));
  }, [b.ad_sub_category3_id]);
  useEffect(() => {
    if (!b.ad_sub_category4_id) { setSubcats((s) => ({ ...s, s5: [] })); return; }
    api.get(`/api/masters/ad_sub_category5?ad_sub_category4_id=${b.ad_sub_category4_id}`).then((d) => setSubcats((s) => ({ ...s, s5: d.rows })));
  }, [b.ad_sub_category4_id]);

  /* ---------- party info panel ---------- */
  useEffect(() => {
    if (!b.agency_id && !b.client_id) { setInfo({}); return; }
    const qs = [b.agency_id ? `agency_id=${b.agency_id}` : '', b.client_id ? `client_id=${b.client_id}` : ''].filter(Boolean).join('&');
    api.get(`/api/bookings/party-info?${qs}`).then((d) => {
      setInfo(d);
      if (d.agency?.alert) window.alert(`AGENCY ALERT:\n${d.agency.alert}`);
      if (d.client?.alert) window.alert(`CLIENT ALERT:\n${d.client.alert}`);
      // auto-pick executive linked to client product (manual 4.5.5)
      if (d.client_products?.length && !b.executive_id) {
        const withExec = d.client_products.find((p) => p.executive_id);
        if (withExec) setMany({ executive_id: withExec.executive_id, product_id: withExec.product_id });
      }
    }).catch(() => {});
    // eslint-disable-next-line
  }, [b.agency_id, b.client_id]);

  /* ---------- derived ---------- */
  const uom = (lists.uoms || []).find((u) => u.id === b.uom_id);
  const uomStr = `${uom?.name || ''} ${uom?.description || ''}`.toUpperCase();
  const isLineUom = ['ROL', 'ROW', 'ROC', 'LINE', 'WORD', 'CHARACTER'].some((k) => uomStr.includes(k));
  const isCD = uomStr.includes('CD') || uomStr.includes('CLASSIFIED DISPLAY');
  const totalArea = (Number(b.height) || 0) * (Number(b.width) || 0);
  const filteredBrands = (lists.brands || []).filter((x) => !b.product_id || x.product_id === b.product_id);
  const filteredVariants = (lists.variants || []).filter((x) => !b.brand_id || x.brand_id === b.brand_id);
  const filteredSizes = (lists.sizes || []).filter((s) => !s.ad_type_id || (lists.cats || []).length === 0 || true);
  const matterWords = (b.matter || '').trim() ? (b.matter || '').trim().split(/\s+/).length : 0;
  const matterLines = Math.ceil(matterWords / 5) || 0; // approx 5 words per printed line

  /* ---------- get rate / recompute ---------- */
  const getRate = async () => {
    setMsg({});
    try {
      const qty = isLineUom ? Number(b.no_of_lines) || 0 : totalArea;
      const d = await api.post('/api/bookings/get-rate', { ...b, qty, total_area: totalArea });
      if (!d.rate && !d.contract_rate && !b.agreed_rate) {
        setMsg({ err: 'No rate found in Rate Master for this Package / Category / UOM / Color combination and date.' });
      }
      setAmounts(d.amounts || {});
      setMany({
        card_rate: d.amounts?.card_rate, contract_rate: d.amounts?.contract_rate,
        eye_catcher_prem: d.amounts?.eye_catcher_prem, box_charges: d.amounts?.box_charges,
      });
      setTab('Rate Details');
    } catch (e) { setMsg({ err: e.message }); }
  };

  /* auto refresh computed amounts when key drivers change (after a rate is known) */
  useEffect(() => {
    if (!b.card_rate && !b.agreed_rate && !b.contract_id) return;
    const t = setTimeout(async () => {
      try {
        const qty = isLineUom ? Number(b.no_of_lines) || 0 : totalArea;
        const d = await api.post('/api/bookings/get-rate', { ...b, qty, total_area: totalArea });
        setAmounts(d.amounts || {});
      } catch {}
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [b.agreed_rate, b.special_discount, b.space_discount, b.special_charges, b.addl_agency_comm,
    b.no_of_insertions, b.scheme_id, b.height, b.width, b.no_of_lines, b.page_premium_id,
    b.position_premium_id, b.eye_catcher_id, b.box_id, b.card_rate, b.contract_id, b.retainer_id]);

  /* ---------- saved bookings list ---------- */
  const loadSaved = () => api.get(`/api/bookings?ad_type=${adType}&limit=100`).then(setSaved);
  useEffect(() => { loadSaved(); /* eslint-disable-next-line */ }, [adType]);

  /* ---------- save ---------- */
  const save = async () => {
    setMsg({});
    try {
      const payload = { ...b, total_area: totalArea || null };
      const d = await api.post('/api/bookings', payload);
      setLastSaved(d);
      setMsg({ ok: `Booking saved successfully. Booking ID: ${d.booking_no} — Gross ₹${fmt(d.gross_amount)}, Bill Amount ₹${fmt(d.bill_amount)}${d.prev_booking_id ? ` (modified from previous booking #${d.prev_booking_id})` : ''}` });
      setB(empty(adType)); setAmounts({}); setInfo({});
      loadSaved(); setTab('Saved Bookings');
    } catch (e) { setMsg({ err: e.message }); }
  };

  const modify = async (row) => {
    const d = await api.get(`/api/bookings/${row.id}`);
    setB({ ...d, register_client: false });
    setAmounts({}); setTab('Ad Details'); setMsg({ ok: `Loaded ${d.booking_no} for modification. Saving will generate a new Booking ID (old id is kept as Previous Booking ID).` });
    window.scrollTo(0, 0);
  };

  const cancelBooking = async (row) => {
    if (!window.confirm(`Cancel booking ${row.booking_no}?`)) return;
    await api.post(`/api/bookings/${row.id}/cancel`);
    loadSaved();
  };

  const clientDisplay = b.client_id ? (info.client?.name || b.client_master_name || '') : undefined;

  return (
    <div>
      <h2>{isClassified ? 'Classified' : 'Display'} Booking</h2>
      <div className="muted" style={{ marginBottom: 8 }}>
        Manual section {isClassified ? '5.2' : '5.1'} — the booking form is divided into 8 parts. Fill the header, then walk through the tabs and press <b>Get Rate</b> before saving.
      </div>
      <Msg {...msg} />

      {/* ============ 5.x.1 BOOKING DETAILS (header) ============ */}
      <div className="panel">
        <h3>Booking Details</h3>
        <div className="grid g4">
          <Inp label="Booking Date" type="date" value={b.booking_date} onChange={(v) => set('booking_date', v)} />
          <Sel label="Branch" value={b.branch_id} onChange={(v) => set('branch_id', v)} opts={lists.branches || []} />
          <Inp label="Booked By" value={b.booked_by || '(current user)'} ro />
          <Inp label="Booking ID" value={b.booking_no || '(auto generated)'} ro />
          <Lookup label="Agency Code / Name" refTable="agency" value={b.agency_id}
            display={b.agency_id ? (info.agency?.name || b.agency_name || '…') : ''}
            onPick={(r) => setMany({ agency_id: r ? r.id : null })} />
          <Inp label="Agency Address" value={info.agency?.address} ro />
          <Inp label="Agency Type" value={info.agency?.type} ro />
          <div className="field">
            <label>Agency Status / Outstanding</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className={`badge ${info.agency?.status === 'ACTIVE' ? 'ok' : info.agency ? 'bad' : 'info'}`}>{info.agency?.status || '—'}</span>
              <span className="muted">₹ {fmt(info.agency?.outstanding ?? 0)}</span>
            </div>
          </div>
          <Lookup label="Client" refTable="client" value={b.client_id}
            display={clientDisplay}
            allowFreeText freeText={b.client_name}
            onFreeText={(v) => setMany({ client_name: v, client_id: null })}
            onPick={(r) => setMany({ client_id: r ? r.id : null, client_name: r ? null : b.client_name })} />
          <Inp label="Client Address" value={b.client_id ? info.client?.address : b.client_address}
            ro={!!b.client_id} onChange={(v) => set('client_address', v)} />
          {!b.client_id && b.client_name ? (
            <div className="field">
              <label>Walk-in Client</label>
              <label style={{ textTransform: 'none', fontWeight: 400, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={!!b.register_client}
                  onChange={(e) => set('register_client', e.target.checked)} />
                Register this client in Client Master
              </label>
            </div>
          ) : <Inp label="Pay Mode" value={info.agency?.paymode} ro />}
          <Inp label="Credit Period (days)" value={info.agency?.credit_days} ro />
          <Inp label="RO No." value={b.ro_no} onChange={(v) => set('ro_no', v)} placeholder="Blank = Dockit booking" />
          <Inp label="RO Date" type="date" value={b.ro_date} onChange={(v) => set('ro_date', v)} />
          <OptSel label="RO Status" value={b.ro_status} onChange={(v) => set('ro_status', v)} options={['CONFIRM', 'RESERVATION']} />
          <Inp label="Key No." value={b.key_no} onChange={(v) => set('key_no', v)} />
          <Sel label="Executive Name" value={b.executive_id} onChange={(v) => set('executive_id', v)} opts={lists.execs || []} />
          <Sel label="Retainer" value={b.retainer_id} onChange={(v) => set('retainer_id', v)} opts={lists.retainers || []} />
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div className="panel">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'Ad Details' && (
          <div className="grid g4">
            <OptSel label="Booking Type" value={b.booking_type} onChange={(v) => set('booking_type', v)} options={['NORMAL', 'FMG', 'IN HOUSE']} />
            {b.booking_type === 'FMG' && <Sel label="FMG Reason" value={b.fmg_reason_id} onChange={(v) => set('fmg_reason_id', v)} opts={lists.fmg || []} />}
            <Sel label="Color" value={b.color_id} onChange={(v) => set('color_id', v)} opts={lists.colors || []} />
            {isClassified && <Sel label="BG Color" value={b.bg_color_id} onChange={(v) => set('bg_color_id', v)} opts={lists.bgColors || []} />}
            <Sel label="Ad Category" req value={b.ad_category_id}
              onChange={(v) => setMany({ ad_category_id: v, ad_sub_category_id: null, ad_sub_category3_id: null, ad_sub_category4_id: null, ad_sub_category5_id: null })}
              opts={lists.cats || []} />
            <Sel label="Ad Sub Category" value={b.ad_sub_category_id}
              onChange={(v) => setMany({ ad_sub_category_id: v, ad_sub_category3_id: null, ad_sub_category4_id: null, ad_sub_category5_id: null })}
              opts={subcats.s2} />
            <Sel label="Ad Sub Category 3" value={b.ad_sub_category3_id} onChange={(v) => setMany({ ad_sub_category3_id: v, ad_sub_category4_id: null, ad_sub_category5_id: null })} opts={subcats.s3} />
            <Sel label="Ad Sub Category 4" value={b.ad_sub_category4_id} onChange={(v) => setMany({ ad_sub_category4_id: v, ad_sub_category5_id: null })} opts={subcats.s4} />
            <Sel label="Ad Sub Category 5" value={b.ad_sub_category5_id} onChange={(v) => set('ad_sub_category5_id', v)} opts={subcats.s5} />
            <Sel label="UOM" req value={b.uom_id} onChange={(v) => set('uom_id', v)} opts={(lists.uoms || []).map((u) => ({ id: u.id, name: `${u.name} — ${u.description || u.uom_type || ''}` }))} />
            <Sel label="Product" value={b.product_id} onChange={(v) => setMany({ product_id: v, brand_id: null, variant_id: null })} opts={lists.products || []} />
            <Sel label="Brand" value={b.brand_id} onChange={(v) => setMany({ brand_id: v, variant_id: null })} opts={filteredBrands} />
            {!isClassified && <Sel label="Variant" value={b.variant_id} onChange={(v) => set('variant_id', v)} opts={filteredVariants} />}
            {!isClassified && <Inp label="Campaign" value={b.campaign} onChange={(v) => set('campaign', v)} />}
            <div className="field">
              <label>Caption</label>
              <input list="captions" value={b.caption ?? ''} onChange={(e) => set('caption', e.target.value)} />
              <datalist id="captions">{(lists.captions || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <OptSel label="Material Status" value={b.material_status} onChange={(v) => set('material_status', v)} options={['', 'CD', 'HARD COPY', 'SOFT COPY', 'EMAIL']} />
            {(isLineUom || isCD) && (
              <div className="field">
                <label>{isCD ? 'Material Upload' : 'Matter (Editor)'}</label>
                <button type="button" className="btn sec" onClick={() => setShowMatter(true)}>
                  {isCD ? '📎 Upload / describe material' : `✍️ Compose Matter ${matterWords ? `(${matterWords} words)` : ''}`}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'Package Details' && (
          <div>
            <div className="grid g4" style={{ marginBottom: 10 }}>
              {!isClassified && (
                <div className="field">
                  <label>Coupon Ad</label>
                  <input type="checkbox" style={{ width: 'auto' }} checked={!!b.coupon_ad} onChange={(e) => set('coupon_ad', e.target.checked ? 1 : 0)} />
                </div>
              )}
              <Inp label="Publish Date" req type="date" value={b.publish_date} onChange={(v) => set('publish_date', v)} />
              <div className="field">
                <label>TFN (Till Further Notice)</label>
                <input type="checkbox" style={{ width: 'auto' }} checked={!!b.tfn} onChange={(e) => set('tfn', e.target.checked ? 1 : 0)} />
              </div>
              <Inp label="No. of Insertions" type="number" value={b.no_of_insertions} onChange={(v) => set('no_of_insertions', v)} />
              <Inp label="Repeating Day" type="number" value={b.repeating_day} onChange={(v) => set('repeating_day', v)} />
              <Inp label="Paid Insertions" value={amounts.paid_insertions ?? b.paid_insertions ?? ''} ro />
              <Sel label="Currency Type" value={b.currency_id} onChange={(v) => set('currency_id', v)} opts={lists.currencies || []} />
              <Sel label="Contract Name" value={b.contract_id} onChange={(v) => set('contract_id', v)}
                opts={(info.contracts || []).map((c) => ({ id: c.id, name: c.name }))} />
              <Inp label="Print Remark" value={b.print_remark} onChange={(v) => set('print_remark', v)} />
            </div>
            <h3>Packages / Editions (select one or many) <span style={{ color: '#b91c1c' }}>*</span></h3>
            <div className="dt-wrap" style={{ maxHeight: 260 }}>
              <table className="dt">
                <thead><tr><th></th><th>Package / Edition</th><th>Combination</th><th>No. of Editions</th></tr></thead>
                <tbody>
                  {(lists.packages || []).map((p) => (
                    <tr key={p.id}>
                      <td><input type="checkbox" style={{ width: 'auto' }}
                        checked={b.package_ids.includes(p.id)}
                        onChange={(e) => set('package_ids', e.target.checked ? [...b.package_ids, p.id] : b.package_ids.filter((x) => x !== p.id))} /></td>
                      <td>{p.name}</td><td>{p.combination_name}</td><td>{p.no_of_editions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Page Details' && (
          <div className="grid g4">
            {!isClassified && (
              <Sel label="Ad Size Type" value={b.ad_size_id}
                onChange={(v) => {
                  const s = (lists.sizes || []).find((x) => x.id === v);
                  setMany({ ad_size_id: v, height: s?.height ?? b.height, width: s?.width ?? b.width });
                }}
                opts={(lists.sizes || []).map((s) => ({ id: s.id, name: `${s.name} (${s.height}×${s.width})` }))} />
            )}
            {!isLineUom && <Inp label="Height (cm)" type="number" value={b.height} onChange={(v) => set('height', v)} />}
            {!isLineUom && <Inp label="Width (cm)" type="number" value={b.width} onChange={(v) => set('width', v)} />}
            <Inp label="No. of Column" type="number" value={b.no_of_columns} onChange={(v) => set('no_of_columns', v)} />
            {!isLineUom && <Inp label="Total Area" value={totalArea ? totalArea.toFixed(2) : ''} ro />}
            {isLineUom && <Inp label={`No. of ${uomStr.includes('ROW') || uomStr.includes('WORD') ? 'Words' : uomStr.includes('ROC') ? 'Characters' : 'Lines'}`} type="number" value={b.no_of_lines} onChange={(v) => set('no_of_lines', v)} />}
            {!isClassified && <Sel label="Page Premium" value={b.page_premium_id} onChange={(v) => set('page_premium_id', v)} opts={lists.pagePrem || []} />}
            <Sel label="Position Premium" value={b.position_premium_id} onChange={(v) => set('position_premium_id', v)} opts={lists.posPrem || []} />
            <Inp label="Page No." type="number" value={b.page_no} onChange={(v) => set('page_no', v)} />
            {!isClassified && <Sel label="Page Type" value={b.page_type_id} onChange={(v) => set('page_type_id', v)} opts={lists.pageTypes || []} />}
            {isClassified && <Sel label="Eye Catcher" value={b.eye_catcher_id} onChange={(v) => set('eye_catcher_id', v)} opts={lists.bullets || []} />}
            {isClassified && <Inp label="Eye Catcher Prem." value={amounts.eye_catcher_prem ?? b.eye_catcher_prem} ro />}
          </div>
        )}

        {tab === 'Rate Details' && (
          <div>
            <div className="toolbar">
              <button className="btn" onClick={getRate}>⚡ Get Rate</button>
              <span className="muted" style={{ alignSelf: 'center' }}>
                Rate is picked from {b.contract_id ? 'Contract Master (contract selected)' : 'Rate Master'} for the selected package, category, UOM, color and publish date.
              </span>
            </div>
            <div className="grid g4">
              <Sel label="Scheme Type" value={b.scheme_id} onChange={(v) => set('scheme_id', v)} opts={lists.schemes || []} />
              <Sel label="Rate Card (Code)" value={b.rate_code_id} onChange={(v) => set('rate_code_id', v)} opts={lists.rateCodes || []} />
              <Inp label="Card Rate" value={amounts.card_rate ?? b.card_rate} ro />
              <Inp label="Card Amount" value={amounts.card_amount != null ? fmt(amounts.card_amount) : ''} ro />
              <Inp label="Contract Rate" value={amounts.contract_rate ?? b.contract_rate ?? ''} ro />
              <Inp label="Deviation" value={amounts.deviation ?? ''} ro />
              <Inp label="Agreed Rate" type="number" value={b.agreed_rate} onChange={(v) => set('agreed_rate', v)} />
              <Inp label="Agreed Amount" value={amounts.agreed_amount != null ? fmt(amounts.agreed_amount) : ''} ro />
              <Inp label="Discount" value={amounts.discount != null ? fmt(amounts.discount) : ''} ro />
              <Inp label="Discount (%)" value={amounts.discount_pct ?? ''} ro />
              <Inp label="Page Prem. Amount" value={amounts.premium_amount != null ? fmt(amounts.premium_amount) : ''} ro />
              <Inp label="Special Discount" type="number" value={b.special_discount} onChange={(v) => set('special_discount', v)} />
              <Inp label="Space Discount" type="number" value={b.space_discount} onChange={(v) => set('space_discount', v)} />
              <Inp label="Special Charges" type="number" value={b.special_charges} onChange={(v) => set('special_charges', v)} />
              <Inp label="Addl. Agency Comm." type="number" value={b.addl_agency_comm} onChange={(v) => set('addl_agency_comm', v)} />
              <Inp label="Retainer Comm." value={amounts.retainer_comm != null ? fmt(amounts.retainer_comm) : ''} ro />
            </div>
            <div className="total-strip">
              <span>Paid Insertions: <b>{amounts.paid_insertions ?? '—'}</b></span>
              <span>Gross Amount: <b>₹ {amounts.gross_amount != null ? fmt(amounts.gross_amount) : '—'}</b></span>
              <span>Trade Discount: <b>₹ {amounts.trade_discount != null ? fmt(amounts.trade_discount) : '—'}</b></span>
              <span>Bill Amount: <b>₹ {amounts.bill_amount != null ? fmt(amounts.bill_amount) : '—'}</b></span>
            </div>
          </div>
        )}

        {tab === 'Bill Details' && (
          <div className="grid g4">
            <OptSel label="Bill Cycle" value={b.bill_cycle} onChange={(v) => set('bill_cycle', v)} options={['DAILY', 'WEEKLY', 'MONTHLY']} />
            <Sel label="Revenue Center" value={b.revenue_center_id} onChange={(v) => set('revenue_center_id', v)} opts={lists.branches || []} />
            <Sel label="Payment Type" value={b.payment_type_id} onChange={(v) => set('payment_type_id', v)} opts={lists.payModes || []} />
            <Inp label="Bill Status" value="PENDING" ro />
            {(lists.payModes || []).find((p) => p.id === b.payment_type_id)?.name === 'CASH' && (
              <Inp label="Cash Received" type="number" value={b.cash_received} onChange={(v) => set('cash_received', v)} />
            )}
            {['CHEQUE', 'DEMAND DRAFT'].includes((lists.payModes || []).find((p) => p.id === b.payment_type_id)?.name) && (
              <>
                <Inp label="Chq/DD No." value={b.chq_no} onChange={(v) => set('chq_no', v)} />
                <Inp label="Chq/DD Amount" type="number" value={b.chq_amount} onChange={(v) => set('chq_amount', v)} />
                <Inp label="Bank Name" value={b.bank_name} onChange={(v) => set('bank_name', v)} />
                <Inp label="Our Bank" value={b.our_bank} onChange={(v) => set('our_bank', v)} />
              </>
            )}
            <Inp label="Billable Size" value={b.billable_size} onChange={(v) => set('billable_size', v)} placeholder="Only if billed size differs" />
            <OptSel label="Bill To" value={b.bill_to} onChange={(v) => set('bill_to', v)} options={['AGENCY', 'CLIENT']} />
            <Inp label="Trade Discount" value={amounts.trade_discount != null ? fmt(amounts.trade_discount) : ''} ro />
            <Inp label="Bill Amount" value={amounts.bill_amount != null ? fmt(amounts.bill_amount) : ''} ro />
            <div className="span2">
              <div className="field"><label>Bill Remarks</label>
                <textarea rows={2} value={b.bill_remarks ?? ''} onChange={(e) => set('bill_remarks', e.target.value)} /></div>
            </div>
          </div>
        )}

        {tab === 'Box Details' && (
          <div className="grid g4">
            <Sel label="Box Code" value={b.box_id} onChange={(v) => set('box_id', v)} opts={lists.boxes || []} />
            <Inp label="Box No." value={b.box_no || (b.box_id ? '(auto generated)' : '')} ro />
            <Inp label="Box Charges" value={amounts.box_charges ?? b.box_charges ?? ''} ro />
            <div className="field">
              <label>Address Source</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ textTransform: 'none', fontWeight: 400 }}>
                  <input type="checkbox" style={{ width: 'auto' }}
                    checked={b._boxSame === 'AGENCY'}
                    onChange={(e) => setMany({ _boxSame: e.target.checked ? 'AGENCY' : null, box_address: e.target.checked ? info.agency?.address : b.box_address })} /> Same as Agency
                </label>
                <label style={{ textTransform: 'none', fontWeight: 400 }}>
                  <input type="checkbox" style={{ width: 'auto' }}
                    checked={b._boxSame === 'CLIENT'}
                    onChange={(e) => setMany({ _boxSame: e.target.checked ? 'CLIENT' : null, box_address: e.target.checked ? (info.client?.address || b.client_address) : b.box_address })} /> Same as Client
                </label>
              </div>
            </div>
            <div className="span2">
              <div className="field"><label>Box Add.</label>
                <textarea rows={2} value={b.box_address ?? ''} onChange={(e) => set('box_address', e.target.value)} /></div>
            </div>
          </div>
        )}

        {tab === 'VTS Details' && (
          <div className="grid g4">
            <Inp label="VTS (No. of Copies)" type="number" value={b.vts_copies} onChange={(v) => set('vts_copies', v)} />
            <Inp label="No. of Invoices" type="number" value={b.no_of_invoices} onChange={(v) => set('no_of_invoices', v)} />
            <div className="span2">
              <div className="field"><label>Billing Address</label>
                <textarea rows={2} placeholder="Only if different from agency master" value={b.billing_address ?? ''} onChange={(e) => set('billing_address', e.target.value)} /></div>
            </div>
          </div>
        )}

        {tab === 'Saved Bookings' && (
          <DataTable rows={saved}
            columns={[
              { key: 'booking_no', label: 'Booking ID' }, { key: 'booking_date', label: 'Date' },
              { key: 'ro_no', label: 'RO No' },
              { key: 'agency_name', label: 'Agency' },
              { key: 'client', label: 'Client', render: (r) => r.client_master_name || r.client_name },
              { key: 'caption', label: 'Caption' }, { key: 'publish_date', label: 'Publish' },
              { key: 'no_of_insertions', label: 'Ins.' },
              { key: 'gross_amount', label: 'Gross', render: (r) => fmt(r.gross_amount) },
              { key: 'status', label: 'Status', render: (r) => <span className={`badge ${r.status === 'BOOKED' ? 'ok' : 'bad'}`}>{r.status}</span> },
              {
                key: '_act', label: 'Actions', render: (r) => r.status === 'BOOKED' ? (
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn warn sm" onClick={() => modify(r)}>Modify</button>{' '}
                    <button className="btn danger sm" onClick={() => cancelBooking(r)}>Cancel</button>
                  </span>
                ) : null,
              },
            ]} />
        )}

        {tab !== 'Saved Bookings' && (
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button className="btn" style={{ padding: '9px 26px' }} onClick={save}>💾 Save Booking</button>
            <button className="btn sec" onClick={() => { setB(empty(adType)); setAmounts({}); setMsg({}); }}>🧹 Clear</button>
            {lastSaved && <span className="muted" style={{ alignSelf: 'center' }}>Last saved: <b>{lastSaved.booking_no}</b></span>}
          </div>
        )}
      </div>

      {/* ---------- matter composing / material upload (5.2.4 A/B) ---------- */}
      {showMatter && (
        <Modal title={isCD ? 'Material Uploading Form' : 'Editor — Matter Composing Form'} wide onClose={() => setShowMatter(false)}
          footer={<button className="btn" onClick={() => { if (isLineUom && matterLines) set('no_of_lines', matterLines); setShowMatter(false); }}>Done</button>}>
          {isCD ? (
            <div className="editor-box">
              <div className="field"><label>Material file name / reference (CD, image, PDF...)</label>
                <input value={b.matter ?? ''} onChange={(e) => set('matter', e.target.value)} placeholder="e.g. GV_LAUNCH_10x8.tif on CD #42" /></div>
              <div className="muted">The production department picks the material using this reference while paginating.</div>
            </div>
          ) : (
            <div className="editor-box">
              <div className="field"><label>Compose the matter to be published</label>
                <textarea rows={7} value={b.matter ?? ''} onChange={(e) => set('matter', e.target.value)} /></div>
              <div className="muted">Words: <b>{matterWords}</b> · Estimated printed lines: <b>{matterLines}</b> (≈5 words/line) — lines are copied to Page Details on Done.</div>
              <div className="matter-preview">
                {b.caption && <b style={{ display: 'block', textTransform: 'uppercase' }}>{b.caption}</b>}
                {b.matter || 'Matter preview will appear here exactly as a classified column...'}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
