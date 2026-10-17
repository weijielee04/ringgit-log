/* ================= constants ================= */
/* @prompts:begin */
const CATS = [
  { id: "food", label: "Food", icon: "food", hint: "Meals, drinks, groceries" },
  { id: "travel", label: "Travel", icon: "car", hint: "Toll, fuel, rides, transit" },
  { id: "parking", label: "Parking", icon: "parking", hint: "Office or on-site" },
  { id: "shopping", label: "Shopping", icon: "bag", hint: "Things you bought" },
  { id: "bills", label: "Bills", icon: "bolt", hint: "Utilities, phone, subscriptions" },
  { id: "other", label: "Other", icon: "dots", hint: "Anything else" }
];
const CAT = {};
CATS.forEach(function (c) { CAT[c.id] = c; });
/* @prompts:end */
const CAT_IDS = CATS.map(function (c) { return c.id; });
/* Stack order follows the chart palette's validated slot order, so neighbouring colours stay distinguishable. */
const STACK = ["travel", "food", "parking", "shopping", "bills", "other"];
const catColor = function (id) { return "var(--c-" + (CAT[id] ? id : "other") + ")"; };
const SOURCES = { tng: "TnG eWallet", cimb: "CIMB", bank: "Bank", receipt: "Receipt", manual: "Typed in", sheet: "Excel import", route: "Route estimate", waze: "Waze", gmaps: "Google Maps", other: "Other" };
const SUBS = { toll: "Toll", fuel: "Fuel", transit: "Public transport", ride: "E-hailing", other: "Other travel" };
const PARK_KINDS = { office: "Office", onsite: "On-site" };

/* @prompts:begin */
/* Class 1 (private car) toll reference used to ground route estimates. */
const TOLL_CHECKED = "11 Oct 2026";
const TOLL_FIXED = [
  ["LDP (E11)", "Penchala", 2.10], ["LDP (E11)", "Petaling Jaya", 2.10], ["LDP (E11)", "Puchong Jaya", 2.10], ["LDP (E11)", "Puchong Selatan", 2.10],
  ["SPRINT (E23)", "Damansara", 2.00], ["SPRINT (E23)", "Pantai (Kerinchi Link)", 2.50], ["SPRINT (E23)", "Bukit Kiara (Penchala Link)", 3.00],
  ["KESAS (E5)", "Awan Besar", 2.00], ["KESAS (E5)", "Awan Kecil", 2.00], ["KESAS (E5)", "Sunway", 2.00], ["KESAS (E5)", "Kemuning", 2.00],
  ["NPE (E10)", "Pantai Dalam", 2.30], ["NPE (E10)", "PJS 5", 2.30], ["NPE (E10)", "PJS 2", 1.00],
  ["DUKE (E33)", "Batu", 2.50], ["DUKE (E33)", "Sentul Pasar", 2.50], ["DUKE (E33)", "Ayer Panas", 2.50], ["DUKE (E33)", "Segambut", 2.50],
  ["SPE (E39)", "Setiawangsa", 3.50], ["SPE (E39)", "Ampang", 3.50], ["SPE (E39)", "Chan Sow Lin", 3.50],
  ["AKLEH (E12)", "Keramat", 2.13],
  ["MEX (E20)", "Salak Selatan", 2.00], ["MEX (E20)", "Seri Kembangan", 2.20], ["MEX (E20)", "Putrajaya", 3.50],
  ["BESRAYA (E9)", "Loke Yew", 1.85], ["BESRAYA (E9)", "Mines", 1.85],
  ["Cheras–Kajang / Grand Saga (E7)", "Batu 9", 1.30], ["Cheras–Kajang / Grand Saga (E7)", "Batu 11", 1.30],
  ["SILK (E18)", "Sungai Ramal", 1.66], ["SILK (E18)", "Sungai Long", 1.66], ["SILK (E18)", "Sungai Balak", 1.66], ["SILK (E18)", "Bukit Kajang", 1.66],
  ["Guthrie / GCE (E35)", "Bukit Jelutong", 1.75], ["Guthrie / GCE (E35)", "Elmina", 1.75], ["Guthrie / GCE (E35)", "Lagong", 1.75],
  ["LKSA (E13)", "Seri Muda", 1.56], ["LKSA (E13)", "Alam Impian", 0.83],
  ["SUKE (E19)", "Ampang", 2.30], ["SUKE (E19)", "Bukit Teratai", 2.30], ["SUKE (E19)", "Alam Damai", 2.30],
  ["DASH (E31)", "Denai Alam", 2.30], ["DASH (E31)", "RRIM (Kwasa Damansara)", 2.30], ["DASH (E31)", "Kota Damansara", 2.30],
  ["SMART (E38)", "SMART Tunnel", 3.00],
  ["LATAR (E25)", "Ijok", 2.50], ["LATAR (E25)", "Kuang Barat", 2.50], ["LATAR (E25)", "Kuang Timur", 2.50], ["LATAR (E25)", "Taman Rimba Templer", 2.50], ["LATAR (E25)", "Kundang Barat", 1.30], ["LATAR (E25)", "Kundang Timur", 1.30],
  ["KL–Karak (E8)", "Gombak", 6.00], ["KL–Karak (E8)", "Bentong", 3.50],
  ["North Klang Straits Bypass (E30)", "Kapar", 2.70], ["North Klang Straits Bypass (E30)", "Bukit Raja", 0.60],
  ["Seremban–Port Dickson (E29)", "Mambau", 2.62], ["Seremban–Port Dickson (E29)", "Lukut", 0.65],
  ["Penang Bridge (E36)", "Perai, mainland to island only", 5.74]
];
const TOLL_PER_KM = [
  ["PLUS network: North–South Expressway (E1, E2), NKVE (E1), ELITE (E6)", 0.112],
  ["LEKAS (E21) Kajang–Seremban", 0.167]
];
const TOLL_FARES = "Sungai Besi to Skudai about 33.30; Jalan Duta to Juru about 35.40; Sungai Besi to Ayer Keroh about 12.90; Karak to Kuantan (East Coast Expressway) about 19.60; LEKAS Kajang to Setul 7.80";
function tollText() {
  const by = {};
  TOLL_FIXED.forEach(function (t) { (by[t[0]] = by[t[0]] || []).push(t[1] + " " + t[2].toFixed(2)); });
  return [
    "Open system (a flat charge at each plaza passed):",
    Object.keys(by).map(function (r) { return "- " + r + ": " + by[r].join("; "); }).join("\n"),
    "Closed system (charged by distance between the entry and exit plaza):",
    TOLL_PER_KM.map(function (t) { return "- " + t[0] + ": about RM " + t[1].toFixed(3) + " per km"; }).join("\n"),
    "Known closed-system fares: " + TOLL_FARES + ".",
    "No toll: Federal Highway Route 2 (the Batu Tiga and Sungai Rasau tolls were abolished), MRR2 and ordinary city roads."
  ].join("\n");
}
/* @prompts:end */

