/* ================= spreadsheets: template columns, import and export =================
   The template (template/ringgit-log-template.xlsx, built into the page), the importer and the
   Excel export all use these headers. Keep them in step with template/make_template.py. */
const SHEET_COLS = [
  { key: "date", head: "Date" }, { key: "time", head: "Time" }, { key: "cat", head: "Type" }, { key: "kind", head: "Kind" },
  { key: "merchant", head: "Description" }, { key: "amount", head: "Amount (RM)" }, { key: "note", head: "Note" },
  { key: "place", head: "Parking place" }, { key: "operator", head: "Parking company" }, { key: "entry", head: "Time in" }, { key: "exit", head: "Time out" },
  { key: "from", head: "From" }, { key: "to", head: "To" }, { key: "km", head: "Distance (km)" }, { key: "mins", head: "Travel time (min)" }, { key: "round", head: "Round trip" },
  { key: "id", head: "Record ID" }
];
const HEAD_ALIASES = {
  date: ["date", "tarikh", "transactiondate", "day"],
  time: ["time", "masa", "transactiontime"],
  cat: ["type", "category", "kategori", "jenis", "expensetype"],
  kind: ["kind", "subtype", "subcategory", "detail"],
  merchant: ["description", "merchant", "item", "details", "what", "payee", "keterangan"],
  amount: ["amountrm", "amount", "amountmyr", "rm", "total", "jumlah", "price", "cost"],
  note: ["note", "notes", "remark", "remarks", "catatan", "comment"],
  place: ["parkingplace", "parkinglocation", "place", "location", "carpark"],
  operator: ["parkingcompany", "parkingoperator", "operator", "company"],
  entry: ["timein", "entry", "entrytime", "masuk"],
  exit: ["timeout", "exit", "exittime", "keluar"],
  from: ["from", "start", "startingpoint", "origin", "dari"],
  to: ["to", "destination", "end", "ke"],
  km: ["distancekm", "distance", "km", "jarak", "mileage"],
  mins: ["traveltimemin", "traveltime", "drivingtime", "durationmin", "duration", "minutes", "mins"],
  round: ["roundtrip", "return", "pergibalik", "twoway"],
  route: ["route"],
  id: ["recordid", "id"]
};
const KIND_LABEL = { toll: "Toll", fuel: "Fuel", transit: "Public transport", ride: "E-hailing", trip: "Trip", other: "Other travel", office: "Office parking", onsite: "On-site parking" };
const TYPE_LIST = "Food,Travel,Parking,Shopping,Bills,Other";
const KIND_LIST = "Toll,Fuel,Public transport,E-hailing,Trip,Other travel,Office parking,On-site parking";
const normHead = function (s) { return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, ""); };
const blankCell = function (v) { return v == null || (typeof v === "string" && !v.trim()); };

/* ---------- evidence on records ---------- */
function evidenceCount(r) { return (r.img ? 1 : 0) + (Array.isArray(r.att) ? r.att.length : 0); }
function wantsEvidence(r) { return r.cat === "parking" || (r.cat === "travel" && (r.sub === "toll" || !!r.trip)); }
function missingEvidence(r) { return !r.example && wantsEvidence(r) && evidenceCount(r) === 0; }

