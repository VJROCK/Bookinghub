/**
 * BookingHub demo seed. Run automatically on first start (or `npm run seed -- --reset`).
 */
const path = require('path');
const fs = require('fs');

if (process.argv.includes('--reset')) {
  const p = process.env.BOOKINGHUB_DB || path.join(__dirname, 'bookinghub.sqlite');
  for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(p + ext); } catch {} }
}

const { db } = require('../db');
const { saveBooking } = require('../bookingEngine');

function ins(table, row) {
  const cols = Object.keys(row);
  const info = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...cols.map((c) => row[c] ?? null));
  return Number(info.lastInsertRowid);
}

function seed() {
  const done = db.prepare("SELECT value FROM preference WHERE key = 'seeded'").get();
  if (done) { console.log('Database already seeded.'); return; }

  console.log('Seeding BookingHub demo data ...');

  /* ---------- environment ---------- */
  const india = ins('country', { name: 'INDIA', alias: 'IN' });
  const usa = ins('country', { name: 'USA', alias: 'US' });
  const mh = ins('state', { country_id: india, name: 'MAHARASHTRA', alias: 'MH' });
  const dl = ins('state', { country_id: india, name: 'DELHI', alias: 'DL' });
  const up = ins('state', { country_id: india, name: 'UTTAR PRADESH', alias: 'UP' });
  const distMum = ins('district', { country_id: india, state_id: mh, name: 'MUMBAI', alias: 'MUM' });
  const distDel = ins('district', { country_id: india, state_id: dl, name: 'NEW DELHI', alias: 'ND' });
  const distLko = ins('district', { country_id: india, state_id: up, name: 'LUCKNOW', alias: 'LKO' });
  ins('taluka', { district_id: distMum, name: 'ANDHERI', alias: 'AND' });
  ins('taluka', { district_id: distDel, name: 'CONNAUGHT PLACE', alias: 'CP' });
  const zN = ins('zone', { name: 'NORTH', alias: 'N' });
  const zW = ins('zone', { name: 'WEST', alias: 'W' });
  ins('zone', { name: 'SOUTH', alias: 'S' }); ins('zone', { name: 'EAST', alias: 'E' });
  const regDel = ins('region', { name: 'DELHI NCR', alias: 'NCR' });
  const regMum = ins('region', { name: 'MUMBAI METRO', alias: 'MM' });
  const regUp = ins('region', { name: 'AWADH', alias: 'AWD' });

  const cityDel = ins('city', { name: 'NEW DELHI', alias: 'DEL', country_id: india, state_id: dl, district_id: distDel, zone_id: zN, region_id: regDel, std_code: '011' });
  const cityMum = ins('city', { name: 'MUMBAI', alias: 'MUM', country_id: india, state_id: mh, district_id: distMum, zone_id: zW, region_id: regMum, std_code: '022' });
  const cityLko = ins('city', { name: 'LUCKNOW', alias: 'LKO', country_id: india, state_id: up, district_id: distLko, zone_id: zN, region_id: regUp, std_code: '0522' });

  for (const n of ['CASH', 'CHEQUE', 'CREDIT', 'DEMAND DRAFT', 'ONLINE']) ins('payment_mode', { name: n });
  const pmCash = 1, pmCheque = 2, pmCredit = 3;
  for (const n of ['ACTIVE', 'INACTIVE', 'BANNED', 'HOLD', 'SUSPENDED']) ins('status_master', { name: n });
  const atDisplay = ins('ad_type', { name: 'DISPLAY', alias: 'DSP' });
  const atClassified = ins('ad_type', { name: 'CLASSIFIED', alias: 'CLS' });
  const inr = ins('currency', { country_id: india, name: 'RUPEES', alias: 'INR' });
  const usd = ins('currency', { country_id: usa, name: 'DOLLAR', alias: 'USD' });
  ins('currency_rate', { parent_id: usd, convert_rate: 83.5, valid_from: '2026-01-01', valid_till: '2026-12-31' });
  const langHi = ins('language', { name: 'HINDI', alias: 'HIN' });
  const langEn = ins('language', { name: 'ENGLISH', alias: 'ENG' });
  for (const n of ['BILLED', 'NOT BILLED', 'NOT TO BILL']) ins('bill_status', { name: n, alias: n });
  const roleAdmin = ins('user_role', { name: 'ADMINISTRATOR', alias: 'ADMIN', level: '1' });
  const roleBooking = ins('user_role', { name: 'BOOKING EXECUTIVE', alias: 'BOOKEX', level: '3' });
  const roleAuditor = ins('user_role', { name: 'AUDITOR', alias: 'AUD', level: '2' });
  ins('user_role', { name: 'ACCOUNTS EXECUTIVE', alias: 'ACCEX', level: '3' });
  ins('tax_rate', { from_date: '2026-01-01', to_date: '2026-12-31', description: 'GST', order_no: 1, rate: 5, tax_type: 'GST' });

  /* ---------- company / centers / branches ---------- */
  const comp = ins('company', { name: 'NATIONAL MEDIA HOUSE LTD.', alias: 'NMH', address1: 'Press Complex, Kasturba Gandhi Marg', country_id: india, city_id: cityDel, pin: '110001', phone1: '011-23456789', email: 'info@nmh.example', pan_no: 'AAACN1234F' });
  const pcDelhi = ins('pub_center', { printing_center: 'YES', name: 'DELHI CENTER', alias: 'DELC', address1: 'Press Complex, KG Marg', country_id: india, city_id: cityDel, pin: '110001', region_id: regDel, zone_id: zN, phone: '011-23456780', email: 'delhi@nmh.example', status: 'ACTIVE' });
  const pcMumbai = ins('pub_center', { printing_center: 'YES', name: 'MUMBAI CENTER', alias: 'MUMC', address1: 'Media Towers, Bandra East', country_id: india, city_id: cityMum, pin: '400051', region_id: regMum, zone_id: zW, phone: '022-26543210', email: 'mumbai@nmh.example', status: 'ACTIVE' });
  const brCP = ins('branch', { pub_center_id: pcDelhi, name: 'CONNAUGHT PLACE BOOKING OFFICE', alias: 'CP', address1: 'N-Block CP', country_id: india, city_id: cityDel, pin: '110001', phone: '011-23416001', email: 'cp@nmh.example' });
  const brNoida = ins('branch', { pub_center_id: pcDelhi, name: 'NOIDA BOOKING OFFICE', alias: 'NOI', address1: 'Sector 18', country_id: india, city_id: cityDel, pin: '201301', phone: '0120-4321001' });
  const brBandra = ins('branch', { pub_center_id: pcMumbai, name: 'BANDRA BOOKING OFFICE', alias: 'BAN', address1: 'Linking Road', country_id: india, city_id: cityMum, pin: '400050', phone: '022-26001122' });

  /* ---------- categories ---------- */
  const catDisplay = ins('ad_category', { ad_type_id: atDisplay, name: 'DISPLAY GENERAL', alias: 'DGEN' });
  const catTender = ins('ad_category', { ad_type_id: atDisplay, name: 'TENDER & NOTICE', alias: 'TND' });
  const catAppoint = ins('ad_category', { ad_type_id: atDisplay, name: 'APPOINTMENTS', alias: 'APPT' });
  const catMat = ins('ad_category', { ad_type_id: atClassified, name: 'MATRIMONIAL', alias: 'MAT', publish_day: 'SUNDAY' });
  const catProp = ins('ad_category', { ad_type_id: atClassified, name: 'PROPERTY', alias: 'PROP' });
  const catComputer = ins('ad_category', { ad_type_id: atClassified, name: 'COMPUTER', alias: 'COMP' });
  const catSituation = ins('ad_category', { ad_type_id: atClassified, name: 'SITUATION VACANT', alias: 'SITV' });
  const subMatBride = ins('ad_sub_category', { ad_category_id: catMat, name: 'WANTED BRIDE', alias: 'WB' });
  ins('ad_sub_category', { ad_category_id: catMat, name: 'WANTED GROOM', alias: 'WG' });
  const subPropSale = ins('ad_sub_category', { ad_category_id: catProp, name: 'FOR SALE', alias: 'SALE' });
  ins('ad_sub_category', { ad_category_id: catProp, name: 'TO LET', alias: 'LET' });
  const subCompSw = ins('ad_sub_category', { ad_category_id: catComputer, name: 'SOFTWARE', alias: 'SW' });
  ins('ad_sub_category', { ad_category_id: catComputer, name: 'HARDWARE', alias: 'HW' });
  const sub3 = ins('ad_sub_category3', { ad_sub_category_id: subCompSw, name: 'ERP SOFTWARE', alias: 'ERP' });
  const sub4 = ins('ad_sub_category4', { ad_sub_category3_id: sub3, name: 'CLOUD ERP', alias: 'CLD' });
  ins('ad_sub_category5', { ad_sub_category4_id: sub4, name: 'SAAS', alias: 'SAAS' });
  ins('caption_master', { ad_type_id: atClassified, name: 'HANDSOME MATCH WANTED' });
  ins('caption_master', { ad_type_id: atClassified, name: '2BHK FLAT FOR SALE' });
  ins('caption_master', { ad_type_id: atDisplay, name: 'GRAND FESTIVE SALE' });

  /* ---------- publications ---------- */
  const perDaily = ins('periodicity', { name: 'DAILY', alias: 'DLY' });
  const perWeekly = ins('periodicity', { name: 'WEEKLY', alias: 'WKY' });
  ins('periodicity', { name: 'MONTHLY', alias: 'MTH' });
  const ptNews = ins('publication_type', { name: 'NEWSPAPER', alias: 'NP' });
  const ptMag = ins('publication_type', { name: 'MAGAZINE', alias: 'MAG' });
  ins('publication_type', { name: 'WEB', alias: 'WEB' });

  const uomSqcm = ins('uom', { ad_type_id: atDisplay, uom_type: 'DISPLAY', description: 'SQCM', name: 'SQCM', alias: 'SQCM', logo_type: 'NO' });
  const uomCC = ins('uom', { ad_type_id: atDisplay, uom_type: 'DISPLAY', description: 'CC', name: 'CC', alias: 'CC', logo_type: 'NO' });
  const uomRol = ins('uom', { ad_type_id: atClassified, uom_type: 'CLASSIFIED', description: 'ROL (Run on Line)', name: 'LINE', alias: 'ROL', logo_type: 'NO' });
  const uomRow = ins('uom', { ad_type_id: atClassified, uom_type: 'CLASSIFIED', description: 'ROW (Run on Word)', name: 'WORD', alias: 'ROW', logo_type: 'NO' });
  const uomCD = ins('uom', { ad_type_id: atClassified, uom_type: 'CLASSIFIED', description: 'CD (Classified Display)', name: 'CD', alias: 'CD', logo_type: 'YES', logo_uom: 'CD' });

  const pubNT = ins('publication', { publication_type_id: ptNews, name: 'NATIONAL TIMES', alias: 'NT', language_id: langEn, start_date: '1995-04-01', periodicity_id: perDaily, priority: 1, gutter_width: 0.5, column_width: 4.2, ro_acceptance_time: '16:00', min_columns: 1, production_days_before: 1, publish_days: 'MON,TUE,WED,THU,FRI,SAT,SUN' });
  const pubDA = ins('publication', { publication_type_id: ptNews, name: 'DAINIK AWAAZ', alias: 'DA', language_id: langHi, start_date: '2001-01-15', periodicity_id: perDaily, priority: 2, gutter_width: 0.5, column_width: 4.0, ro_acceptance_time: '15:30', min_columns: 1, production_days_before: 1, publish_days: 'MON,TUE,WED,THU,FRI,SAT,SUN' });

  const edNTDel = ins('edition', { publication_id: pubNT, edition_type: 'MAIN', name: 'DELHI', alias: 'NT-DEL', country_id: india, pub_center_id: pcDelhi, printing_center_id: pcDelhi, periodicity_id: perDaily, priority: 1, circulation: 450000, uom_id: uomSqcm, no_of_columns: 8, height: 52, width: 33, gutter_width: 0.5, column_width: 4.2, ro_time: '16:00', production_days_before: 1 });
  const edNTMum = ins('edition', { publication_id: pubNT, edition_type: 'MAIN', name: 'MUMBAI', alias: 'NT-MUM', country_id: india, pub_center_id: pcMumbai, printing_center_id: pcMumbai, periodicity_id: perDaily, priority: 2, circulation: 380000, uom_id: uomSqcm, no_of_columns: 8, height: 52, width: 33, ro_time: '16:00', production_days_before: 1 });
  const edNTLko = ins('edition', { publication_id: pubNT, edition_type: 'SUB', name: 'LUCKNOW', alias: 'NT-LKO', country_id: india, pub_center_id: pcDelhi, printing_center_id: pcDelhi, periodicity_id: perDaily, priority: 3, circulation: 150000, uom_id: uomSqcm, no_of_columns: 8, height: 52, width: 33 });
  const edDADel = ins('edition', { publication_id: pubDA, edition_type: 'MAIN', name: 'DELHI', alias: 'DA-DEL', country_id: india, pub_center_id: pcDelhi, printing_center_id: pcDelhi, periodicity_id: perDaily, priority: 1, circulation: 520000, uom_id: uomSqcm, no_of_columns: 8, height: 52, width: 33 });

  const stSep = ins('supplement_type', { name: 'SEPARATE SUPPLEMENT', alias: 'SEP' });
  ins('supplement_type', { name: 'REGULAR PAGE SUPPLEMENT', alias: 'REG' });
  const supCity = ins('supplement', { publication_id: pubNT, edition_id: edNTDel, supplement_type_id: stSep, name: 'CITY LIFE', alias: 'NT-CIT-DEL', periodicity_id: perWeekly, uom_id: uomSqcm, no_of_columns: 6, height: 40, width: 26, publish_days: 'SUN' });

  ins('page_type', { publication_id: pubNT, name: 'SPORTS', height: 52, width: 33 });
  ins('page_type', { publication_id: pubNT, name: 'BUSINESS', height: 52, width: 33 });
  ins('page_type', { publication_id: pubNT, name: 'ENTERTAINMENT', height: 52, width: 33 });

  const nidHoli = ins('no_issue_day', { name: 'HOLI' });
  ins('no_issue_day', { name: 'DIWALI' });
  const ni = ins('no_issue', { edition_id: edNTDel });
  ins('no_issue_date', { parent_id: ni, no_issue_day_id: nidHoli, date: '2026-03-04' });

  /* ---------- packages (single edition + combos) ---------- */
  const mkPkg = (name, adTypeId, eds, catId = null) => {
    const p = ins('package', { ad_type_id: adTypeId, ad_category_id: catId, option_type: 'MAIN EDITION', name, alias: name.replace(/[^A-Z]/g, '').slice(0, 8), no_of_editions: eds.length, combination_name: name, no_of_inserts: 1, status: 'ACTIVE' });
    for (const e of eds) ins('package_edition', { parent_id: p, edition_id: e });
    return p;
  };
  const pkgNTDelD = mkPkg('NT-DEL (DISPLAY)', atDisplay, [edNTDel]);
  const pkgNTMumD = mkPkg('NT-MUM (DISPLAY)', atDisplay, [edNTMum]);
  const pkgNTAllD = mkPkg('NT ALL EDITIONS (DISPLAY)', atDisplay, [edNTDel, edNTMum, edNTLko]);
  const pkgDADelD = mkPkg('DA-DEL (DISPLAY)', atDisplay, [edDADel]);
  const pkgNTDelC = mkPkg('NT-DEL (CLASSIFIED)', atClassified, [edNTDel]);
  const pkgNTDelMumC = mkPkg('NT DEL+MUM (CLASSIFIED)', atClassified, [edNTDel, edNTMum]);
  const pkgDADelC = mkPkg('DA-DEL (CLASSIFIED)', atClassified, [edDADel]);

  /* ---------- colors, premiums, schemes, boxes, bullets ---------- */
  const colBW = ins('color', { name: 'BLACK & WHITE', alias: 'B&W' });
  const colFC = ins('color', { name: 'FOUR COLOR', alias: 'FC' });
  ins('color_type', { name: 'SPOT COLOR', alias: 'SPOT' });
  ins('bg_color', { name: 'NONE', alias: 'NONE', charge: 0 });
  ins('bg_color', { name: 'YELLOW SCREEN', alias: 'YLW', charge: 150 });
  const premFront = ins('ad_page_premium', { name: 'FRONT PAGE', ad_type_id: atDisplay, publication_id: pubNT, page_no: 1, premium_type: 'PERCENTAGE', premium_value: 50, valid_from: '2026-01-01', valid_to: '2026-12-31', page_heading: 'FRONT' });
  ins('ad_page_premium', { name: 'BACK PAGE', ad_type_id: atDisplay, publication_id: pubNT, premium_type: 'PERCENTAGE', premium_value: 30, valid_from: '2026-01-01', valid_to: '2026-12-31', page_heading: 'BACK' });
  const posSolus = ins('ad_position_type', { name: 'SOLUS POSITION', alias: 'SOL', premium_type: 'PERCENTAGE', premium_value: 15 });
  ins('ad_position_type', { name: 'ISLAND POSITION', alias: 'ISL', premium_type: 'FIXED', premium_value: 2000 });
  const schemeBuy5 = ins('scheme', { name: 'BUY 5 GET 1 FREE', valid_from: '2026-01-01', valid_to: '2026-12-31', paid_insertions: 5, free_insertions: 1, description: 'Book 5 insertions, 6th free' });
  const boxCourier = ins('box', { name: 'BY COURIER', alias: 'COUR', no_of_dispatches: 3, national_charges: 250, international_charges: 900, valid_from: '2026-01-01', valid_to: '2026-12-31' });
  ins('box', { name: 'PERSONAL COLLECTION', alias: 'PERS', no_of_dispatches: 1, national_charges: 100, international_charges: 0, valid_from: '2026-01-01', valid_to: '2026-12-31' });
  const bulletStar = ins('bullet', { pub_center_id: pcDelhi, name: 'STAR', charge_type: 'FIXED', charges: 100, valid_from: '2026-01-01', valid_till: '2026-12-31', symbol: '*', font: 'WINGDINGS' });
  ins('bullet', { pub_center_id: pcDelhi, name: 'HAND', charge_type: 'FIXED', charges: 120, valid_from: '2026-01-01', valid_till: '2026-12-31', symbol: '+', font: 'WEBDINGS' });
  ins('translation_charge', { ad_type_id: atClassified, name: 'HINDI TRANSLATION', alias: 'HTR', charge_type: 'FIXED', charge_amount: 50, valid_from: '2026-01-01', valid_to: '2026-12-31', charge_active: 'YES' });
  ins('fmg_reason', { name: 'GOODWILL AD' });
  ins('fmg_reason', { name: 'PROMOTIONAL EXCHANGE' });

  /* ---------- rate structure ---------- */
  const rgComm = ins('rate_group', { name: 'COMMERCIAL', alias: 'COMM' });
  const rgGovt = ins('rate_group', { name: 'GOVERNMENT (DAVP)', alias: 'DAVP' });
  const rcLocal = ins('rate_code', { name: 'LOCAL', remark: 'Local advertisers', status: 'ACTIVE' });
  const rcCorp = ins('rate_code', { name: 'CORPORATE', remark: 'Corporate advertisers', status: 'ACTIVE' });

  const mkRate = (extra) => ins('rate_master', {
    rate_group_id: rgComm, currency_id: inr, valid_from: '2026-01-01', valid_to: '2026-12-31', status: 'ACTIVE', rate_code_id: rcLocal, ...extra,
  });
  // Display rates (per SQCM)
  mkRate({ ad_type_id: atDisplay, package_id: pkgNTDelD, uom_id: uomSqcm, color_id: colBW, rate: 800, min_rate: 5000, weekend_rate: 950 });
  mkRate({ ad_type_id: atDisplay, package_id: pkgNTDelD, uom_id: uomSqcm, color_id: colFC, rate: 1200, min_rate: 8000, weekend_rate: 1400 });
  mkRate({ ad_type_id: atDisplay, package_id: pkgNTMumD, uom_id: uomSqcm, color_id: colBW, rate: 700, min_rate: 4500 });
  mkRate({ ad_type_id: atDisplay, package_id: pkgNTMumD, uom_id: uomSqcm, color_id: colFC, rate: 1050, min_rate: 7000 });
  mkRate({ ad_type_id: atDisplay, package_id: pkgNTAllD, uom_id: uomSqcm, color_id: colBW, rate: 1800, min_rate: 12000 });
  mkRate({ ad_type_id: atDisplay, package_id: pkgNTAllD, uom_id: uomSqcm, color_id: colFC, rate: 2600, min_rate: 18000 });
  mkRate({ ad_type_id: atDisplay, package_id: pkgDADelD, uom_id: uomSqcm, color_id: colBW, rate: 650, min_rate: 4000 });
  mkRate({ ad_type_id: atDisplay, package_id: pkgDADelD, uom_id: uomSqcm, color_id: colFC, rate: 950, min_rate: 6000 });
  // Tender category premium rate
  mkRate({ ad_type_id: atDisplay, ad_category_id: catTender, package_id: pkgNTDelD, uom_id: uomSqcm, color_id: colBW, rate: 900, min_rate: 5500 });
  // Classified line rates
  mkRate({ ad_type_id: atClassified, package_id: pkgNTDelC, uom_id: uomRol, rate: 120, min_rate: 480, extra_rate: 110, size_from: 4, weekend_rate: 140, weekend_extra_rate: 130 });
  mkRate({ ad_type_id: atClassified, package_id: pkgNTDelC, uom_id: uomRow, rate: 30, min_rate: 300, extra_rate: 25, size_from: 10 });
  mkRate({ ad_type_id: atClassified, package_id: pkgNTDelMumC, uom_id: uomRol, rate: 200, min_rate: 800, extra_rate: 180, size_from: 4 });
  mkRate({ ad_type_id: atClassified, package_id: pkgDADelC, uom_id: uomRol, rate: 90, min_rate: 360, extra_rate: 80, size_from: 4 });
  // Classified display rates
  mkRate({ ad_type_id: atClassified, package_id: pkgNTDelC, uom_id: uomCD, color_id: colBW, rate: 450, min_rate: 3000 });
  mkRate({ ad_type_id: atClassified, package_id: pkgNTDelC, uom_id: uomCD, color_id: colFC, rate: 650, min_rate: 4500 });
  // Matrimonial special rate
  mkRate({ ad_type_id: atClassified, ad_category_id: catMat, package_id: pkgNTDelC, uom_id: uomRol, rate: 100, min_rate: 400, extra_rate: 90, size_from: 4 });

  ins('color_rate_group', { color_rate: 'REFERENCE', ad_type_id: atDisplay, package_id: pkgNTDelD, publication_id: pubNT, color_id: colFC, premium_pct: 50, from_date: '2026-01-01', to_date: '2026-12-31' });
  ins('edition_ratio', { package_id: pkgNTAllD, edition_id: edNTDel, ratio: 45 });
  ins('edition_ratio', { package_id: pkgNTAllD, edition_id: edNTMum, ratio: 38 });
  ins('edition_ratio', { package_id: pkgNTAllD, edition_id: edNTLko, ratio: 17 });

  /* ---------- ad sizes ---------- */
  const szFull = ins('ad_size', { ad_type_id: atDisplay, name: 'FULL PAGE', height: 52, width: 33, color_id: colBW, uom_id: uomSqcm });
  const szHalf = ins('ad_size', { ad_type_id: atDisplay, name: 'HALF PAGE', height: 26, width: 33, color_id: colBW, uom_id: uomSqcm });
  const szQtr = ins('ad_size', { ad_type_id: atDisplay, name: 'QUARTER PAGE', height: 26, width: 16.5, color_id: colBW, uom_id: uomSqcm });
  ins('ad_size', { ad_type_id: atDisplay, name: 'EAR PANEL', height: 5, width: 8, color_id: colFC, uom_id: uomSqcm });

  /* ---------- people: industry, products, representatives, executives, retainers ---------- */
  const indAuto = ins('industry', { name: 'AUTOMOBILE', alias: 'AUTO' });
  const indRealty = ins('industry', { name: 'REAL ESTATE', alias: 'REAL' });
  const indFmcg = ins('industry', { name: 'FMCG', alias: 'FMCG' });
  ins('industry', { name: 'EDUCATION', alias: 'EDU' });
  const prodCar = ins('product', { industry_id: indAuto, name: 'CAR', alias: 'CAR' });
  const prodFlat = ins('product', { industry_id: indRealty, name: 'RESIDENTIAL FLATS', alias: 'FLAT' });
  const prodSoap = ins('product', { industry_id: indFmcg, name: 'PERSONAL CARE', alias: 'PCARE' });
  const brSwift = ins('brand', { product_id: prodCar, name: 'SWIFT', alias: 'SWF' });
  const brAlto = ins('brand', { product_id: prodCar, name: 'ALTO', alias: 'ALT' });
  const brGreens = ins('brand', { product_id: prodFlat, name: 'GREEN VALLEY', alias: 'GV' });
  ins('variant', { brand_id: brSwift, name: 'VXI', alias: 'VXI' });
  ins('variant', { brand_id: brSwift, name: 'LXI', alias: 'LXI' });
  ins('variant', { brand_id: brAlto, name: 'STD', alias: 'STD' });
  const repRavi = ins('representative', { name: 'RAVI MALHOTRA' });
  const repSunita = ins('representative', { name: 'SUNITA IYER' });

  const desMgr = ins('designation', { name: 'SALES MANAGER' });
  const desExec = ins('designation', { name: 'SALES EXECUTIVE' });
  ins('designation', { name: 'GM MARKETING' });
  const rtoAnil = ins('reporting_to', { name: 'ANIL KHANNA', designation_id: desMgr, level: '2', email: 'anil.k@nmh.example', discount_allowed: 10 });
  const exRohit = ins('executive', { name: 'ROHIT SHARMA', alias: 'RS', team_name: 'TEAM ALPHA', designation_id: desExec, reporting_to_id: rtoAnil, zone_id: zN, email: 'rohit@nmh.example', phone: '9810012345', status: 'ACTIVE' });
  const exPriya = ins('executive', { name: 'PRIYA NAIR', alias: 'PN', team_name: 'TEAM ALPHA', designation_id: desExec, reporting_to_id: rtoAnil, zone_id: zW, email: 'priya@nmh.example', phone: '9820023456', status: 'ACTIVE' });
  const exVikas = ins('executive', { name: 'VIKAS GUPTA', alias: 'VG', team_name: 'TEAM BETA', designation_id: desExec, reporting_to_id: rtoAnil, zone_id: zN, email: 'vikas@nmh.example', phone: '9830034567', status: 'ACTIVE' });
  ins('executive_contact', { parent_id: exRohit, address1: 'Karol Bagh', city: 'New Delhi', phone: '011-25752121', mobile: '9810012345', email: 'rohit@nmh.example' });

  const retMehta = ins('retainer', { name: 'MEHTA MEDIA SERVICES', alias: 'MMS', address1: 'Lajpat Nagar', country_id: india, city_id: cityDel, pin: '110024', phone: '011-29841234', pan_no: 'AFLPM3456K', credit_days: 30, status: 'ACTIVE', email: 'mehta@media.example' });
  ins('retainer_commission', { parent_id: retMehta, effective_from: '2026-01-01', effective_to: '2026-12-31', fixed_rate: 5, additional_rate: 2, from_amount: 100000, to_amount: 500000, commission_on: 'GROSS' });
  ins('retainer_slab', { parent_id: retMehta, from_days: 0, till_days: 10, commission_on: 'GROSS', comm_rate: 10 });
  ins('retainer_slab', { parent_id: retMehta, from_days: 11, till_days: 20, commission_on: 'GROSS', comm_rate: 5 });

  /* ---------- agency & clients ---------- */
  const agtAccr = ins('agency_type', { name: 'ACCREDITED', alias: 'ACC', effective_from: '2026-01-01', effective_to: '2026-12-31', commission_rate: 15, commission_on: 'GROSS', credit_days: 60 });
  const agtNon = ins('agency_type', { name: 'NON ACCREDITED', alias: 'NACC', effective_from: '2026-01-01', effective_to: '2026-12-31', commission_rate: 10, commission_on: 'GROSS', credit_days: 30 });
  const agtGovt = ins('agency_type', { name: 'GOVERNMENT', alias: 'GOVT', effective_from: '2026-01-01', effective_to: '2026-12-31', commission_rate: 0, commission_on: 'NET', credit_days: 90 });
  ins('agency_category', { agency_type_id: agtAccr, name: 'PREMIUM PARTNERS', alias: 'PREM' });
  ins('agency_category', { agency_type_id: agtNon, name: 'STANDARD', alias: 'STD' });

  const agAdVantage = ins('agency', { parent_type: 'PARENT', name: 'ADVANTAGE COMMUNICATIONS', alias: 'ADVC', agency_type_id: agtAccr, rate_group_id: rgComm, address1: '22 Barakhamba Road', country_id: india, city_id: cityDel, pin: '110001', region_id: regDel, zone_id: zN, phone: '011-23731111', email: 'ro@advantage.example', credit_days: 60, credit_limit: 1500000, pan_no: 'AAACA9999Q', representative_id: repRavi, status: 'ACTIVE', enrollment_date: '2020-04-01' });
  const agMediaMint = ins('agency', { parent_type: 'PARENT', name: 'MEDIAMINT ADVERTISING', alias: 'MMA', agency_type_id: agtNon, rate_group_id: rgComm, address1: 'Andheri West', country_id: india, city_id: cityMum, pin: '400058', region_id: regMum, zone_id: zW, phone: '022-26731222', email: 'booking@mediamint.example', credit_days: 30, credit_limit: 600000, representative_id: repSunita, status: 'ACTIVE', enrollment_date: '2022-08-10' });
  const agDavp = ins('agency', { parent_type: 'PARENT', name: 'DAVP (GOVT OF INDIA)', alias: 'DAVP', agency_type_id: agtGovt, rate_group_id: rgGovt, address1: 'Soochna Bhawan, CGO Complex', country_id: india, city_id: cityDel, pin: '110003', region_id: regDel, zone_id: zN, status: 'ACTIVE' });
  ins('agency_commission', { parent_id: agAdVantage, effective_from: '2026-01-01', effective_to: '2026-12-31', commission_rate: 15, commission_on: 'GROSS' });
  ins('agency_paymode', { parent_id: agAdVantage, payment_mode_id: pmCredit });
  ins('agency_paymode', { parent_id: agAdVantage, payment_mode_id: pmCheque });
  ins('agency_contact', { parent_id: agAdVantage, contact_name: 'KAVITA REDDY', designation_id: desMgr, phone: '011-23731112', mobile: '9891122334', email: 'kavita@advantage.example' });
  ins('agency_bg', { parent_id: agAdVantage, bg_no: 'BG/2026/0142', amount: 500000, bg_date: '2026-01-15', validity_date: '2027-01-14', bank: 'STATE BANK OF INDIA' });
  ins('agency_status', { parent_id: agAdVantage, valid_from: '2026-01-01', status_id: 1, remark: 'Active premium agency' });
  ins('agency_bank', { parent_id: agAdVantage, country_id: india, city_id: cityDel, bank_no: 'SBIN0000691', account_no: '30991234567', bank_name: 'STATE BANK OF INDIA', branch_name: 'CP BRANCH' });
  ins('ro_book_issue', { agency_id: agAdVantage, issue_date: '2026-01-05', issue_no: 'RB-26-01', from_ro_no: 'RO5001', till_ro_no: 'RO5100', status: 'ACTIVE' });
  ins('agency_credit', { company_id: comp, agency_id: agAdVantage, date: '2026-07-01', balance: 245000 });

  const ccCorporate = ins('client_category', { name: 'CORPORATE', alias: 'CORP' });
  const ccRetail = ins('client_category', { name: 'RETAIL / WALK-IN', alias: 'RETL' });
  const clMaruti = ins('client', { name: 'MARUTI SUZUKI INDIA LTD.', alias: 'MSIL', address1: 'Nelson Mandela Road, Vasant Kunj', country_id: india, city_id: cityDel, pin: '110070', region_id: regDel, zone_id: zN, phone: '011-46781000', email: 'media@maruti.example', client_category_id: ccCorporate, credit_days: 45, credit_limit: 2000000, status: 'ACTIVE' });
  const clGreenValley = ins('client', { name: 'GREEN VALLEY DEVELOPERS', alias: 'GVD', address1: 'Sector 62, Noida', country_id: india, city_id: cityDel, pin: '201309', region_id: regDel, zone_id: zN, phone: '0120-4567890', client_category_id: ccCorporate, credit_days: 30, status: 'ACTIVE' });
  const clSharma = ins('client', { name: 'RAJESH SHARMA (WALK-IN)', alias: 'RSHA', address1: 'Mayur Vihar Phase 1', country_id: india, city_id: cityDel, client_category_id: ccRetail, status: 'ACTIVE' });
  ins('client_product', { parent_id: clMaruti, product_id: prodCar, executive_id: exRohit });
  ins('client_brand', { parent_id: clMaruti, product_id: prodCar, brand_id: brSwift, executive_id: exRohit });
  ins('client_executive', { parent_id: clMaruti, executive_id: exRohit });
  ins('client_contact', { parent_id: clMaruti, contact_name: 'AMIT VERMA', phone: '011-46781001', mobile: '9899001122', email: 'amit.v@maruti.example' });
  ins('client_product', { parent_id: clGreenValley, product_id: prodFlat, executive_id: exVikas });
  ins('publisher', { name: 'NMH PRESS DELHI', alias: 'NMHP', publisher_type: 'SELF', country_id: india, city_id: cityDel, sharing_pct: 0 });

  /* ---------- contract ---------- */
  const ctValue = ins('contract_type', { name: 'VALUE CONTRACT', alias: 'VAL' });
  ins('contract_type', { name: 'VOLUME CONTRACT', alias: 'VOL' });
  const contractMaruti = ins('contract', { contract_date: '2026-01-10', name: 'MSIL ANNUAL VALUE DEAL 2026', contract_type_id: ctValue, agency_id: agAdVantage, client_id: clMaruti, product_id: prodCar, valid_from: '2026-01-01', valid_to: '2026-12-31', total_value: 5000000, executive_id: exRohit, payment_type_id: pmCredit, status: 'CONFIRM', center_id: pcDelhi, service_tax: 5 });
  ins('contract_detail', { parent_id: contractMaruti, ad_category_id: catDisplay, package_id: pkgNTDelD, color_id: colFC, rate: 1050 });
  ins('contract_detail', { parent_id: contractMaruti, ad_category_id: catDisplay, package_id: pkgNTAllD, color_id: colFC, rate: 2300 });

  /* ---------- users ---------- */
  ins('users', { username: 'admin', password: 'admin123', first_name: 'System', last_name: 'Administrator', email: 'admin@nmh.example', branch_id: brCP, company_id: comp, currency_id: inr, role_id: roleAdmin, status: 'ACTIVE', edit_line_booking: 'YES' });
  ins('users', { username: 'booking', password: 'booking123', first_name: 'Neha', last_name: 'Kapoor', email: 'neha@nmh.example', branch_id: brCP, company_id: comp, currency_id: inr, role_id: roleBooking, status: 'ACTIVE' });
  ins('users', { username: 'auditor', password: 'audit123', first_name: 'Suresh', last_name: 'Menon', email: 'suresh@nmh.example', branch_id: brCP, company_id: comp, currency_id: inr, role_id: roleAuditor, status: 'ACTIVE' });
  db.prepare("INSERT INTO preference (key, value) VALUES ('rate_audit_required','YES'), ('default_currency','INR'), ('company_name','NATIONAL MEDIA HOUSE LTD.'), ('financial_year','2026-27')").run();

  /* ---------- demo bookings ---------- */
  const today = new Date();
  const d = (off) => { const t = new Date(today); t.setDate(t.getDate() + off); return t.toISOString().slice(0, 10); };

  const bk1 = saveBooking({
    ad_type: 'DISPLAY', booking_date: d(-20), branch_id: brCP, agency_id: agAdVantage, client_id: clMaruti,
    ro_no: 'RO5001', ro_date: d(-21), ro_status: 'CONFIRM', executive_id: exRohit,
    booking_type: 'NORMAL', color_id: colFC, ad_category_id: catDisplay, uom_id: uomSqcm,
    product_id: prodCar, brand_id: brSwift, campaign: 'SWIFT SUMMER DRIVE', caption: 'DRIVE HOME A SWIFT',
    material_status: 'SOFT COPY', publish_date: d(-15), no_of_insertions: 3, repeating_day: 2,
    contract_id: contractMaruti, ad_size_id: szHalf, height: 26, width: 33, no_of_columns: 8,
    page_no: 3, package_ids: [pkgNTDelD], bill_cycle: 'MONTHLY', revenue_center_id: brCP, payment_type_id: pmCredit,
  }, 'booking');

  const bk2 = saveBooking({
    ad_type: 'DISPLAY', booking_date: d(-12), branch_id: brCP, agency_id: agDavp, client_name: 'MINISTRY OF HEALTH', client_address: 'Nirman Bhawan, New Delhi',
    ro_no: 'DAVP/2026/1123', ro_date: d(-13), ro_status: 'CONFIRM', executive_id: exVikas,
    booking_type: 'NORMAL', color_id: colBW, ad_category_id: catTender, uom_id: uomSqcm,
    caption: 'PUBLIC HEALTH NOTICE', material_status: 'HARD COPY',
    publish_date: d(-8), no_of_insertions: 2, repeating_day: 3,
    height: 15, width: 12.6, no_of_columns: 3, page_no: 7,
    package_ids: [pkgNTDelD], bill_cycle: 'MONTHLY', revenue_center_id: brCP, payment_type_id: pmCheque,
  }, 'booking');

  const bk3 = saveBooking({
    ad_type: 'CLASSIFIED', booking_date: d(-10), branch_id: brCP, client_id: clSharma, client_name: 'RAJESH SHARMA (WALK-IN)',
    ro_status: 'CONFIRM', booking_type: 'NORMAL', color_id: colBW,
    ad_category_id: catMat, ad_sub_category_id: subMatBride, uom_id: uomRol,
    caption: 'HANDSOME MATCH WANTED', matter: 'Wanted beautiful, educated bride for handsome Punjabi boy, 29/178, MNC software engineer, Delhi based. Contact with biodata.',
    material_status: 'SOFT COPY', publish_date: d(-4), no_of_insertions: 4, repeating_day: 7,
    no_of_lines: 6, no_of_columns: 1, eye_catcher_id: bulletStar,
    package_ids: [pkgNTDelC], bill_cycle: 'DAILY', revenue_center_id: brCP, payment_type_id: pmCash, cash_received: 3000,
  }, 'booking');

  const bk4 = saveBooking({
    ad_type: 'CLASSIFIED', booking_date: d(-6), branch_id: brNoida, agency_id: agMediaMint, client_id: clGreenValley,
    ro_no: 'MM/778', ro_date: d(-6), ro_status: 'CONFIRM', executive_id: exVikas, retainer_id: retMehta,
    booking_type: 'NORMAL', color_id: colFC, ad_category_id: catProp, ad_sub_category_id: subPropSale, uom_id: uomCD,
    product_id: prodFlat, brand_id: brGreens, caption: '2/3 BHK GREEN VALLEY NOIDA',
    matter: 'GREEN VALLEY — Premium 2/3 BHK apartments at Sector 62 Noida. Possession 2027. Booking open.',
    material_status: 'CD', publish_date: d(-1), no_of_insertions: 6, repeating_day: 2, scheme_id: schemeBuy5,
    height: 10, width: 8.4, no_of_columns: 2, box_id: boxCourier,
    package_ids: [pkgNTDelC], bill_cycle: 'WEEKLY', revenue_center_id: brNoida, payment_type_id: pmCredit,
  }, 'booking');

  const bk5 = saveBooking({
    ad_type: 'DISPLAY', booking_date: d(-3), branch_id: brBandra, agency_id: agMediaMint, client_id: clGreenValley,
    ro_no: 'MM/781', ro_date: d(-3), ro_status: 'RESERVATION', executive_id: exPriya,
    booking_type: 'NORMAL', color_id: colFC, ad_category_id: catDisplay, uom_id: uomSqcm,
    product_id: prodFlat, brand_id: brGreens, campaign: 'GV LAUNCH MUMBAI', caption: 'GREEN VALLEY GRAND LAUNCH',
    material_status: 'SOFT COPY', publish_date: d(4), no_of_insertions: 1,
    ad_size_id: szQtr, height: 26, width: 16.5, no_of_columns: 4, page_premium_id: premFront, page_no: 1,
    package_ids: [pkgNTMumD], bill_cycle: 'MONTHLY', revenue_center_id: brBandra, payment_type_id: pmCredit,
  }, 'booking');

  const bk6 = saveBooking({
    ad_type: 'CLASSIFIED', source: 'QBC', booking_date: d(0), branch_id: brCP, client_name: 'SUNIL ARORA', client_address: 'Rohini Sector 8, Delhi', client_mobile: '9811098110',
    ro_status: 'CONFIRM', booking_type: 'NORMAL', color_id: colBW,
    ad_category_id: catSituation, uom_id: uomRow,
    caption: 'DRIVER WANTED', matter: 'Wanted experienced driver for private car, Rohini area, good salary. Call 9811098110.',
    publish_date: d(2), no_of_insertions: 2, repeating_day: 1, no_of_lines: 14,
    package_ids: [pkgNTDelC], bill_cycle: 'DAILY', payment_type_id: pmCash, cash_received: 850, revenue_center_id: brCP,
  }, 'booking');

  /* audits, publishing & billing for realistic report data */
  db.prepare("UPDATE booking SET audit_status='AUDITED', audit_by='auditor' WHERE id IN (?,?,?,?)").run(bk1.id, bk2.id, bk3.id, bk4.id);
  db.prepare("UPDATE booking SET rate_audit_status='PASSED', rate_audit_by='auditor' WHERE id IN (?,?,?)").run(bk1.id, bk2.id, bk3.id);
  const todayStr = today.toISOString().slice(0, 10);
  db.prepare("UPDATE insertion SET status='PUBLISHED' WHERE publish_date <= ? AND booking_id IN (?,?,?,?)").run(todayStr, bk1.id, bk2.id, bk3.id, bk4.id);

  // bills for bookings 1 & 2
  const mkBill = (bk, n) => {
    const b = db.prepare('SELECT * FROM booking WHERE id = ?').get(bk.id);
    const insCount = db.prepare("SELECT COUNT(*) c FROM insertion WHERE booking_id = ? AND status='PUBLISHED'").get(bk.id).c;
    const taxPct = 5;
    const taxable = b.gross_amount - b.trade_discount - (b.addl_agency_comm || 0);
    const tax = +(taxable * taxPct / 100).toFixed(2);
    ins('bill', { bill_no: `BILL-26-${1000 + n}`, bill_date: todayStr, booking_id: bk.id, agency_id: b.agency_id, client_id: b.client_id, bill_to: b.bill_to, insertions_count: insCount, gross_amount: b.gross_amount, trade_discount: b.trade_discount, addl_comm: b.addl_agency_comm || 0, tax_pct: taxPct, tax_amount: tax, net_amount: +(taxable + tax).toFixed(2), status: 'ACTIVE', created_by: 'admin' });
    db.prepare("UPDATE booking SET bill_status='BILLED' WHERE id = ?").run(bk.id);
    db.prepare("UPDATE insertion SET status='BILLED' WHERE booking_id = ? AND status='PUBLISHED'").run(bk.id);
  };
  mkBill(bk1, 1); mkBill(bk2, 2);

  ins('payment', { booking_id: bk3.id, date: d(-10), mode: 'CASH', amount: 3000, received_by: 'booking' });
  ins('payment', { booking_id: bk6.id, date: d(0), mode: 'CASH', amount: 850, received_by: 'booking' });
  ins('follow_up', { date: d(-2), agency_id: agMediaMint, client_id: clGreenValley, booking_id: bk5.id, remarks: 'Confirm RO for Mumbai launch ad before weekend.', next_date: d(1), status: 'OPEN' });

  db.prepare("INSERT INTO preference (key, value) VALUES ('seeded', datetime('now'))").run();
  console.log('Seed complete. Login: admin / admin123');
}

seed();
module.exports = { seed };