/* ================= helpers ================= */
const NBSP = "\u00a0";
const pad2 = function (n) { return String(n).padStart(2, "0"); };
const ymd = function (d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
const todayStr = function () { return ymd(new Date()); };
const nowHM = function () { const d = new Date(); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };
const ymOf = function (s) { return String(s).slice(0, 7); };
const parseYMD = function (s) { const p = String(s).split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };
const isYMD = function (s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = parseYMD(s);
  return ymd(d) === s && d.getFullYear() > 1999 && d.getFullYear() < 2100;
};
const daysIn = function (ym) { const p = ym.split("-").map(Number); return new Date(p[0], p[1], 0).getDate(); };
const addMonths = function (ym, n) { const p = ym.split("-").map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + "-" + pad2(d.getMonth() + 1); };
const monthLabel = function (ym, short) { return new Intl.DateTimeFormat("en-MY", { month: short ? "short" : "long", year: "numeric" }).format(parseYMD(ym + "-01")); };
const monthShort = function (ym) { return new Intl.DateTimeFormat("en-MY", { month: "short" }).format(parseYMD(ym + "-01")); };
const dayLabel = function (s) { return new Intl.DateTimeFormat("en-MY", { weekday: "short", day: "numeric", month: "short" }).format(parseYMD(s)); };
const normTime = function (t) { const m = String(t || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return ""; const hh = Number(m[1]), mm = Number(m[2]); return hh < 24 && mm < 60 ? pad2(hh) + ":" + m[2] : ""; };
const cents = function (r) { return Math.round((Number(r.amount) || 0) * 100); };
const sumCents = function (list) { let s = 0; for (let i = 0; i < list.length; i++) s += cents(list[i]); return s; };
const fmtNum = function (c) { return (c / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const fmtRM = function (c) { return "RM" + NBSP + fmtNum(c); };
const fmtShort = function (c) { const v = c / 100; if (v >= 10000) return Math.round(v / 1000) + "k"; if (v >= 1000) return (v / 1000).toFixed(1) + "k"; if (v >= 100) return String(Math.round(v)); return v.toFixed(2); };
const fmtKm = function (n) { return (Math.round((Number(n) || 0) * 10) / 10).toLocaleString("en-MY") + NBSP + "km"; };
const fmtMins = function (m) { m = Math.round(Number(m) || 0); if (m < 60) return m + NBSP + "min"; const hh = Math.floor(m / 60), mm = m % 60; return hh + NBSP + "h" + (mm ? " " + mm + NBSP + "min" : ""); };
const newId = function () { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
const cx = function () { return Array.prototype.filter.call(arguments, Boolean).join(" "); };
const clone = function (o) { return JSON.parse(JSON.stringify(o)); };
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const cmpDesc = function (a, b) {
  const ka = a.date + (a.time || "00:00"), kb = b.date + (b.time || "00:00");
  return kb.localeCompare(ka) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
};
const isPdfFile = function (f) { return f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""); };
const fmtBytes = function (n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; };
function byCat(list) { const o = {}; CAT_IDS.forEach(function (c) { o[c] = 0; }); list.forEach(function (r) { o[CAT[r.cat] ? r.cat : "other"] += cents(r); }); return o; }
function byDay(list, ym) {
  const n = daysIn(ym), days = [];
  for (let i = 1; i <= n; i++) days.push({ d: i, date: ym + "-" + pad2(i), total: 0, parts: {}, recs: [] });
  list.forEach(function (r) {
    const day = days[Number(String(r.date).slice(8, 10)) - 1];
    if (!day) return;
    const c = cents(r), k = CAT[r.cat] ? r.cat : "other";
    day.total += c; day.parts[k] = (day.parts[k] || 0) + c; day.recs.push(r);
  });
  return days;
}
function minsBetween(a, b) { a = normTime(a); b = normTime(b); if (!a || !b) return null; let m = (Number(b.slice(0, 2)) * 60 + Number(b.slice(3))) - (Number(a.slice(0, 2)) * 60 + Number(a.slice(3))); if (m < 0) m += 1440; return m; }
function catLabel(r) {
  const c = CAT[r.cat] || CAT.other;
  if (r.cat === "parking") return "Parking · " + (PARK_KINDS[r.park && r.park.kind] || "On-site");
  if (r.cat === "travel" && r.sub && SUBS[r.sub] && r.sub !== "other") return "Travel · " + SUBS[r.sub];
  return c.label;
}

/* ================= change bus ================= */
const bus = {
  v: 0, subs: new Set(), queued: false,
  emit: function () {
    if (bus.queued) return;
    bus.queued = true;
    setTimeout(function () { bus.queued = false; bus.v++; bus.subs.forEach(function (f) { try { f(bus.v); } catch (e) {} }); }, 0);
  }
};

/* ================= storage =================
   The app keeps each month's records in memory and saves through one driver:
   - cloud: online storage from the platform file (the Claude host's database, or Supabase on the website);
   - local: this browser only, when no online storage is available. */
const STOP_CODES = { quota_exceeded: 1, invalid_argument: 1, not_granted: 1, revoked: 1, capability_disabled: 1, session_expired: 1 };
async function retrying(fn) {
  let tries = 0;
  for (;;) {
    try { return await fn(); }
    catch (e) {
      const code = e && e.code; tries++;
      if (code === "unavailable" && tries <= 1) { await sleep(300 + Math.random() * 500); continue; }
      if (code === "resource_exhausted" && tries <= 3) { await sleep(1200 * tries + Math.random() * 400); continue; }
      throw e;
    }
  }
}
async function runPool(list, work, onProgress) {
  const queue = list.slice(), failed = []; let done = 0;
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      try { await work(item); }
      catch (e) { failed.push({ rec: item, error: e }); if (e && STOP_CODES[e.code]) { queue.forEach(function (q) { failed.push({ rec: q, error: e }); }); queue.length = 0; } }
      done++; if (onProgress) onProgress(Math.min(done, list.length), list.length);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return failed;
}
function recordBody(rec) { const b = clone(rec); delete b.id; b.updatedAt = new Date().toISOString(); return b; }
const store = (function () {
  let mode = "loading", why = "";
  let drv = null;
  let settings = {}, settingsLoaded = false;
  const months = new Map();
  const wanted = new Set();
  const LS = "ringgit-log.v1";
  let local = null;
  let chain = Promise.resolve();

  function loadLocal() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { d = null; }
    if (!d || typeof d !== "object") d = {};
    local = { settings: d.settings && typeof d.settings === "object" ? d.settings : {}, recs: d.recs && typeof d.recs === "object" ? d.recs : {} };
  }
  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(local)); return true; } catch (e) { return false; } }
  function localMonth(ym) {
    const m = new Map();
    Object.keys(local.recs).forEach(function (id) { const r = local.recs[id]; if (r && typeof r.date === "string" && r.date.slice(0, 7) === ym) m.set(id, r); });
    return m;
  }
  function refreshLocal() { months.forEach(function (m, ym) { m.recs = localMonth(ym); m.loaded = true; }); }
  const fatal = function (code) { return code === "not_granted" || code === "capability_disabled" || code === "capability_removed"; };

  function goLocal(reason) {
    months.forEach(function (m) { if (m.timer) clearTimeout(m.timer); if (m.unsub) { try { m.unsub(); } catch (e) {} } });
    months.clear();
    mode = "local"; why = reason; drv = null;
    loadLocal(); settings = local.settings; settingsLoaded = true;
    Array.from(wanted).forEach(open);
    bus.emit();
  }
  function open(ym) {
    if (months.has(ym)) return;
    const m = { recs: new Map(), loaded: false, unsub: null, error: "", timer: null };
    months.set(ym, m);
    if (mode === "cloud") {
      try {
        m.unsub = drv.listen(ym, function (map, meta) {
          m.recs = map;
          if (meta && meta.fromCache && map.size === 0 && !m.loaded) {
            if (!m.timer) m.timer = setTimeout(function () { m.timer = null; if (!m.loaded) { m.loaded = true; bus.emit(); } }, 3500);
            return;
          }
          if (m.timer) { clearTimeout(m.timer); m.timer = null; }
          m.loaded = true; m.error = ""; bus.emit();
        }, function (code) {
          code = code || "unavailable";
          m.loaded = true; m.error = code; m.unsub = null;
          if (fatal(code)) { goLocal("denied"); return; }
          bus.emit();
        });
      } catch (e) { m.loaded = true; m.error = "invalid_argument"; }
    } else {
      m.recs = localMonth(ym); m.loaded = true;
    }
  }
  function watch(ym) {
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    wanted.add(ym);
    if (mode === "loading" || months.has(ym)) return;
    open(ym);
    if (mode === "local") bus.emit();   /* local months are ready at once; cloud months announce themselves */
  }
  function retry() {
    months.forEach(function (m, ym) { if (m.error) { if (m.unsub) { try { m.unsub(); } catch (e) {} } months.delete(ym); } });
    Array.from(wanted).forEach(open); bus.emit();
  }
  /* connect() resolves to { driver } for online storage, or { local: reason } to keep records in this browser. */
  async function init(connect) {
    let got = null;
    try { got = connect ? await connect() : null; } catch (e) { got = null; }
    if (!got || !got.driver) { goLocal((got && got.local) || "standalone"); return; }
    drv = got.driver; mode = "cloud";
    try {
      drv.watchSettings(function (s) { settings = s && typeof s === "object" ? s : {}; settingsLoaded = true; bus.emit(); },
        function (code) { settingsLoaded = true; if (fatal(code)) goLocal("denied"); else bus.emit(); });
    } catch (e) { settingsLoaded = true; }
    Array.from(wanted).forEach(open);
    bus.emit();
  }

  async function put(rec, quiet) {
    if (mode === "cloud") { await drv.put(rec); return; }
    if (mode === "local") {
      local.recs[rec.id] = Object.assign(recordBody(rec), { id: rec.id });
      if (quiet) return;
      if (!saveLocal()) throw { code: "quota_exceeded" };
      refreshLocal(); bus.emit(); return;
    }
    throw { code: "unavailable" };
  }
  async function remove(rec, quiet) {
    if (mode === "cloud") { await drv.remove(rec); return; }
    if (mode === "local") { delete local.recs[rec.id]; if (quiet) return; saveLocal(); refreshLocal(); bus.emit(); return; }
    throw { code: "unavailable" };
  }
  /* On the Claude host a record's month is part of where it is stored, so moving it to another month means a copy and a delete. */
  const moves = function (a, b) { return mode === "cloud" && !!drv.byMonthPath && ymOf(a.date) !== ymOf(b.date); };
  const batched = function () { return mode === "cloud" && !drv.byMonthPath && !!drv.putMany && !!drv.removeMany; };
  async function update(oldRec, newRec) {
    await put(newRec);
    if (moves(oldRec, newRec)) await remove(oldRec);
  }
  async function putMany(list, onProgress) {
    if (mode === "local") {
      list.forEach(function (r) { local.recs[r.id] = Object.assign(recordBody(r), { id: r.id }); });
      if (!saveLocal()) { list.forEach(function (r) { delete local.recs[r.id]; }); return list.map(function (r) { return { rec: r, error: { code: "quota_exceeded" } }; }); }
      refreshLocal(); bus.emit(); return [];
    }
    if (batched()) return drv.putMany(list, onProgress);
    return runPool(list, function (r) { return put(r); }, onProgress);
  }
  /* Spreadsheet imports: new records are added, rows with a Record ID replace the saved record (moving it if its month changed). */
  async function applyMany(ops, onProgress) {
    if (mode === "local") {
      const before = {};
      ops.forEach(function (o) { before[o.rec.id] = local.recs[o.rec.id]; local.recs[o.rec.id] = Object.assign(recordBody(o.rec), { id: o.rec.id }); });
      if (!saveLocal()) {
        Object.keys(before).forEach(function (id) { if (before[id]) local.recs[id] = before[id]; else delete local.recs[id]; });
        return ops.map(function (o) { return { rec: o.rec, error: { code: "quota_exceeded" } }; });
      }
      refreshLocal(); bus.emit(); return [];
    }
    if (batched()) return drv.putMany(ops.map(function (o) { return o.rec; }), onProgress);
    const failed = await runPool(ops, function (o) { return o.old ? update(o.old, o.rec) : put(o.rec); }, onProgress);
    return failed.map(function (f) { return { rec: f.rec.rec, error: f.error }; });
  }
  async function undoMany(ops) {
    if (mode === "local") {
      ops.forEach(function (o) { if (o.old) local.recs[o.old.id] = Object.assign(recordBody(o.old), { id: o.old.id }); else delete local.recs[o.rec.id]; });
      saveLocal(); refreshLocal(); bus.emit(); return [];
    }
    if (batched()) {
      const a = await drv.removeMany(ops.filter(function (o) { return !o.old; }).map(function (o) { return o.rec; }));
      const b = await drv.putMany(ops.filter(function (o) { return o.old; }).map(function (o) { return o.old; }));
      return a.concat(b);
    }
    return runPool(ops, async function (o) {
      if (!o.old) { await remove(o.rec); return; }
      await put(o.old);
      if (moves(o.old, o.rec)) await remove(o.rec);
    });
  }
  async function removeMany(list) {
    if (mode === "local") { list.forEach(function (r) { delete local.recs[r.id]; }); saveLocal(); refreshLocal(); bus.emit(); return []; }
    if (batched()) return drv.removeMany(list);
    return runPool(list, function (r) { return remove(r); });
  }
  function saveSettings(patch) {
    settings = Object.assign({}, settings, patch); bus.emit();
    if (mode === "cloud") {
      const snap = clone(settings);
      chain = chain.then(function () { return drv.saveSettings(snap); }).catch(function () {});
      return chain;
    }
    if (mode === "local") { local.settings = settings; saveLocal(); }
    return Promise.resolve();
  }
  const exampleMonths = function () { return Array.isArray(settings.exampleMonths) ? settings.exampleMonths.filter(function (s) { return /^\d{4}-\d{2}$/.test(s); }) : []; };
  async function clearExamples() {
    const list = exampleMonths();
    if (mode === "cloud") { if (drv.clearExamples) await drv.clearExamples(list); }
    else if (mode === "local") {
      Object.keys(local.recs).forEach(function (id) { if (local.recs[id] && local.recs[id].example) delete local.recs[id]; });
      saveLocal(); refreshLocal();
    }
    await saveSettings({ exampleMonths: [] });
  }
  function whenLoaded(yms, ms) {
    yms.forEach(watch);
    return new Promise(function (resolve) {
      const t0 = Date.now();
      (function poll() { if (yms.every(isLoaded) || Date.now() - t0 > ms) resolve(); else setTimeout(poll, 120); })();
    });
  }
  function isLoaded(ym) { const m = months.get(ym); return !!(m && m.loaded); }
  return {
    init: init, watch: watch, retry: retry,
    refresh: function () { if (mode === "cloud" && drv.refresh) drv.refresh(); },
    recs: function (ym) { const m = months.get(ym); return m ? Array.from(m.recs.values()) : []; },
    loaded: isLoaded,
    errorOf: function (ym) { const m = months.get(ym); return m ? m.error : ""; },
    mode: function () { return mode; }, why: function () { return why; },
    settings: function () { return settings; }, settingsLoaded: function () { return settingsLoaded; },
    officePlaces: function () { return Array.isArray(settings.officePlaces) ? settings.officePlaces.filter(function (s) { return typeof s === "string" && s.trim(); }) : []; },
    put: put, update: update, remove: remove, putMany: putMany, removeMany: removeMany, applyMany: applyMany, undoMany: undoMany,
    saveSettings: saveSettings, hasExamples: function () { return exampleMonths().length > 0; }, clearExamples: clearExamples, whenLoaded: whenLoaded
  };
})();