/* ---------- reading cell values ---------- */
const MONTHS = { jan: 1, feb: 2, mar: 3, mac: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12 };
function serialToYMD(n, date1904) {
  const ms = Date.UTC(1899, 11, 30) + (Math.floor(n) + (date1904 ? 1462 : 0)) * 86400000;
  const d = new Date(ms);
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
}
function ymdOf(y, m, d) { y = Number(y); if (y < 100) y += 2000; const s = y + "-" + pad2(Number(m)) + "-" + pad2(Number(d)); return isYMD(s) ? s : ""; }
function parseDateCell(v, date1904) {
  if (v == null || v === "") return "";
  if (typeof v === "number") return v > 20000 && v < 80000 ? serialToYMD(v, date1904) : "";
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/))) return ymdOf(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?:\s.*)?$/))) return ymdOf(m[3], m[2], m[1]);   /* day first */
  if ((m = s.match(/^(\d{1,2})[\s\-\/.]+([A-Za-z]{3,})[\s\-\/.,]+(\d{2}|\d{4})$/))) { const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; return mo ? ymdOf(m[3], mo, m[1]) : ""; }
  if ((m = s.match(/^([A-Za-z]{3,})[\s.]+(\d{1,2}),?\s+(\d{4})$/))) { const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; return mo ? ymdOf(m[3], mo, m[2]) : ""; }
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDateCell(Number(s), date1904);
  return "";
}
function parseTimeCell(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    let mins;
    if (v >= 0 && v < 1) mins = Math.round(v * 1440);
    else if (v >= 1 && v < 24) { const hh = Math.floor(v), mm = Math.round((v - hh) * 100); if (mm >= 60) return ""; mins = hh * 60 + mm; }   /* 8.30 typed as a number */
    else if (v > 20000) mins = Math.round((v - Math.floor(v)) * 1440);
    else return "";
    mins = mins % 1440;
    return pad2(Math.floor(mins / 60)) + ":" + pad2(mins % 60);
  }
  const s = String(v).trim().toLowerCase().replace(/\s+/g, " ");
  let m = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) { const m2 = s.match(/^(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)$/); if (m2) m = [s, m2[1], "00", m2[2]]; }
  if (!m) { const m3 = s.match(/^(\d{1,2})(\d{2})$/); if (m3) m = [s, m3[1], m3[2], ""]; }
  if (!m) { const m4 = s.match(/^\d{4}-\d{2}-\d{2}[t ](\d{1,2}):(\d{2})/); if (m4) m = [s, m4[1], m4[2], ""]; }
  if (!m) return "";
  let hh = Number(m[1]); const mm = Number(m[2]), ap = (m[3] || "").replace(/\./g, "");
  if (ap === "pm" && hh < 12) hh += 12;
  if (ap === "am" && hh === 12) hh = 0;
  return hh < 24 && mm < 60 ? pad2(hh) + ":" + pad2(mm) : "";
}
function parseNum(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/^rm\s*/i, "").replace(/myr/i, "").replace(/\s/g, "");
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? (neg ? -n : n) : null;
}
function parseYes(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  return /^(y|yes|ya|true|1|x|✓|✔)$/i.test(String(v == null ? "" : v).trim());
}
function normType(raw) {
  const s = normHead(raw);
  if (!s) return "";
  if (["food", "foodanddrinks", "foodanddrink", "fooddrinks", "fnb", "meal", "meals", "makan", "makanan", "groceries", "grocery", "drinks", "dining"].indexOf(s) >= 0) return "food";
  if (["travel", "travelling", "traveling", "transport", "transportation", "toll", "fuel", "petrol", "trip", "perjalanan", "pengangkutan"].indexOf(s) >= 0) return "travel";
  if (["parking", "parkir", "letakkereta"].indexOf(s) >= 0) return "parking";
  if (["shopping", "shop", "belibelah", "purchase"].indexOf(s) >= 0) return "shopping";
  if (["bills", "bill", "utilities", "utility", "bil", "subscription", "subscriptions"].indexOf(s) >= 0) return "bills";
  if (["other", "others", "lainlain", "misc", "miscellaneous"].indexOf(s) >= 0) return "other";
  return "?";
}
function normKind(raw) {
  const s = normHead(raw);
  if (!s) return {};
  if (["toll", "tol", "tolls"].indexOf(s) >= 0) return { cat: "travel", sub: "toll" };
  if (["fuel", "petrol", "minyak", "ron95", "ron97", "diesel", "gas"].indexOf(s) >= 0) return { cat: "travel", sub: "fuel" };
  if (["publictransport", "transit", "lrt", "mrt", "bus", "train", "ktm", "monorail", "brt", "erl"].indexOf(s) >= 0) return { cat: "travel", sub: "transit" };
  if (["ehailing", "grab", "taxi", "ride", "airasiaride", "indrive", "maxim"].indexOf(s) >= 0) return { cat: "travel", sub: "ride" };
  if (["trip", "route", "journey", "drive"].indexOf(s) >= 0) return { cat: "travel", sub: "toll", trip: true };
  if (["othertravel"].indexOf(s) >= 0) return { cat: "travel", sub: "other" };
  if (["officeparking", "office", "pejabat"].indexOf(s) >= 0) return { cat: "parking", park: "office" };
  if (["onsiteparking", "onsite", "site", "clientsite", "outside"].indexOf(s) >= 0) return { cat: "parking", park: "onsite" };
  return { unknown: true };
}

