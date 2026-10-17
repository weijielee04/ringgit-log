// Pure-logic checks on the core module (no browser).
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync("src/01-core.js", "utf8") + "\n" + fs.readFileSync("src/06-sheets.js", "utf8") + "\n;globalThis.__t = { chunkPages, tilePlan, layoutText, normRow, salvageRows, markDuplicates, toCsv, minsBetween, isYMD, addMonths, daysIn, byDay, byCat, fmtShort, fmtMins, normTime, normRoute, tollText, extractPrompt, routePrompt, shotPrompt, store, cmpDesc, catLabel, guessParkKind };";
const ctx = { window: {}, document: {}, localStorage: { getItem: () => null, setItem: () => {} }, console, setTimeout, clearTimeout, Intl, URL, Promise, Math, JSON, Date, Number, String, Array, Object, Set, Map, isFinite, isNaN, parseFloat, TextDecoder, Uint8Array, React: { memo: f => f } };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const t = ctx.__t; let fails = 0;
const eq = (name, got, want) => { const a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) { fails++; console.log("FAIL", name, "\n   got ", a, "\n   want", b); } else console.log("ok  ", name); };
eq("isYMD valid", [t.isYMD("2026-10-11"), t.isYMD("2026-02-30"), t.isYMD("11/10/2026"), t.isYMD("")], [true, false, false, false]);
eq("addMonths across years", [t.addMonths("2026-01", -1), t.addMonths("2026-12", 1), t.addMonths("2026-10", -5)], ["2025-12", "2027-01", "2026-05"]);
eq("daysIn", [t.daysIn("2026-02"), t.daysIn("2028-02"), t.daysIn("2026-10")], [28, 29, 31]);
eq("minsBetween", [t.minsBetween("08:15", "18:40"), t.minsBetween("23:30", "00:45"), t.minsBetween("", "10:00")], [625, 75, null]);
eq("normTime", [t.normTime("7:05"), t.normTime("19:40:22"), t.normTime("25:00"), t.normTime("noon")], ["07:05", "19:40", "", ""]);
eq("fmtShort", [t.fmtShort(3350), t.fmtShort(13340), t.fmtShort(123456), t.fmtShort(1500000)], ["33.50", "133", "1.2k", "15k"]);
eq("fmtMins", [t.fmtMins(45).replace(/ /g, " "), t.fmtMins(125).replace(/ /g, " "), t.fmtMins(120).replace(/ /g, " ")], ["45 min", "2 h 5 min", "2 h"]);
// money: cents add exactly
const recs = [{ date: "2026-10-01", amount: 0.1, cat: "food" }, { date: "2026-10-01", amount: 0.2, cat: "food" }, { date: "2026-10-03", amount: 19.99, cat: "weird" }];
const days = t.byDay(recs, "2026-10");
eq("byDay totals in cents", [days[0].total, days[2].total, days[2].parts.other, days.length], [30, 1999, 1999, 31]);
eq("byCat", t.byCat(recs), { food: 30, travel: 0, parking: 0, shopping: 0, bills: 0, other: 1999 });
// tiles
const plan = (w, h, m) => { const p = t.tilePlan(w, h, m); return [p.n, p.W, p.H, p.bands.map(b => b[1] - b[0])]; };
console.log("tilePlan phone 1170x2532 max4:", JSON.stringify(plan(1170, 2532, 4)));
console.log("tilePlan camera 3024x4032 max4:", JSON.stringify(plan(3024, 4032, 4)));
console.log("tilePlan small 800x600 max4:", JSON.stringify(plan(800, 600, 4)));
console.log("tilePlan camera max1:", JSON.stringify(plan(3024, 4032, 1)));
const p4 = t.tilePlan(3024, 4032, 4); eq("every tile under ~1.3 MP", p4.bands.every(b => (b[1] - b[0]) * p4.W < 1.3e6), true);
eq("bands cover the whole height", [p4.bands[0][0], p4.bands[p4.bands.length - 1][1]], [0, p4.H]);
// chunking
const pages = Array.from({ length: 6 }, (_, i) => ("row " + (i + 1) + " " + "x".repeat(40) + "\n").repeat(70));
const ch = t.chunkPages(pages, 7000);
eq("chunkPages keeps every page once, two pages per chunk when they fit", [ch.length, ch.map(c => c.from + "-" + c.to).join(","), ch.every(c => c.text.length <= 7200)], [3, "1-2,3-4,5-6", true]);
const ch2 = t.chunkPages(["a".repeat(3000), "b".repeat(3000), "c".repeat(3000)], 7000);
eq("chunkPages merges small pages", ch2.map(c => c.from + "-" + c.to), ["1-2", "3-3"]);
const big = Array.from({ length: 400 }, (_, i) => "line " + i + " " + "y".repeat(50)).join("\n");
const ch3 = t.chunkPages([big], 7000);
eq("chunkPages splits one long page by lines without losing any", [ch3.every(c => c.text.length <= 7000), ch3.map(c => c.text).join("\n") === big], [true, true]);
// layout text: fragments of one number stay glued, columns stay apart
const it = (str, x, y, w) => ({ str, transform: [1, 0, 0, 9, x, y], width: w, height: 9 });
const txt = t.layoutText([it("DATE", 40, 760, 22), it("WITHDRAWAL", 330, 760, 60), it("02/09/2026", 40, 744, 48), it("JAYA GROCER", 100, 744, 60), it("1,2", 360, 744, 14), it("88.40", 374, 744, 24), it("4,122.15", 500, 743.6, 38)]);
console.log(txt);
eq("glued number", /1,288\.40/.test(txt), true);
eq("two lines", txt.split("\n").length, 2);
// rows
const ctxMixed = { type: "mixed", places: ["Wisma Contoh"], parkKind: "" };
const r1 = t.normRow({ date: "2026-10-03", time: "9:05", merchant: "  Wilson   Parking  Wisma Contoh ", amount: "RM 9.00", kind: "expense", cat: "parking", park: { location: "Wisma Contoh", operator: "Wilson Parking", entry: "08:00", exit: "18:30" }, sure: true }, ctxMixed, 0);
eq("normRow parking", [r1.amount, r1.time, r1.merchant, r1.park.kind, r1.park.mins, r1.on], [9, "09:05", "Wilson Parking Wisma Contoh", "office", 630, true]);
const r2 = t.normRow({ date: "03/10/2026", merchant: "", amount: -12.345, kind: "topup", cat: "nonsense" }, { type: "food", fallbackDate: "2026-10-05" }, 1);
eq("normRow fallbacks", [r2.date, r2.amount, r2.cat, r2.on, r2.sure, r2.merchant], ["2026-10-05", 12.35, "food", false, false, "Food"]);
eq("normRow rejects junk", [t.normRow({ amount: "abc" }, ctxMixed, 0), t.normRow({ amount: 0, date: "2026-10-01" }, ctxMixed, 0), t.normRow(null, ctxMixed, 0)], [null, null, null]);
const cut = '{"source":"tng","period":"","rows":[{"date":"2026-10-01","time":"08:00","merchant":"A","amount":2.1,"kind":"expense","cat":"travel","sub":"toll","park":null,"sure":true},{"date":"2026-10-02","time":"","merchant":"B","amount":9,"kind":"expense","cat":"parking","sub":"","park":{"location":"X","operator":"","entry":"","exit":"","mins":null},"sure":true},{"date":"2026-10-03","merch';
eq("salvage rows from a cut-off reply", t.salvageRows(cut).map(r => r.merchant), ["A", "B"]);
// routes
const rt = t.normRoute({ name: "via E1", roads: ["E1 NKVE"], km: "24.5 km", mins: 30, mins_peak: 55, tolls: [{ plaza: "Jalan Duta", road: "NKVE", rm: 2.1 }, { plaza: "X", rm: "1.75" }] });
eq("normRoute sums tolls", [rt.km, rt.mins, rt.toll, rt.tollNote], [24.5, 30, 3.85, "estimated"]);
const rs = t.normRoute({ name: "A", km: 10, mins: 12, toll_shown: true, toll_rm: 4.2, tolls: [] });
eq("normRoute uses the shown toll", [rs.toll, rs.tollNote], [4.2, "shown"]);
// csv
const csv = t.toCsv([{ id: "a1", date: "2026-10-02", time: "08:00", amount: 9, cat: "parking", merchant: 'Wisma "A", KL', src: "tng", park: { kind: "office", location: "Wisma A", operator: "=cmd", entry: "08:00", exit: "18:00", mins: 600 } }, { id: "b2", date: "2026-10-01", amount: 2.1, cat: "travel", sub: "toll", merchant: "-5 toll", src: "manual" }]);
console.log(csv.replace("﻿", ""));
eq("csv quoting and formula guard", [csv.includes('"Wisma ""A"", KL"'), csv.includes("'=cmd"), csv.includes("-5 toll") && !csv.includes("'-5 toll") ? "raw" : "guarded", csv.split("\r\n")[1].startsWith("2026-10-01")], [true, true, "guarded", true]);
// prompts carry the toll table and stay well under the input cap
console.log("prompt sizes:", t.routePrompt("A", "B").length, t.shotPrompt(2).length, t.extractPrompt({ type: "parking", parkKind: "office" }, { mode: "image", count: 3 }).length);
eq("extract prompt mentions the stated type", /at the user's office/.test(t.extractPrompt({ type: "parking", parkKind: "office" }, { mode: "image", count: 1 })), true);
eq("park kind guess", [t.guessParkKind("WILSON PARKING - WISMA CONTOH", ["Wisma Contoh"]), t.guessParkKind("Mid Valley", ["Wisma Contoh"])], ["office", "onsite"]);
console.log(fails ? fails + " FAILED" : "all unit checks passed");
process.exit(fails ? 1 : 0);