/* ================= optional capabilities: receipt files and file saving =================
   assets: upload(blob, {type}) -> {id}, delete(id), list() -> {usage}; downloads: save({filename, data});
   fileUrl(id): the address of a kept file, as a string or a promise of one. */
const caps = { assets: null, downloads: null, fileUrl: null };
async function initCaps(connect) {
  let got = null;
  try { got = connect ? await connect() : null; } catch (e) { got = null; }
  got = got || {};
  caps.assets = got.assets || null; caps.downloads = got.downloads || null; caps.fileUrl = got.fileUrl || null;
  bus.emit();
}

/* ================= asking Claude to read things =================
   Callers describe the job ({task: "extract" | "route" | "shot", ...}). On the Claude host the prompt is
   built here and sent with the page's own Claude access; on the website the job goes to the read Edge
   Function, which builds the same prompt on the server. */
const ai = (function () {
  let fn = null, lim = null, state = "loading", why = "", serverPrompts = false;
  /* connect() resolves to { fn, limits, serverPrompts } when reading is available, or { off: reason }. */
  async function init(connect) {
    let got = null;
    try { got = connect ? await connect() : null; } catch (e) { got = null; }
    if (!got || typeof got.fn !== "function") { fn = null; state = "off"; why = (got && got.off) || "unavailable"; bus.emit(); return; }
    fn = got.fn; lim = got.limits || null; serverPrompts = !!got.serverPrompts; state = "ready"; bus.emit();
  }
  function promptOf(task) {
    if (typeof task === "string") return task;
    if (task.task === "extract") return extractPrompt(task.ctx, task.part);
    if (task.task === "route") return routePrompt(task.from, task.to);
    if (task.task === "shot") return shotPrompt(task.count);
    throw { code: "bad_request", message: "unknown task" };
  }
  function looseJSON(text) {
    const t = String(text || "").trim();
    try { return JSON.parse(t); } catch (e) {}
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) { try { return JSON.parse(fence[1]); } catch (e) {} }
    const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    throw { code: "invalid_json", message: "no JSON in reply", text: t };
  }
  async function viaText(input, opts) { const r = await fn(input, opts); return looseJSON(r.text); }
  async function json(task, o) {
    if (!fn) throw { code: "capability_disabled" };
    o = o || {};
    const opts = {};
    if (o.images && o.images.length) opts.images = o.images;
    if (o.signal) opts.signal = o.signal;
    if (o.tier) opts.modelTier = o.tier;
    if (o.fresh) opts.cache = false;
    if (o.onText) opts.onText = o.onText;
    const input = serverPrompts ? task : promptOf(task);
    try {
      if (typeof fn.json === "function") return await fn.json(input, opts);
      return await viaText(input, opts);
    } catch (e) {
      const code = e && e.code;
      if (code === "capability_removed") return await viaText(input, opts);
      if (code === "not_granted" || code === "sampling_disabled" || code === "not_declared" || code === "capability_disabled" || code === "not_configured") { state = "off"; why = code; bus.emit(); }
      throw e;
    }
  }
  return {
    init: init, json: json,
    ready: function () { return state === "ready"; }, loading: function () { return state === "loading"; }, why: function () { return why; },
    canImages: function () { return !!(lim && lim.images); },
    maxImages: function () { return (lim && lim.images && lim.images.maxCount) || 1; }
  };
})();
function aiOffText() {
  const w = ai.why();
  if (w === "not_granted") return "Automatic reading was declined for this visit, so details need typing in. Reload the page to be asked again.";
  if (w === "sampling_disabled") return "Claude isn't available for this account, so details need typing in.";
  if (w === "not_configured") return "Automatic reading isn't set up on this site yet, so details need typing in.";
  if (PLATFORM.web) return "Automatic reading isn't available right now, so details need typing in. Reload the page to try again.";
  return "Automatic reading isn't available in this view, so details need typing in.";
}
function readErrorText(e) {
  switch (e && e.code) {
    case "not_granted": case "sampling_disabled": case "not_declared": case "capability_disabled": case "capability_removed": case "not_configured": return aiOffText();
    case "daily_limit": return "You've used today's automatic readings for this account. Type the details in, or read it again tomorrow.";
    case "site_limit": return "This site has used up today's automatic readings. Type the details in, or read it again tomorrow.";
    case "bad_request": return "That couldn't be sent for reading. Try again, or type the details in.";
    case "images_unavailable": return "This view can't send pictures to Claude. Upload a PDF with selectable text, or type the details in.";
    case "rate_limited": return "Claude is busy, or you've reached a usage limit. Wait a little and try again.";
    case "session_expired": return "Your sign-in has expired. Reload the page, sign in and try again.";
    case "image_rejected": return "That picture couldn't be used. It may be too large or in an unsupported format. Try a screenshot instead.";
    case "image_unreadable": return "That picture couldn't be opened in this browser. Try a screenshot or a JPG or PNG copy.";
    case "refused": return "Claude declined to read this file. Type the details in instead.";
    case "prompt_too_large": return "This file has too much text to read in one go. Split the PDF and upload fewer pages at a time.";
    case "empty_completion": case "invalid_json": return "The reading came back garbled. Try again, or type the details in.";
    case "pdf_engine": return "The PDF reader couldn't be loaded. Check your connection, or upload screenshots of the pages instead.";
    case "pdf_unreadable": return "That PDF couldn't be opened. It may be damaged. Try screenshots of the pages instead.";
    case "nothing_found": return "No transactions could be found in that file. Check it's the right one, or type the details in.";
    default: return "Something went wrong while reading. Try again.";
  }
}
function saveErrorText(e) {
  switch (e && e.code) {
    case "quota_exceeded": return "Storage is full. Delete some old records or receipt photos, then try again.";
    case "resource_exhausted": return "Too many saves at once. Wait a moment and try again.";
    case "invalid_argument": return PLATFORM.web ? "Some details couldn't be saved. Check the date, amount and text, then try again." : "This couldn't be saved here. You may not have permission to add records on this page.";
    case "not_granted": case "revoked": case "capability_disabled": return PLATFORM.web ? "This account isn't allowed to change that. Sign out, sign in again and retry." : "Saving isn't allowed in this view.";
    case "session_expired": return "Your sign-in has expired. Sign in again, then try once more.";
    default: return "Couldn't save. Check your connection and try again.";
  }
}