/* ---------- finding the header row and turning rows into review rows ---------- */
function mapHeader(cells) {
  const map = {};
  const norm = cells.map(normHead);
  const hasCategory = norm.indexOf("category") >= 0 || norm.indexOf("kategori") >= 0;
  norm.forEach(function (h, i) {
    if (!h) return;
    if (hasCategory && h === "type") { if (map.kind == null) map.kind = i; return; }   /* older exports: Category + Type */
    Object.keys(HEAD_ALIASES).forEach(function (k) { if (map[k] == null && HEAD_ALIASES[k].indexOf(h) >= 0) map[k] = i; });
  });
  return map;
}
function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = (rows[i] || []).map(function (v) { return v == null ? "" : String(v); });
    const map = mapHeader(cells);
    if (map.date != null && map.amount != null) return { index: i, map: map };
  }
  return null;
}
function defaultMerchant(r) {
  if (r.cat === "parking") return (r.park && r.park.location) || "Parking";
  if (r.trip && (r.trip.from || r.trip.to)) return (r.trip.from || "Start") + " → " + (r.trip.to || "Destination");
  return (CAT[r.cat] || CAT.other).label;
}
function importRowsFrom(table, ctx) {
  const head = findHeader(table.rows);
  if (!head) throw { code: "sheet_no_header" };
  const map = head.map, has = {};
  Object.keys(map).forEach(function (k) { has[k] = true; });
  const out = [], seenIds = new Set();
  let examples = 0, blank = 0;
  for (let i = head.index + 1; i < table.rows.length && out.length < 2000; i++) {
    const cells = table.rows[i] || [];
    const get = function (k) { return map[k] == null ? undefined : cells[map[k]]; };
    const str = function (k) { const v = get(k); return v == null ? "" : String(v).trim().replace(/^'(?=[=+\-@])/, ""); };   /* the export guards formulas with a leading ' */
    if (!SHEET_COLS.concat([{ key: "route" }]).some(function (c) { return !blankCell(get(c.key)); })) { blank++; continue; }
    if (/^example$/i.test(str("id"))) { examples++; continue; }
    const warn = [];
    const kind = normKind(str("kind"));
    let cat = normType(str("cat"));
    if (cat === "?") { warn.push("Type “" + str("cat").slice(0, 30) + "” isn't one of the six types, so it was set to Other."); cat = "other"; }
    const hasPark = ["place", "operator", "entry", "exit"].some(function (k) { return !blankCell(get(k)); });
    const hasTrip = ["from", "to", "km", "mins"].some(function (k) { return !blankCell(get(k)); });
    if (!cat) cat = kind.cat || (hasPark ? "parking" : hasTrip ? "travel" : "other");
    if (kind.unknown) warn.push("Kind “" + str("kind").slice(0, 30) + "” wasn't recognised.");
    else if (kind.cat && kind.cat !== cat) warn.push("Kind “" + str("kind").slice(0, 30) + "” doesn't fit the type " + CAT[cat].label + ", so it was ignored.");
    const fits = kind.cat === cat;
    let amount = parseNum(get("amount"));
    if (amount != null && amount < 0) { warn.push("The amount was negative; it was made positive."); amount = -amount; }
    const date = parseDateCell(get("date"), table.date1904);
    if (!date && !blankCell(get("date"))) warn.push("The date “" + str("date").slice(0, 20) + "” couldn't be read. Use day/month/year.");
    const row = {
      key: newId(), line: i + 1, on: true, date: date, time: parseTimeCell(get("time")), merchant: str("merchant").slice(0, 80),
      amount: amount == null ? 0 : Math.round(amount * 100) / 100, kind: "expense", cat: cat, sub: "", park: null, trip: null,
      note: str("note").slice(0, 200), sure: true, dup: false, file: -1, upd: null, refId: "", warn: warn.join(" ")
    };
    if (cat === "parking") {
      const location = str("place").slice(0, 80), operator = str("operator").slice(0, 60);
      const entry = parseTimeCell(get("entry")), exit = parseTimeCell(get("exit"));
      row.park = { kind: fits && kind.park ? kind.park : guessParkKind(location + " " + row.merchant, ctx.places || []), location: location, operator: operator, entry: entry, exit: exit, mins: minsBetween(entry, exit) };
    } else if (cat === "travel") {
      if ((fits && kind.trip) || hasTrip) {
        const km = parseNum(get("km")), mins = parseNum(get("mins"));
        row.trip = { from: str("from").slice(0, 90), to: str("to").slice(0, 90), km: km != null && km > 0 ? Math.round(km * 10) / 10 : 0, mins: mins != null && mins > 0 ? Math.round(mins) : 0, round: parseYes(get("round")), route: str("route").slice(0, 60) };
        row.sub = "toll";
      } else row.sub = fits && kind.sub ? kind.sub : "other";
    }
    if (!row.merchant) row.merchant = defaultMerchant(row);
    const ref = str("id").match(/^(\d{4}-\d{2})\/([A-Za-z0-9_\-.~:@+]{1,200})$/);
    if (ref && !seenIds.has(ref[0])) { row.refId = ref[0]; seenIds.add(ref[0]); }
    row.on = isYMD(row.date) && (row.amount > 0 || !!row.trip);
    out.push(row);
  }
  return { rows: out, has: has, examples: examples, blank: blank, headerRow: head.index + 1 };
}
/* Rows carrying a Record ID from an earlier export update that record; columns missing from the sheet keep the saved values. */
async function resolveUpdates(rows, has) {
  const refs = rows.filter(function (r) { return r.refId; });
  const months = Array.from(new Set(refs.map(function (r) { return r.refId.slice(0, 7); }).concat(rows.map(function (r) { return ymOf(r.date); })).filter(function (m) { return /^\d{4}-\d{2}$/.test(m); }))).slice(0, 24);
  await store.whenLoaded(months, 5000);
  refs.forEach(function (r) {
    const ym = r.refId.slice(0, 7), id = r.refId.slice(8);
    const old = store.recs(ym).find(function (x) { return x.id === id && !x.example; });
    if (!old) return;
    r.upd = old;
    if (!has.time) r.time = old.time || "";
    if (!has.merchant) r.merchant = old.merchant || r.merchant;
    if (!has.note) r.note = old.note || "";
    if (!has.cat && !has.kind) { r.cat = CAT[old.cat] ? old.cat : "other"; r.sub = old.sub || ""; }
    if (r.cat === "parking") {
      const op = old.park || {}, pk = Object.assign(blankPark(op.kind || "onsite"), r.park || {});
      if (!has.kind && op.kind) pk.kind = op.kind;
      if (!has.place) pk.location = op.location || ""; if (!has.operator) pk.operator = op.operator || "";
      if (!has.entry) pk.entry = op.entry || ""; if (!has.exit) pk.exit = op.exit || "";
      pk.mins = minsBetween(pk.entry, pk.exit); if (pk.mins == null && op.mins) pk.mins = op.mins;
      r.park = pk;
    }
    if (r.cat === "travel" && old.trip && !has.from && !has.to && !has.km && !has.mins) { r.trip = Object.assign({}, old.trip); r.sub = "toll"; }
    else if (r.trip && old.trip) { r.trip.route = r.trip.route || old.trip.route || ""; if (!has.round) r.trip.round = !!old.trip.round; }
    r.same = sameAsSaved(r);
    if (r.same) r.on = false;   /* nothing to change; ticking it again is harmless */
  });
  markDuplicates(rows.filter(function (r) { return !r.upd; }));
  return rows;
}
/* What a row would save, reduced to the fields a sheet can carry, so an unchanged export row can be told apart. */
function sheetShape(x) {
  const p = x.park, t = x.trip;
  return JSON.stringify([x.date, x.time || "", Math.round((Number(x.amount) || 0) * 100), x.cat, x.cat === "travel" && !t ? x.sub || "" : "", String(x.merchant || "").trim(), String(x.note || "").trim(),
    x.cat === "parking" && p ? [p.kind === "office" ? "office" : "onsite", p.location || "", p.operator || "", p.entry || "", p.exit || ""] : null,
    x.cat === "travel" && t ? [t.from || "", t.to || "", Math.round((Number(t.km) || 0) * 10), Math.round(Number(t.mins) || 0), !!t.round] : null]);
}
function sameAsSaved(r) { return !!r.upd && sheetShape(recordFromImport(r, "", "")) === sheetShape(r.upd); }
function recordFromImport(r, batch, now) {
  const rec = r.upd ? clone(r.upd) : { id: newId(), src: "sheet", batch: batch, createdAt: now };
  delete rec.example;
  rec.date = r.date; rec.time = normTime(r.time); rec.amount = Math.round((Number(r.amount) || 0) * 100) / 100; rec.cat = CAT[r.cat] ? r.cat : "other";
  rec.merchant = String(r.merchant || "").trim() || defaultMerchant(r); rec.note = String(r.note || "").trim();
  rec.sub = rec.cat === "travel" ? (SUBS[r.sub] ? r.sub : "other") : "";
  if (rec.cat === "parking") {
    const pk = Object.assign(blankPark("onsite"), r.park || {});
    pk.location = String(pk.location || "").trim(); pk.operator = String(pk.operator || "").trim(); pk.entry = normTime(pk.entry); pk.exit = normTime(pk.exit);
    const m = minsBetween(pk.entry, pk.exit); pk.mins = m != null ? m : (pk.mins || null);
    rec.park = pk;
  } else delete rec.park;
  if (rec.cat === "travel" && r.trip) {
    const old = (r.upd && r.upd.trip) || {};
    rec.trip = { from: String(r.trip.from || "").trim(), to: String(r.trip.to || "").trim(), route: r.trip.route || old.route || "", roads: old.roads || [], km: Math.round((Number(r.trip.km) || 0) * 10) / 10, mins: Math.round(Number(r.trip.mins) || 0), tolls: old.tolls || [], round: !!r.trip.round, basis: old.basis || "sheet" };
    rec.sub = "toll";
  } else delete rec.trip;
  return rec;
}

/* ---------- reading files ---------- */
const JSZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
let jszipWait = null;
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jszipWait) jszipWait = new Promise(function (resolve, reject) {
    const s = document.createElement("script");
    s.src = JSZIP_URL;
    s.onload = function () { if (window.JSZip) resolve(window.JSZip); else { jszipWait = null; reject({ code: "sheet_engine" }); } };
    s.onerror = function () { jszipWait = null; reject({ code: "sheet_engine" }); };
    document.head.appendChild(s);
  });
  return jszipWait;
}
function decodeText(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
  let t = new TextDecoder("utf-8").decode(b);
  if (t.indexOf("\ufffd") >= 0) { try { t = new TextDecoder("windows-1252").decode(b); } catch (e) {} }
  return t.replace(/^\ufeff/, "");
}
function parseCsv(text) {
  let body = text;
  let delim = null;
  const sep = body.match(/^sep=(.)\r?\n/i);
  if (sep) { delim = sep[1]; body = body.slice(sep[0].length); }
  if (!delim) {
    const first = body.split(/\r?\n/, 1)[0] || "";
    const count = function (d) { return first.split(d).length - 1; };
    delim = ["\t", ";", ","].reduce(function (best, d) { return count(d) > count(best) ? d : best; }, ",");
  }
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === "\"") { if (body[i + 1] === "\"") { cell += "\""; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === "\"" && cell === "") quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && body[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function colIndex(ref) { const m = String(ref).match(/^([A-Z]+)/); if (!m) return -1; let n = 0; for (let i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64); return n - 1; }
function byLocal(node, name) { return Array.prototype.slice.call(node.getElementsByTagNameNS("*", name)); }
function sheetRowsFromXml(xml, shared) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw { code: "sheet_unreadable" };
  const rows = [];
  byLocal(doc, "row").slice(0, 5000).forEach(function (rowEl, n) {
    const r = Number(rowEl.getAttribute("r")) || n + 1;
    const cells = [];
    byLocal(rowEl, "c").forEach(function (c, k) {
      const ref = c.getAttribute("r"), col = ref ? colIndex(ref) : k;
      if (col < 0 || col > 200) return;
      const t = c.getAttribute("t"), vEl = byLocal(c, "v")[0], v = vEl ? vEl.textContent : null;
      let val = null;
      if (t === "s") val = v == null ? "" : (shared[Number(v)] || "");
      else if (t === "inlineStr") val = byLocal(c, "t").map(function (x) { return x.textContent; }).join("");
      else if (t === "b") val = v === "1";
      else if (t === "str" || t === "e" || t === "d") val = v == null ? "" : v;
      else val = v == null || v === "" ? null : Number(v);
      cells[col] = val;
    });
    rows[r - 1] = cells;
  });
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}
async function readXlsx(file) {
  const JSZip = await loadJSZip();
  let zip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); } catch (e) { throw { code: "sheet_unreadable" }; }
  const text = function (p) { const f = zip.file(p); return f ? f.async("string") : Promise.resolve(null); };
  const parse = function (s) { return new DOMParser().parseFromString(s, "application/xml"); };
  const wbXml = await text("xl/workbook.xml");
  if (!wbXml) throw { code: "sheet_unreadable" };
  const wb = parse(wbXml);
  const pr = byLocal(wb, "workbookPr")[0];
  const date1904 = !!pr && /^(1|true)$/i.test(pr.getAttribute("date1904") || "");
  const relsXml = await text("xl/_rels/workbook.xml.rels");
  const targets = {};
  if (relsXml) byLocal(parse(relsXml), "Relationship").forEach(function (r) { targets[r.getAttribute("Id")] = r.getAttribute("Target"); });
  const shared = [];
  const ssXml = await text("xl/sharedStrings.xml");
  if (ssXml) byLocal(parse(ssXml), "si").forEach(function (si) {
    shared.push(byLocal(si, "t").filter(function (t) { return !t.parentNode || t.parentNode.localName !== "rPh"; }).map(function (t) { return t.textContent; }).join(""));
  });
  const sheets = byLocal(wb, "sheet").map(function (s) {
    const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    let target = targets[rid] || "";
    target = target.charAt(0) === "/" ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
    return { name: s.getAttribute("name") || "Sheet", hidden: !!s.getAttribute("state") && s.getAttribute("state") !== "visible", path: target };
  }).filter(function (s) { return !s.hidden && s.path; });
  sheets.sort(function (a, b) { return (/^expenses$/i.test(b.name) ? 1 : 0) - (/^expenses$/i.test(a.name) ? 1 : 0); });
  for (let i = 0; i < sheets.length; i++) {
    const xml = await text(sheets[i].path);
    if (!xml) continue;
    const rows = sheetRowsFromXml(xml, shared);
    if (findHeader(rows)) return { kind: "xlsx", sheet: sheets[i].name, rows: rows, date1904: date1904 };
  }
  throw { code: "sheet_no_header" };
}
async function readSheetFile(file) {
  const name = String(file.name || "").toLowerCase();
  if (/\.xls$/.test(name)) throw { code: "sheet_xls" };
  if (/\.(ods|numbers)$/.test(name)) throw { code: "sheet_other" };
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b) return readXlsx(file);
  if (head[0] === 0xd0 && head[1] === 0xcf) throw { code: "sheet_xls" };
  const rows = parseCsv(decodeText(await file.arrayBuffer()));
  if (!findHeader(rows)) throw { code: "sheet_no_header" };
  return { kind: "csv", sheet: "", rows: rows, date1904: false };
}
function sheetErrorText(e) {
  switch (e && e.code) {
    case "sheet_xls": return "That's an old .xls file. In Excel choose File › Save As › Excel Workbook (.xlsx), then import the new file.";
    case "sheet_other": return "That file type can't be read. Save it as an Excel workbook (.xlsx) or as CSV, then import it.";
    case "sheet_no_header": return "No header row with Date and Amount was found. Use the template, or make sure your sheet has columns named Date and Amount (RM).";
    case "sheet_engine": return "The Excel reader couldn't be loaded. Check your connection, or save the sheet as CSV and import that.";
    case "sheet_unreadable": return "That file couldn't be opened as a spreadsheet. Save it again from Excel as .xlsx and try once more.";
    case "sheet_empty": return "The sheet has a header row but no expenses under it.";
    default: return "Something went wrong while reading the sheet. Try again.";
  }
}

