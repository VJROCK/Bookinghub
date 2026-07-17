/**
 * BookingHub booking engine.
 * Rate pickup (from Rate Master / Contract), amount computation and
 * insertion schedule generation — used by both the API and the seed script.
 */
const { db, log } = require('./db');

const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0);
const LINE_UOMS = ['ROL', 'ROW', 'ROC', 'LINE', 'WORD', 'CHARACTER'];

function isLineUom(uomId) {
  if (!uomId) return false;
  const u = db.prepare('SELECT name, description FROM uom WHERE id = ?').get(uomId);
  if (!u) return false;
  const s = `${u.name || ''} ${u.description || ''}`.toUpperCase();
  return LINE_UOMS.some((k) => s.includes(k));
}

function adTypeId(adTypeName) {
  const r = db.prepare('SELECT id FROM ad_type WHERE UPPER(name) = UPPER(?)').get(adTypeName);
  return r ? r.id : null;
}

/** Pick the best matching rate from rate_master. */
function pickRate({ ad_type, ad_category_id, package_id, uom_id, color_id, date, qty }) {
  const atId = adTypeId(ad_type);
  const d = date || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT * FROM rate_master
    WHERE (status IS NULL OR status = 'ACTIVE')
      AND (ad_type_id IS NULL OR ad_type_id = ?)
      AND package_id = ?
      AND (valid_from IS NULL OR valid_from <= ?)
      AND (valid_to   IS NULL OR valid_to   >= ?)
  `).all(atId, package_id || 0, d, d);

  let best = null; let bestScore = -1;
  for (const r of rows) {
    // a rate restricted to a category/uom/color only applies when the booking matches it
    if (r.ad_category_id && r.ad_category_id !== Number(ad_category_id || 0)) continue;
    if (r.uom_id && uom_id && r.uom_id !== Number(uom_id)) continue;
    if (r.color_id && color_id && r.color_id !== Number(color_id)) continue;
    if (qty && r.size_from != null && r.size_from !== '' && num(qty) < num(r.size_from)) continue;
    if (qty && r.size_to != null && r.size_to !== '' && num(r.size_to) > 0 && num(qty) > num(r.size_to)) continue;
    let score = 0;
    if (r.ad_category_id) score += 4;
    if (r.color_id) score += 2;
    if (r.uom_id) score += 1;
    if (r.size_from != null || r.size_to != null) score += 1;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}

/** Contract rate for an agency/client + package/category, valid on date. */
function pickContractRate({ contract_id, ad_category_id, package_id, color_id }) {
  if (!contract_id) return null;
  const rows = db.prepare('SELECT * FROM contract_detail WHERE parent_id = ?').all(contract_id);
  let best = null; let bestScore = -1;
  for (const r of rows) {
    if (r.package_id && package_id && r.package_id !== Number(package_id)) continue;
    if (r.ad_category_id && ad_category_id && r.ad_category_id !== Number(ad_category_id)) continue;
    if (r.color_id && color_id && r.color_id !== Number(color_id)) continue;
    let score = (r.package_id ? 2 : 0) + (r.ad_category_id ? 2 : 0) + (r.color_id ? 1 : 0);
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best ? num(best.rate) : null;
}

/** Current agency commission % (agency_commission rows override agency_type). */
function agencyCommission(agency_id, date) {
  if (!agency_id) return { rate: 0, on: 'GROSS' };
  const d = date || new Date().toISOString().slice(0, 10);
  const c = db.prepare(`
    SELECT commission_rate, commission_on FROM agency_commission
    WHERE parent_id = ? AND (effective_from IS NULL OR effective_from <= ?) AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY id DESC LIMIT 1`).get(agency_id, d, d);
  if (c) return { rate: num(c.commission_rate), on: c.commission_on || 'GROSS' };
  const t = db.prepare(`
    SELECT t.commission_rate, t.commission_on FROM agency a JOIN agency_type t ON t.id = a.agency_type_id
    WHERE a.id = ?`).get(agency_id);
  return t ? { rate: num(t.commission_rate), on: t.commission_on || 'GROSS' } : { rate: 0, on: 'GROSS' };
}

function retainerCommissionRate(retainer_id, date) {
  if (!retainer_id) return 0;
  const d = date || new Date().toISOString().slice(0, 10);
  const c = db.prepare(`
    SELECT fixed_rate FROM retainer_commission
    WHERE parent_id = ? AND (effective_from IS NULL OR effective_from <= ?) AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY id DESC LIMIT 1`).get(retainer_id, d, d);
  return c ? num(c.fixed_rate) : 0;
}

/** Quantity used for rating: area for display/CD, lines/words for ROL/ROW/ROC. */
function bookingQty(b) {
  if (isLineUom(b.uom_id)) return num(b.no_of_lines);
  const area = num(b.total_area) || num(b.height) * num(b.width);
  return area;
}

/**
 * Compute all booking amounts.
 * Returns fields merged into the booking record.
 */
function computeAmounts(b) {
  const qty = bookingQty(b);
  const date = b.publish_date || b.booking_date;

  // --- rates -------------------------------------------------------------
  let card_rate = num(b.card_rate);
  let rateRow = null;
  if (!card_rate) {
    const pkg = b.package_ids && b.package_ids.length ? b.package_ids[0] : b.package_id;
    rateRow = pickRate({
      ad_type: b.ad_type, ad_category_id: b.ad_category_id, package_id: pkg,
      uom_id: b.uom_id, color_id: b.color_id, date, qty,
    });
    if (rateRow) {
      const isWeekend = date && [0, 6].includes(new Date(date + 'T00:00:00').getDay());
      card_rate = isWeekend && num(rateRow.weekend_rate) ? num(rateRow.weekend_rate) : num(rateRow.rate);
    }
  }

  const contract_rate = b.contract_id
    ? (pickContractRate({ contract_id: b.contract_id, ad_category_id: b.ad_category_id, package_id: (b.package_ids || [])[0] || b.package_id, color_id: b.color_id }) ?? (num(b.contract_rate) || null))
    : (num(b.contract_rate) || null);

  const agreed_rate = num(b.agreed_rate) || null;
  const effective_rate = agreed_rate || contract_rate || card_rate;

  // --- scheme: free insertions -------------------------------------------
  let free = num(b.free_insertions);
  if (b.scheme_id) {
    const s = db.prepare('SELECT * FROM scheme WHERE id = ?').get(b.scheme_id);
    if (s && num(b.no_of_insertions) >= num(s.paid_insertions) && num(s.paid_insertions) > 0) {
      free = Math.max(free, num(s.free_insertions));
    }
  }
  const total_ins = Math.max(1, num(b.no_of_insertions) || 1);
  const paid_ins = Math.max(1, total_ins - free);

  // --- amounts ------------------------------------------------------------
  let card_amount = qty * card_rate;
  if (rateRow && num(rateRow.min_rate) && card_amount < num(rateRow.min_rate)) card_amount = num(rateRow.min_rate);
  const agreed_amount = agreed_rate ? qty * agreed_rate : null;
  const base = qty * effective_rate;

  // page / position premium
  let premium_amount = num(b.premium_amount);
  if (!premium_amount && b.page_premium_id) {
    const p = db.prepare('SELECT * FROM ad_page_premium WHERE id = ?').get(b.page_premium_id);
    if (p) premium_amount += (p.premium_type === 'PERCENTAGE') ? base * num(p.premium_value) / 100 : num(p.premium_value);
  }
  if (b.position_premium_id) {
    const p = db.prepare('SELECT * FROM ad_position_type WHERE id = ?').get(b.position_premium_id);
    if (p) premium_amount += (p.premium_type === 'PERCENTAGE') ? base * num(p.premium_value) / 100 : num(p.premium_value);
  }

  // eye catcher
  let eye_prem = num(b.eye_catcher_prem);
  if (!eye_prem && b.eye_catcher_id) {
    const e = db.prepare('SELECT * FROM bullet WHERE id = ?').get(b.eye_catcher_id);
    if (e) eye_prem = (e.charge_type === 'PERCENTAGE') ? base * num(e.charges) / 100 : num(e.charges);
  }

  // box charges
  let box_charges = num(b.box_charges);
  if (!box_charges && b.box_id) {
    const bx = db.prepare('SELECT * FROM box WHERE id = ?').get(b.box_id);
    if (bx) box_charges = num(bx.national_charges);
  }

  const discount = agreed_rate ? Math.max(0, (card_rate - agreed_rate) * qty) : num(b.discount);
  const discount_pct = card_amount > 0 && discount ? +(discount / card_amount * 100).toFixed(2) : num(b.discount_pct);
  const deviation = contract_rate ? +(card_rate - contract_rate).toFixed(2) : 0;

  const special_discount = num(b.special_discount);
  const space_discount = num(b.space_discount);
  const special_charges = num(b.special_charges);
  const addl_agency_comm = num(b.addl_agency_comm);

  let gross = base * paid_ins + premium_amount + eye_prem + box_charges + special_charges - special_discount - space_discount;
  gross = Math.max(0, +gross.toFixed(2));

  const comm = agencyCommission(b.agency_id, date);
  const trade_discount = +(gross * comm.rate / 100).toFixed(2);
  const retainer_comm = +(gross * retainerCommissionRate(b.retainer_id, date) / 100).toFixed(2);
  const bill_amount = +(gross - trade_discount - addl_agency_comm).toFixed(2);

  return {
    card_rate: +card_rate.toFixed(2),
    card_amount: +card_amount.toFixed(2),
    contract_rate, deviation,
    agreed_rate, agreed_amount: agreed_amount != null ? +agreed_amount.toFixed(2) : null,
    discount: +num(discount).toFixed(2), discount_pct,
    premium_amount: +premium_amount.toFixed(2),
    eye_catcher_prem: +eye_prem.toFixed(2),
    box_charges: +box_charges.toFixed(2),
    special_discount, space_discount, special_charges,
    free_insertions: free, paid_insertions: paid_ins,
    addl_agency_comm, retainer_comm,
    gross_amount: gross, trade_discount, bill_amount,
    total_area: isLineUom(b.uom_id) ? null : (num(b.total_area) || num(b.height) * num(b.width) || null),
  };
}

/** Editions of the selected packages. */
function packageEditions(packageIds) {
  const out = [];
  for (const pid of packageIds || []) {
    const rows = db.prepare('SELECT edition_id FROM package_edition WHERE parent_id = ? AND edition_id IS NOT NULL').all(pid);
    for (const r of rows) if (!out.includes(r.edition_id)) out.push(r.edition_id);
  }
  return out;
}

function noIssueDates(editionId) {
  return db.prepare(`
    SELECT d.date FROM no_issue_date d JOIN no_issue n ON n.id = d.parent_id
    WHERE n.edition_id = ?`).all(editionId).map((r) => r.date);
}

/** Generate the insertion schedule for a booking. */
function generateInsertions(bookingId, { publish_date, no_of_insertions, repeating_day, gross_amount }, editionIds) {
  if (!publish_date) return [];
  const count = Math.max(1, num(no_of_insertions) || 1);
  const step = Math.max(1, num(repeating_day) || 1);
  const eds = editionIds.length ? editionIds : [null];
  const totalRows = count * eds.length;
  const perAmount = totalRows ? +((num(gross_amount) || 0) / totalRows).toFixed(2) : 0;
  const ins = db.prepare('INSERT INTO insertion (booking_id, edition_id, publish_date, status, amount) VALUES (?,?,?,?,?)');
  const created = [];
  for (const ed of eds) {
    const skip = ed ? noIssueDates(ed) : [];
    let d = new Date(publish_date + 'T00:00:00');
    for (let i = 0; i < count; i++) {
      while (skip.includes(d.toISOString().slice(0, 10))) d.setDate(d.getDate() + 1); // shift past no-issue dates
      const ds = d.toISOString().slice(0, 10);
      ins.run(bookingId, ed, ds, 'BOOKED', perAmount);
      created.push({ edition_id: ed, publish_date: ds });
      d.setDate(d.getDate() + step);
    }
  }
  return created;
}

function nextBookingNo(adType, source) {
  const prefix = source === 'QBC' ? 'QBC' : adType === 'DISPLAY' ? 'DSP' : 'CLS';
  const r = db.prepare("SELECT COUNT(*) AS c FROM booking").get();
  return `${prefix}${String(100001 + r.c)}`;
}

/** Create (or modify) a booking. Modification archives the old booking id per the manual. */
function saveBooking(payload, username) {
  const b = { ...payload };
  b.booking_date = b.booking_date || new Date().toISOString().slice(0, 10);
  const amounts = computeAmounts(b);
  Object.assign(b, amounts);

  let prevId = null;
  if (b.id) {
    // Manual: on modify, a new booking id is generated and the old one is kept as reference.
    prevId = b.id;
    db.prepare("UPDATE booking SET status = 'CANCELLED' WHERE id = ?").run(prevId);
    db.prepare("UPDATE insertion SET status = 'CANCELLED' WHERE booking_id = ? AND status IN ('BOOKED')").run(prevId);
    delete b.id;
  }

  b.booking_no = nextBookingNo(b.ad_type, b.source);
  if (!b.ro_no && !b.dockit_no) b.dockit_no = 'DKT' + Date.now().toString().slice(-7);
  if (b.box_id && !b.box_no) b.box_no = 'BOX' + Date.now().toString().slice(-6);

  const cols = [
    'booking_no', 'ad_type', 'source', 'booking_date', 'branch_id', 'booked_by', 'prev_booking_id',
    'agency_id', 'client_id', 'client_name', 'client_address', 'client_mobile',
    'ro_no', 'ro_date', 'ro_status', 'dockit_no', 'key_no', 'executive_id', 'retainer_id',
    'booking_type', 'fmg_reason_id', 'color_id', 'bg_color_id',
    'ad_category_id', 'ad_sub_category_id', 'ad_sub_category3_id', 'ad_sub_category4_id', 'ad_sub_category5_id',
    'uom_id', 'product_id', 'brand_id', 'variant_id', 'campaign', 'caption', 'material_status', 'matter', 'coupon_ad',
    'publish_date', 'tfn', 'no_of_insertions', 'repeating_day', 'free_insertions', 'paid_insertions',
    'currency_id', 'contract_id', 'print_remark',
    'ad_size_id', 'height', 'width', 'no_of_columns', 'page_premium_id', 'position_premium_id',
    'total_area', 'page_no', 'page_type_id', 'eye_catcher_id', 'eye_catcher_prem', 'no_of_lines',
    'scheme_id', 'rate_code_id', 'card_rate', 'card_amount', 'contract_rate', 'deviation',
    'agreed_rate', 'agreed_amount', 'discount', 'discount_pct', 'premium_amount',
    'special_discount', 'space_discount', 'special_charges', 'addl_agency_comm', 'retainer_comm', 'gross_amount',
    'bill_cycle', 'revenue_center_id', 'payment_type_id', 'bill_status',
    'cash_received', 'chq_no', 'chq_amount', 'bank_name', 'our_bank', 'billable_size', 'bill_to',
    'trade_discount', 'bill_amount', 'bill_remarks',
    'box_id', 'box_no', 'box_address', 'box_charges', 'vts_copies', 'no_of_invoices', 'billing_address',
    'audit_status', 'status',
  ];
  b.prev_booking_id = prevId;
  b.booked_by = username || b.booked_by || 'admin';
  b.audit_status = b.audit_status || 'UNAUDITED';
  b.bill_status = b.bill_status || 'PENDING';
  b.ro_status = b.ro_status || 'CONFIRM';
  b.booking_type = b.booking_type || 'NORMAL';
  b.bill_to = b.bill_to || (b.agency_id ? 'AGENCY' : 'CLIENT');
  b.bill_cycle = b.bill_cycle || 'MONTHLY';
  b.status = 'BOOKED';
  b.tfn = b.tfn ? 1 : 0;
  b.coupon_ad = b.coupon_ad ? 1 : 0;

  const placeholders = cols.map(() => '?').join(',');
  const values = cols.map((c) => (b[c] === undefined || b[c] === '' ? null : b[c]));
  const info = db.prepare(`INSERT INTO booking (${cols.join(',')}) VALUES (${placeholders})`).run(...values);
  const bookingId = Number(info.lastInsertRowid);

  const pkgIds = (b.package_ids || []).map(Number).filter(Boolean);
  const bp = db.prepare('INSERT INTO booking_package (booking_id, package_id) VALUES (?,?)');
  for (const pid of pkgIds) bp.run(bookingId, pid);

  const editions = packageEditions(pkgIds);
  generateInsertions(bookingId, b, editions);

  log(username, b.ad_type === 'DISPLAY' ? 'Display Booking' : 'Classified Booking',
    prevId ? 'MODIFY' : 'CREATE', b.booking_no, `Agency:${b.agency_id || ''} Client:${b.client_name || b.client_id || ''} Gross:${b.gross_amount}`);

  return { id: bookingId, booking_no: b.booking_no, prev_booking_id: prevId, ...amounts };
}

module.exports = {
  pickRate, pickContractRate, computeAmounts, saveBooking,
  generateInsertions, packageEditions, agencyCommission, isLineUom, bookingQty, nextBookingNo,
};
