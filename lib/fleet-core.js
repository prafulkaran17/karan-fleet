// Karan Fleet — local-first core (black theme). Data in localStorage + Google Drive auto-sync.
// initFleet({ root, jsPDF, drive }) builds the whole UI inside `root`.

export function initFleet({ root, jsPDF, drive }) {
  /* ---------------- helpers ---------------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = n => Number(n) || 0;
  const fmt2 = n => num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inr = n => '₹' + Math.round(num(n)).toLocaleString('en-IN');
  const inr1 = n => '₹' + num(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const pad2 = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const curMonth = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); };
  const isoToDMY = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
  const monthLabel = ym => { if (!ym) return ''; const [y, m] = ym.split('-'); return ['', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'][+m] + ' ' + y; };
  const monthLabelHi = ym => { if (!ym) return ''; const [y, m] = ym.split('-'); return ['', 'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितम्बर', 'अक्टूबर', 'नवम्बर', 'दिसम्बर'][+m] + ' ' + y; };
  const lastDayISO = ym => { const [y, m] = ym.split('-').map(Number); return ym + '-' + pad2(new Date(y, m, 0).getDate()); };
  const firstDayISO = ym => ym + '-01';
  const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const daysBetween = iso => { if (!iso) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(iso + 'T00:00:00') - t) / 86400000); };
  const addMonthISO = (ym, d) => { let [y, m] = ym.split('-').map(Number); m += d; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + pad2(m); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const $ = s => root.querySelector(s);

  function toast(msg) { let t = root.querySelector('#toast'); if (t) t.remove(); t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.textContent = msg; root.appendChild(t); setTimeout(() => t && t.remove(), 2800); }

  function words(n) { n = Math.floor(Math.abs(n)); if (n === 0) return 'Zero';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
    const three = x => (Math.floor(x / 100) ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
    let s = ''; const cr = Math.floor(n / 1e7); n %= 1e7; const la = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1e3); n %= 1e3;
    if (cr) s += two(cr) + ' Crore '; if (la) s += two(la) + ' Lakh '; if (th) s += two(th) + ' Thousand '; if (n) s += three(n); return s.trim(); }
  const rupeeWords = amt => { const r = Math.floor(Math.round(amt * 100) / 100); const p = Math.round((amt - r) * 100); let s = 'Rupees ' + words(r); if (p) s += ' and ' + words(p) + (p === 1 ? ' Paisa' : ' Paise'); return s + ' Only'; };

  const IC = {
    fuel: '<path d="M6 20V5a2 2 0 012-2h5a2 2 0 012 2v15M4 20h12M15 9h2.5a2 2 0 012 2v5a1.5 1.5 0 003 0V8l-2.5-2.5"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
    inflow: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    doc: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
    cloud: '<path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 18z"/>',
    cal: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  };
  const svg = (p, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  /* ---------------- store ---------------- */
  const LS = 'karanFleetStore';
  let STORE = { companies: {}, clients: {}, vehicles: [], invoices: [], slips: [], cash: [], updatedAt: 0, v: 1 };
  let companies, clients, vehicles, invoices, slips, cash;
  function point() { companies = STORE.companies; clients = STORE.clients; vehicles = STORE.vehicles; invoices = STORE.invoices; slips = STORE.slips; cash = STORE.cash; }
  let pushTimer = null;
  function persist(noPush) {
    STORE.updatedAt = Date.now();
    try { localStorage.setItem(LS, JSON.stringify(STORE)); } catch (e) {}
    if (!noPush) schedulePush();
  }
  function schedulePush() {
    if (!drive || !drive.isSignedIn()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { drive.push(STORE).then(() => setSync('saved')).catch(() => setSync('error')); setSync('saving'); }, 2500);
  }
  function loadLocal() { try { const raw = localStorage.getItem(LS); if (raw) { const o = JSON.parse(raw); if (o && o.vehicles) STORE = o; } } catch (e) {} }

  function seedIfEmpty() {
    if (Object.keys(STORE.companies).length) return;
    STORE.companies = {
      karan: { name: 'M/S KARAN TOURS & TRAVELS', tagline: 'Vehicle Hire • Tour & Travel Services', gstin: '10BIOPS7614F4Z5', pan: '',
        ho: "'Ashirwad Bhawan', Road No. 11B, Behind P&N Mall, Industrial Area, Patliputra, Kurji, Patna - 800010",
        bo: "'Shyam Kunj', South of D.M. Residence, Patel Nagar, D.M. Colony, Biharsharif, Nalanda - 803101",
        mobile: '9835683305, 8539819805', email: 'karantravels80@gmail.com', stateCode: '10',
        contactLines: ['Patna, Bihar - 800010', '+91 98356 83305 | 85398 19805', 'karantravels80@gmail.com'],
        footer: 'Safe Journey • On-Time Service • Your Trusted Travel Partner', signatory: 'Proprietor',
        invoicePrefix: '', invoiceNext: 1053,
        bank: { holder: 'M/S KARAN TOURS & TRAVELS', payId: 'PT I793753', bank: 'IDFC FIRST BANK', acc: '59835683309', ifsc: 'IDFB0060284', branch: 'Ashiana Digha Road' } },
      jk: { name: 'J K ENTERPRISES', tagline: 'Vehicle Hire Services', gstin: '10BWHPK1108H1Z1', pan: 'BWHPK1108H',
        ho: 'Dalluchak, Kothwan Baswari, Khagaul, Patna - 801105 (Bihar)', bo: '',
        mobile: '9835683305', email: 'jkenterprises@gmail.com', stateCode: '10',
        contactLines: ['Dalluchak, Kothwan Baswari, Khagaul', 'Patna - 801105 (Bihar)', '+91 98356 83305', 'jkenterprises@gmail.com'],
        footer: '', signatory: 'Authorised Signatory', invoicePrefix: 'JK/26-27/', invoiceNext: 387, bank: null },
    };
    STORE.clients = {
      cl_mid: { name: 'The Executive Engineer', line2: 'Minor Irrigation Division', address: 'Jal Bhawan, Riding Road, Sheikhpura, Patna - 800014', stateCode: '10', defaultGst: 18 },
      cl_bpro: { name: 'The Block Panchayat Raj Officer (BPRO)', line2: 'Block Office, Bihar Sharif', address: 'District - Nalanda, Bihar', stateCode: '10', defaultGst: 5 },
      cl_ddo: { name: 'The Administrative Officer Cum DDO', line2: 'Panchayati Raj Department', address: '1st Floor, Vikash Bhawan, Patna, Bihar - 800015', stateCode: '10', defaultGst: 5 },
      cl_doi: { name: 'Department of Industries', line2: '', address: '2nd Floor, Vikash Bhawan, Patna - 800015', stateCode: '10', defaultGst: 5 },
      cl_addl: { name: 'Additional Secretary', line2: 'Department of Industries', address: '2nd Floor, Vikash Bhawan, Patna - 800015', stateCode: '10', defaultGst: 5 },
    };
    const V = (number, model, buyer, hireRate, gst, company, freeKm, hireNote) => ({ id: uid(), number, model, company: company || 'karan', buyer, hireRate, gst, freeKm: freeKm || 1500, hireNote: hireNote || 'Without fuel, with driver', status: 'active', startKm: 0, driverName: '', driverPhone: '', driverSalary: 0, ownership: 'owned', loan: { emi: 0 }, docs: {}, logs: { fuel: [], service: [], driver: [], income: [], cost: [], duty: [] }, createdAt: Date.now() });
    STORE.vehicles = [
      V('BR01PR 8395', 'Toyota Innova Crysta', 'cl_mid', 46500, 18), V('BR01FP 1054', 'Toyota Innova Crysta', 'cl_mid', 46500, 18),
      V('BR01FY 2341', 'Mahindra Scorpio N', 'cl_mid', 46500, 18), V('BR01KC 0182', 'Mahindra Scorpio N', 'cl_mid', 46500, 18),
      V('BR01JD 7740', 'Mahindra Scorpio N', 'cl_mid', 46500, 18), V('BR01JZ 4457', 'Mahindra Scorpio N', 'cl_mid', 46500, 18),
      V('BR01PN 7397', 'Maruti XL6', 'cl_mid', 38898.31, 18),
      V('BR31PA 8953', 'Mahindra Scorpio', 'cl_mid', 31099, 18), V('BR01HK 1293', 'Mahindra Scorpio', 'cl_mid', 31099, 18),
      V('BR01PP 9182', 'Mahindra Scorpio', 'cl_mid', 31099, 18), V('BR01HY 2766', 'Mahindra Scorpio', 'cl_mid', 31099, 18),
      V('BR01HY 2767', 'Mahindra Scorpio', 'cl_mid', 31099, 18), V('BR01JK 5455', 'Mahindra Scorpio', 'cl_mid', 31099, 18),
      V('BR01KC 4728', 'Mahindra Scorpio', 'cl_mid', 31099, 18),
      V('BR01PK 5562', 'Mahindra Scorpio', 'cl_bpro', 36666.67, 5),
      V('BR01HN 2643', 'Toyota Innova Crysta', 'cl_addl', 65000, 5),
      V('BR01JK 3112', 'Maruti Ertiga', 'cl_ddo', 49900, 5, 'jk', 1000, 'up to 1,000 km'),
    ];
  }
  // migrate older vehicles missing duty array
  function migrate() { vehicles.forEach(v => { if (!v.logs) v.logs = { fuel: [], service: [], driver: [], income: [], cost: [], duty: [] }; if (!v.logs.duty) v.logs.duty = []; if (v.driverUpi == null) v.driverUpi = ''; }); if (!STORE.payees) STORE.payees = []; if (!STORE.payers) STORE.payers = []; }

  /* ---------------- state ---------------- */
  let detail = null, detailVid = null;
  let st = { nav: 'home', vsub: null, dtab: 'report', rptMonth: curMonth(), billTab: 'invoices', dutyMonth: curMonth() };

  const CATS = { insurance: 'बीमा / Insurance', puc: 'प्रदूषण / PUC', fitness: 'फ़िटनेस / Fitness', permit: 'परमिट / Permit', roadTax: 'रोड टैक्स / Road Tax' };
  const COSTCATS = { emi: 'EMI / किस्त', insurance: 'बीमा प्रीमियम', tax: 'रोड टैक्स', permit: 'परमिट', fitness: 'फ़िटनेस', challan: 'चालान / फ़ाइन', tyre: 'टायर', parts: 'पार्ट्स', other: 'अन्य' };

  /* ---------------- data ops ---------------- */
  function vehById(id) { return vehicles.find(v => v.id === id); }
  function loadDetail(vid) { const v = vehById(vid); detail = v ? v.logs : null; detailVid = vid; }
  function saveVehicle(id, data) { if (id) { const v = vehById(id); Object.assign(v, data); } else { vehicles.push({ id: uid(), ...data, logs: { fuel: [], service: [], driver: [], income: [], cost: [], duty: [] }, createdAt: Date.now() }); } persist(); }
  function addSub(vid, col, data) { const v = vehById(vid); v.logs[col].push({ id: uid(), ...data, createdAt: Date.now() }); persist(); }
  function delSub(vid, col, id) { const v = vehById(vid); v.logs[col] = v.logs[col].filter(x => x.id !== id); persist(); }

  function clientName(id) { return clients[id] ? clients[id].name : ''; }
  function vehLabel(v) { return v ? ((v.number || '') + (v.model ? ' · ' + v.model : '')) : ''; }

  /* ---------------- payments (UPI deep-link + WhatsApp) ---------------- */
  // Categories a cash entry can carry, and how each one links back into a vehicle's ledger.
  // veh:true -> ask which गाड़ी · col -> which per-vehicle log to mirror into · driver:true -> auto-fill driver · fuel/odo -> extra fields.
  const CASH_OUT_CATS = [
    { v: 'fuel', l: 'तेल / डीज़ल', veh: true, col: 'fuel', fuel: true },
    { v: 'salary', l: 'ड्राइवर — सैलरी', veh: true, col: 'driver', dtype: 'salary', driver: true },
    { v: 'advance', l: 'ड्राइवर — एडवांस', veh: true, col: 'driver', dtype: 'advance', driver: true },
    { v: 'service', l: 'सर्विस / मरम्मत', veh: true, col: 'service', odo: true },
    { v: 'emi', l: 'EMI / किस्त', veh: true, col: 'cost', cost: 'emi' },
    { v: 'insurance', l: 'बीमा प्रीमियम', veh: true, col: 'cost', cost: 'insurance' },
    { v: 'tax', l: 'रोड टैक्स', veh: true, col: 'cost', cost: 'tax' },
    { v: 'permit', l: 'परमिट', veh: true, col: 'cost', cost: 'permit' },
    { v: 'fitness', l: 'फ़िटनेस', veh: true, col: 'cost', cost: 'fitness' },
    { v: 'challan', l: 'चालान / फ़ाइन', veh: true, col: 'cost', cost: 'challan' },
    { v: 'tyre', l: 'टायर', veh: true, col: 'cost', cost: 'tyre' },
    { v: 'parts', l: 'पार्ट्स', veh: true, col: 'cost', cost: 'parts' },
    { v: 'owner-drawing', l: 'मालिक निकासी', veh: false },
    { v: 'other', l: 'अन्य खर्च', veh: true, col: 'cost', cost: 'other' },
  ];
  const CASH_IN_CATS = [
    { v: 'income', l: 'आमदनी / किराया मिला', veh: true, col: 'income' },
    { v: 'owner-deposit', l: 'मालिक जमा', veh: false },
    { v: 'other', l: 'अन्य', veh: false },
  ];
  const catMeta = (dir, v) => (dir === 'out' ? CASH_OUT_CATS : CASH_IN_CATS).find(c => c.v === v) || {};
  const catLabel = (dir, v) => (catMeta(dir, v).l) || v || '';

  const digits = s => String(s || '').replace(/\D/g, '');
  const waPhone = p => { let d = digits(p); if (d.length === 10) d = '91' + d; return d; };
  const isUpiId = s => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(String(s || '').trim());
  function upiURI(scheme, pa, pn, am, tn) {
    const q = 'pa=' + encodeURIComponent((pa || '').trim()) + '&pn=' + encodeURIComponent(pn || '') +
      (num(am) > 0 ? '&am=' + encodeURIComponent(Math.round(num(am) * 100) / 100) : '') +
      '&cu=INR' + (tn ? '&tn=' + encodeURIComponent(tn.slice(0, 50)) : '');
    return scheme + q;
  }
  const UPI_APPS = [
    { k: 'any', l: 'कोई भी UPI', scheme: 'upi://pay?' },
    { k: 'gpay', l: 'GPay', scheme: 'tez://upi/pay?' },
    { k: 'phonepe', l: 'PhonePe', scheme: 'phonepe://pay?' },
    { k: 'paytm', l: 'Paytm', scheme: 'paytmmp://pay?' },
  ];
  function savePayee(p) {
    if (!p || (!isUpiId(p.upi) && !digits(p.phone))) return;
    const key = (p.upi || '').trim().toLowerCase();
    let ex = STORE.payees.find(x => (x.upi || '').trim().toLowerCase() === key && key) ||
      (!key ? STORE.payees.find(x => x.name === p.name && digits(x.phone) === digits(p.phone)) : null);
    if (ex) { ex.name = p.name || ex.name; ex.upi = p.upi || ex.upi; ex.phone = p.phone || ex.phone; }
    else STORE.payees.push({ id: uid(), name: p.name || '', upi: (p.upi || '').trim(), phone: p.phone || '', kind: p.kind || 'other' });
  }

  // Decode a UPI QR image -> { pa (UPI id), pn (name) }. Uses jsQR, loaded on demand.
  async function decodeQrFile(file) {
    const jsQR = (await import('jsqr')).default;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image')); im.src = url; });
      const long = Math.max(img.width, img.height) || 1; const scale = Math.min(1, 1600 / long);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * scale) || img.width; c.height = Math.round(img.height * scale) || img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
      return code ? code.data : null;
    } finally { URL.revokeObjectURL(url); }
  }
  function parseUpiText(text) {
    text = String(text || '').trim();
    if (/pa=/.test(text)) { try { const p = new URLSearchParams(text.split('?')[1] || text); return { pa: (p.get('pa') || '').trim(), pn: (p.get('pn') || '').trim() }; } catch (e) {} }
    if (isUpiId(text)) return { pa: text, pn: '' };
    return { pa: '', pn: '' };
  }
  // Adds a "📷 QR से UPI भरें" button under a UPI input; fills upiEl (and nameEl if empty) from an uploaded QR image.
  function mountQrButton(upiEl, nameEl) {
    const wrap = upiEl && upiEl.closest('.field'); if (!wrap) return;
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.style.display = 'none';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn gho'; btn.textContent = '📷 QR से UPI भरें'; btn.style.cssText = 'width:100%;margin-top:7px';
    wrap.appendChild(file); wrap.appendChild(btn);
    btn.onclick = () => file.click();
    file.onchange = async () => { const f = file.files && file.files[0]; if (!f) return; toast('QR पढ़ रहे…');
      try { const text = await decodeQrFile(f); if (!text) { toast('QR नहीं पढ़ा — साफ़/बड़ी फ़ोटो डालें'); return; }
        const { pa, pn } = parseUpiText(text); if (!pa) { toast('इस QR में UPI ID नहीं मिली'); return; }
        upiEl.value = pa; if (pn && nameEl && !nameEl.value.trim()) nameEl.value = pn; upiEl.dispatchEvent(new Event('input')); toast('UPI भर दी ✓ — ' + pa);
      } catch (e) { console.error(e); toast('QR पढ़ने में दिक़्क़त'); } finally { file.value = ''; } };
  }

  function vInitials(v) { const p = (v.number || '').replace(/\s/g, ''); return p.slice(-4) || '?'; }

  /* duty-month aggregation */
  function dutyStats(v, ym) {
    const rows = (v.logs.duty || []).filter(x => (x.date || '').slice(0, 7) === ym);
    let km = 0, extraHrs = 0, nights = 0, dutyDays = 0;
    rows.forEach(r => { km += num(r.km); const h = num(r.hours); if (h > 12) extraHrs += (h - 12); if (r.night) nights++; if (num(r.km) > 0 || h > 0) dutyDays++; });
    const freeKm = num(v.freeKm) || 0;
    const extraKm = Math.max(0, km - freeKm);
    return { rows, km, extraKm, extraHrs, nights, dutyDays, freeKm };
  }

  function monthStats(v, ym) {
    const d = v.logs; const inM = x => (x.date || '').slice(0, 7) === ym;
    const fuel = d.fuel.filter(inM), service = d.service.filter(inM), driver = d.driver.filter(inM), income = d.income.filter(inM), cost = d.cost.filter(inM);
    const fuelAmt = fuel.reduce((s, x) => s + num(x.amount), 0), liters = fuel.reduce((s, x) => s + num(x.liters), 0);
    const servAmt = service.reduce((s, x) => s + num(x.amount), 0);
    const costAmt = cost.reduce((s, x) => s + num(x.amount), 0);
    const incAmt = income.reduce((s, x) => s + num(x.amount), 0);
    const adv = driver.filter(x => x.type === 'advance').reduce((s, x) => s + num(x.amount), 0);
    const sal = driver.filter(x => x.type === 'salary').reduce((s, x) => s + num(x.amount), 0);
    // km: prefer duty log; else odometer readings
    const ds = dutyStats(v, ym);
    let km = ds.km > 0 ? ds.km : null;
    if (km == null) {
      let reads = [];
      if (num(v.startKm) > 0) reads.push({ date: '2000-01-01', odo: num(v.startKm) });
      d.fuel.concat(d.service).forEach(x => { if (num(x.odo) > 0) reads.push({ date: x.date, odo: num(x.odo) }); });
      reads.sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo);
      const first = firstDayISO(ym), nextFirst = firstDayISO(addMonthISO(ym, 1));
      const before = reads.filter(r => r.date < first), upto = reads.filter(r => r.date < nextFirst), inMo = reads.filter(r => r.date >= first && r.date < nextFirst);
      if (upto.length) { const end = Math.max(...upto.map(r => r.odo)); const start = before.length ? Math.max(...before.map(r => r.odo)) : (inMo.length ? Math.min(...inMo.map(r => r.odo)) : null); if (start != null) km = Math.max(0, end - start); }
    }
    const avg = (km && liters) ? km / liters : null;
    const runCost = fuelAmt + servAmt + costAmt + sal;
    return { fuelAmt, liters, servAmt, costAmt, incAmt, adv, sal, km, avg, runCost, profit: incAmt - runCost, cpk: (km && runCost) ? runCost / km : null,
      n: { fuel: fuel.length, service: service.length, income: income.length, cost: cost.length, driver: driver.length } };
  }
  function driverBalance(v) { let b = 0; v.logs.driver.forEach(x => { if (x.type === 'salary' || x.type === 'bonus') b += num(x.amount); else if (x.type === 'advance' || x.type === 'deduction') b -= num(x.amount); }); return b; }
  function monthAdvances(v, ym) { return v.logs.driver.filter(x => x.type === 'advance' && (x.date || '').slice(0, 7) === ym); }
  function cashBalance() { return cash.reduce((s, x) => s + (x.dir === 'in' ? num(x.amount) : -num(x.amount)), 0); }

  function allAlerts() { const out = []; vehicles.forEach(v => { const d = v.docs || {}; Object.keys(CATS).forEach(k => { if (d[k]) out.push({ vid: v.id, number: v.number, type: k, date: d[k], days: daysBetween(d[k]) }); }); }); return out.sort((a, b) => a.days - b.days); }
  const alertClass = days => days < 0 ? 'bad' : days <= 7 ? 'bad' : days <= 30 ? 'warn' : 'good';
  const alertWord = days => days < 0 ? `${-days} दिन पहले expire` : days === 0 ? 'आज expire' : days === 1 ? 'कल expire' : `${days} दिन बाक़ी`;

  /* ---------------- app shell ---------------- */
  root.innerHTML = `
  <div class="appwrap">
    <div class="hdr"><div class="wrap">
      <div class="brand"><span class="logo">K</span><span>Karan Fleet</span></div><span class="sp"></span>
      <button class="iconbtn" id="btnSync" title="Google Drive"></button>
      <button class="iconbtn" id="btnTheme" aria-label="theme">${svg('<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>')}</button>
      <button class="iconbtn" id="btnSet" aria-label="settings">${svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9M4.6 9a1.7 1.7 0 00-.3-1.9"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>')}</button>
    </div></div>
    <main><div class="wrap"><div id="view" class="page"></div></div></main>
    <div class="nav"><div class="wrap">
      <button data-nav="home" class="on">${svg('<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>', 22)}<span>होम</span></button>
      <button data-nav="vehicles">${svg('<path d="M3 13l2-5a2 2 0 012-1.4h10A2 2 0 0119 8l2 5v5h-3"/><path d="M6 18H3v-5"/><circle cx="7.5" cy="18" r="1.8"/><circle cx="16.5" cy="18" r="1.8"/>', 22)}<span>गाड़ियाँ</span></button>
      <button data-nav="docs">${svg(IC.shield, 22)}<span>कागज़ात</span></button>
      <button data-nav="bills">${svg('<path d="M6 3h9l3 3v15l-2.2-1.3L13.6 21l-2.2-1.3L9.2 21 7 19.7 4.8 21V5A2 2 0 016 3z"/><path d="M8 8h7M8 12h7M8 16h4"/>', 22)}<span>बिल</span></button>
      <button data-nav="cash">${svg('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>', 22)}<span>कैशबुक</span></button>
    </div></div>
  </div>`;
  const view = $('#view');

  /* ---------------- render dispatch ---------------- */
  function setNav(n) { st.nav = n; st.vsub = null; root.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === n)); render(); }
  function render() {
    const n = st.nav;
    if (n === 'home') renderHome();
    else if (n === 'vehicles') st.vsub ? renderDetail() : renderVehicles();
    else if (n === 'docs') renderDocs();
    else if (n === 'bills') renderBills();
    else if (n === 'cash') renderCash();
  }

  const fab = act => `<button class="fab" data-act="${act}">${svg(IC.plus, 26)}</button>`;

  function vehicleRow(v) {
    const docs = v.docs || {}; let soon = null;
    Object.keys(CATS).forEach(k => { if (docs[k]) { const d = daysBetween(docs[k]); if (soon == null || d < soon.days) soon = { k, days: d }; } });
    const right = soon ? `<span class="pill ${alertClass(soon.days)}"><span class="dot"></span>${soon.days < 0 ? 'expired' : soon.days + 'd'}</span>` : `<span class="pill mut">${v.hireRate ? inr(v.hireRate) : '—'}</span>`;
    return `<div class="lrow" data-act="openV" data-id="${v.id}"><div class="vavatar">${esc(vInitials(v))}</div>
      <div class="t"><div class="nm">${esc(v.number || 'नई गाड़ी')}</div><div class="mt">${esc(v.model || '')}${v.driverName ? ' · ' + esc(v.driverName) : ''}</div></div>
      <div class="rt">${right}</div><span class="chev">${svg('<path d="M9 6l6 6-6 6"/>', 18)}</span></div>`;
  }
  const emptyVehiclesInline = () => `<div class="empty" style="padding:24px 8px"><div class="em-ic">${svg(IC.fuel, 24)}</div><h3>अभी कोई गाड़ी नहीं</h3><p>पहली गाड़ी जोड़ें।</p><button class="btn pri" data-act="newVehicle">${svg(IC.plus, 16)} गाड़ी जोड़ें</button></div>`;

  function renderHome() {
    const ym = curMonth();
    const expectedInc = vehicles.reduce((s, v) => s + num(v.hireRate), 0);
    const activeN = vehicles.filter(v => v.status !== 'idle' && v.status !== 'sold').length;
    const alerts = allAlerts(); const urgent = alerts.filter(a => a.days <= 7); const soon = alerts.filter(a => a.days > 7 && a.days <= 30);
    let h = `<div class="ptitle">नमस्ते 👋</div><div class="psub">${monthLabelHi(ym)} · fleet एक नज़र में</div>`;
    if (urgent.length) {
      h += `<div class="card pad" style="border-color:var(--bad);margin-bottom:12px"><div class="row" style="color:var(--bad);font-weight:800;margin-bottom:8px">${svg(IC.shield, 18)} ज़रूरी — कागज़ात expire</div>`;
      urgent.slice(0, 4).forEach(a => { h += `<div class="between" data-act="openV" data-id="${a.vid}" style="padding:7px 0;border-top:1px solid var(--line2);cursor:pointer"><div><b>${esc(a.number)}</b> · ${CATS[a.type].split(' / ')[0]}</div><span class="pill ${alertClass(a.days)}"><span class="dot"></span>${alertWord(a.days)}</span></div>`; });
      h += `</div>`;
    }
    h += `<div class="grid g2">
      <div class="tile"><div class="k">कुल गाड़ियाँ</div><div class="v num">${vehicles.length}</div><div class="mini">${activeN} चालू</div></div>
      <div class="tile"><div class="k">मासिक hire (अपेक्षित)</div><div class="v num sm">${inr(expectedInc)}</div></div>
      <div class="tile"><div class="k">कैश बैलेंस</div><div class="v num sm ${cashBalance() < 0 ? 'neg' : ''}">${inr(cashBalance())}</div></div>
      <div class="tile"><div class="k">कागज़ात alert</div><div class="v num">${alerts.filter(a => a.days <= 30).length}</div><div class="mini">${urgent.length} ज़रूरी · ${soon.length} जल्द</div></div></div>`;
    h += `<div class="sec-h"><h3>गाड़ियाँ</h3><button class="lnk" data-act="nav" data-n="vehicles">सभी →</button></div><div class="card pad">`;
    if (!vehicles.length) h += emptyVehiclesInline(); else vehicles.slice(0, 6).forEach(v => h += vehicleRow(v));
    h += `</div><div class="sec-h"><h3>जल्दी करें</h3></div><div class="grid g2">
      <button class="btn gho" data-act="newBill">${svg(IC.doc, 16)} नया बिल</button>
      <button class="btn gho" data-act="newVehicle">${svg(IC.plus, 16)} गाड़ी जोड़ें</button>
      <button class="btn gho" data-act="cashQuick">${svg(IC.inflow, 16)} कैश In/Out</button>
      <button class="btn gho" data-act="nav" data-n="docs">${svg(IC.shield, 16)} कागज़ात</button></div>`;
    view.innerHTML = h;
  }

  function renderVehicles() {
    let h = `<div class="ptitle">गाड़ियाँ</div><div class="psub">${vehicles.length} गाड़ियाँ · टैप करके हिसाब देखें</div><div class="card pad">`;
    if (!vehicles.length) h += emptyVehiclesInline(); else vehicles.forEach(v => h += vehicleRow(v));
    h += `</div>`; view.innerHTML = h; if (vehicles.length) view.insertAdjacentHTML('beforeend', fab('newVehicle'));
  }

  function openVehicle(vid) { st.nav = 'vehicles'; st.vsub = vid; st.dtab = 'report'; st.rptMonth = curMonth(); st.dutyMonth = curMonth(); root.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === 'vehicles')); loadDetail(vid); render(); }

  function renderDetail() {
    const v = vehById(st.vsub); if (!v) { setNav('vehicles'); return; }
    const tabs = [['report', 'रिपोर्ट'], ['duty', 'दैनिक'], ['fuel', 'तेल'], ['service', 'सर्विस'], ['driver', 'ड्राइवर'], ['income', 'आमदनी'], ['cost', 'खर्च'], ['docs', 'कागज़ात']];
    let h = `<button class="back" data-act="nav" data-n="vehicles">${svg('<path d="M15 6l-6 6 6 6"/>', 17)} गाड़ियाँ</button>
      <div class="dhead"><div class="big">${esc(vInitials(v))}</div><div style="flex:1"><div class="ptitle" style="font-size:19px">${esc(v.number || '—')}</div>
      <div class="psub" style="margin-bottom:6px">${esc(v.model || '')} ${v.status === 'idle' ? '<span class="pill mut">खाली</span>' : '<span class="pill good">चालू</span>'}</div></div>
      <button class="iconbtn" data-act="editV" data-id="${v.id}">${svg('<path d="M4 20h4L18.5 9.5a2 2 0 00-3-3L5 17z"/>', 18)}</button></div>
      <div class="grid g2" style="margin:10px 0 4px"><button class="btn pri sm" data-act="vBill" data-id="${v.id}">${svg(IC.doc, 15)} बिल बनाएँ</button>
      <button class="btn gho sm" data-act="vSlip" data-id="${v.id}">${svg(IC.user, 15)} सैलरी स्लिप</button></div>
      <div class="tabs">`;
    tabs.forEach(([k, l]) => h += `<button class="${st.dtab === k ? 'on' : ''}" data-act="dtab" data-t="${k}">${l}</button>`);
    h += `</div><div id="dbody"></div>`;
    view.innerHTML = h; $('#dbody').innerHTML = detailBody(v);
  }
  function detailBody(v) {
    const t = st.dtab;
    if (t === 'report') return reportTab(v);
    if (t === 'duty') return dutyTab(v);
    if (t === 'docs') return docsTab(v);
    const map = { fuel: 'तेल / डीज़ल', service: 'सर्विस', driver: 'ड्राइवर खाता', income: 'आमदनी', cost: 'अन्य खर्च' };
    return logTab(v, t, map[t]);
  }

  function reportTab(v) {
    const ym = st.rptMonth; const s = monthStats(v, ym); const bal = driverBalance(v); const ds = dutyStats(v, ym);
    let h = `<div class="between" style="margin-bottom:12px"><button class="btn sm gho" data-act="rptM" data-d="-1">${svg('<path d="M15 6l-6 6 6 6"/>', 14)}</button>
      <div style="font-weight:800;font-family:var(--head)">${monthLabelHi(ym)}</div><button class="btn sm gho" data-act="rptM" data-d="1">${svg('<path d="M9 6l6 6-6 6"/>', 14)}</button></div>`;
    h += `<div class="card pad" style="margin-bottom:12px"><div class="mini">इस महीने मुनाफ़ा / घाटा</div>
      <div class="big-amt ${s.profit >= 0 ? 'pos' : 'neg'}">${s.profit >= 0 ? '+' : '−'}${inr(Math.abs(s.profit))}</div>
      <div class="mini" style="margin-top:4px">आमदनी ${inr(s.incAmt)} − खर्च ${inr(s.runCost)}</div></div>`;
    h += `<div class="grid g2">
      <div class="tile"><div class="k">तेल/डीज़ल</div><div class="v num sm">${inr(s.fuelAmt)}</div><div class="mini">${fmt2(s.liters)} L · ${s.n.fuel} बार</div></div>
      <div class="tile"><div class="k">माइलेज</div><div class="v num sm">${s.avg ? fmt2(s.avg) + ' km/L' : '—'}</div><div class="mini">${s.km != null ? s.km + ' km' : 'दर्ज करें'}</div></div>
      <div class="tile"><div class="k">सर्विस</div><div class="v num sm">${inr(s.servAmt)}</div><div class="mini">${s.n.service} बार</div></div>
      <div class="tile"><div class="k">अन्य खर्च</div><div class="v num sm">${inr(s.costAmt)}</div></div>
      <div class="tile"><div class="k">ड्राइवर एडवांस</div><div class="v num sm">${inr(s.adv)}</div></div>
      <div class="tile"><div class="k">प्रति km लागत</div><div class="v num sm">${s.cpk ? inr1(s.cpk) : '—'}</div></div></div>`;
    if (ds.rows.length) h += `<div class="card pad" style="margin-top:12px"><div class="mini">दैनिक लॉग सारांश</div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:6px"><span class="pill acc">कुल ${ds.km} km</span><span class="pill ${ds.extraKm ? 'warn' : 'mut'}">Extra ${ds.extraKm} km</span><span class="pill ${ds.extraHrs ? 'warn' : 'mut'}">Extra ${ds.extraHrs} hr</span><span class="pill mut">${ds.dutyDays} duty days</span><span class="pill mut">${ds.nights} night</span></div></div>`;
    if (s.avg && s.avg < 8) h += `<div class="alert warn" style="margin-top:12px">${svg(IC.fuel, 18)} माइलेज कम (${fmt2(s.avg)} km/L) — जाँचें।</div>`;
    h += `<div class="card pad" style="margin-top:12px"><div class="between"><div><div class="mini">ड्राइवर खाता (कुल)</div>
      <div style="font-weight:800;font-size:17px" class="${bal > 0 ? 'neg' : 'pos'}">${bal >= 0 ? 'देना ' : 'लेना '}${inr(Math.abs(bal))}</div></div>
      <button class="btn sm" data-act="dtab" data-t="driver">खाता</button></div></div>`;
    h += `<button class="btn block pri" style="margin-top:14px" data-act="vBill" data-id="${v.id}">${svg(IC.doc, 16)} ${monthLabel(ym)} का बिल बनाएँ</button>`;
    return h;
  }

  function dutyTab(v) {
    const ym = st.dutyMonth; const dim = daysInMonth(ym); const ds = dutyStats(v, ym);
    const byDay = {}; (v.logs.duty || []).forEach(r => { if ((r.date || '').slice(0, 7) === ym) byDay[r.date] = r; });
    let h = `<div class="between" style="margin-bottom:10px"><button class="btn sm gho" data-act="dutyM" data-d="-1">${svg('<path d="M15 6l-6 6 6 6"/>', 14)}</button>
      <div style="font-weight:800;font-family:var(--head)">${monthLabelHi(ym)}</div><button class="btn sm gho" data-act="dutyM" data-d="1">${svg('<path d="M9 6l6 6-6 6"/>', 14)}</button></div>`;
    h += `<div class="card pad" style="margin-bottom:10px"><div class="row" style="gap:8px;flex-wrap:wrap">
      <span class="pill acc">कुल ${ds.km} km</span><span class="pill ${ds.extraKm ? 'warn' : 'mut'}">Extra ${ds.extraKm} km</span>
      <span class="pill ${ds.extraHrs ? 'warn' : 'mut'}">Extra ${ds.extraHrs} घंटे</span><span class="pill mut">${ds.dutyDays} days</span><span class="pill mut">${ds.nights} night</span></div>
      <div class="mini" style="margin-top:8px">फ़्री ${ds.freeKm} km/माह · 12 घंटे/दिन से ऊपर = extra. नीचे किसी दिन पर टैप करके KM व घंटे भरें।</div></div>`;
    h += `<div class="card pad"><div class="dgrid dgrid-h"><span>दिन</span><span>KM</span><span>घंटे</span><span>रात</span></div>`;
    for (let i = 1; i <= dim; i++) { const iso = ym + '-' + pad2(i); const r = byDay[iso]; const ov = r && num(r.hours) > 12;
      h += `<div class="dgrid" data-act="dutyEdit" data-iso="${iso}">
        <span class="num">${pad2(i)}.${ym.split('-')[1]}</span>
        <span class="num ${r && num(r.km) ? '' : 'faint'}">${r && num(r.km) ? r.km : '—'}</span>
        <span class="num ${ov ? 'warntxt' : (r && num(r.hours) ? '' : 'faint')}">${r && num(r.hours) ? r.hours + (ov ? ' (+' + (num(r.hours) - 12) + ')' : '') : '—'}</span>
        <span>${r && r.night ? '🌙' : ''}</span></div>`; }
    h += `</div>`;
    return h;
  }

  function logTab(v, col, title) {
    const rows = (v.logs[col] || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const total = rows.reduce((s, x) => s + num(x.amount), 0);
    let h = `<div class="between" style="margin-bottom:10px"><div style="font-weight:800;font-family:var(--head)">${title}</div><button class="btn sm pri" data-act="addLog" data-c="${col}">${svg(IC.plus, 14)} जोड़ें</button></div>`;
    if (col !== 'driver') h += `<div class="tile" style="margin-bottom:10px"><div class="k">कुल</div><div class="v num sm">${inr(total)}</div></div>`;
    else { const bal = driverBalance(v); h += `<div class="tile" style="margin-bottom:10px"><div class="k">बक़ाया</div><div class="v num sm ${bal > 0 ? 'neg' : 'pos'}">${bal >= 0 ? 'देना ' : 'लेना '}${inr(Math.abs(bal))}</div></div>`; }
    h += `<div class="card pad">`;
    if (!rows.length) h += `<div class="empty" style="padding:26px 8px"><p>अभी कोई entry नहीं।</p></div>`;
    rows.forEach(r => {
      let mid = '', rt = '';
      if (col === 'fuel') { mid = `${fmt2(r.liters)} L${r.odo ? ' · ' + r.odo + ' km' : ''}`; rt = inr(r.amount); }
      else if (col === 'service') { mid = esc(r.workshop || '') + (r.odo ? ' · ' + r.odo + ' km' : ''); rt = inr(r.amount); }
      else if (col === 'driver') { const t = { advance: 'एडवांस', salary: 'सैलरी', bonus: 'बोनस', deduction: 'कटौती' }[r.type] || r.type; mid = t; rt = (r.type === 'salary' || r.type === 'bonus' ? '+' : '−') + inr(r.amount); }
      else if (col === 'income') { mid = esc(r.client || ''); rt = '+' + inr(r.amount); }
      else if (col === 'cost') { mid = COSTCATS[r.category] || r.category || ''; rt = inr(r.amount); }
      h += `<div class="lrow" style="cursor:default"><div class="t"><div class="nm num">${isoToDMY(r.date)}</div><div class="mt">${mid}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
        <div class="rt num" style="font-weight:800">${rt}</div><button class="del-x" data-act="delLog" data-c="${col}" data-id="${r.id}">मिटाएँ</button></div>`;
    });
    h += `</div>`; return h;
  }

  function docsTab(v) {
    const docs = v.docs || {};
    let h = `<div class="between" style="margin-bottom:10px"><div style="font-weight:800;font-family:var(--head)">कागज़ात तारीख़ें</div><button class="btn sm pri" data-act="editV" data-id="${v.id}">बदलें</button></div><div class="card pad">`;
    Object.keys(CATS).forEach(k => { const d = docs[k]; const dl = d ? daysBetween(d) : null;
      h += `<div class="kv"><span class="k">${CATS[k]}</span><span class="v">${d ? `<span class="num">${isoToDMY(d)}</span> <span class="pill ${dl != null ? alertClass(dl) : 'mut'}">${dl != null ? (dl < 0 ? 'expired' : dl + 'd') : '—'}</span>` : '<span class="pill mut">नहीं भरा</span>'}</span></div>`; });
    h += `</div><div class="mini" style="margin-top:10px">💡 हर तारीख़ से 30/15/7/1 दिन पहले reminder दिखेगा।</div>`; return h;
  }

  function renderDocs() {
    const alerts = allAlerts();
    const buckets = [['⛔ Expired / आज-कल', a => a.days <= 1], ['⚠️ 7 दिन में', a => a.days > 1 && a.days <= 7], ['🟡 30 दिन में', a => a.days > 7 && a.days <= 30], ['✅ आगे', a => a.days > 30]];
    let h = `<div class="ptitle">कागज़ात & Reminders</div><div class="psub">Insurance · PUC · Fitness · Permit · Road Tax</div>`;
    if (!alerts.length) { h += `<div class="empty"><div class="em-ic">${svg(IC.shield, 24)}</div><h3>कोई तारीख़ दर्ज नहीं</h3><p>किसी गाड़ी में कागज़ात तारीख़ें भरें।</p></div>`; view.innerHTML = h; return; }
    buckets.forEach(([title, fn]) => { const list = alerts.filter(fn); if (!list.length) return;
      h += `<div class="sec-h"><h3>${title}</h3><span class="mini">${list.length}</span></div><div class="card pad">`;
      list.forEach(a => h += `<div class="lrow" data-act="openV" data-id="${a.vid}"><div class="vavatar" style="font-size:11px">${esc((a.number || '').slice(-4))}</div>
        <div class="t"><div class="nm">${esc(a.number)}</div><div class="mt">${CATS[a.type]}</div></div>
        <div class="rt"><div class="num" style="font-weight:700;font-size:12.5px">${isoToDMY(a.date)}</div><span class="pill ${alertClass(a.days)}" style="margin-top:3px"><span class="dot"></span>${alertWord(a.days)}</span></div></div>`);
      h += `</div>`; });
    view.innerHTML = h;
  }

  function renderBills() {
    const tabs = [['invoices', 'बिल'], ['slips', 'सैलरी स्लिप'], ['summary', 'मासिक सारांश']];
    let h = `<div class="ptitle">बिल & दस्तावेज़</div><div class="psub">सब PDF बनते हैं और app में save रहते हैं</div><div class="tabs">`;
    tabs.forEach(([k, l]) => h += `<button class="${st.billTab === k ? 'on' : ''}" data-act="billTab" data-t="${k}">${l}</button>`);
    h += `</div>`;
    if (st.billTab === 'invoices') {
      h += `<button class="btn block pri" style="margin-bottom:14px" data-act="newBill">${svg(IC.plus, 16)} नया बिल बनाएँ</button><div class="card pad">`;
      if (!invoices.length) h += `<div class="empty" style="padding:26px"><p>अभी कोई बिल नहीं।</p></div>`;
      invoices.slice().sort((a, b) => b.createdAt - a.createdAt).forEach(iv => h += `<div class="lrow" data-act="regenInv" data-id="${iv.id}"><div class="vavatar" style="font-size:10px;color:${iv.company === 'jk' ? '#c98' : '#8ab'}">${iv.company === 'jk' ? 'JK' : 'KT'}</div>
        <div class="t"><div class="nm">${esc(iv.number)} · ${esc(iv.vehicleNo || '')}</div><div class="mt">${esc(iv.buyerName || '')} · ${esc(iv.period ? iv.period.label : '')}</div></div>
        <div class="rt"><div class="num" style="font-weight:800">${inr(iv.grandTotal)}</div><div class="mini">${isoToDMY(iv.date)}</div></div></div>`);
      h += `</div>`;
    } else if (st.billTab === 'slips') {
      h += `<div class="card pad">`;
      if (!slips.length) h += `<div class="empty" style="padding:26px"><p>किसी गाड़ी → सैलरी स्लिप से बनाएँ।</p></div>`;
      slips.slice().sort((a, b) => b.createdAt - a.createdAt).forEach(sl => h += `<div class="lrow" data-act="regenSlip" data-id="${sl.id}"><div class="vavatar">${svg(IC.user, 18)}</div>
        <div class="t"><div class="nm">${esc(sl.driverName || '')}</div><div class="mt">${esc(sl.vehicleNo || '')} · ${monthLabelHi(sl.month)}</div></div>
        <div class="rt"><div class="num" style="font-weight:800">${inr(sl.net)}</div><div class="mini">Net</div></div></div>`);
      h += `</div>`;
    } else {
      h += `<div class="card pad"><div style="font-weight:800;font-family:var(--head);margin-bottom:6px">मासिक सारांश (Abstract)</div>
        <p class="mini" style="margin-bottom:12px">Company + विभाग + महीना चुनें — सभी बिलों का एक सारांश PDF बनेगा।</p>
        <button class="btn block pri" data-act="newSummary">${svg(IC.doc, 16)} सारांश PDF</button></div>`;
    }
    view.innerHTML = h;
  }

  function renderCash() {
    const inAmt = cash.filter(x => x.dir === 'in').reduce((s, x) => s + num(x.amount), 0);
    const outAmt = cash.filter(x => x.dir === 'out').reduce((s, x) => s + num(x.amount), 0);
    let h = `<div class="ptitle">कैशबुक</div><div class="psub">गाड़ी/ड्राइवर से जुड़ा · UPI से भेजें · WhatsApp सूचना · entry पर टैप करें</div>
      <div class="card pad" style="margin-bottom:12px"><div class="mini">कुल बैलेंस</div><div class="big-amt ${cashBalance() < 0 ? 'neg' : ''}">${inr(cashBalance())}</div>
      <div class="row" style="gap:14px;margin-top:6px"><span class="pill good">In ${inr(inAmt)}</span><span class="pill bad">Out ${inr(outAmt)}</span></div></div>
      <div class="grid g2" style="margin-bottom:14px"><button class="btn pri" data-act="cashNew" data-d="in">${svg(IC.inflow, 16)} पैसा आया</button>
      <button class="btn gho" data-act="cashNew" data-d="out"><span style="transform:rotate(180deg);display:inline-flex">${svg(IC.inflow, 16)}</span> पैसा गया</button></div><div class="card pad">`;
    if (!cash.length) h += `<div class="empty" style="padding:26px"><p>अभी कोई entry नहीं।</p></div>`;
    cash.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(x => { const vx = x.vehicleId ? vehById(x.vehicleId) : null;
      const sub = [isoToDMY(x.date), catLabel(x.dir, x.category), vx ? '🚗 ' + esc(vx.number || '') : '', x.paidBy ? '👤 ' + esc(x.paidBy) : '', x.method === 'cash' ? 'नकद' : (x.upi ? 'UPI' : ''), x.note ? esc(x.note) : ''].filter(Boolean).join(' · ');
      h += `<div class="lrow" data-act="cashPay" data-id="${x.id}" style="cursor:pointer"><div class="vavatar" style="color:${x.dir === 'in' ? 'var(--good)' : 'var(--bad)'}">${x.dir === 'in' ? svg(IC.inflow, 18) : '<span style="transform:rotate(180deg);display:inline-flex">' + svg(IC.inflow, 18) + '</span>'}</div>
      <div class="t"><div class="nm">${esc(x.party || catLabel(x.dir, x.category) || (x.dir === 'in' ? 'आया' : 'गया'))}</div><div class="mt">${sub}</div></div>
      <div class="rt num" style="font-weight:800;color:${x.dir === 'in' ? 'var(--good)' : 'var(--bad)'}">${x.dir === 'in' ? '+' : '−'}${inr(x.amount)}</div>
      <button class="del-x" data-act="delCash" data-id="${x.id}">✕</button></div>`; });
    h += `</div>`; view.innerHTML = h;
  }

  /* ---------------- sheet / forms ---------------- */
  function openSheet(cfg) {
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    let fh = `<div class="sheet"><div class="grip"></div><h3>${esc(cfg.title)}</h3><form id="sheetForm" onsubmit="return false">`;
    (cfg.fields || []).forEach(f => {
      if (f.section) { fh += `<div class="fsec">${esc(f.section)}</div>`; return; }
      if (f.type === 'check') { fh += `<label class="ck field" style="margin-bottom:12px"><input type="checkbox" name="${f.k}" ${f.val ? 'checked' : ''}><span>${esc(f.label)}</span></label>`; return; }
      const val = f.val == null ? '' : f.val; let inp;
      if (f.type === 'select') inp = `<select name="${f.k}">${f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(val) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
      else if (f.type === 'textarea') inp = `<textarea name="${f.k}" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
      else inp = `<input type="${f.type || 'text'}" name="${f.k}" value="${esc(val)}" placeholder="${esc(f.ph || '')}" ${f.type === 'number' ? 'inputmode="decimal" step="any"' : ''}>`;
      fh += `<div class="field"><label>${esc(f.label)}</label>${inp}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
    });
    fh += `</form><div class="sheet-actions">${cfg.extra || ''}<button class="btn gho" id="sheetCancel">रद्द</button><button class="btn pri" id="sheetOk">${esc(cfg.ok || 'सेव')}</button></div></div>`;
    scrim.innerHTML = fh; root.appendChild(scrim);
    const close = () => scrim.remove();
    scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
    scrim.querySelector('#sheetCancel').onclick = close;
    scrim.querySelector('#sheetOk').onclick = async () => {
      const fd = new FormData(scrim.querySelector('#sheetForm')); const obj = {};
      (cfg.fields || []).forEach(f => { if (f.section) return; if (f.type === 'check') obj[f.k] = fd.get(f.k) === 'on'; else obj[f.k] = fd.get(f.k); });
      if (cfg.validate) { const err = cfg.validate(obj); if (err) { toast(err); return; } }
      try { await cfg.submit(obj); close(); } catch (e) { console.error(e); toast('सेव नहीं हुआ'); }
    };
    if (cfg.onMount) cfg.onMount(scrim);
    return close;
  }

  function vehicleForm(v) {
    v = v || {}; const docs = v.docs || {}; const loan = v.loan || {};
    const coOpts = Object.keys(companies).map(id => ({ v: id, l: companies[id].name }));
    const clOpts = [{ v: '', l: '— कोई नहीं —' }].concat(Object.keys(clients).map(id => ({ v: id, l: clients[id].name })));
    openSheet({ title: v.id ? 'गाड़ी बदलें' : 'नई गाड़ी', ok: 'सेव', fields: [
      { section: 'गाड़ी' }, { k: 'number', label: 'गाड़ी नंबर', val: v.number, ph: 'BR01PR 8395' }, { k: 'model', label: 'मॉडल', val: v.model, ph: 'Toyota Innova Crysta' },
      { k: 'status', label: 'स्थिति', type: 'select', val: v.status || 'active', options: [{ v: 'active', l: 'चालू' }, { v: 'idle', l: 'खाली' }, { v: 'maintenance', l: 'मरम्मत' }, { v: 'sold', l: 'बिक गई' }] },
      { k: 'startKm', label: 'शुरुआती KM', type: 'number', val: v.startKm },
      { section: 'ड्राइवर' }, { k: 'driverName', label: 'ड्राइवर नाम', val: v.driverName }, { k: 'driverPhone', label: 'फ़ोन (WhatsApp)', type: 'tel', val: v.driverPhone, hint: 'पेमेंट की सूचना यहीं WhatsApp होगी' }, { k: 'driverUpi', label: 'ड्राइवर UPI ID', val: v.driverUpi, ph: 'name@okbank', hint: 'सैलरी/एडवांस सीधे इसी पर भेजें' }, { k: 'driverSalary', label: 'मासिक सैलरी ₹', type: 'number', val: v.driverSalary },
      { section: 'हायर / Billing' },
      { k: 'company', label: 'Company', type: 'select', val: v.company || 'karan', options: coOpts },
      { k: 'buyer', label: 'ग्राहक/विभाग', type: 'select', val: v.buyer || '', options: clOpts },
      { k: 'hireRate', label: 'मासिक hire ₹', type: 'number', val: v.hireRate }, { k: 'gst', label: 'GST %', type: 'select', val: v.gst == null ? '18' : String(v.gst), options: [{ v: '18', l: '18%' }, { v: '5', l: '5%' }, { v: '12', l: '12%' }, { v: '0', l: '0%' }] },
      { k: 'freeKm', label: 'फ़्री KM/माह', type: 'number', val: v.freeKm, ph: '1500' }, { k: 'hireNote', label: 'हायर नोट', val: v.hireNote || 'Without fuel, with driver' },
      { section: 'कागज़ात की expiry तारीख़ें' },
      { k: 'd_insurance', label: 'बीमा', type: 'date', val: docs.insurance }, { k: 'd_puc', label: 'PUC', type: 'date', val: docs.puc },
      { k: 'd_fitness', label: 'फ़िटनेस', type: 'date', val: docs.fitness }, { k: 'd_permit', label: 'परमिट', type: 'date', val: docs.permit }, { k: 'd_roadTax', label: 'रोड टैक्स', type: 'date', val: docs.roadTax },
    ], onMount: scrim => { mountQrButton(scrim.querySelector('[name="driverUpi"]'), scrim.querySelector('[name="driverName"]')); },
      validate: o => !o.number ? 'गाड़ी नंबर ज़रूरी' : null, submit: o => {
      const data = { number: o.number.trim(), model: o.model, status: o.status, startKm: num(o.startKm), driverName: o.driverName, driverPhone: o.driverPhone, driverUpi: (o.driverUpi || '').trim(), driverSalary: num(o.driverSalary),
        company: o.company, buyer: o.buyer, hireRate: num(o.hireRate), gst: num(o.gst), freeKm: num(o.freeKm) || 0, hireNote: o.hireNote, ownership: v.ownership || 'owned', loan: { ...loan },
        docs: { insurance: o.d_insurance, puc: o.d_puc, fitness: o.d_fitness, permit: o.d_permit, roadTax: o.d_roadTax } };
      saveVehicle(v.id, data); if (st.vsub) loadDetail(st.vsub); toast('सेव'); render();
    } });
  }

  function logForm(vid, col) {
    const common = [{ k: 'date', label: 'तारीख़', type: 'date', val: todayISO() }]; let fields, title;
    if (col === 'fuel') { title = 'तेल / डीज़ल'; fields = [...common, { k: 'liters', label: 'लीटर', type: 'number' }, { k: 'amount', label: 'राशि ₹', type: 'number' }, { k: 'odo', label: 'मीटर (km)', type: 'number' }, { k: 'note', label: 'नोट' }]; }
    else if (col === 'service') { title = 'सर्विस'; fields = [...common, { k: 'workshop', label: 'गैराज/शोरूम' }, { k: 'amount', label: 'बिल ₹', type: 'number' }, { k: 'odo', label: 'मीटर (km)', type: 'number' }, { k: 'note', label: 'काम', type: 'textarea' }]; }
    else if (col === 'driver') { title = 'ड्राइवर खाता'; fields = [...common, { k: 'type', label: 'प्रकार', type: 'select', val: 'advance', options: [{ v: 'advance', l: 'एडवांस दिया' }, { v: 'salary', l: 'सैलरी' }, { v: 'bonus', l: 'बोनस' }, { v: 'deduction', l: 'कटौती' }] }, { k: 'amount', label: 'राशि ₹', type: 'number' }, { k: 'note', label: 'नोट' }]; }
    else if (col === 'income') { const v = vehById(vid); title = 'आमदनी'; fields = [...common, { k: 'client', label: 'किससे', val: clientName(v.buyer) }, { k: 'amount', label: 'राशि ₹', type: 'number' }, { k: 'note', label: 'नोट' }]; }
    else if (col === 'cost') { title = 'अन्य खर्च'; fields = [...common, { k: 'category', label: 'श्रेणी', type: 'select', val: 'emi', options: Object.keys(COSTCATS).map(k => ({ v: k, l: COSTCATS[k] })) }, { k: 'amount', label: 'राशि ₹', type: 'number' }, { k: 'note', label: 'नोट' }]; }
    openSheet({ title, ok: 'जोड़ें', fields, validate: o => (col !== 'driver' && num(o.amount) <= 0) ? 'राशि डालें' : null, submit: o => {
      const d = { date: o.date, amount: num(o.amount), note: o.note || '' };
      if (col === 'fuel') { d.liters = num(o.liters); d.odo = num(o.odo); }
      if (col === 'service') { d.workshop = o.workshop; d.odo = num(o.odo); }
      if (col === 'driver') d.type = o.type; if (col === 'income') d.client = o.client; if (col === 'cost') d.category = o.category;
      addSub(vid, col, d); loadDetail(vid); toast('जुड़ गया'); render();
    } });
  }

  function dutyEditForm(v, iso) {
    const existing = (v.logs.duty || []).find(x => x.date === iso) || {};
    openSheet({ title: 'दैनिक — ' + isoToDMY(iso), ok: 'सेव', extra: existing.date ? `<button class="btn gho" id="dutyDel">मिटाएँ</button>` : '', fields: [
      { k: 'km', label: 'उस दिन KM चली', type: 'number', val: existing.km },
      { k: 'hours', label: 'उस दिन घंटे चली', type: 'number', val: existing.hours, hint: '12 घंटे से ऊपर = extra hours (अपने-आप)' },
      { k: 'night', label: 'नाइट हॉल्ट (रात रुकी)', type: 'check', val: !!existing.night },
      { k: 'remarks', label: 'remark', val: existing.remarks },
    ], onMount: scrim => { const db = scrim.querySelector('#dutyDel'); if (db) db.onclick = () => { v.logs.duty = v.logs.duty.filter(x => x.date !== iso); persist(); scrim.remove(); $('#dbody').innerHTML = detailBody(v); toast('मिटाया'); }; },
      submit: o => {
        v.logs.duty = (v.logs.duty || []).filter(x => x.date !== iso);
        if (num(o.km) > 0 || num(o.hours) > 0 || o.night || o.remarks) v.logs.duty.push({ id: uid(), date: iso, km: num(o.km), hours: num(o.hours), night: !!o.night, remarks: o.remarks || '' });
        persist(); $('#dbody').innerHTML = detailBody(v); toast('सेव');
      } });
  }

  // Adds the "भुगतान भेजें" button row (UPI apps + WhatsApp) just above a sheet's action buttons.
  // read() returns the live state each time: { am, pa(upi), pn(name), ph(phone), online, note, wa, save }.
  function mountPayButtons(scrim, read) {
    const box = document.createElement('div'); box.className = 'paybox'; box.style.cssText = 'margin:4px 0 14px';
    box.innerHTML = `<div class="fsec" style="margin-top:0">भुगतान भेजें</div><div class="paygrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div><div class="hint" style="margin-top:7px">UPI बटन दबाते ही GPay/PhonePe/Paytm में से जो फ़ोन में है खुलेगा — राशि भरी मिलेगी।</div>`;
    scrim.querySelector('.sheet-actions').insertAdjacentElement('beforebegin', box);
    const grid = box.querySelector('.paygrid');
    const mk = (l, c) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + c; b.textContent = l; grid.appendChild(b); return b; };
    const upiBtns = UPI_APPS.map(a => { const b = mk(a.l, a.k === 'any' ? 'pri' : 'gho'); b._app = a; return b; });
    const waBtn = mk('WhatsApp सूचना भेजें', 'gho'); waBtn.style.cssText = 'grid-column:1/-1';
    const defWa = s => 'नमस्ते 🙏\n' + s.note + ' के लिए ₹' + Math.round(s.am).toLocaleString('en-IN') + ' का भुगतान किया गया है।\n— Karan Tours & Travels';
    function refresh() {
      const s = read(); box.style.display = (s.am > 0 && !s.hide) ? '' : 'none';
      const canUpi = s.online !== false && s.am > 0 && isUpiId(s.pa);
      upiBtns.forEach(b => { b.disabled = !canUpi; b.style.opacity = canUpi ? '1' : '.45'; });
      const canWa = !!digits(s.ph); waBtn.disabled = !canWa; waBtn.style.opacity = canWa ? '1' : '.45';
    }
    upiBtns.forEach(b => b.onclick = () => {
      const s = read(); if (!(s.online !== false && s.am > 0 && isUpiId(s.pa))) { toast('सही UPI ID और राशि भरें'); return; }
      if (s.save) s.save(); try { window.location.href = upiURI(b._app.scheme, s.pa, s.pn, s.am, s.note); } catch (e) {} toast(b._app.l + ' खुल रहा…');
    });
    waBtn.onclick = () => { const s = read(); if (!digits(s.ph)) { toast('फ़ोन नंबर भरें'); return; } if (s.save) s.save(); window.open('https://wa.me/' + waPhone(s.ph) + '?text=' + encodeURIComponent(s.wa || defWa(s)), '_blank'); };
    return refresh;
  }

  function cashForm(dir) {
    const paid = { entry: null };
    const vehOpts = [{ v: '', l: '— कोई गाड़ी नहीं —' }].concat(vehicles.map(v => ({ v: v.id, l: vehLabel(v) })));
    const payeeOpts = [{ v: '', l: '— नया / नीचे भरें —' }].concat(STORE.payees.map(p => ({ v: p.id, l: p.name + (p.upi ? ' · ' + p.upi : (p.phone ? ' · ' + p.phone : '')) })));
    const catOpts = (dir === 'out' ? CASH_OUT_CATS : CASH_IN_CATS).map(c => ({ v: c.v, l: c.l }));
    const lastPayer = (cash.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).find(x => x.paidBy) || {}).paidBy || '';
    const fields = [
      { k: 'date', label: 'तारीख़', type: 'date', val: todayISO() },
      { k: 'category', label: 'श्रेणी', type: 'select', val: dir === 'out' ? 'fuel' : 'income', options: catOpts },
      { k: 'vehicleId', label: 'गाड़ी', type: 'select', val: '', options: vehOpts },
      { k: 'amount', label: 'राशि ₹', type: 'number' },
      { k: 'liters', label: 'लीटर', type: 'number' },
      { k: 'odo', label: 'मीटर रीडिंग (km)', type: 'number' },
      { k: 'paidBy', label: dir === 'in' ? 'किसने लिया (Received by)' : 'किसके द्वारा (Paid by)', val: lastPayer, ph: 'नाम टाइप करें — पुराने नाम अपने-आप सुझाव में', hint: 'नया नाम लिखें तो list में जुड़ जाएगा' },
      { section: 'किसको' },
      { k: 'savedPayee', label: 'सहेजा गया भुगतानकर्ता', type: 'select', val: '', options: payeeOpts },
      { k: 'party', label: 'नाम (किसको/किससे)', val: '' },
      { k: 'upi', label: 'UPI ID', val: '', ph: 'name@okbank · 98xxxxxxxx@ybl' },
      { k: 'phone', label: 'फ़ोन (WhatsApp)', type: 'tel', val: '' },
      { k: 'waNotify', label: '✅ सेव होते ही इस WhatsApp नंबर पर सूचना भेजें', type: 'check', val: false },
      { k: 'method', label: 'भुगतान का तरीक़ा', type: 'select', val: 'upi', options: [{ v: 'upi', l: 'UPI / ऑनलाइन' }, { v: 'cash', l: 'नकद' }, { v: 'bank', l: 'बैंक ट्रांसफर' }] },
      { k: 'note', label: 'नोट' },
      { k: 'mirror', label: 'गाड़ी के खाते में भी जोड़ें', type: 'check', val: true },
    ];
    const validate = o => num(o.amount) <= 0 ? 'राशि डालें' : null;
    const collect = scrim => { const fd = new FormData(scrim.querySelector('#sheetForm')); const o = {}; fields.forEach(f => { if (f.section) return; o[f.k] = f.type === 'check' ? fd.get(f.k) === 'on' : fd.get(f.k); }); return o; };
    function doSave(o) {
      if (paid.entry) return paid.entry;
      const m = catMeta(dir, o.category);
      const e = { id: uid(), dir, date: o.date || todayISO(), amount: num(o.amount), party: (o.party || '').trim(), category: o.category,
        note: o.note || '', vehicleId: m.veh ? (o.vehicleId || '') : '', method: o.method || 'upi', upi: (o.upi || '').trim(), phone: (o.phone || '').trim(), paidBy: (o.paidBy || '').trim(), createdAt: Date.now() };
      cash.push(e);
      if (e.paidBy && !STORE.payers.some(n => n.toLowerCase() === e.paidBy.toLowerCase())) STORE.payers.push(e.paidBy);
      if (e.vehicleId && o.mirror !== false && m.col) {
        const v = vehById(e.vehicleId);
        if (v) { const lid = uid(); const base = { id: lid, date: e.date, amount: e.amount, note: e.note, createdAt: Date.now() }; let rec = base;
          if (m.col === 'fuel') rec = { ...base, liters: num(o.liters), odo: num(o.odo) };
          else if (m.col === 'driver') rec = { ...base, type: m.dtype };
          else if (m.col === 'service') rec = { ...base, workshop: e.party, odo: num(o.odo) };
          else if (m.col === 'cost') rec = { ...base, category: m.cost || 'other' };
          else if (m.col === 'income') rec = { ...base, client: e.party };
          v.logs[m.col].push(rec); e.linkedLog = { vid: v.id, col: m.col, id: lid }; }
      }
      if (m.driver && e.vehicleId && isUpiId(e.upi)) { const v = vehById(e.vehicleId); if (v && !v.driverUpi) v.driverUpi = e.upi; }
      if (!m.driver && e.party && (isUpiId(e.upi) || digits(e.phone))) savePayee({ name: e.party, upi: e.upi, phone: e.phone, kind: m.fuel ? 'pump' : 'other' });
      persist(); paid.entry = e; render(); return e;
    }
    openSheet({ title: dir === 'in' ? 'पैसा आया (In)' : 'पैसा गया (Out)', ok: 'सेव', fields, validate,
      submit: o => { doSave(o); toast('दर्ज'); render();
        if (o.waNotify && digits(o.phone)) { const v = vehById(o.vehicleId); const note = catLabel(dir, o.category) + (v && v.number ? ' ' + v.number : ''); const verb = dir === 'in' ? 'प्राप्त हुआ' : 'का भुगतान किया गया';
          const msg = ((o.party || '').trim() ? (o.party || '').trim() + ' जी, ' : '') + 'नमस्ते 🙏\n' + note + ' के लिए ₹' + Math.round(num(o.amount)).toLocaleString('en-IN') + ' ' + verb + ' है।\n— Karan Tours & Travels';
          window.open('https://wa.me/' + waPhone(o.phone) + '?text=' + encodeURIComponent(msg), '_blank'); } },
      onMount: scrim => {
        const q = n => scrim.querySelector('[name="' + n + '"]');
        const show = (n, on) => { const el = q(n); if (el) { const w = el.closest('.field'); if (w) w.style.display = on ? '' : 'none'; } };
        const cat = q('category'), veh = q('vehicleId'), party = q('party'), upi = q('upi'), phone = q('phone'), amount = q('amount'), saved = q('savedPayee'), method = q('method');
        const pb = q('paidBy'); if (pb && STORE.payers.length) { const dl = document.createElement('datalist'); dl.id = 'payersDL_' + dir; dl.innerHTML = STORE.payers.map(n => `<option value="${esc(n)}"></option>`).join(''); pb.setAttribute('list', dl.id); pb.parentNode.appendChild(dl); }
        mountQrButton(upi, party);
        const metaNow = () => catMeta(dir, cat.value);
        const payNote = () => { const v = vehById(veh.value); return catLabel(dir, cat.value) + (v && v.number ? ' ' + v.number : ''); };
        const refreshPay = mountPayButtons(scrim, () => ({ am: num(amount.value), pa: (upi.value || '').trim(), pn: (party.value || '').trim(), ph: (phone.value || '').trim(),
          online: method.value !== 'cash', note: payNote(), hide: cat.value === 'owner-drawing' || cat.value === 'owner-deposit',
          wa: ((party.value || '').trim() ? (party.value || '').trim() + ' जी, ' : '') + 'नमस्ते 🙏\n' + payNote() + ' के लिए ₹' + Math.round(num(amount.value)).toLocaleString('en-IN') + ' का भुगतान किया गया है।\n— Karan Tours & Travels',
          save: () => { const o = collect(scrim); if (!validate(o)) doSave(o); } }));
        function fillFromVehicle() { const m = metaNow(), v = vehById(veh.value); if (!v) { refreshPay(); return; }
          if (m.driver) { if (!party.value || party.dataset.auto === '1') { party.value = v.driverName || ''; party.dataset.auto = '1'; } if (v.driverUpi) upi.value = v.driverUpi; if (v.driverPhone) phone.value = v.driverPhone; }
          else if (!phone.value && v.driverPhone) phone.value = v.driverPhone;
          refreshPay(); }
        function fillFromSaved() { const p = STORE.payees.find(x => x.id === saved.value); if (!p) { refreshPay(); return; } party.value = p.name || ''; upi.value = p.upi || ''; if (p.phone) phone.value = p.phone; party.dataset.auto = ''; refreshPay(); }
        function applyCat() { const m = metaNow(); const owner = cat.value === 'owner-drawing' || cat.value === 'owner-deposit';
          show('vehicleId', !!m.veh); show('liters', !!m.fuel); show('odo', !!m.fuel || !!m.odo);
          show('upi', !owner); show('phone', !owner); show('waNotify', !owner); show('savedPayee', !owner && !m.driver && STORE.payees.length > 0); show('mirror', !!(m.veh && m.col));
          if (owner) { if (!party.dataset.user) { party.value = 'मालिक (Owner)'; party.dataset.auto = '1'; } }
          else if (party.dataset.auto === '1' && !party.dataset.user) party.value = '';
          if (m.driver) fillFromVehicle(); else refreshPay(); }
        cat.onchange = applyCat; veh.onchange = fillFromVehicle; saved.onchange = fillFromSaved; method.onchange = refreshPay;
        party.oninput = () => { party.dataset.auto = ''; party.dataset.user = '1'; refreshPay(); };
        [amount, upi, phone].forEach(el => el.oninput = refreshPay);
        applyCat();
      } });
  }

  // "फिर से भेजें" — re-open UPI/WhatsApp buttons for an already-saved entry.
  function cashPaySheet(e) {
    const v = e.vehicleId ? vehById(e.vehicleId) : null;
    const note = catLabel(e.dir, e.category) + (v && v.number ? ' ' + v.number : '');
    openSheet({ title: (e.dir === 'in' ? 'वसूली' : 'भुगतान') + ' — ' + inr(e.amount), ok: 'ठीक है',
      fields: [{ k: 'upi', label: 'UPI ID', val: e.upi || '', ph: 'name@okbank' }, { k: 'phone', label: 'फ़ोन (WhatsApp)', type: 'tel', val: e.phone || '' }],
      submit: o => { e.upi = (o.upi || '').trim(); e.phone = (o.phone || '').trim(); persist(); },
      onMount: scrim => {
        const upi = scrim.querySelector('[name="upi"]'), phone = scrim.querySelector('[name="phone"]');
        mountQrButton(upi, null);
        const refresh = mountPayButtons(scrim, () => ({ am: num(e.amount), pa: (upi.value || '').trim(), pn: e.party || '', ph: (phone.value || '').trim(), online: e.method !== 'cash', note,
          wa: (e.party ? e.party + ' जी, ' : '') + 'नमस्ते 🙏\n' + note + ' के लिए ₹' + Math.round(num(e.amount)).toLocaleString('en-IN') + ' का भुगतान किया गया है।\n— Karan Tours & Travels',
          save: () => { e.upi = (upi.value || '').trim(); e.phone = (phone.value || '').trim(); persist(); } }));
        [upi, phone].forEach(el => el.oninput = refresh); refresh();
      } });
  }

  /* ---------------- salary slip (auto advances) ---------------- */
  function slipForm(v) {
    const ym = curMonth();
    const renderAdv = m => monthAdvances(v, m).reduce((s, x) => s + num(x.amount), 0);
    openSheet({ title: 'सैलरी स्लिप — ' + (v.driverName || v.number), ok: 'स्लिप बनाएँ', fields: [
      { k: 'month', label: 'महीना', type: 'month', val: ym },
      { k: 'driverName', label: 'ड्राइवर', val: v.driverName || '' },
      { k: 'basic', label: 'मासिक सैलरी ₹', type: 'number', val: v.driverSalary || '' },
      { k: 'additions', label: 'बोनस/अन्य +₹', type: 'number', val: '' },
      { k: 'advances', label: 'एडवांस काटें −₹ (अपने-आप)', type: 'number', val: renderAdv(ym), hint: 'ड्राइवर खाते से उस महीने का एडवांस अपने-आप — बदल सकते हैं' },
      { k: 'deductions', label: 'अन्य कटौती −₹', type: 'number', val: '' },
      { k: 'paidDate', label: 'भुगतान तारीख़', type: 'date', val: todayISO() },
    ], onMount: scrim => {
        const q = n => scrim.querySelector('[name=' + n + ']');
        const mo = q('month'), basic = q('basic'), add = q('additions'), adv = q('advances'), ded = q('deductions');
        const box = document.createElement('div'); box.className = 'slip-preview'; box.style.cssText = 'margin:4px 0 14px';
        scrim.querySelector('.sheet-actions').insertAdjacentElement('beforebegin', box);
        function draw() {
          const b = num(basic.value), a = num(add.value), ad = num(adv.value), d = num(ded.value); const net = b + a - ad - d;
          const list = mo ? monthAdvances(v, mo.value) : [];
          const advLines = list.slice().sort((x, y) => (x.date || '').localeCompare(y.date || '')).map(x =>
            `<div class="kv" style="padding:3px 0 3px 16px"><span class="k" style="font-weight:400;opacity:.85">• ${isoToDMY(x.date)}${x.note ? ' · ' + esc(x.note) : ''}</span><span class="v num" style="opacity:.85;color:var(--bad)">−${inr(x.amount)}</span></div>`).join('');
          box.innerHTML = `<div class="fsec" style="margin-top:0">अंतिम राशि (Preview)</div><div class="card pad">
            <div class="kv"><span class="k">मासिक सैलरी</span><span class="v num">${inr(b)}</span></div>
            ${a ? `<div class="kv"><span class="k">+ बोनस / अन्य</span><span class="v num" style="color:var(--good)">+${inr(a)}</span></div>` : ''}
            ${ad ? `<div class="kv"><span class="k">− एडवांस (इस माह)${list.length ? ' · ' + list.length + ' बार' : ''}</span><span class="v num" style="color:var(--bad)">−${inr(ad)}</span></div>${advLines}` : ''}
            ${d ? `<div class="kv"><span class="k">− अन्य कटौती</span><span class="v num" style="color:var(--bad)">−${inr(d)}</span></div>` : ''}
            <div class="kv" style="border-top:1px solid var(--line2);margin-top:6px;padding-top:8px"><span class="k" style="font-weight:800">नेट भुगतान</span><span class="v num ${net < 0 ? 'neg' : ''}" style="font-size:20px;font-weight:800">${inr(net)}</span></div>
            <div class="mini" style="margin-top:4px">${rupeeWords(net)}</div></div>`;
        }
        if (mo && adv) mo.addEventListener('change', () => { adv.value = renderAdv(mo.value); draw(); });
        [basic, add, adv, ded].forEach(el => el && el.addEventListener('input', draw));
        draw();
      },
      validate: o => !o.driverName ? 'ड्राइवर नाम डालें' : null, submit: o => {
        const basic = num(o.basic), add = num(o.additions), ad = num(o.advances), ded = num(o.deductions); const net = basic + add - ad - ded;
        const advBreak = monthAdvances(v, o.month).map(x => ({ date: x.date, amount: num(x.amount) }));
        const rec = { id: uid(), vehicleId: v.id, vehicleNo: v.number, driverName: o.driverName, month: o.month, basic, additions: add, advances: ad, deductions: ded, net, advBreak, paidDate: o.paidDate, company: v.company || 'karan', createdAt: Date.now() };
        slips.push(rec); persist(); toast('स्लिप सेव — PDF बन रही'); genSlipPDF(rec);
      } });
  }

  /* ---------------- invoice ---------------- */
  // Day-wise KM/घंटे editor used while making a bill. Opens a scrollable grid for the month; calls onSave({day:{day,km,hours,night}}).
  function dayGridSheet(ym, dayData, onSave) {
    const dim = daysInMonth(ym); const mm = ym.split('-')[1];
    let rows = '';
    for (let i = 1; i <= dim; i++) { const d = dayData[i] || {};
      rows += `<div style="display:grid;grid-template-columns:48px 1fr 1fr 40px;gap:6px;align-items:center;margin-bottom:5px">
        <span class="mini num">${pad2(i)}.${mm}</span>
        <input type="number" inputmode="decimal" step="any" data-d="${i}" data-k="km" placeholder="KM" value="${d.km || ''}" style="padding:7px">
        <input type="number" inputmode="decimal" step="any" data-d="${i}" data-k="hours" placeholder="घंटे" value="${d.hours || ''}" style="padding:7px">
        <input type="checkbox" data-d="${i}" data-k="night" ${d.night ? 'checked' : ''} title="रात रुकी" style="justify-self:center;width:20px;height:20px"></div>`; }
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    scrim.innerHTML = `<div class="sheet"><div class="grip"></div><h3>दिन-wise KM / घंटे — ${monthLabelHi(ym)}</h3>
      <div class="hint" style="margin-bottom:8px">हर दिन चली KM व घंटे भरें · 12 घंटे से ऊपर = extra hours (auto) · ☑ = रात रुकी</div>
      <div style="display:grid;grid-template-columns:48px 1fr 1fr 40px;gap:6px;font-weight:700;font-size:11.5px;margin-bottom:6px"><span>दिन</span><span>KM</span><span>घंटे</span><span>रात</span></div>
      <div style="overflow:auto;max-height:54vh">${rows}</div>
      <div class="sheet-actions"><button class="btn gho" id="dgClear">सब मिटाएँ</button><button class="btn gho" id="dgCancel">रद्द</button><button class="btn pri" id="dgSave">सेव</button></div></div>`;
    root.appendChild(scrim);
    const close = () => scrim.remove();
    scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
    scrim.querySelector('#dgCancel').onclick = close;
    scrim.querySelector('#dgClear').onclick = () => scrim.querySelectorAll('input[data-d]').forEach(inp => { if (inp.type === 'checkbox') inp.checked = false; else inp.value = ''; });
    scrim.querySelector('#dgSave').onclick = () => {
      const tmp = {}; scrim.querySelectorAll('input[data-d]').forEach(inp => { const i = inp.dataset.d, k = inp.dataset.k; tmp[i] = tmp[i] || { day: +i }; tmp[i][k] = k === 'night' ? inp.checked : inp.value; });
      const out = {}; Object.values(tmp).forEach(r => { const km = num(r.km), hours = num(r.hours), night = !!r.night; if (km || hours || night) out[r.day] = { day: r.day, km, hours, night }; });
      onSave(out); close();
    };
  }

  function billForm(v) {
    const co = companies[v.company] || companies.karan;
    const bym = addMonthISO(curMonth(), -1);
    const dayData = {};
    (v.logs.duty || []).forEach(r => { if ((r.date || '').slice(0, 7) === bym) { const d = +r.date.slice(8, 10); dayData[d] = { day: d, km: num(r.km), hours: num(r.hours), night: !!r.night }; } });
    const coOpts = Object.keys(companies).map(id => ({ v: id, l: companies[id].name }));
    const clOpts = Object.keys(clients).map(id => ({ v: id, l: clients[id].name }));
    const ds = dutyStats(v, bym);
    openSheet({ title: 'नया बिल — ' + v.number, ok: 'बिल PDF बनाएँ',
      extra: `<button class="btn gho" id="fillDays">📅 दिन-wise भरें</button><button class="btn gho" id="fillDuty">लॉग से</button>`,
      fields: [
      { section: 'मूल' }, { k: 'company', label: 'Company', type: 'select', val: v.company || co.id, options: coOpts },
      { k: 'buyer', label: 'ग्राहक/विभाग', type: 'select', val: v.buyer || (clOpts[0] && clOpts[0].v), options: clOpts },
      { k: 'bmonth', label: 'बिलिंग महीना', type: 'month', val: bym }, { k: 'invDate', label: 'बिल तारीख़', type: 'date', val: firstDayISO(addMonthISO(bym, 1)) },
      { k: 'invNo', label: 'बिल नंबर', val: (co.invoicePrefix || '') + (co.invoiceNext || '') },
      { section: 'हायर' }, { k: 'amtMode', label: 'राशि प्रकार', type: 'select', val: 'taxable', options: [{ v: 'taxable', l: 'टैक्स से पहले' }, { v: 'total', l: 'कुल (GST सहित)' }] },
      { k: 'hire', label: 'हायर ₹', type: 'number', val: v.hireRate }, { k: 'gst', label: 'GST %', type: 'select', val: v.gst == null ? '18' : String(v.gst), options: [{ v: '18', l: '18%' }, { v: '5', l: '5%' }, { v: '12', l: '12%' }, { v: '0', l: '0%' }] },
      { k: 'freeKm', label: 'फ़्री KM', type: 'number', val: v.freeKm || 1500 }, { k: 'hireNote', label: 'नोट', val: v.hireNote || 'Without fuel, with driver' },
      { section: 'अतिरिक्त ("📅 दिन-wise भरें" से auto भर जाएगा)' },
      { k: 'xhrQty', label: 'एक्स्ट्रा घंटे', type: 'number', val: ds.extraHrs || '' }, { k: 'xhrRate', label: 'रेट/घंटा ₹', type: 'number', val: '' },
      { k: 'xkmQty', label: 'एक्स्ट्रा KM', type: 'number', val: ds.extraKm || '' }, { k: 'xkmRate', label: 'रेट/km ₹', type: 'number', val: '' },
      { k: 'nightQty', label: 'नाइट हॉल्ट', type: 'number', val: ds.nights || '' }, { k: 'nightRate', label: 'रेट/रात ₹', type: 'number', val: '' },
      { section: 'विकल्प' }, { k: 'annex', label: 'Day-wise annexure PDF में जोड़ें', type: 'check', val: false }, { k: 'roundoff', label: 'पूर्ण रुपये में round', type: 'check', val: true },
    ], onMount: scrim => {
        const q = n => scrim.querySelector('[name=' + n + ']');
        const applyDayTotals = () => { const free = num(q('freeKm').value) || 1500; let km = 0, xhr = 0, nights = 0;
          Object.values(dayData).forEach(r => { km += num(r.km); xhr += Math.max(0, num(r.hours) - 12); if (r.night) nights++; });
          q('xhrQty').value = Math.round(xhr) || ''; q('xkmQty').value = Math.max(0, km - free) || ''; q('nightQty').value = nights || ''; q('annex').checked = true; };
        scrim.querySelector('#fillDays').onclick = () => dayGridSheet(q('bmonth').value, dayData, upd => { for (const k in dayData) delete dayData[k]; Object.assign(dayData, upd); applyDayTotals(); const n = Object.keys(dayData).length; toast(n ? n + ' दिन भरे ✓' : 'कुछ नहीं भरा'); });
        scrim.querySelector('#fillDuty').onclick = () => { const mo = q('bmonth').value; const d = dutyStats(v, mo);
          for (const k in dayData) delete dayData[k];
          (v.logs.duty || []).forEach(r => { if ((r.date || '').slice(0, 7) === mo) { const dd = +r.date.slice(8, 10); dayData[dd] = { day: dd, km: num(r.km), hours: num(r.hours), night: !!r.night }; } });
          q('xhrQty').value = d.extraHrs || ''; q('xkmQty').value = d.extraKm || ''; q('nightQty').value = d.nights || ''; q('annex').checked = true; toast('दैनिक लॉग से भर दिया'); };
      },
      validate: o => num(o.hire) <= 0 ? 'हायर राशि डालें' : null, submit: o => buildAndSaveInvoice(v, o, Object.values(dayData)) });
  }

  function computeInvoice(v, o) {
    const gst = num(o.gst), half = gst / 2;
    let taxableHire = (o.amtMode === 'total' && gst > 0) ? Math.round((num(o.hire) / (1 + gst / 100)) * 100) / 100 : num(o.hire);
    const bym = o.bmonth; const period = { from: firstDayISO(bym), to: lastDayISO(bym), label: monthLabel(bym) };
    const descLines = [`Vehicle: ${v.model || ''} (No. ${v.number})`, `Period: ${isoToDMY(period.from)} to ${isoToDMY(period.to)} (${period.label})`];
    if (o.hireNote) descLines.push('*' + o.hireNote + '*');
    const lines = [{ sl: 1, title: 'Vehicle Hire Charges (Monthly)', desc: descLines, qty: '1 Month', rate: taxableHire, per: 'Month', amount: taxableHire }];
    let sl = 2; const freeKm = num(o.freeKm) || 1500;
    const xhr = num(o.xhrQty) * num(o.xhrRate), xkm = num(o.xkmQty) * num(o.xkmRate), night = num(o.nightQty) * num(o.nightRate);
    lines.push({ sl: sl++, title: 'Extra Hours Charges (beyond 12 hours per day)', qty: num(o.xhrQty) || '-', rate: num(o.xhrRate) || '-', per: 'Hour', amount: xhr || '-' });
    lines.push({ sl: sl++, title: `Extra Kilometre Charges (beyond ${freeKm.toLocaleString('en-IN')} km per month)`, qty: num(o.xkmQty) || '-', rate: num(o.xkmRate) || '-', per: 'Km', amount: xkm || '-' });
    lines.push({ sl: sl++, title: 'Night Halt Charges', qty: num(o.nightQty) || '-', rate: num(o.nightRate) || '-', per: 'Night', amount: night || '-' });
    const taxable = taxableHire + xhr + xkm + night;
    const cgst = Math.round(taxable * half) / 100, sgst = Math.round(taxable * half) / 100;
    const raw = taxable + cgst + sgst; let grand = raw, roundOff = 0;
    if (o.roundoff) { grand = Math.round(raw); roundOff = Math.round((grand - raw) * 100) / 100; }
    return { gst, lines, taxable, cgst, sgst, roundOff, grand, period };
  }
  function buildAndSaveInvoice(v, o, dayRows) {
    const co = companies[o.company]; const cl = clients[o.buyer] || { name: '', address: '', stateCode: '10' }; const c = computeInvoice(v, o);
    const rec = { id: uid(), company: o.company, number: o.invNo, date: o.invDate, buyerId: o.buyer, buyerName: cl.name,
      buyer: { name: cl.name, line2: cl.line2 || '', address: cl.address || '', stateCode: cl.stateCode || '10' },
      vehicleId: v.id, vehicleNo: v.number, model: v.model, lines: c.lines, taxableValue: c.taxable, gstRate: c.gst, cgst: c.cgst, sgst: c.sgst, roundOff: c.roundOff, grandTotal: c.grand,
      amountWords: rupeeWords(c.grand), taxWords: rupeeWords(c.cgst + c.sgst), annexure: !!o.annex, month: o.bmonth, period: c.period, freeKm: num(o.freeKm) || 1500,
      dayRows: (dayRows || []).filter(r => num(r.km) || num(r.hours) || r.night).map(r => ({ day: r.day, km: num(r.km), hours: num(r.hours), night: !!r.night })), createdAt: Date.now() };
    invoices.push(rec);
    const m = String(o.invNo).match(/(\d+)\s*$/); if (m && co) co.invoiceNext = parseInt(m[1], 10) + 1;
    persist(); toast('बिल सेव — PDF बन रही'); genInvoicePDF(rec); render();
  }

  /* ---------------- PDF ---------------- */
  function downloadBlob(blob, filename) { const a = document.createElement('a'); const url = URL.createObjectURL(blob); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500); }
  function newDoc() { return new jsPDF({ unit: 'pt', format: 'a4' }); }
  function savePDF(doc, filename, folders) {
    let blob; try { blob = doc.output('blob'); } catch (e) { toast('PDF नहीं बनी'); return; }
    downloadBlob(blob, filename); toast('PDF डाउनलोड ✓');
    if (drive && drive.uploadPdf && drive.isSignedIn()) {
      drive.uploadPdf(blob, filename, ['Karan Fleet'].concat(folders || []))
        .then(() => toast('Drive में भी सेव ✓'))
        .catch(e => { const m = String((e && e.message) || ''); toast(/403|scope/i.test(m) ? 'Drive: दोबारा Login करें (नई अनुमति)' : 'Drive upload नहीं हुआ'); });
    }
  }
  const brandColors = coId => coId === 'jk' ? { dark: [110, 31, 40], accent: [138, 43, 54], ini: 'JK' } : { dark: [27, 58, 107], accent: [168, 130, 42], ini: 'K' };

  function pdfHeader(doc, co, bc) {
    const W = doc.internal.pageSize.getWidth(), M = 28; let y = 34;
    doc.setFillColor(...bc.dark); doc.circle(M + 16, y + 6, 16, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(bc.ini.length > 1 ? 10 : 14); doc.text(bc.ini, M + 16, y + 10, { align: 'center' });
    doc.setTextColor(...bc.dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(co.name || '', M + 42, y + 2);
    doc.setTextColor(...bc.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text((co.tagline || '').toUpperCase(), M + 43, y + 15);
    doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('GSTIN: ' + (co.gstin || '') + (co.pan ? '    PAN: ' + co.pan : ''), M + 43, y + 26);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 60, 60); let ry = y - 2; (co.contactLines || []).forEach(l => { doc.text(l, W - M, ry, { align: 'right' }); ry += 10; });
    y += 36; doc.setDrawColor(...bc.dark); doc.setLineWidth(1.6); doc.line(M, y, W - M, y); doc.setLineWidth(.5); doc.line(M, y + 3, W - M, y + 3);
    return y + 12;
  }
  function pdfTitleBand(doc, y, title, right) {
    const W = doc.internal.pageSize.getWidth(), M = 28; doc.setFillColor(226, 230, 224); doc.rect(M, y, W - 2 * M, 20, 'F');
    doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(title, W / 2, y + 14, { align: 'center' });
    if (right) { doc.setFontSize(7.5); doc.text(right, W - M - 4, y + 13, { align: 'right' }); } return y + 20;
  }
  function pdfFooter(doc, co, bc) {
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    if (co.footer) { doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(10); doc.setTextColor(...bc.dark); doc.text(co.footer, W / 2, H - 26, { align: 'center' }); }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.text('This is a Computer Generated Invoice', W / 2, H - 15, { align: 'center' });
  }

  function genInvoicePDF(iv) {
    const co = companies[iv.company] || {}; const bc = brandColors(iv.company); const doc = newDoc(); const W = doc.internal.pageSize.getWidth(), M = 28;
    let y = pdfHeader(doc, co, bc); y = pdfTitleBand(doc, y, 'TAX INVOICE', 'ORIGINAL FOR RECIPIENT');
    const boxY = y, leftW = 300, rightX = M + leftW, rightW = W - M - rightX, boxH = 96;
    doc.setDrawColor(150); doc.setLineWidth(.5); doc.rect(M, boxY, leftW, boxH);
    doc.setTextColor(20, 20, 20); doc.setFontSize(7.6); let sy = boxY + 11; const sx = M + 5;
    const sline = (lbl, val) => { doc.setFont('helvetica', 'bold'); doc.text(lbl, sx, sy); const lw = doc.getTextWidth(lbl); doc.setFont('helvetica', 'normal'); const txt = doc.splitTextToSize(val, leftW - 10 - lw); doc.text(txt, sx + lw, sy); sy += txt.length * 8.5; };
    doc.setFont('helvetica', 'bold'); doc.text('SELLER', sx, sy); sy += 9;
    sline('H.O.: ', co.ho || ''); if (co.bo) sline('B.O.: ', co.bo); sline('Mobile No.: ', co.mobile || ''); sline('GSTIN: ', co.gstin || ''); sline('State Name: ', 'Bihar, Code: ' + (co.stateCode || '10')); sline('E-mail: ', co.email || '');
    const rowH = boxH / 3;
    doc.rect(rightX, boxY, rightW, rowH); doc.line(rightX + rightW / 2, boxY, rightX + rightW / 2, boxY + rowH); doc.rect(rightX, boxY + rowH, rightW, rowH); doc.rect(rightX, boxY + 2 * rowH, rightW, rowH);
    const cap = (x, w, yy, lbl, val, big) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 90, 90); doc.text(lbl, x + w / 2, yy + 10, { align: 'center' }); doc.setFont('helvetica', 'bold'); doc.setFontSize(big || 11); doc.setTextColor(20, 20, 20); doc.text(String(val || ''), x + w / 2, yy + 23, { align: 'center' }); };
    cap(rightX, rightW / 2, boxY, 'Invoice No.', iv.number); cap(rightX + rightW / 2, rightW / 2, boxY, 'Dated', isoToDMY(iv.date));
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 90, 90); doc.text('Billing Period', rightX + rightW / 2, boxY + rowH + 9, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(20, 20, 20); doc.text(isoToDMY(iv.period.from) + ' to ' + isoToDMY(iv.period.to), rightX + rightW / 2, boxY + rowH + 22, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(iv.period.label, rightX + rightW / 2, boxY + rowH + 31, { align: 'center' });
    cap(rightX, rightW, boxY + 2 * rowH, 'Vehicle No.', iv.vehicleNo, 12);
    y = boxY + boxH;
    const bH = 52; doc.rect(M, y, W - 2 * M, bH); doc.setFontSize(7.5); let by = y + 11; const bx = M + 5;
    doc.setFont('helvetica', 'bold'); doc.text('BUYER (BILL TO)', bx, by); by += 10; doc.setFontSize(9); doc.text(iv.buyer.name || '', bx, by); by += 11;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); const baddr = [iv.buyer.line2, iv.buyer.address].filter(Boolean).join(', '); const bl = doc.splitTextToSize(baddr, W - 2 * M - 10); doc.text(bl, bx, by); by += bl.length * 9; doc.text('State Name: Bihar, Code: ' + (iv.buyer.stateCode || '10'), bx, by);
    y += bH;
    const body = iv.lines.map(l => { let d = l.title; if (l.desc) d += '\n' + l.desc.join('\n'); return [l.sl, d, l.qty, (typeof l.rate === 'number' ? fmt2(l.rate) : l.rate), l.per, '-', (typeof l.amount === 'number' ? fmt2(l.amount) : l.amount)]; });
    const gp = iv.gstRate / 2;
    const foot = [
      [{ content: 'Total (Taxable Value)', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt2(iv.taxableValue), styles: { halign: 'right', fontStyle: 'bold' } }],
      [{ content: `Add: CGST @ ${gp}%`, colSpan: 6, styles: { halign: 'right' } }, { content: fmt2(iv.cgst), styles: { halign: 'right' } }],
      [{ content: `Add: SGST @ ${gp}%`, colSpan: 6, styles: { halign: 'right' } }, { content: fmt2(iv.sgst), styles: { halign: 'right' } }],
    ];
    if (iv.roundOff) foot.push([{ content: 'Round Off', colSpan: 6, styles: { halign: 'right' } }, { content: (iv.roundOff > 0 ? '+' : '') + fmt2(iv.roundOff), styles: { halign: 'right' } }]);
    foot.push([{ content: `GRAND TOTAL (Including ${iv.gstRate}% GST)`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 230, 224] } }, { content: 'Rs. ' + fmt2(iv.grandTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [226, 230, 224] } }]);
    doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid',
      head: [['SL\nNo.', 'Description of Services', 'Quantity', 'Rate (Rs.)', 'Per', 'Disc.\n%', 'Amount (Rs.)']], body, foot,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, lineColor: [150, 150, 150], lineWidth: .4, textColor: [20, 20, 20] },
      headStyles: { fillColor: [238, 240, 236], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'center', fontSize: 7.6 },
      footStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20] },
      columnStyles: { 0: { cellWidth: 26, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 50, halign: 'center' }, 3: { cellWidth: 56, halign: 'right' }, 4: { cellWidth: 38, halign: 'center' }, 5: { cellWidth: 32, halign: 'center' }, 6: { cellWidth: 66, halign: 'right' } } });
    y = doc.lastAutoTable.finalY;
    const awH = 26; doc.setDrawColor(150); doc.rect(M, y, W - 2 * M, awH); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text('Amount Chargeable (in words)', M + 5, y + 10); doc.setFontSize(8.5); doc.text(iv.amountWords, M + 5, y + 21); doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.text('E. & O.E.', W - M - 4, y + 10, { align: 'right' });
    y += awH + 6;
    doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid',
      head: [[{ content: 'HSN/SAC', rowSpan: 2 }, { content: 'Taxable Value', rowSpan: 2 }, { content: 'Central Tax (CGST)', colSpan: 2 }, { content: 'State Tax (SGST)', colSpan: 2 }, { content: 'Total Tax Amount', rowSpan: 2 }], ['Rate', 'Amount', 'Rate', 'Amount']],
      body: [['996601', fmt2(iv.taxableValue), gp + '%', fmt2(iv.cgst), gp + '%', fmt2(iv.sgst), fmt2(iv.cgst + iv.sgst)]],
      foot: [[{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: fmt2(iv.taxableValue), styles: { fontStyle: 'bold' } }, '', { content: fmt2(iv.cgst), styles: { fontStyle: 'bold' } }, '', { content: fmt2(iv.sgst), styles: { fontStyle: 'bold' } }, { content: fmt2(iv.cgst + iv.sgst), styles: { fontStyle: 'bold' } }]],
      styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 3, halign: 'center', lineColor: [150, 150, 150], lineWidth: .4, textColor: [20, 20, 20] },
      headStyles: { fillColor: [238, 240, 236], textColor: [20, 20, 20], fontStyle: 'bold' }, footStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20] },
      columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } } });
    y = doc.lastAutoTable.finalY; doc.setDrawColor(150); doc.rect(M, y, W - 2 * M, 16); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text('Tax Amount (in words): ' + iv.taxWords, M + 5, y + 10);
    y += 16 + 6;
    const colW = (W - 2 * M) / 2, decH = 58; doc.rect(M, y, colW, decH); doc.rect(M + colW, y, colW, decH);
    doc.setFontSize(7.3); doc.setFont('helvetica', 'bold'); doc.text('Remarks: ', M + 5, y + 11); doc.setFont('helvetica', 'normal'); doc.text('Payment by CHQ / RTGS / CASH / UPI', M + 5 + doc.getTextWidth('Remarks: '), y + 11);
    doc.setFont('helvetica', 'bold'); doc.text('Declaration', M + 5, y + 24); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize('We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.', colW - 10), M + 5, y + 34);
    if (co.bank) { const b = co.bank; let yy = y + 11; const bx2 = M + colW + 5; doc.setFont('helvetica', 'bold'); doc.text('BANK DETAILS', bx2, yy); yy += 10;
      const bln = (l, v2) => { doc.setFont('helvetica', 'bold'); doc.text(l, bx2, yy); doc.setFont('helvetica', 'normal'); doc.text(v2, bx2 + doc.getTextWidth(l), yy); yy += 9; };
      bln("A/c Holder: ", b.holder || ''); if (b.payId) bln('Pay ID: ', b.payId); bln('Bank: ', b.bank || ''); bln('A/c No.: ', b.acc || ''); bln('Branch & IFSC: ', (b.branch || '') + ', ' + (b.ifsc || '')); }
    else { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('For ' + (co.name || ''), M + 2 * colW - 5, y + 12, { align: 'right' }); }
    y += decH; const sH = 46; doc.rect(M, y, colW, sH); doc.rect(M + colW, y, colW, sH);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text("Receiver's Signature & Seal", M + colW / 2, y + sH - 8, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.text('For ' + (co.name || ''), M + 2 * colW - 5, y + 11, { align: 'right' }); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(co.signatory || 'Authorised Signatory', M + 2 * colW - 5, y + sH - 6, { align: 'right' });
    pdfFooter(doc, co, bc);
    if (iv.annexure) annexurePage(doc, co, bc, iv);
    savePDF(doc, 'Invoice_' + String(iv.number).replace(/[^\w\-]/g, '_') + '_' + (iv.vehicleNo || '').replace(/\s/g, '') + '.pdf', ['Bills', iv.vehicleNo || 'अन्य']);
  }

  function annexurePage(doc, co, bc, iv) {
    doc.addPage(); const W = doc.internal.pageSize.getWidth(), M = 28; let y = pdfHeader(doc, co, bc); y = pdfTitleBand(doc, y, 'ANNEXURE', 'DAY-WISE RUNNING DETAILS') + 8;
    const ym = iv.month; const dim = daysInMonth(ym); const free = num(iv.freeKm) || 1500;
    const byDay = {};
    if (iv.dayRows && iv.dayRows.length) iv.dayRows.forEach(r => { byDay[ym + '-' + pad2(r.day)] = { km: num(r.km), hours: num(r.hours), night: !!r.night }; });
    else { const v = vehById(iv.vehicleId) || { logs: { duty: [] } }; (v.logs.duty || []).forEach(r => { if ((r.date || '').slice(0, 7) === ym) byDay[r.date] = r; }); }
    let tkm = 0, txhr = 0, tn = 0, dd = 0;
    Object.keys(byDay).forEach(k => { const r = byDay[k]; if (num(r.km) || num(r.hours) || r.night) dd++; tkm += num(r.km); txhr += Math.max(0, num(r.hours) - 12); if (r.night) tn++; });
    const xkm = Math.max(0, tkm - free);
    const cell = i => { if (i < 1 || i > dim) return ['', '', '']; const iso = ym + '-' + pad2(i); const r = byDay[iso]; const xh = r && num(r.hours) > 12 ? String(Math.round(num(r.hours) - 12)) : ''; return [isoToDMY(iso), r && num(r.km) ? String(num(r.km)) : '', xh]; };
    const rows = []; for (let i = 1; i <= 16; i++) rows.push([...cell(i), ...cell(i + 16)]);
    doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid',
      head: [[{ content: 'DAY-WISE RUNNING DETAILS (' + monthLabel(ym) + ')  -  ' + (iv.vehicleNo || '') + '   |   Extra Hr = hours beyond 12 hrs in a day', colSpan: 6, styles: { halign: 'center', fillColor: [238, 240, 236] } }], ['Date', 'KM', 'Extra Hr', 'Date', 'KM', 'Extra Hr']], body: rows,
      foot: [[{ content: `Total KM: ${tkm}   |   Free KM: ${free.toLocaleString('en-IN')}   |   Extra KM: ${xkm}   |   Total Extra Hours: ${Math.round(txhr)}   |   Nights: ${tn}   |   Duty Days: ${dd}`, colSpan: 6, styles: { halign: 'left', fontStyle: 'bold' } }]],
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, halign: 'center', lineColor: [150, 150, 150], lineWidth: .4 }, headStyles: { fillColor: [238, 240, 236], textColor: [20, 20, 20], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 62 }, 3: { cellWidth: 62 } } });
    y = doc.lastAutoTable.finalY + 10; const colW = (W - 2 * M) / 2; doc.setDrawColor(150); doc.rect(M, y, colW, 54); doc.rect(M + colW, y, colW, 54);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Invoice No.: ' + iv.number, M + 5, y + 13); doc.text('Invoice Date: ' + isoToDMY(iv.date), M + 5, y + 25);
    doc.setFont('helvetica', 'normal'); doc.text('Vehicle: ' + (iv.model || '') + ' (No. ' + (iv.vehicleNo || '') + ')', M + 5, y + 37);
    doc.setFont('helvetica', 'bold'); doc.text('For ' + (co.name || ''), M + 2 * colW - 5, y + 13, { align: 'right' }); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(co.signatory || 'Authorised Signatory', M + 2 * colW - 5, y + 48, { align: 'right' });
    pdfFooter(doc, co, bc);
  }

  function genSlipPDF(sl) {
    const co = companies[sl.company] || companies.karan || {}; const bc = brandColors(sl.company); const doc = newDoc(); const W = doc.internal.pageSize.getWidth(), M = 28;
    let y = pdfHeader(doc, co, bc); y = pdfTitleBand(doc, y, 'SALARY SLIP', monthLabel(sl.month)) + 10;
    doc.setDrawColor(150); doc.rect(M, y, W - 2 * M, 50); doc.setFontSize(9); let iy = y + 15; const ix = M + 8;
    const kv = (l, v2, x) => { doc.setFont('helvetica', 'bold'); doc.text(l, x, iy); doc.setFont('helvetica', 'normal'); doc.text(String(v2 || ''), x + doc.getTextWidth(l), iy); };
    kv('Driver Name: ', sl.driverName, ix); kv('Month: ', monthLabel(sl.month), M + (W - 2 * M) / 2); iy += 16; kv('Vehicle No.: ', sl.vehicleNo, ix); kv('Paid On: ', isoToDMY(sl.paidDate), M + (W - 2 * M) / 2);
    y += 50 + 12;
    const rows = [['Basic Salary', 'Rs. ' + fmt2(sl.basic)]];
    if (sl.additions) rows.push(['Bonus / Additions', '+ Rs. ' + fmt2(sl.additions)]);
    if (sl.advances) { const br = sl.advBreak || [];
      if (br.length > 1) { rows.push(['Less: Advance Taken (' + br.length + ' times)', '- Rs. ' + fmt2(sl.advances)]);
        const sub = { fontStyle: 'italic', fontSize: 8.5, textColor: [110, 110, 110] };
        br.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(a => rows.push([{ content: '      ' + isoToDMY(a.date), styles: sub }, { content: 'Rs. ' + fmt2(a.amount), styles: { ...sub, halign: 'right' } }])); }
      else rows.push(['Less: Advance Taken' + (br.length ? ' (' + isoToDMY(br[0].date) + ')' : ''), '- Rs. ' + fmt2(sl.advances)]); }
    if (sl.deductions) rows.push(['Less: Other Deductions', '- Rs. ' + fmt2(sl.deductions)]);
    doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid', head: [['Particulars', 'Amount']], body: rows,
      foot: [[{ content: 'NET PAYABLE', styles: { fontStyle: 'bold', fillColor: [226, 230, 224] } }, { content: 'Rs. ' + fmt2(sl.net), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 230, 224] } }]],
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 6, lineColor: [150, 150, 150], lineWidth: .4, textColor: [20, 20, 20] }, headStyles: { fillColor: [238, 240, 236], textColor: [20, 20, 20], fontStyle: 'bold' }, columnStyles: { 1: { halign: 'right', cellWidth: 160 } } });
    y = doc.lastAutoTable.finalY + 14; doc.setDrawColor(150); doc.rect(M, y, W - 2 * M, 22); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('Net Pay (in words): ' + rupeeWords(sl.net), M + 6, y + 14);
    y += 22 + 40; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text("Driver's Signature", M + 6, y); doc.text('For ' + (co.name || ''), W - M - 6, y - 26, { align: 'right' }); doc.text(co.signatory || 'Authorised Signatory', W - M - 6, y, { align: 'right' });
    pdfFooter(doc, co, bc); savePDF(doc, 'SalarySlip_' + (sl.driverName || '').replace(/\s/g, '_') + '_' + sl.month + '.pdf', ['Salary Slips', sl.driverName || sl.vehicleNo || 'ड्राइवर']);
  }

  function summaryForm() {
    const coOpts = Object.keys(companies).map(id => ({ v: id, l: companies[id].name }));
    const clOpts = [{ v: '', l: '— सभी —' }].concat(Object.keys(clients).map(id => ({ v: id, l: clients[id].name })));
    openSheet({ title: 'मासिक सारांश PDF', ok: 'बनाएँ', fields: [
      { k: 'company', label: 'Company', type: 'select', val: coOpts[0] && coOpts[0].v, options: coOpts },
      { k: 'buyer', label: 'विभाग', type: 'select', val: '', options: clOpts },
      { k: 'month', label: 'महीना', type: 'month', val: addMonthISO(curMonth(), -1) }, { k: 'date', label: 'तारीख़', type: 'date', val: firstDayISO(curMonth()) },
    ], submit: o => { const list = invoices.filter(iv => iv.company === o.company && iv.month === o.month && (!o.buyer || iv.buyerId === o.buyer)); if (!list.length) { toast('इस महीने कोई बिल नहीं मिला'); return; } genSummaryPDF(o, list); } });
  }
  function genSummaryPDF(o, list) {
    const co = companies[o.company] || {}; const bc = brandColors(o.company); const cl = clients[o.buyer] || { name: list[0].buyerName }; const doc = newDoc(); const W = doc.internal.pageSize.getWidth(), M = 28;
    let y = pdfHeader(doc, co, bc); y = pdfTitleBand(doc, y, 'SUMMARY OF INVOICES', 'ABSTRACT') + 6;
    list.sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
    doc.setDrawColor(150); doc.rect(M, y, W - 2 * M, 40); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text('BUYER (BILL TO)', M + 5, y + 11); doc.setFontSize(9); doc.text(cl.name || '', M + 5, y + 23);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('Invoice Nos.: ' + list[0].number + ' to ' + list[list.length - 1].number + '   |   ' + monthLabel(o.month) + '   |   Dated: ' + isoToDMY(o.date), M + 5, y + 34); y += 46;
    let tTax = 0, tCg = 0, tSg = 0, tGr = 0;
    const body = list.map((iv, i) => { tTax += iv.taxableValue; tCg += iv.cgst; tSg += iv.sgst; tGr += iv.grandTotal; return [i + 1, iv.number, iv.vehicleNo, iv.model, fmt2(iv.taxableValue), fmt2(iv.cgst), fmt2(iv.sgst), fmt2(iv.grandTotal)]; });
    doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid', head: [['SL', 'Inv.No', 'Vehicle No.', 'Vehicle', 'Taxable', 'CGST', 'SGST', 'Total (Rs.)']], body,
      foot: [[{ content: 'GRAND TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: fmt2(tTax), styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmt2(tCg), styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmt2(tSg), styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmt2(tGr), styles: { fontStyle: 'bold', halign: 'right' } }]],
      styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 3, lineColor: [150, 150, 150], lineWidth: .4, textColor: [20, 20, 20] }, headStyles: { fillColor: [238, 240, 236], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { cellWidth: 22, halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } } });
    y = doc.lastAutoTable.finalY + 12;
    const byType = {}; list.forEach(iv => { const k = iv.model || 'Other'; if (!byType[k]) byType[k] = { n: 0, gst: 0, total: 0 }; byType[k].n++; byType[k].gst += iv.cgst + iv.sgst; byType[k].total += iv.grandTotal; });
    const tbody = Object.keys(byType).map(k => [k, byType[k].n, fmt2(byType[k].total / byType[k].n), fmt2(byType[k].gst), fmt2(byType[k].total)]);
    tbody.push([{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: list.length, styles: { fontStyle: 'bold' } }, '', { content: fmt2(tCg + tSg), styles: { fontStyle: 'bold' } }, { content: fmt2(tGr), styles: { fontStyle: 'bold' } }]);
    doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid', head: [['Vehicle Type', 'No.', 'Amount/Vehicle', 'GST Amount', 'Total Amount']], body: tbody,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, lineColor: [150, 150, 150], lineWidth: .4, textColor: [20, 20, 20] }, headStyles: { fillColor: [238, 240, 236], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'center' }, columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
    y = doc.lastAutoTable.finalY + 10; doc.setDrawColor(150); doc.rect(M, y, W - 2 * M, 34); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Total Amount Payable (in words)', M + 5, y + 11); doc.setFont('helvetica', 'normal'); doc.text(rupeeWords(tGr), M + 5, y + 22);
    doc.setFont('helvetica', 'bold'); doc.text('Total GST (in words): ', M + 5, y + 32); doc.setFont('helvetica', 'normal'); doc.text(rupeeWords(tCg + tSg), M + 5 + doc.getTextWidth('Total GST (in words): '), y + 32);
    pdfFooter(doc, co, bc); savePDF(doc, 'Summary_' + (co.name || '').replace(/[^\w]/g, '_').slice(0, 10) + '_' + o.month + '.pdf', ['Summaries']);
  }

  /* ---------------- settings & sync ---------------- */
  function setSync(state2) { const b = $('#btnSync'); if (!b) return; let color = 'var(--muted)', title = 'Google Drive बंद';
    if (state2 === 'saved' || (drive && drive.isSignedIn() && !state2)) { color = 'var(--good)'; title = 'Drive sync चालू'; }
    else if (state2 === 'saving') { color = 'var(--warn)'; title = 'sync हो रहा…'; }
    else if (state2 === 'error') { color = 'var(--bad)'; title = 'sync error'; }
    else if (drive && drive.isConfigured() && !drive.isSignedIn()) { color = 'var(--warn)'; title = 'Drive login करें'; }
    b.innerHTML = svg(IC.cloud, 19); b.style.color = color; b.title = title;
  }
  function syncClick() {
    if (!drive) return;
    if (!drive.isConfigured()) { openSettings('drive'); return; }
    if (!drive.isSignedIn()) { drive.signIn().then(() => syncNow(true)).catch(e => toast(e.message || 'login fail')); return; }
    syncNow(true);
  }
  async function syncNow(manual) {
    if (!drive || !drive.isSignedIn()) return; setSync('saving');
    try { const remote = await drive.pull();
      if (remote && remote.updatedAt > (STORE.updatedAt || 0) + 1000) { STORE = remote; point(); migrate(); persist(true); render(); toast('Drive से नया data आया'); }
      else { await drive.push(STORE); if (manual) toast('Drive में सेव ✓'); }
      setSync('saved');
    } catch (e) { setSync('error'); if (manual) toast(e.message || 'sync fail'); }
  }

  function openSettings(focus) {
    let fh = `<div class="sheet"><div class="grip"></div><h3>सेटिंग्स</h3>`;
    fh += `<div class="fsec">Google Drive Sync</div><div id="driveBox"></div>`;
    fh += `<div class="fsec">Companies</div>`;
    Object.keys(companies).forEach(id => { const c = companies[id]; fh += `<div class="linkrow" data-act="editCo" data-id="${id}"><div><b>${esc(c.name)}</b><div class="mini">GSTIN ${esc(c.gstin || '')} · अगला #${esc(c.invoicePrefix || '')}${esc(c.invoiceNext || '')}</div></div>${svg('<path d="M9 6l6 6-6 6"/>', 18)}</div>`; });
    fh += `<div class="fsec">ग्राहक / विभाग</div>`;
    Object.keys(clients).forEach(id => { fh += `<div class="linkrow" data-act="editCl" data-id="${id}"><div><b>${esc(clients[id].name)}</b></div>${svg('<path d="M9 6l6 6-6 6"/>', 18)}</div>`; });
    fh += `<button class="btn block gho" style="margin-top:10px" data-act="newClient">${svg(IC.plus, 15)} नया विभाग</button>`;
    fh += `<div class="fsec">Backup</div><div class="grid g2"><button class="btn gho" data-act="backup">बैकअप फ़ाइल</button><label class="btn gho" style="cursor:pointer">रिस्टोर<input type="file" id="restoreFile" accept="application/json" hidden></label></div>`;
    fh += `<div class="sheet-actions"><button class="btn pri block" id="setClose">ठीक है</button></div></div>`;
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.innerHTML = fh; root.appendChild(scrim);
    const close = () => scrim.remove();
    function drawDrive() {
      const box = scrim.querySelector('#driveBox'); const cid = drive.getClientId(); const signed = drive.isSignedIn();
      box.innerHTML = `<div class="field"><label>Google OAuth Client ID</label><input id="cidIn" value="${esc(cid)}" placeholder="xxxxx.apps.googleusercontent.com"><div class="hint">README में बनाने का तरीक़ा है। एक बार डालें।</div></div>
        <div class="grid g2">${signed ? `<button class="btn" id="dSignOut">Logout</button><button class="btn pri" id="dSync">अभी Sync</button>` : `<button class="btn pri" id="dSignIn">Google Login</button><button class="btn gho" id="dSave">ID सेव</button>`}</div>
        ${signed ? `<button class="btn gho block" id="dFolder" style="margin-top:8px">📁 Drive फ़ोल्डर खोलें</button>` : ''}
        <div class="mini" style="margin-top:6px">${signed ? '✓ Drive से जुड़ा — डेटा backup + हर बिल/स्लिप PDF "Karan Fleet" फ़ोल्डर में (गाड़ी/ड्राइवर के नाम से)' : (cid ? 'Login करें (नई अनुमति: Drive फ़ोल्डर)' : 'पहले Client ID डालें')}</div>`;
      const cidIn = box.querySelector('#cidIn');
      const save = () => { drive.setClientId(cidIn.value); toast('ID सेव'); drawDrive(); };
      if (box.querySelector('#dSave')) box.querySelector('#dSave').onclick = save;
      if (box.querySelector('#dSignIn')) box.querySelector('#dSignIn').onclick = () => { drive.setClientId(cidIn.value); drive.signIn().then(() => { syncNow(true); drawDrive(); }).catch(e => toast(e.message || 'login fail')); };
      if (box.querySelector('#dSignOut')) box.querySelector('#dSignOut').onclick = () => { drive.signOut(); drawDrive(); setSync(); };
      if (box.querySelector('#dSync')) box.querySelector('#dSync').onclick = () => syncNow(true);
      if (box.querySelector('#dFolder')) box.querySelector('#dFolder').onclick = () => { if (!drive.appFolderUrl) { toast('उपलब्ध नहीं'); return; } toast('फ़ोल्डर खुल रहा…'); const w = window.open('', '_blank'); drive.appFolderUrl().then(url => { if (w) w.location = url; else window.open(url, '_blank'); }).catch(e => { if (w) w.close(); toast(/403|scope/i.test(String((e && e.message) || '')) ? 'दोबारा Login करें (नई अनुमति)' : 'फ़ोल्डर नहीं खुला'); }); };
    }
    drawDrive();
    scrim.querySelector('#restoreFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const o = JSON.parse(r.result); if (o && o.vehicles) { STORE = o; point(); migrate(); persist(); render(); toast('रिस्टोर हो गया'); close(); } else toast('ग़लत फ़ाइल'); } catch (err) { toast('फ़ाइल पढ़ी नहीं गई'); } }; r.readAsText(f); };
    scrim.addEventListener('click', e => { if (e.target === scrim || e.target.id === 'setClose') { close(); return; } const b = e.target.closest('[data-act]'); if (!b) return; const act = b.dataset.act, id = b.dataset.id;
      if (act === 'editCo') { close(); companyForm(companies[id], id); } if (act === 'editCl') { close(); clientForm(clients[id], id); } if (act === 'newClient') { close(); clientForm(null); }
      if (act === 'backup') { downloadBlob(new Blob([JSON.stringify(STORE, null, 2)], { type: 'application/json' }), 'karan-fleet-backup-' + todayISO() + '.json'); toast('बैकअप बन गया'); }
    });
    if (focus === 'drive') scrim.querySelector('#cidIn') && scrim.querySelector('#cidIn').focus();
  }
  function companyForm(c, id) { c = c || {}; const b = c.bank || {};
    openSheet({ title: 'Company — ' + (c.name || ''), ok: 'सेव', fields: [
      { k: 'name', label: 'नाम', val: c.name }, { k: 'tagline', label: 'टैगलाइन', val: c.tagline }, { k: 'gstin', label: 'GSTIN', val: c.gstin }, { k: 'pan', label: 'PAN', val: c.pan },
      { k: 'ho', label: 'H.O. पता', type: 'textarea', val: c.ho }, { k: 'bo', label: 'B.O. पता', type: 'textarea', val: c.bo }, { k: 'mobile', label: 'मोबाइल', val: c.mobile }, { k: 'email', label: 'ईमेल', val: c.email },
      { k: 'invoicePrefix', label: 'बिल prefix', val: c.invoicePrefix }, { k: 'invoiceNext', label: 'अगला बिल नंबर', type: 'number', val: c.invoiceNext }, { k: 'signatory', label: 'हस्ताक्षरकर्ता', val: c.signatory || 'Authorised Signatory' },
      { section: 'बैंक' }, { k: 'b_holder', label: 'खाता नाम', val: b.holder }, { k: 'b_bank', label: 'बैंक', val: b.bank }, { k: 'b_acc', label: 'खाता नंबर', val: b.acc }, { k: 'b_ifsc', label: 'IFSC', val: b.ifsc }, { k: 'b_branch', label: 'ब्रांच', val: b.branch }, { k: 'b_payId', label: 'Pay ID', val: b.payId },
    ], submit: o => { companies[id] = { ...c, name: o.name, tagline: o.tagline, gstin: o.gstin, pan: o.pan, ho: o.ho, bo: o.bo, mobile: o.mobile, email: o.email, stateCode: c.stateCode || '10', footer: c.footer, contactLines: c.contactLines, invoicePrefix: o.invoicePrefix, invoiceNext: num(o.invoiceNext), signatory: o.signatory, bank: { holder: o.b_holder, bank: o.b_bank, acc: o.b_acc, ifsc: o.b_ifsc, branch: o.b_branch, payId: o.b_payId } }; persist(); toast('सेव'); } });
  }
  function clientForm(c, id) { c = c || {};
    openSheet({ title: c.name ? 'विभाग बदलें' : 'नया विभाग', ok: 'सेव', fields: [
      { k: 'name', label: 'नाम/पदनाम', val: c.name }, { k: 'line2', label: 'विभाग', val: c.line2 }, { k: 'address', label: 'पता', type: 'textarea', val: c.address }, { k: 'stateCode', label: 'State Code', val: c.stateCode || '10' },
      { k: 'defaultGst', label: 'डिफ़ॉल्ट GST%', type: 'select', val: c.defaultGst == null ? '18' : String(c.defaultGst), options: [{ v: '18', l: '18%' }, { v: '5', l: '5%' }, { v: '12', l: '12%' }, { v: '0', l: '0%' }] },
    ], validate: o => !o.name ? 'नाम ज़रूरी' : null, submit: o => { const key = id || uid(); clients[key] = { name: o.name, line2: o.line2, address: o.address, stateCode: o.stateCode, defaultGst: num(o.defaultGst) }; persist(); toast('सेव'); render(); } });
  }

  /* ---------------- events ---------------- */
  root.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]'); if (nav) { setNav(nav.dataset.nav); return; }
    const b = e.target.closest('[data-act]'); if (!b) return; const act = b.dataset.act, id = b.dataset.id;
    if (act === 'nav') return setNav(b.dataset.n);
    if (act === 'openV') return openVehicle(id);
    if (act === 'newVehicle') return vehicleForm(null);
    if (act === 'editV') return vehicleForm(vehById(id));
    if (act === 'dtab') { st.dtab = b.dataset.t; const v = vehById(st.vsub); if (v) $('#dbody').innerHTML = detailBody(v); root.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === st.dtab)); return; }
    if (act === 'rptM') { st.rptMonth = addMonthISO(st.rptMonth, parseInt(b.dataset.d, 10)); $('#dbody').innerHTML = detailBody(vehById(st.vsub)); return; }
    if (act === 'dutyM') { st.dutyMonth = addMonthISO(st.dutyMonth, parseInt(b.dataset.d, 10)); $('#dbody').innerHTML = detailBody(vehById(st.vsub)); return; }
    if (act === 'dutyEdit') { dutyEditForm(vehById(st.vsub), b.dataset.iso); return; }
    if (act === 'addLog') return logForm(st.vsub, b.dataset.c);
    if (act === 'delLog') { delSub(st.vsub, b.dataset.c, id); loadDetail(st.vsub); $('#dbody').innerHTML = detailBody(vehById(st.vsub)); toast('मिटाया'); return; }
    if (act === 'vBill') return billForm(vehById(id));
    if (act === 'vSlip') return slipForm(vehById(id));
    if (act === 'newBill') return pickVehicle();
    if (act === 'billTab') { st.billTab = b.dataset.t; render(); return; }
    if (act === 'regenInv') { const iv = invoices.find(x => x.id === id); if (iv) genInvoicePDF(iv); return; }
    if (act === 'regenSlip') { const sl = slips.find(x => x.id === id); if (sl) genSlipPDF(sl); return; }
    if (act === 'newSummary') return summaryForm();
    if (act === 'cashNew') return cashForm(b.dataset.d);
    if (act === 'cashQuick') return cashForm('out');
    if (act === 'cashPay') { const e = cash.find(x => x.id === id); if (e) cashPaySheet(e); return; }
    if (act === 'delCash') { const e = cash.find(x => x.id === id); if (e && e.linkedLog) { const v = vehById(e.linkedLog.vid); if (v && v.logs[e.linkedLog.col]) v.logs[e.linkedLog.col] = v.logs[e.linkedLog.col].filter(r => r.id !== e.linkedLog.id); } cash = cash.filter(x => x.id !== id); STORE.cash = cash; persist(); toast('मिटाया'); render(); return; }
  });
  $('#btnSet').onclick = () => openSettings();
  $('#btnSync').onclick = syncClick;
  $('#btnTheme').onclick = () => { const r = document.documentElement; const cur = r.getAttribute('data-theme'); const dark = cur ? cur === 'dark' : true; r.setAttribute('data-theme', dark ? 'light' : 'dark'); };

  function pickVehicle() { if (!vehicles.length) { toast('पहले गाड़ी जोड़ें'); return; }
    const opts = vehicles.map(v => ({ v: v.id, l: (v.number || '') + ' · ' + (v.model || '') }));
    openSheet({ title: 'गाड़ी चुनें', ok: 'आगे', fields: [{ k: 'vid', label: 'गाड़ी', type: 'select', val: opts[0].v, options: opts }], submit: o => { const v = vehById(o.vid); setTimeout(() => billForm(v), 120); } });
  }

  /* ---------------- boot ---------------- */
  loadLocal(); seedIfEmpty(); point(); migrate(); persist(true);
  if (drive) { drive.init(); drive.onChange(() => setSync()); setSync(); if (drive.isSignedIn()) syncNow(false); }
  render();
}