/* ---------- writing an Excel file of a month's records ---------- */
const xmlEsc = function (s) { return String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" }[c]; }); };
function colName(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function ymdToSerial(s) { const p = s.split("-").map(Number); return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(1899, 11, 30)) / 86400000); }
function hmToFraction(t) { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? (Number(m[1]) * 60 + Number(m[2])) / 1440 : null; }
function exportValues(r) {
  const p = r.park || {}, t = r.trip || {};
  const kind = r.cat === "parking" ? KIND_LABEL[p.kind === "office" ? "office" : "onsite"] : r.cat === "travel" ? (r.trip ? "Trip" : KIND_LABEL[r.sub] || "Other travel") : "";
  return {
    date: r.date, time: r.time || "", cat: (CAT[r.cat] || CAT.other).label, kind: kind, merchant: r.merchant || "", amount: cents(r) / 100, note: r.note || "",
    place: p.location || "", operator: p.operator || "", entry: p.entry || "", exit: p.exit || "",
    from: t.from || "", to: t.to || "", km: r.trip && t.km ? t.km : "", mins: r.trip && t.mins ? t.mins : "", round: r.trip ? (t.round ? "Yes" : "No") : "",
    id: ymOf(r.date) + "/" + r.id, receipt: evidenceCount(r) ? "Yes" : "No"
  };
}
async function buildXlsx(recs) {
  const JSZip = await loadJSZip();
  const cols = SHEET_COLS.concat([{ key: "receipt", head: "Receipt attached" }]);
  const widths = { date: 12, time: 8, cat: 11, kind: 16, merchant: 32, amount: 13, note: 24, place: 22, operator: 18, entry: 9, exit: 9, from: 20, to: 20, km: 13, mins: 16, round: 11, id: 22, receipt: 16 };
  const style = { date: 2, time: 3, entry: 3, exit: 3, amount: 4, km: 5, mins: 6, id: 7, receipt: 7 };
  const last = colName(cols.length - 1), n = recs.length + 1, maxRow = Math.max(n + 200, 500);
  const cell = function (ref, k, v) {
    if (v === "" || v == null) return "";
    if (k === "date") return "<c r=\"" + ref + "\" s=\"2\"><v>" + ymdToSerial(v) + "</v></c>";
    if (k === "time" || k === "entry" || k === "exit") { const f = hmToFraction(v); return f == null ? "" : "<c r=\"" + ref + "\" s=\"3\"><v>" + f + "</v></c>"; }
    if (typeof v === "number") return "<c r=\"" + ref + "\" s=\"" + (style[k] || 0) + "\"><v>" + v + "</v></c>";
    const s = String(v), keep = /^\s|\s$|\n/.test(s) ? " xml:space=\"preserve\"" : "";
    return "<c r=\"" + ref + "\" t=\"inlineStr\"" + (style[k] ? " s=\"" + style[k] + "\"" : "") + "><is><t" + keep + ">" + xmlEsc(s) + "</t></is></c>";
  };
  const rowsXml = ["<row r=\"1\">" + cols.map(function (c, i) { return "<c r=\"" + colName(i) + "1\" t=\"inlineStr\" s=\"1\"><is><t>" + xmlEsc(c.head) + "</t></is></c>"; }).join("") + "</row>"];
  recs.forEach(function (r, i) {
    const v = exportValues(r), rn = i + 2;
    rowsXml.push("<row r=\"" + rn + "\">" + cols.map(function (c, j) { return cell(colName(j) + rn, c.key, v[c.key]); }).join("") + "</row>");
  });
  const L = {}; cols.forEach(function (c, i) { L[c.key] = colName(i); });
  const dv = function (key, list) { return "<dataValidation type=\"list\" errorStyle=\"warning\" allowBlank=\"1\" showErrorMessage=\"1\" sqref=\"" + L[key] + "2:" + L[key] + maxRow + "\"><formula1>\"" + list + "\"</formula1></dataValidation>"; };
  const sheet = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
    "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
    "<dimension ref=\"A1:" + last + n + "\"/>" +
    "<sheetViews><sheetView tabSelected=\"1\" workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/><selection pane=\"bottomLeft\" activeCell=\"A2\" sqref=\"A2\"/></sheetView></sheetViews>" +
    "<sheetFormatPr defaultRowHeight=\"15\"/>" +
    "<cols>" + cols.map(function (c, i) { return "<col min=\"" + (i + 1) + "\" max=\"" + (i + 1) + "\" width=\"" + (widths[c.key] || 12) + "\" customWidth=\"1\"/>"; }).join("") + "</cols>" +
    "<sheetData>" + rowsXml.join("") + "</sheetData>" +
    "<dataValidations count=\"3\">" + dv("cat", TYPE_LIST) + dv("kind", KIND_LIST) + dv("round", "Yes,No") + "</dataValidations>" +
    "<pageMargins left=\"0.7\" right=\"0.7\" top=\"0.75\" bottom=\"0.75\" header=\"0.3\" footer=\"0.3\"/>" +
    "</worksheet>";
  const styles = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
    "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
    "<numFmts count=\"4\"><numFmt numFmtId=\"164\" formatCode=\"dd/mm/yyyy\"/><numFmt numFmtId=\"165\" formatCode=\"hh:mm\"/><numFmt numFmtId=\"166\" formatCode=\"#,##0.00\"/><numFmt numFmtId=\"167\" formatCode=\"0.0\"/></numFmts>" +
    "<fonts count=\"3\"><font><sz val=\"10\"/><name val=\"Arial\"/><family val=\"2\"/></font><font><b/><sz val=\"10\"/><name val=\"Arial\"/><family val=\"2\"/></font><font><sz val=\"10\"/><color rgb=\"FF72686E\"/><name val=\"Arial\"/><family val=\"2\"/></font></fonts>" +
    "<fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFF1EEF0\"/><bgColor indexed=\"64\"/></patternFill></fill></fills>" +
    "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" +
    "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
    "<cellXfs count=\"8\">" +
    "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>" +
    "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\"/>" +
    "<xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
    "<xf numFmtId=\"165\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
    "<xf numFmtId=\"166\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
    "<xf numFmtId=\"167\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
    "<xf numFmtId=\"1\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
    "<xf numFmtId=\"0\" fontId=\"2\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>" +
    "</cellXfs>" +
    "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
    "</styleSheet>";
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/></Types>");
  zip.file("_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
  zip.file("xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><bookViews><workbookView/></bookViews><sheets><sheet name=\"Expenses\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
  zip.file("xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>");
  zip.file("xl/worksheets/sheet1.xml", sheet);
  zip.file("xl/styles.xml", styles);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ---------- the template and exports, through the viewer's save prompt ---------- */
/* Says why a file wasn't saved; returns "format" when this view can't save that kind of file at all. */
function fileSaveFailed(e, kind) {
  const code = e && e.code;
  if (code === "declined") return "declined";
  if (code === "rate_limited") { toasts.push("A save prompt is already open. Answer that one first."); return "busy"; }
  if (code === "extension_not_enabled" || code === "rejected_extension") { toasts.push(kind + " files can't be saved in this view."); return "format"; }
  if (code === "too_large") { toasts.push("That file is too large to save here."); return "large"; }
  if (code === "unavailable" || code === "not_granted" || code === "capability_disabled" || code === "capability_removed") { toasts.push("Saving files isn't available in this view."); return "off"; }
  toasts.push("Couldn't save the file. Try again.");
  return "error";
}
/* The template workbook (template/ringgit-log-template.xlsx) is written into the page by build.sh. */
const TEMPLATE_B64 = "__TEMPLATE_B64__";
async function saveTemplate() {
  if (!caps.downloads) { toasts.push("Saving files isn't available in this view. Ask Claude in the chat for the template."); return; }
  let blob = null;
  try {
    const bin = atob(TEMPLATE_B64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });   /* an xlsx is a zip file */
  } catch (e) { blob = null; }
  if (!blob) { toasts.push("The template couldn't be prepared in this view. Ask Claude in the chat for it."); return; }
  try {
    await caps.downloads.save({ filename: "Ringgit Log template.xlsx", data: blob });
    toasts.push("Template saved. Fill it in, then use Import from Excel.");
  } catch (e) {
    if (fileSaveFailed(e, "Excel") === "format") toasts.push("Ask Claude in the chat for the template instead.");
  }
}

/* ================= the import window ================= */
function importRowValid(r) { return isYMD(r.date) && (r.amount > 0 || (r.cat === "travel" && !!r.trip)); }
function ImportModal(p) {
  const A = p.A;
  useBus();
  const [step, setStep] = useState("pick");
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState("");
  const inputRef = useRef(null), alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  async function take(list) {
    const file = list && list[0];
    if (!file) return;
    setErr(""); setStep("reading");
    try {
      const table = await readSheetFile(file);
      const res = importRowsFrom(table, { places: store.officePlaces() });
      if (!res.rows.length) throw { code: "sheet_empty" };
      await resolveUpdates(res.rows, res.has);
      if (!alive.current) return;
      setRows(res.rows);
      setMeta({ name: file.name || "your file", sheet: table.sheet, examples: res.examples, has: res.has });
      setStep("review");
    } catch (e) {
      if (!alive.current) return;
      setErr(sheetErrorText(e)); setStep("pick");
    }
  }
  const patchRow = useCallback((key, patch) => {
    setRows(list => list.map(r => {
      if (r.key !== key) return r;
      const n = Object.assign({}, r, patch);
      if (patch.cat) {
        if (n.cat === "parking" && !n.park) n.park = blankPark(guessParkKind(n.merchant, store.officePlaces()));
        if (n.cat === "travel" && !n.sub) n.sub = n.trip ? "toll" : "other";
        if (n.cat !== "travel") n.trip = null;
      }
      if (n.upd) n.same = sameAsSaved(n);
      if (!("on" in patch) && importRowValid(n) && (!importRowValid(r) || (r.same && !n.same))) n.on = true;   /* fixing or changing a row ticks it */
      return n;
    }));
  }, []);
  const valid = importRowValid;
  const chosen = rows.filter(r => r.on && valid(r));
  const total = Math.round(chosen.reduce((s, r) => s + r.amount * 100, 0));
  const nUpd = chosen.filter(r => r.upd).length, nNew = chosen.length - nUpd;
  const nBad = rows.filter(r => !valid(r)).length, nDup = rows.filter(r => r.dup).length, nSame = rows.filter(r => r.same).length;
  const anyOn = rows.some(r => r.on);

  async function save() {
    if (!chosen.length || busy) return;
    setBusy("Saving…"); setErr("");
    try {
      const batch = newId(), now = new Date().toISOString();
      const ops = chosen.map(r => ({ rec: recordFromImport(r, batch, now), old: r.upd || null }));
      await A.saveImport(ops, (d, t) => { if (alive.current) setBusy("Saving " + d + " of " + t + "…"); });
      const offices = ops.map(o => o.rec).filter(r => r.park && r.park.kind === "office" && r.park.location && r.park.location.length >= 3).map(r => r.park.location);
      if (offices.length) {
        const cur = store.officePlaces();
        const add = Array.from(new Set(offices)).filter(x => !cur.some(y => y.toLowerCase() === x.toLowerCase()));
        if (add.length) store.saveSettings({ officePlaces: cur.concat(add).slice(-20) });
      }
      p.onClose();
    } catch (e) { if (alive.current) { setBusy(""); setErr(saveErrorText(e)); } }
  }

  let body, foot;
  if (step === "pick" || step === "reading") {
    body = h("div", { className: "modal-body" },
      h("p", null, "Fill in a month of expenses in Excel, then bring them in here in one go. You check every row before anything is saved."),
      h("div", { className: "steps-list" },
        h("div", { className: "step-line" }, h("em", null, "1"), h("span", null, h("strong", null, "Get the template. "), "One row per expense. Parking, toll and trip rows have their own columns, and receipts can be attached later."),
          h("button", { type: "button", className: "btn sm", onClick: saveTemplate }, h(Icon, { name: "download", size: 15 }), "Download template")),
        h("div", { className: "step-line" }, h("em", null, "2"), h("span", null, h("strong", null, "Fill it in "), "in Excel, Google Sheets or Numbers, and save it as .xlsx or .csv.")),
        h("div", { className: "step-line" }, h("em", null, "3"), h("span", null, h("strong", null, "Import it below. "), "To change records you already have, export the month first, edit that file and import it back. Rows with a Record ID update those records instead of adding copies."))),
      step === "reading" ? h("div", { className: "reading" }, h("div", { className: "spinner" }), h("p", null, "Reading the sheet…"))
        : h("div", { className: cx("drop", over && "is-over"), onDragOver: e => { e.preventDefault(); setOver(true); }, onDragLeave: () => setOver(false), onDrop: e => { e.preventDefault(); setOver(false); take(e.dataTransfer && e.dataTransfer.files); } },
            h("span", { className: "empty-ico" }, h(Icon, { name: "table", size: 22 })),
            h("p", null, h("strong", null, "Drop your sheet here"), " or choose it from your device. Excel (.xlsx) and CSV files work."),
            h("input", { id: "imp-file", ref: inputRef, type: "file", hidden: true, accept: ".xlsx,.xlsm,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv", onChange: e => { const f = e.target.files; take(f ? Array.from(f) : []); e.target.value = ""; } }),
            h("button", { type: "button", className: "btn", onClick: () => inputRef.current && inputRef.current.click() }, h(Icon, { name: "upload", size: 16 }), "Choose a sheet")),
      err ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, err)) : null);
    foot = h("div", { className: "modal-foot" }, h("button", { type: "button", className: "btn ghost", onClick: p.onClose }, "Cancel"));
  } else {
    const where = meta.sheet ? "the " + meta.sheet + " sheet of " + meta.name : meta.name;
    const notes = [];
    if (meta.examples) notes.push("The example row was skipped.");
    if (nBad) notes.push(nBad + (nBad === 1 ? " row needs" : " rows need") + " a date or an amount before it can be saved.");
    if (nDup) notes.push(nDup + (nDup === 1 ? " row matches" : " rows match") + " a record you already have, so " + (nDup === 1 ? "it is" : "they are") + " left unticked.");
    if (nSame) notes.push(nSame === rows.length ? "Every row is the same as its saved record, so there's nothing to update." : nSame + (nSame === 1 ? " row is" : " rows are") + " the same as the saved record, so " + (nSame === 1 ? "it is" : "they are") + " left unticked.");
    body = h("div", { className: "modal-body" },
      h("div", { className: "slip" },
        h("div", { className: "slip-head" }, h("span", null, h("b", null, rows.length + (rows.length === 1 ? " row" : " rows")), " read from " + where),
          h("span", { className: "spacer" }),
          rows.length > 1 ? h("button", { type: "button", className: "linkish", onClick: () => setRows(list => list.map(r => Object.assign({}, r, { on: anyOn ? false : valid(r) && !r.dup }))) }, anyOn ? "Untick all" : "Tick all") : null),
        rows.map(r => h(ReviewRow, { key: r.key, row: r, patch: patchRow }))),
      notes.length ? h("div", { className: "banner warn" }, h(Icon, { name: "info", size: 16 }), h("span", { className: "grow" }, notes.join(" "))) : null,
      h("p", { className: "note" }, "Only ticked rows are saved. " + (nUpd ? nUpd + (nUpd === 1 ? " row updates a record" : " rows update records") + " you already have; the rest are added as new. " : "") + "Receipts can be attached to any record afterwards."),
      err ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, err)) : null);
    foot = h("div", { className: "modal-foot" },
      h("button", { type: "button", className: "btn ghost", disabled: !!busy, onClick: () => { setRows([]); setMeta(null); setStep("pick"); } }, "Change file"),
      h("span", { className: "spacer" }),
      h("button", { type: "button", className: "btn primary", disabled: !chosen.length || !!busy, onClick: save }, h(Icon, { name: "check", size: 16 }),
        busy || (chosen.length ? (nNew ? "Add " + nNew : "") + (nNew && nUpd ? ", update " + nUpd : nUpd ? "Update " + nUpd : "") + " · " + fmtRM(total) : "Nothing ticked")));
  }
  return h(Modal, { title: "Import from Excel", onClose: p.onClose, locked: !!busy || step === "reading" }, body, foot);
}
