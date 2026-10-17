// Pure-logic checks for the spreadsheet import (no browser).
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync("src/01-core.js", "utf8") + "\n" + fs.readFileSync("src/06-sheets.js", "utf8") +
  "\n;globalThis.__t = { parseDateCell, parseTimeCell, parseNum, parseYes, normType, normKind, mapHeader, findHeader, importRowsFrom, parseCsv, decodeText, recordFromImport, exportValues, toCsv, colName, ymdToSerial, serialToYMD, missingEvidence, evidenceCount, store };";
const ctx = { window: {}, document: {}, localStorage: { getItem: () => null, setItem: () => {} }, console, setTimeout, clearTimeout, Intl, URL, Promise, Math, JSON, Date, Number, String, Array, Object, Set, Map, isFinite, isNaN, parseFloat, TextDecoder, Uint8Array, React: { memo: f => f } };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const t = ctx.__t; let fails = 0;
const eq = (name, got, want) => { const a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) { fails++; console.log("FAIL", name, "\n   got ", a, "\n   want", b); } else console.log("ok  ", name); };
eq("dates: serials, day-first text, month names, ISO", [t.parseDateCell(46296), t.parseDateCell(46296, true), t.parseDateCell("13/10/2026"), t.parseDateCell("1-10-26"), t.parseDateCell("13 Oct 2026"), t.parseDateCell("13-Okt-2026"), t.parseDateCell("Oct 13, 2026"), t.parseDateCell("2026-10-13T00:00:00"), t.parseDateCell("31/02/2026"), t.parseDateCell("hello"), t.parseDateCell("46296")],
  ["2026-10-01", "2030-10-02", "2026-10-13", "2026-10-01", "2026-10-13", "2026-10-13", "2026-10-13", "2026-10-13", "", "", "2026-10-01"]);
eq("times: fractions, text, am/pm, typed decimals", [t.parseTimeCell(0.5), t.parseTimeCell(0.7777777), t.parseTimeCell("8:05"), t.parseTimeCell("6:40 PM"), t.parseTimeCell("12:15 am"), t.parseTimeCell("0830"), t.parseTimeCell(8.3), t.parseTimeCell("18:40:00"), t.parseTimeCell("7pm"), t.parseTimeCell("25:00"), t.parseTimeCell(46296.75)],
  ["12:00", "18:40", "08:05", "18:40", "00:15", "08:30", "08:30", "18:40", "19:00", "", "18:00"]);
eq("numbers", [t.parseNum("RM 1,234.50"), t.parseNum("12,50"), t.parseNum("(9.00)"), t.parseNum(""), t.parseNum("abc"), t.parseNum(7)], [1234.5, 12.5, -9, null, null, 7]);
eq("yes", [t.parseYes("Yes"), t.parseYes("y"), t.parseYes("No"), t.parseYes(""), t.parseYes(true)], [true, true, false, false, true]);
eq("types", ["Food", "food & drinks", "Transport", "PARKING", "Bil", "lain-lain", "", "Gym"].map(t.normType), ["food", "food", "travel", "parking", "bills", "other", "", "?"]);
eq("kinds", ["Toll", "Petrol", "MRT", "Grab", "Trip", "Office parking", "On-site parking", "", "Boat"].map(x => JSON.stringify(t.normKind(x))),
  ['{"cat":"travel","sub":"toll"}', '{"cat":"travel","sub":"fuel"}', '{"cat":"travel","sub":"transit"}', '{"cat":"travel","sub":"ride"}', '{"cat":"travel","sub":"toll","trip":true}', '{"cat":"parking","park":"office"}', '{"cat":"parking","park":"onsite"}', "{}", '{"unknown":true}']);