/* ================= pictures ================= */
function canvasBlob(canvas, type, q) {
  return new Promise(function (res, rej) { canvas.toBlob(function (b) { if (b) res(b); else rej({ code: "image_unreadable" }); }, type || "image/jpeg", q || 0.9); });
}
async function decodeImage(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) {}
    try { return await createImageBitmap(file); } catch (e) {}
  }
  return await new Promise(function (res, rej) {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = function () { URL.revokeObjectURL(url); res(img); };
    img.onerror = function () { URL.revokeObjectURL(url); rej({ code: "image_unreadable" }); };
    img.src = url;
  });
}
const dimsOf = function (s) { return { w: s.naturalWidth || s.width, h: s.naturalHeight || s.height }; };
/* Claude sees each picture at about 1.2 megapixels, so tall or dense pictures are cut into horizontal bands
   (rows stay intact) to keep small print legible. */
function tilePlan(w, h, maxTiles) {
  const MP = 1.15e6, px = w * h;
  const n = Math.max(1, Math.min(maxTiles || 1, Math.ceil(px / (MP * 1.12))));
  const scale = Math.min(1, Math.sqrt((n * MP) / px));
  const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
  const band = H / n, pad = n > 1 ? band * 0.035 : 0, bands = [];
  for (let i = 0; i < n; i++) bands.push([Math.max(0, Math.floor(i * band - pad)), Math.min(H, Math.ceil((i + 1) * band + pad))]);
  return { n: n, scale: scale, W: W, H: H, bands: bands };
}
async function tilesFrom(src, maxTiles) {
  const d = dimsOf(src);
  if (!d.w || !d.h) throw { code: "image_unreadable" };
  const plan = tilePlan(d.w, d.h, maxTiles), out = [];
  for (let i = 0; i < plan.bands.length; i++) {
    const a = plan.bands[i][0], b = plan.bands[i][1];
    const c = document.createElement("canvas"); c.width = plan.W; c.height = b - a;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, a / plan.scale, d.w, (b - a) / plan.scale, 0, 0, plan.W, b - a);
    out.push(await canvasBlob(c, "image/jpeg", 0.9));
  }
  return out;
}
async function archiveCopy(file) {
  const src = await decodeImage(file), d = dimsOf(src), k = Math.min(1, 1600 / Math.max(d.w, d.h));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(d.w * k)); c.height = Math.max(1, Math.round(d.h * k));
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
  return await canvasBlob(c, "image/jpeg", 0.78);
}

/* ================= PDFs (read in this browser; pages are only sent to Claude when you press Read) ================= */
const PDF_BASE = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/";
let pdfLib = null;
async function loadPdf() {
  if (pdfLib) return pdfLib;
  let got;
  try { got = await Promise.all([import(PDF_BASE + "pdf.min.mjs"), import(PDF_BASE + "pdf.worker.min.mjs")]); }
  catch (e) { throw { code: "pdf_engine" }; }
  globalThis.pdfjsWorker = got[1];   /* run the parser on this thread; no separate worker file needed */
  pdfLib = got[0];
  return pdfLib;
}
async function openPdf(file, password) {
  const lib = await loadPdf();
  const data = new Uint8Array(await file.arrayBuffer());
  const params = { data: data, useWasm: false, useWorkerFetch: false, isOffscreenCanvasSupported: false, isImageDecoderSupported: false, isEvalSupported: false, disableFontFace: true, verbosity: 0 };
  if (password) params.password = password;
  try { return await lib.getDocument(params).promise; }
  catch (e) {
    if (e && e.name === "PasswordException") throw { code: e.code === 2 ? "pdf_wrong_password" : "pdf_password" };
    throw { code: "pdf_unreadable" };
  }
}
/* Rebuild each page's text with columns kept roughly aligned, so withdrawals and deposits stay tellable apart. */
function layoutText(items) {
  items = items.filter(function (it) { return it && typeof it.str === "string" && it.str.trim() && it.transform; });
  if (!items.length) return "";
  const widths = items.map(function (it) { return it.width / Math.max(1, it.str.length); }).filter(function (v) { return v > 0.5; }).sort(function (a, b) { return a - b; });
  const cw = widths.length ? widths[Math.floor(widths.length / 2)] : 5;
  const minX = Math.min.apply(null, items.map(function (it) { return it.transform[4]; }));
  items.sort(function (p, q) { return (q.transform[5] - p.transform[5]) || (p.transform[4] - q.transform[4]); });
  const lines = []; let cur = null;
  items.forEach(function (it) {
    const y = it.transform[5], hh = it.height || Math.abs(it.transform[3]) || 8;
    if (!cur || Math.abs(cur.y - y) > Math.max(2, hh * 0.5)) { cur = { y: y, parts: [] }; lines.push(cur); }
    cur.parts.push(it);
  });
  return lines.map(function (ln) {
    ln.parts.sort(function (a, b) { return a.transform[4] - b.transform[4]; });
    let s = "", prevEnd = null;
    ln.parts.forEach(function (it) {
      const x = it.transform[4], col = Math.round((x - minX) / cw);
      if (prevEnd !== null && x - prevEnd < cw * 0.3) { /* touching fragments of one word or number */ }
      else if (s.length < col) s += " ".repeat(Math.min(col - s.length, 60));
      else if (s && !/\s$/.test(s)) s += " ";
      s += it.str; prevEnd = x + (it.width || 0);
    });
    return s.replace(/\s+$/, "");
  }).join("\n");
}
async function pageCanvas(page) {
  const v1 = page.getViewport({ scale: 1 });
  const scale = Math.min(3, Math.sqrt(2.3e6 / Math.max(1, v1.width * v1.height)));
  const vp = page.getViewport({ scale: scale });
  const c = document.createElement("canvas"); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  await page.render({ canvas: c, viewport: vp }).promise;
  return c;
}
function chunkPages(texts, maxChars) {
  const chunks = []; let cur = null;
  const push = function (text, from, to) { chunks.push({ text: text, from: from, to: to }); };
  texts.forEach(function (t, i) {
    const pageNo = i + 1;
    if (t.length > maxChars) {
      if (cur) { push(cur.text, cur.from, cur.to); cur = null; }
      const lines = t.split("\n"); let buf = "";
      lines.forEach(function (ln) { if (buf.length + ln.length + 1 > maxChars && buf) { push(buf, pageNo, pageNo); buf = ""; } buf += (buf ? "\n" : "") + ln; });
      if (buf) push(buf, pageNo, pageNo);
      return;
    }
    if (cur && cur.text.length + t.length + 20 > maxChars) { push(cur.text, cur.from, cur.to); cur = null; }
    if (!cur) cur = { text: "", from: pageNo, to: pageNo };
    cur.text += (cur.text ? "\n\n--- page " + pageNo + " ---\n" : "") + t; cur.to = pageNo;
  });
  if (cur && cur.text.trim()) push(cur.text, cur.from, cur.to);
  return chunks;
}