const tplHead = ["Date *", "Time", "Type *", "Kind", "Description", "Amount (RM) *", "Note", "Parking place", "Parking company", "Time in", "Time out", "From", "To", "Distance (km)", "Travel time (min)", "Round trip", "Record ID"];
eq("template header maps every column", t.mapHeader(tplHead), { date: 0, time: 1, cat: 2, kind: 3, merchant: 4, amount: 5, note: 6, place: 7, operator: 8, entry: 9, exit: 10, from: 11, to: 12, km: 13, mins: 14, round: 15, id: 16 });
const oldExport = ["Date", "Time", "Category", "Type", "Description", "Amount (RM)", "Source", "Parking location", "Parking operator", "Entry", "Exit", "Minutes parked", "From", "To", "Route", "Distance (km)", "Travel time (min)", "Note"];
const om = t.mapHeader(oldExport);
eq("older export header: Category is the type, Type is the kind", [om.cat, om.kind, om.place, om.operator, om.entry, om.route], [2, 3, 7, 8, 9, 14]);
// the template layout: title, legend, bands, header, example, entries
const rows = [
  ["Ringgit Log · expenses to import", null, null, null, "Total of your rows (RM)", 0],
  ["Type one expense per row…"],
  ["Every expense", null, null, null, null, null, null, "Parking only", null, null, null, "Trips only", null, null, null, null, "Leave blank"],
  tplHead,
  [46296, 0.7777777, "Parking", "Office parking", "Office car park", 9, "Example row", "Wisma Contoh", "Wilson Parking", 0.34375, 0.7777777, null, null, null, null, null, "EXAMPLE"],
  [46296, 0.34, "Food", null, "Kopitiam", 7.5],
  ["2/10/2026", "07:52", "Travel", "Toll", "LDP Penchala", "2.10"],
  [46297, 0.75, "Parking", "On-site parking", null, 3, null, "Jalan Telawi", "DBKL", "11:05", "12:10"],
  [46298, 0.38, "Travel", "Trip", "Client visit", 11, null, null, null, null, null, "Bangsar South", "Cyberjaya", 66.4, 72, "Yes"],
  [46299, null, null, null, "Lunch", 12],
  [46299, null, null, null, null, 4, null, "Menara Ujian", "Metro Parking"],
  [46300, null, "Gym", null, "Membership", 120],
  ["sometime", null, "Food", null, "Mystery", 5],
  [46301, null, "Food", null, "No amount"],
  [],
  [46302, null, "Travel", null, "Federal Highway drive", null, null, null, null, null, null, "PJ", "Shah Alam", 14, 25],
  [46303, null, "Bills", null, "Unifi", 129, null, null, null, null, null, null, null, null, null, null, "2026-10/r123abc"],
];
const res = t.importRowsFrom({ rows, date1904: false }, { places: ["Menara Ujian"] });
const brief = r => [r.line, r.date, r.time, r.cat, r.sub, r.merchant, r.amount, r.on, r.park ? r.park.kind + "|" + r.park.location + "|" + r.park.entry + "-" + r.park.exit + "|" + r.park.mins : "", r.trip ? r.trip.from + ">" + r.trip.to + "|" + r.trip.km + "|" + r.trip.mins + "|" + r.trip.round : "", r.refId, r.warn ? "W" : ""];
res.rows.forEach(r => console.log("   ", JSON.stringify(brief(r))));
eq("import counts", [res.rows.length, res.examples, res.blank, res.headerRow], [11, 1, 1, 4]);
eq("toll row", brief(res.rows[1]).slice(1, 8), ["2026-10-02", "07:52", "travel", "toll", "LDP Penchala", 2.1, true]);
eq("on-site parking row", brief(res.rows[2])[8], "onsite|Jalan Telawi|11:05-12:10|65");
eq("trip row", [res.rows[3].sub, brief(res.rows[3])[9]], ["toll", "Bangsar South>Cyberjaya|66.4|72|true"]);
eq("type inferred: other, parking from columns (office place)", [res.rows[4].cat, res.rows[5].cat, res.rows[5].park.kind], ["other", "parking", "office"]);
eq("unknown type warns", [res.rows[6].cat, !!res.rows[6].warn], ["other", true]);
eq("unreadable date is off", [res.rows[7].date, res.rows[7].on, !!res.rows[7].warn], ["", false, true]);
eq("missing amount is off", [res.rows[8].amount, res.rows[8].on], [0, false]);
eq("trip without toll still saves", [res.rows[9].cat, res.rows[9].trip ? res.rows[9].trip.km : 0, res.rows[9].on, res.rows[9].merchant], ["travel", 14, true, "Federal Highway drive"]);
eq("record id kept", res.rows[10].refId, "2026-10/r123abc");
// records from rows, and back out to the export columns
const rec = t.recordFromImport(res.rows[3], "b1", "2026-10-13T00:00:00.000Z");
eq("trip record", [rec.cat, rec.sub, rec.trip.basis, rec.trip.km, rec.trip.round, rec.src, rec.amount], ["travel", "toll", "sheet", 66.4, true, "sheet", 11]);
const ev = t.exportValues(Object.assign({}, rec, { id: "rX" }));
eq("export values", [ev.cat, ev.kind, ev.km, ev.mins, ev.round, ev.id, ev.receipt], ["Travel", "Trip", 66.4, 72, "Yes", "2026-10/rX", "No"]);
eq("missing evidence", [t.missingEvidence(rec), t.missingEvidence(Object.assign({}, rec, { att: [{ id: "a" }] })), t.missingEvidence({ cat: "food" }), t.missingEvidence({ cat: "parking", example: true })], [true, false, false, false]);
// CSV: semicolons, quotes, windows-1252 text
const csv = 'sep=;\r\nDate;Type;Description;Amount (RM)\r\n13/10/2026;Food;"Café; ""Kopi""";4,50\r\n14/10/2026;Parking;Lot;3\r\n';
const enc = Uint8Array.from(Buffer.from(csv, "latin1"));
const table = t.parseCsv(t.decodeText(enc.buffer));
eq("csv rows", table, [["Date", "Type", "Description", "Amount (RM)"], ["13/10/2026", "Food", "Café; \"Kopi\"", "4,50"], ["14/10/2026", "Parking", "Lot", "3"]]);
const r2 = t.importRowsFrom({ rows: table, date1904: false }, { places: [] });
eq("csv import", r2.rows.map(r => [r.date, r.cat, r.merchant, r.amount]), [["2026-10-13", "food", "Café; \"Kopi\"", 4.5], ["2026-10-14", "parking", "Lot", 3]]);
eq("serial round trip", [t.serialToYMD(t.ymdToSerial("2026-10-13")), t.colName(0), t.colName(16), t.colName(26)], ["2026-10-13", "A", "Q", "AA"]);
console.log(fails ? fails + " FAILED" : "all spreadsheet checks passed");
process.exit(fails ? 1 : 0);