/* ================= prompts ================= */
/* @prompts:begin */
function extractPrompt(ctx, part) {
  let typeLine;
  if (ctx.type === "mixed") typeLine = "a statement or transaction history with different kinds of spending. Pick the best \"cat\" for each row.";
  else if (ctx.type === "parking") typeLine = "parking (" + (ctx.parkKind === "office" ? "at the user's office" : "on-site, away from the office") + "). Use cat \"parking\" for every expense row.";
  else typeLine = CAT[ctx.type].label.toLowerCase() + " spending. Use cat \"" + ctx.type + "\" for every expense row.";
  let what;
  if (part.mode === "text") what = "Below, between the lines BEGIN and END, is text extracted from a PDF (" + part.label + "). Columns are kept roughly aligned with spaces, so use the column headers to tell money going out from money coming in.";
  else if (part.count > 1) what = "The " + part.count + " attached images are consecutive slices of ONE picture or page, top to bottom, with a small overlap. A row that appears at the edge of two slices is the same row: list it once.";
  else what = "The attached image is a photo or screenshot of a receipt, a transaction history or a statement page.";
  const lines = [
    "You are reading a financial document for a personal expense tracker used in Malaysia. Amounts are in Malaysian ringgit (RM / MYR).",
    "",
    "The user says this upload is: " + typeLine,
    "Today is " + todayStr() + " (Malaysia time)." + (part.period ? " The statement period is " + part.period + "." : ""),
    "",
    what,
    "",
    "List every money transaction shown, one entry each. For a single shop, parking or toll receipt, return ONE entry using the final total actually paid (after tax, service charge, rounding and discounts), not the line items.",
    "",
    "Fields for each entry:",
    "- \"date\": \"YYYY-MM-DD\". Dates are day-first (03/10/2026 is 3 October 2026). If the year is missing, use the statement period, otherwise the most recent such date that is not after today. If no date is shown at all, use \"\".",
    "- \"time\": \"HH:MM\" in 24-hour time, or \"\" if not shown.",
    "- \"merchant\": the merchant, payee or a short description, tidied up, at most 60 characters.",
    "- \"amount\": a positive number in RM.",
    "- \"kind\": \"expense\" for money spent (purchases, toll, parking, fuel, bills, fees, payments or transfers to someone else); \"topup\" for eWallet reloads and transfers between the user's own accounts; \"income\" for money received (salary, transfers in, cashback, interest); \"refund\" for refunds and reversals.",
    "- \"cat\": \"food\" (meals, drinks, groceries), \"travel\" (toll, fuel, public transport, e-hailing, flights), \"parking\", \"shopping\", \"bills\" (utilities, phone, internet, subscriptions, insurance, loans) or \"other\".",
    "- \"sub\": only when cat is \"travel\": \"toll\", \"fuel\", \"transit\", \"ride\" or \"other\". Otherwise \"\".",
    "- \"park\": only when cat is \"parking\": {\"location\": the site or building, \"operator\": the parking company or council if shown, \"entry\": \"HH:MM\" or \"\", \"exit\": \"HH:MM\" or \"\", \"mins\": minutes parked or null}. Otherwise null.",
    "- \"sure\": false if the date, amount or merchant was hard to read or partly guessed, otherwise true.",
    "",
    "Also return \"source\": \"tng\" (Touch 'n Go eWallet or card), \"cimb\" (CIMB account or card), \"bank\" (another bank or card), \"receipt\" (a merchant receipt or invoice) or \"other\"; and \"period\": \"YYYY-MM-DD..YYYY-MM-DD\" if a statement period is shown, otherwise \"\".",
    "",
    "Never invent rows. Skip balances, opening and closing balance lines, subtotals, page headers and adverts. If nothing can be read, return an empty \"rows\" array.",
    "",
    "Reply with only this JSON object and nothing else:",
    "{\"source\":\"receipt\",\"period\":\"\",\"rows\":[{\"date\":\"2026-10-03\",\"time\":\"12:45\",\"merchant\":\"Nasi Kandar Pelita\",\"amount\":14.5,\"kind\":\"expense\",\"cat\":\"food\",\"sub\":\"\",\"park\":null,\"sure\":true}]}"
  ];
  if (part.mode === "text") lines.push("", "BEGIN", part.text, "END");
  return lines.join("\n");
}
function routePrompt(from, to) {
  return [
    "You are helping a driver in Malaysia estimate a car trip for an expense log.",
    "From: " + JSON.stringify(from),
    "To: " + JSON.stringify(to),
    "Vehicle: Class 1 private car.",
    "",
    "Give up to 3 realistic one-way driving routes that a navigation app would offer, fastest first. Include a toll-free route when a sensible one exists. For each route:",
    "- \"name\": a short label such as \"via NKVE and LDP\" or \"Toll-free via Jalan Kuching\".",
    "- \"roads\": the main roads in order, with route numbers where known, e.g. [\"E1 NKVE\", \"E11 LDP\"].",
    "- \"km\": driving distance.",
    "- \"mins\": typical driving time outside rush hour. \"mins_peak\": at weekday rush hour.",
    "- \"tolls\": every toll charge on the way, in order, as {\"plaza\", \"road\", \"rm\"}. For open-system plazas use the amount in the reference below. For a closed-system stretch give one entry named \"Entry plaza to Exit plaza\" priced at the per-km rate times the distance driven on that highway. Use [] when the route has no toll.",
    "- \"note\": one short caution if it matters (for example a road that floods or closes), otherwise \"\".",
    "",
    "Toll reference, Class 1, in RM (checked " + TOLL_CHECKED + "):",
    tollText(),
    "",
    "These are estimates from general knowledge, not live map data, so do not claim precision you do not have. If a place is ambiguous or you do not recognise it, still give your best estimate, set \"confidence\" to \"low\" and put what would pin it down in \"question\". Otherwise set \"confidence\" to \"medium\" and \"question\" to \"\".",
    "",
    "Reply with only this JSON object and nothing else:",
    "{\"from\":\"start as you understood it\",\"to\":\"destination as you understood it\",\"confidence\":\"medium\",\"question\":\"\",\"routes\":[{\"name\":\"via …\",\"roads\":[\"E1 NKVE\"],\"km\":24.5,\"mins\":30,\"mins_peak\":50,\"tolls\":[{\"plaza\":\"Jalan Duta\",\"road\":\"NKVE\",\"rm\":2.1}],\"note\":\"\"}]}"
  ].join("\n");
}
function shotPrompt(count) {
  return [
    (count > 1 ? "The " + count + " attached images are consecutive slices of ONE screenshot, top to bottom, with a small overlap." : "The attached image is a screenshot.") + " It comes from a navigation app (Waze, Google Maps or similar) showing a driving route in Malaysia.",
    "Read what the screenshot shows. Do not guess a value that is visible on screen.",
    "",
    "Return every route option shown, with the highlighted or selected one first. For each:",
    "- \"name\": the route label as shown (for example \"via E1\"), or a short label of your own.",
    "- \"roads\": road names or numbers shown for the route, if any.",
    "- \"km\": the distance shown (convert metres to km). \"mins\": the travel time shown, in minutes.",
    "- \"toll_shown\": true if the app shows a toll price for this route (or says it has no tolls). \"toll_rm\": that price, 0 for no tolls, or null if not shown.",
    "- \"tolls\": [] unless plaza names are visible. If the app shows no toll price but the route clearly uses a tolled highway, estimate the tolls from the reference below, list them as {\"plaza\", \"road\", \"rm\"} and set \"toll_estimated\" to true.",
    "- \"note\": \"\" unless something on screen matters (for example a closure warning).",
    "Also return \"from\" and \"to\" place names if they are visible (otherwise \"\"), and \"app\": \"waze\", \"google_maps\" or \"other\".",
    "",
    "Toll reference, Class 1, in RM (checked " + TOLL_CHECKED + "):",
    tollText(),
    "",
    "Reply with only this JSON object and nothing else:",
    "{\"app\":\"waze\",\"from\":\"\",\"to\":\"\",\"routes\":[{\"name\":\"via E1\",\"roads\":[],\"km\":24.5,\"mins\":32,\"toll_shown\":true,\"toll_rm\":4.2,\"toll_estimated\":false,\"tolls\":[],\"note\":\"\"}]}"
  ].join("\n");
}

/* @prompts:end */

/* ================= turning replies into rows ================= */
function toNumber(v) { const n = Number(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : NaN; }
function guessParkKind(text, places) { const t = String(text || "").toLowerCase(); return places.some(function (p) { return p && t.indexOf(p.toLowerCase()) >= 0; }) ? "office" : "onsite"; }
function blankPark(kind) { return { kind: kind || "onsite", location: "", operator: "", entry: "", exit: "", mins: null }; }
function normRow(r, ctx, fileIndex) {
  if (!r || typeof r !== "object") return null;
  let amount = toNumber(r.amount);
  if (!isFinite(amount)) return null;
  amount = Math.round(Math.abs(amount) * 100) / 100;
  if (amount <= 0 || amount > 1e7) return null;
  let sure = r.sure !== false;
  let date = String(r.date || "").slice(0, 10);
  if (!isYMD(date)) { date = isYMD(ctx.fallbackDate) ? ctx.fallbackDate : todayStr(); sure = false; }
  const kind = ["expense", "topup", "income", "refund"].indexOf(r.kind) >= 0 ? r.kind : "expense";
  let cat = CAT[r.cat] ? r.cat : "other";
  if (ctx.type !== "mixed" && CAT[ctx.type]) cat = ctx.type;
  const merchant = String(r.merchant || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const row = { key: newId(), on: kind === "expense", date: date, time: normTime(r.time), merchant: merchant || CAT[cat].label, amount: amount, kind: kind, cat: cat, sub: "", park: null, sure: sure, dup: false, file: fileIndex };
  if (cat === "travel") row.sub = SUBS[r.sub] ? r.sub : "other";
  if (cat === "parking") {
    const p = r.park && typeof r.park === "object" ? r.park : {};
    const location = String(p.location || "").trim().slice(0, 80), operator = String(p.operator || "").trim().slice(0, 60);
    const entry = normTime(p.entry), exit = normTime(p.exit);
    let mins = toNumber(p.mins); mins = isFinite(mins) && mins > 0 && mins < 60 * 24 * 40 ? Math.round(mins) : null;
    if (mins == null) mins = minsBetween(entry, exit);
    row.park = { kind: ctx.parkKind || guessParkKind(location + " " + merchant, ctx.places || []), location: location, operator: operator, entry: entry, exit: exit, mins: mins };
  }
  return row;
}
function salvageRows(text) {
  const out = [], re = /\{(?:[^{}]|\{[^{}]*\})*\}/g; let m;
  const body = String(text || "");
  const start = body.indexOf("\"rows\"");
  const src = start >= 0 ? body.slice(start) : body;
  while ((m = re.exec(src))) { try { const o = JSON.parse(m[0]); if (o && o.amount != null && o.date) out.push(o); } catch (e) {} }
  return out;
}
function markDuplicates(rows) {
  const used = new Set();
  const byMonth = {};
  rows.forEach(function (r) { r.dup = false; (byMonth[ymOf(r.date)] = byMonth[ymOf(r.date)] || []).push(r); });
  Object.keys(byMonth).forEach(function (ym) {
    const existing = store.recs(ym).filter(function (e) { return !e.example; });
    existing.forEach(function (e) {
      const cand = byMonth[ym].filter(function (r) { return !used.has(r.key) && r.date === e.date && Math.round(r.amount * 100) === cents(e); });
      if (!cand.length) return;
      const pick = cand.find(function (r) { return r.time && r.time === e.time; }) || cand[0];
      used.add(pick.key); pick.dup = true; pick.on = false;
    });
  });
  return rows;
}

/* Reads every file and returns review rows. Each call to Claude covers one picture, one page or one chunk of text. */
async function extractAll(files, ctx, hooks) {
  const maxImg = Math.max(1, Math.min(4, ai.maxImages()));
  const jobs = [], out = { rows: [], source: "", period: "", problems: [] };
  for (let f = 0; f < files.length; f++) {
    const file = files[f];
    if (hooks.signal.aborted) throw { code: "cancelled" };
    if (isPdfFile(file)) {
      hooks.onStage("Opening " + file.name + "…");
      let pdf;
      try { pdf = await openPdf(file, hooks.passwords[f]); } catch (e) { e.file = f; throw e; }
      const total = pdf.numPages, take = Math.min(total, 40), texts = [];
      for (let p = 1; p <= take; p++) {
        const page = await pdf.getPage(p);
        let t = "";
        try { t = layoutText((await page.getTextContent()).items); } catch (e) { t = ""; }
        texts.push(t);
      }
      const joined = texts.join("\n");
      const usable = joined.replace(/\s/g, "").length > 120 && /\d[.,]\d{2}(?!\d)/.test(joined);
      if (total > take) out.problems.push(file.name + " has " + total + " pages; only the first " + take + " were read.");
      if (usable) {
        const chunks = chunkPages(texts, 7000);
        chunks.forEach(function (ch, i) {
          jobs.push({ file: f, label: file.name + (chunks.length > 1 ? " · part " + (i + 1) + " of " + chunks.length : ""), mode: "text", text: ch.text, partLabel: (ch.from === ch.to ? "page " + ch.from : "pages " + ch.from + " to " + ch.to) + " of " + total });
        });
      } else {
        if (!ai.canImages()) throw { code: "images_unavailable" };
        const pages = Math.min(take, 12);
        if (take > pages) out.problems.push(file.name + " is a scanned PDF; only the first " + pages + " pages were read.");
        for (let p = 1; p <= pages; p++) {
          hooks.onStage("Preparing " + file.name + " · page " + p + " of " + pages + "…");
          const page = await pdf.getPage(p);
          const canvas = await pageCanvas(page);
          const tiles = await tilesFrom(canvas, Math.min(2, maxImg));
          jobs.push({ file: f, label: file.name + (pages > 1 ? " · page " + p + " of " + pages : ""), mode: "image", images: tiles });
        }
      }
      try { pdf.destroy(); } catch (e) {}
    } else {
      if (!ai.canImages()) throw { code: "images_unavailable" };
      hooks.onStage("Preparing " + file.name + "…");
      const src = await decodeImage(file);
      const tiles = await tilesFrom(src, maxImg);
      if (src.close) { try { src.close(); } catch (e) {} }
      jobs.push({ file: f, label: file.name, mode: "image", images: tiles });
    }
  }
  if (!jobs.length) throw { code: "nothing_found" };

  let found = 0, done = 0, firstError = null;
  async function run(job) {
    if (hooks.signal.aborted) throw { code: "cancelled" };
    const part = job.mode === "text" ? { mode: "text", text: job.text, label: job.partLabel, period: out.period } : { mode: "image", count: job.images.length, period: out.period };
    let seen = 0;
    const opts = { signal: hooks.signal, fresh: hooks.fresh, onText: function (u) { const n = (u.text.match(/"amount"/g) || []).length; if (n > seen) { found += n - seen; seen = n; hooks.onFound(found); } } };
    if (job.mode === "image") opts.images = job.images;
    let reply = null, rowsRaw = [];
    try { reply = await ai.json({ task: "extract", ctx: { type: ctx.type, parkKind: ctx.parkKind || "" }, part: part }, opts); }
    catch (e) {
      if (e && e.code === "cancelled") throw e;
      if (e && e.code === "invalid_json" && e.text) { rowsRaw = salvageRows(e.text); if (!rowsRaw.length) throw e; out.problems.push(job.label + " was cut short; some rows may be missing."); }
      else throw e;
    }
    if (reply && typeof reply === "object") {
      if (Array.isArray(reply)) rowsRaw = reply;
      else {
        if (Array.isArray(reply.rows)) rowsRaw = reply.rows;
        if (!out.source && typeof reply.source === "string" && SOURCES[reply.source]) out.source = reply.source;
        if (!out.period && typeof reply.period === "string" && /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(reply.period)) out.period = reply.period;
      }
    }
    const rows = rowsRaw.map(function (r) { return normRow(r, ctx, job.file); }).filter(Boolean);
    job.rows = rows;
    if (rows.length > seen) { found += rows.length - seen; hooks.onFound(found); }
  }
  let halted = false;
  const fatalCodes = { cancelled: 1, not_granted: 1, sampling_disabled: 1, not_declared: 1, capability_disabled: 1, session_expired: 1, images_unavailable: 1, not_configured: 1 };
  async function guarded(job) {
    if (halted) return;
    hooks.onStage("Reading " + job.label + "…");
    try { await run(job); }
    catch (e) {
      const code = e && e.code;
      if (fatalCodes[code]) throw e;
      if (code === "rate_limited" || code === "daily_limit" || code === "site_limit") {
        /* keep what was already read instead of throwing the whole upload away */
        if (!jobs.some(function (j) { return j.rows && j.rows.length; })) throw e;
        if (!halted) out.problems.push(code === "rate_limited" ? "Reading stopped early because Claude is busy or a usage limit was reached. The remaining parts were not read." : "Reading stopped early because today's automatic readings are used up. The remaining parts were not read.");
        halted = true; job.rows = []; return;
      }
      if (!firstError) firstError = e;
      out.problems.push(job.label + " couldn't be read.");
      job.rows = [];
    }
    done++;
    if (done < jobs.length && !halted) hooks.onStage("Read " + done + " of " + jobs.length + " parts…");
  }
  await guarded(jobs[0]);                       /* the first part also tells us the source and statement period */
  const rest = jobs.slice(1);
  async function worker() { while (rest.length && !halted) { await guarded(rest.shift()); } }
  await Promise.all([worker(), worker()]);

  const seenKeys = new Set();
  jobs.forEach(function (job) {
    (job.rows || []).forEach(function (r) {
      const k = r.time ? [r.date, r.time, Math.round(r.amount * 100), r.merchant.toLowerCase()].join("|") : "";
      if (k && seenKeys.has(k)) return;        /* the same timed row caught in two overlapping screenshots */
      if (k) seenKeys.add(k);
      out.rows.push(r);
    });
  });
  if (!out.rows.length) throw firstError || { code: "nothing_found" };
  out.rows.sort(function (a, b) { return (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")); });
  return out;
}

function normRoute(r) {
  if (!r || typeof r !== "object") return null;
  const num = function (v) { const n = toNumber(v); return isFinite(n) ? Math.abs(n) : 0; };
  const tolls = (Array.isArray(r.tolls) ? r.tolls : []).map(function (t) {
    if (!t || typeof t !== "object") return null;
    return { plaza: String(t.plaza || "Toll").slice(0, 60), road: String(t.road || "").slice(0, 30), rm: Math.round(num(t.rm) * 100) / 100 };
  }).filter(Boolean).slice(0, 12);
  let toll = Math.round(tolls.reduce(function (s, t) { return s + t.rm * 100; }, 0)) / 100;
  let tollNote = tolls.length ? "estimated" : "none";
  if (r.toll_shown === true && r.toll_rm != null && isFinite(toNumber(r.toll_rm))) { toll = Math.round(num(r.toll_rm) * 100) / 100; tollNote = "shown"; }
  else if (r.toll_shown === false && !tolls.length) tollNote = "unknown";
  return {
    name: String(r.name || "Route").slice(0, 60),
    roads: (Array.isArray(r.roads) ? r.roads : []).map(function (x) { return String(x).slice(0, 26); }).filter(Boolean).slice(0, 6),
    km: Math.round(num(r.km) * 10) / 10, mins: Math.round(num(r.mins)), minsPeak: Math.round(num(r.mins_peak)),
    tolls: tolls, toll: toll, tollNote: tollNote, note: String(r.note || "").slice(0, 160)
  };
}

/* ================= CSV ================= */
function toCsv(recs) {
  const cols = SHEET_COLS.concat([{ key: "receipt", head: "Receipt attached" }]);
  const cell = function (v) { let s = v == null ? "" : String(v); if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s; return /[",\n;]/.test(s) ? "\"" + s.replace(/"/g, "\"\"") + "\"" : s; };
  const lines = [cols.map(function (c) { return cell(c.head); }).join(",")];
  recs.slice().sort(function (a, b) { return -cmpDesc(a, b); }).forEach(function (r) {
    const v = exportValues(r);
    lines.push(cols.map(function (c) { return cell(c.key === "amount" ? v.amount.toFixed(2) : v[c.key]); }).join(","));
  });
  return "\ufeff" + lines.join("\r\n");
}
