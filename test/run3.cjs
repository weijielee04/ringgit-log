// Third pass: spreadsheet import, the Excel export round trip, and receipts attached afterwards.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { chromium } = require("playwright");
const helpers = fs.readFileSync(path.join(__dirname, "run.cjs"), "utf8").split("(async () => {")[0]
  .replace('const { chromium } = require("playwright");', "").replace('const fs = require("fs");', "").replace('const path = require("path");', "");
eval(helpers.replace(/^const /gm, "var "));
var SHEETS = path.join(__dirname, "sheets");
var FILES = path.join(SHOTS, "files"); fs.mkdirSync(FILES, { recursive: true });
var only = process.env.ONLY || "";

var recsOf = page => page.evaluate(() => { const out = []; window.__mock.docs.forEach((v, k) => { const p = k.split("/"); if (p.length === 6 && !v.example) out.push(Object.assign({ _ym: p[4], _id: p[5] }, v)); }); return out; });
var exampleCount = page => page.evaluate(() => { let n = 0; window.__mock.docs.forEach(v => { if (v.example) n++; }); return n; });
var openImport = async page => { await nav(page, "Records"); await page.locator(".toolbar .btn", { hasText: "Import from Excel" }).click(); await page.waitForSelector("#imp-file", { state: "attached" }); };
var review = page => page.evaluate(() => Array.from(document.querySelectorAll(".modal .rv")).map(r => {
  const q = s => r.querySelector(s);
  return { on: q(".rv-chk input").checked, date: q(".rv-date").value, time: q(".rv-time").value, mer: q(".rv-mer").value, cat: q(".rv-cat").value, amt: q(".rv-amt").value,
    extra: Array.from(r.querySelectorAll(".rv-extra input:not([type=checkbox]), .rv-extra select")).map(x => x.value).join("|") + (q(".rv-extra input[type=checkbox]") ? "|round=" + q(".rv-extra input[type=checkbox]").checked : ""),
    tags: Array.from(r.querySelectorAll(".rv-tags .tag")).map(t => t.innerText).join(" / ") };
}));
var printReview = (label, rows) => { log(label + " (" + rows.length + " rows):"); rows.forEach(r => log("   " + (r.on ? "[x]" : "[ ]"), r.date || "-", r.time || "--:--", r.cat.padEnd(8), String(r.amt).padStart(7), JSON.stringify(r.mer), r.extra ? "{" + r.extra + "}" : "", "·", r.tags)); };
var saveBlob = async (page, idx, file) => { const b64 = await page.evaluate(i => window.__mock.saves[i].b64, idx); fs.writeFileSync(file, Buffer.from(b64, "base64")); return file; };
var toastText = page => page.locator(".toast").allInnerTexts();
var py = (args) => { try { return cp.execFileSync("python3", args, { encoding: "utf8" }); } catch (e) { return "PY FAILED\n" + (e.stdout || "") + (e.stderr || ""); } };
var waitRecs = (page, fn, arg) => page.waitForFunction(new Function("arg", "const out = []; window.__mock.docs.forEach((v, k) => { const p = k.split('/'); if (p.length === 6 && !v.example) out.push(v); }); return (" + fn + ")(out, arg);"), arg, { timeout: 15000 });

(async () => {
  const browser = await chromium.launch();
  /* ---------- I1: desktop, light, cloud ledger with the example data ---------- */
  if (!only || only.includes("1")) {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 1440, height: 900 } });
    await page.waitForSelector(".donut-list .dl-row"); await page.waitForTimeout(300);

    /* settings card and the template download */
    await nav(page, "Settings"); await shot(page, "60-settings-sheets");
    await page.locator(".btn", { hasText: "Download template" }).click();
    await page.waitForFunction(() => window.__mock.saves.length === 1, null, { timeout: 10000 });
    const tpl = await saveBlob(page, 0, path.join(FILES, "template-download.xlsx"));
    const same = Buffer.compare(fs.readFileSync(tpl), fs.readFileSync(path.join(ROOT, "template/ringgit-log-template.xlsx"))) === 0;
    log("I1 template save:", JSON.stringify(await page.evaluate(() => ({ filename: window.__mock.saves[0].filename, size: window.__mock.saves[0].size, type: window.__mock.saves[0].type }))), "| same bytes as the template:", same, "| toast:", JSON.stringify(await toastText(page)));

    /* the add-expense window points to the import */
    await page.locator(".top .btn.primary", { hasText: "Add expense" }).click(); await page.waitForSelector(".tiles");
    await page.locator(".modal .linkish", { hasText: "Import from Excel" }).click();
    await page.waitForSelector("#imp-file", { state: "attached" });
    log("I1 wizard link opens:", await page.locator(".modal-head h2, .modal-head .modal-title").first().innerText().catch(() => "?"));
    await shot(page, "61-import-pick", { fullPage: false });

    /* files that can't be imported */
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "notes.xlsx"));
    await page.waitForSelector(".modal .banner.bad"); log("I1 no header:", await page.locator(".modal .banner.bad").innerText());
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "old.xls"));
    await page.waitForFunction(() => /\.xls file/.test((document.querySelector(".modal .banner.bad") || {}).innerText || ""), null, { timeout: 5000 });
    log("I1 old xls:", await page.locator(".modal .banner.bad").innerText());

    /* the filled-in template */
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "filled.xlsx"));
    await page.waitForSelector(".modal .rv", { timeout: 15000 }); await page.waitForTimeout(200);
    printReview("I1 review of filled.xlsx", await review(page));
    log("I1 head:", await page.locator(".modal .slip-head").innerText(), "| notes:", JSON.stringify(await page.locator(".modal .banner.warn").allInnerTexts()), "| note:", await page.locator(".modal p.note").innerText());
    log("I1 button:", await page.locator(".modal-foot .btn.primary").innerText());
    await shot(page, "62-import-review", { fullPage: false });
    await page.locator(".overlay").evaluate(el => { el.scrollTop = el.scrollHeight; }); await page.waitForTimeout(100);
    await shot(page, "63-import-review-end", { fullPage: false });
    /* fixing the two rows that can't be saved yet ticks them */
    const teh = page.locator(".modal .rv", { has: page.locator("input.rv-mer[value='Teh tarik']") });
    await teh.locator(".rv-amt").fill("4.50"); await teh.locator(".rv-amt").blur(); await page.waitForTimeout(100);
    const roti = page.locator(".modal .rv", { has: page.locator("input.rv-mer[value='Roti canai']") });
    await roti.locator(".rv-date").fill("2026-10-12"); await page.waitForTimeout(100);
    log("I1 after fixing: teh ticked", await teh.locator(".rv-chk input").isChecked(), "| roti ticked", await roti.locator(".rv-chk input").isChecked(), "| button:", await page.locator(".modal-foot .btn.primary").innerText());
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(400);
    let recs = await recsOf(page);
    log("I1 saved:", recs.length, "| toasts:", JSON.stringify(await toastText(page)));
    recs.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).forEach(r => log("   ", r._ym, r.date, r.time || "--:--", r.cat, r.sub || "-", r.amount, JSON.stringify(r.merchant), r.note ? "note=" + JSON.stringify(r.note) : "", r.park ? "park=" + JSON.stringify(r.park) : "", r.trip ? "trip=" + JSON.stringify(r.trip) : "", "src=" + r.src, r.batch ? "batch" : "NO BATCH"));
    await page.waitForFunction(() => { let n = 0; window.__mock.docs.forEach(v => { if (v.example) n++; }); return n === 0; }, null, { timeout: 30000 });
    log("I1 examples left:", await exampleCount(page), "| office places:", JSON.stringify(await page.evaluate(() => (window.__mock.docs.get("data/users/" + window.__mock.uid + "/ledger") || {}).officePlaces)));

    /* undo puts everything back the way it was */
    await page.locator(".toast button", { hasText: "Undo" }).last().click();
    await waitRecs(page, "(l) => l.length === 0");
    await page.waitForTimeout(300);
    log("I1 after undo:", (await recsOf(page)).length, "| toasts:", JSON.stringify(await toastText(page)));

    /* import again, then a third time: the second copy is flagged */
    await openImport(page);
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "filled.xlsx")); await page.waitForSelector(".modal .rv", { timeout: 15000 });
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    log("I1 imported again:", (await recsOf(page)).length);
    await openImport(page);
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "filled.xlsx")); await page.waitForSelector(".modal .rv", { timeout: 15000 }); await page.waitForTimeout(150);
    const rv3 = await review(page);
    log("I1 third import: flagged", rv3.filter(r => /already recorded/.test(r.tags)).length, "of", rv3.length, "| ticked", rv3.filter(r => r.on).length, "| notes:", JSON.stringify(await page.locator(".modal .banner.warn").allInnerTexts()), "| button:", await page.locator(".modal-foot .btn.primary").innerText());
    await page.locator(".modal-head .icon-btn").click(); await page.waitForTimeout(150);

    /* overview: the missing-receipt banner and its shortcut */
    await nav(page, "Overview"); await page.waitForTimeout(250);
    log("I1 overview banner:", JSON.stringify(await page.locator(".content > .banner").allInnerTexts()));
    await shot(page, "64-overview-missing");
    await page.locator(".banner .btn", { hasText: "Show them" }).click(); await page.waitForTimeout(250);
    log("I1 show them -> page:", await page.locator(".top h1").innerText(), "| chip on:", await page.locator(".chip.is-on", { hasText: "No receipt yet" }).count(), "| rows:", await page.locator(".rows .row").count(), "| head:", await page.locator(".card-head .card-sub").first().innerText());
    await shot(page, "65-records-missing");
    log("I1 row tags:", JSON.stringify(await page.locator(".rows .row .tag").allInnerTexts()));
    await page.locator(".chip.is-on", { hasText: "No receipt yet" }).click(); await page.waitForTimeout(150);
    log("I1 chip off rows:", await page.locator(".rows .row").count());

    /* export, check the file, edit it and import it back */
    await page.locator(".btn", { hasText: "Export to Excel" }).click();
    await page.waitForFunction(() => window.__mock.saves.length === 2, null, { timeout: 10000 });
    const exp = await saveBlob(page, 1, path.join(FILES, "export.xlsx"));
    log("I1 export:", JSON.stringify(await page.evaluate(() => ({ filename: window.__mock.saves[1].filename, size: window.__mock.saves[1].size, type: window.__mock.saves[1].type }))), "| toast:", JSON.stringify(await toastText(page)));
    log("I1 export check:\n" + py([path.join(__dirname, "check_export.py"), exp, "--edit", path.join(FILES, "edited.xlsx")]));
    const lo = cp.spawnSync("soffice", ["--headless", "--convert-to", "csv", "--outdir", FILES, exp], { encoding: "utf8", timeout: 120000 });
    log("I1 LibreOffice opens the export:", (lo.stdout || "").trim().split("\n").pop(), "\n" + (fs.existsSync(path.join(FILES, "export.csv")) ? fs.readFileSync(path.join(FILES, "export.csv"), "utf8").split("\n").slice(0, 4).join("\n") : "NO CSV"));
    const before = await recsOf(page);
    await openImport(page);
    await page.locator("#imp-file").setInputFiles(path.join(FILES, "edited.xlsx")); await page.waitForSelector(".modal .rv", { timeout: 15000 }); await page.waitForTimeout(150);
    const rvE = await review(page);
    printReview("I1 review of the edited export", rvE);
    log("I1 edited: updates", rvE.filter(r => /Updates a saved record/.test(r.tags)).length, "| button:", await page.locator(".modal-foot .btn.primary").innerText(), "| note:", await page.locator(".modal p.note").innerText());
    await shot(page, "66-import-updates", { fullPage: false });
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(400);
    const after = await recsOf(page);
    const byId = l => { const m = {}; l.forEach(r => { m[r._id] = r; }); return m; };
    const bm = byId(before), am = byId(after);
    log("I1 after round trip: before", before.length, "after", after.length, "| same ids kept:", before.every(r => am[r._id]), "| new ids:", JSON.stringify(after.filter(r => !bm[r._id]).map(r => r.merchant + " " + r.amount)));
    const nk = after.find(r => r.merchant === "Nasi kandar"), kp = after.find(r => r.merchant === "Kopitiam"), pl = after.find(r => /PLUS/.test(r.merchant));
    log("I1 changed:", JSON.stringify({ nasi: nk && [nk._ym, nk.amount, nk.src], kopitiam: kp && [kp._ym, kp.date, kp.time], plus: pl && [pl.merchant, pl.time, pl.sub], parkKept: JSON.stringify(after.find(r => r.merchant === "Office car park").park) }));
    log("I1 toasts:", JSON.stringify(await toastText(page)));
    await page.locator(".toast button", { hasText: "Undo" }).last().click();
    await waitRecs(page, "(l) => !l.some(r => r.merchant === 'Mamak') && l.some(r => r.merchant === 'Nasi kandar' && r.amount === 13.5)");
    await page.waitForTimeout(300);
    const undone = await recsOf(page);
    const kp2 = undone.filter(r => r.merchant === "Kopitiam");
    log("I1 undo of the update:", undone.length, "records | Kopitiam:", JSON.stringify(kp2.map(r => [r._ym, r.date])), "| PLUS:", JSON.stringify(undone.filter(r => /PLUS/.test(r.merchant)).map(r => r.merchant)));

    /* receipts afterwards: a parking record */
    await nav(page, "Records");
    await page.locator(".rows .row", { hasText: "Office car park" }).first().click(); await page.waitForSelector(".modal .ev-box");
    log("I1 record ev box:", (await page.locator(".modal .ev-box").innerText()).replace(/\n/g, " | "));
    await shot(page, "67-record-no-receipt", { fullPage: false });
    await page.locator("#e-files").setInputFiles(path.join(__dirname, "tng.png")); await page.waitForSelector(".modal .ev img");
    log("I1 staged:", (await page.locator(".modal .ev-box").innerText()).replace(/\n/g, " | "), "| save button:", await page.locator(".modal-foot .btn.primary").innerText());
    await page.locator(".modal .ev .btn", { hasText: "Fill in from it" }).click();
    await page.waitForFunction(() => { const b = document.querySelector(".modal .ev-box .banner"); return b && !/Reading/.test(b.innerText); }, null, { timeout: 15000 });
    log("I1 fill banner:", await page.locator(".modal .ev-box .banner").innerText());
    await shot(page, "68-record-fill", { fullPage: false });
    const upBefore = await page.evaluate(() => window.__mock.uploads.length);
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    let ocp = (await recsOf(page)).find(r => r.merchant === "Office car park");
    log("I1 attached:", JSON.stringify(ocp.att), "| uploads +", (await page.evaluate(() => window.__mock.uploads.length)) - upBefore, JSON.stringify(await page.evaluate(() => window.__mock.uploads.slice(-1))), "| toast:", JSON.stringify(await toastText(page)));
    log("I1 row tag now:", await page.locator(".rows .row", { hasText: "Office car park" }).first().locator(".tag").allInnerTexts().then(JSON.stringify));
    await page.locator(".rows .row", { hasText: "Office car park" }).first().click(); await page.waitForSelector(".modal .ev-box");
    await page.locator(".modal .ev .btn", { hasText: "View" }).click(); await page.waitForSelector(".modal img.receipt-img");
    log("I1 reopened:", (await page.locator(".modal .ev-box").innerText()).replace(/\n/g, " | "));
    await shot(page, "69-record-receipt", { fullPage: false });
    await page.locator(".modal .ev .icon-btn[aria-label^='Remove']").click(); await page.waitForTimeout(100);
    log("I1 after remove click:", (await page.locator(".modal .ev-box").innerText()).replace(/\n/g, " | "));
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    ocp = (await recsOf(page)).find(r => r.merchant === "Office car park");
    log("I1 removed:", JSON.stringify({ att: ocp.att || null }), "| assets deleted:", JSON.stringify(await page.evaluate(() => window.__mock.deleted)));

    /* a trip with no distance: the screenshot fills it in */
    await page.locator(".rows .row", { hasText: "KLIA" }).first().click(); await page.waitForSelector(".modal .ev-box");
    log("I1 trip form:", JSON.stringify(await page.evaluate(() => ["e-from", "e-to", "e-km", "e-mins", "e-amount"].map(id => (document.getElementById(id) || {}).value))));
    await page.locator("#e-files").setInputFiles(path.join(__dirname, "tng.png")); await page.waitForSelector(".modal .ev img");
    await page.locator(".modal .ev .btn", { hasText: "Fill in from it" }).click();
    await page.waitForFunction(() => { const b = document.querySelector(".modal .ev-box .banner"); return b && !/Reading/.test(b.innerText); }, null, { timeout: 15000 });
    log("I1 trip fill:", await page.locator(".modal .ev-box .banner").innerText(), "| form now:", JSON.stringify(await page.evaluate(() => ["e-from", "e-to", "e-km", "e-mins", "e-amount"].map(id => (document.getElementById(id) || {}).value))));
    await shot(page, "70-trip-fill", { fullPage: false });
    const useBtn = page.locator(".modal .ev-box .banner .btn", { hasText: /^Use RM/ });
    if (await useBtn.count()) { await useBtn.click(); await page.waitForTimeout(120); log("I1 used the shown toll, amount:", await page.locator("#e-amount").inputValue(), "| banner:", (await page.locator(".modal .ev-box .banner").innerText()).replace(/\n/g, " | ")); }
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    const klia = (await recsOf(page)).find(r => r.trip && r.trip.to === "KLIA");
    log("I1 trip saved:", JSON.stringify({ amount: klia.amount, trip: klia.trip, att: (klia.att || []).length, sub: klia.sub }));

    /* a PDF receipt on a toll record, then deleting that record removes its files */
    await page.locator(".rows .row", { hasText: "PLUS" }).first().click(); await page.waitForSelector(".modal .ev-box");
    await page.locator("#e-files").setInputFiles([path.join(__dirname, "statement.pdf"), path.join(__dirname, "tng.png")]); await page.waitForTimeout(200);
    log("I1 two staged:", (await page.locator(".modal .ev-box").innerText()).replace(/\n/g, " | "), "| button:", await page.locator(".modal-foot .btn.primary").innerText());
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    const plus = (await recsOf(page)).find(r => /PLUS/.test(r.merchant));
    log("I1 PLUS att:", JSON.stringify(plus.att.map(a => ({ pdf: a.pdf, name: a.name }))), "| upload types:", JSON.stringify(await page.evaluate(() => window.__mock.uploads.slice(-2).map(u => u.type))), "| toast:", JSON.stringify(await toastText(page)));
    await page.locator(".rows .row", { hasText: "PLUS" }).first().click(); await page.waitForSelector(".modal .ev-box");
    log("I1 PLUS reopened:", (await page.locator(".modal .ev-box").innerText()).replace(/\n/g, " | "), "| open link:", await page.locator(".modal .ev a.btn").getAttribute("href"));
    await page.locator(".modal-foot .btn", { hasText: "Delete" }).click();
    log("I1 delete confirm:", await page.locator(".modal-foot").innerText().then(t => t.replace(/\n/g, " | ")));
    const delBefore = await page.evaluate(() => window.__mock.deleted.length);
    await page.locator(".modal-foot .btn.primary", { hasText: "Delete" }).click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    log("I1 deleted record's files:", (await page.evaluate(() => window.__mock.deleted.length)) - delBefore, "| left:", (await recsOf(page)).length);

    /* the month's export with receipts marked, then the CSV fallback when the Excel writer is missing */
    await page.evaluate(() => { window.JSZip = function () { throw new Error("writer broke"); }; });
    await page.locator(".btn", { hasText: "Export to Excel" }).click();
    await page.waitForFunction(() => window.__mock.saves.length === 3, null, { timeout: 10000 });
    log("I1 export without the Excel writer:", JSON.stringify(await page.evaluate(() => { const s = window.__mock.saves[2]; return { filename: s.filename, head: s.head.slice(0, 300) }; })));
    log("I1 errors:", JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- I2: phone, dark ---------- */
  if (!only || only.includes("2")) {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 390, height: 844 }, dpr: 2, dark: true, touch: true });
    await page.waitForSelector(".donut-list .dl-row"); await page.waitForTimeout(300);
    await tab(page, "Records");
    await page.locator(".toolbar .btn", { hasText: "Import from Excel" }).click(); await page.waitForSelector("#imp-file", { state: "attached" });
    await shot(page, "71-m-import-pick", { fullPage: false });
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "filled.xlsx")); await page.waitForSelector(".modal .rv", { timeout: 15000 }); await page.waitForTimeout(200);
    await shot(page, "72-m-import-review", { fullPage: false });
    log("I2 overflow:", JSON.stringify(await overflow(page)), "| modal:", JSON.stringify(await page.locator(".modal").evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }))), "| widest row:", await page.evaluate(() => Math.max.apply(null, Array.from(document.querySelectorAll(".modal .rv")).map(r => r.scrollWidth - r.clientWidth))));
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(400);
    await tab(page, "Home"); await page.waitForTimeout(200);
    await shot(page, "73-m-overview-missing", { fullPage: false });
    log("I2 overview overflow:", JSON.stringify(await overflow(page)));
    await tab(page, "Records"); await page.waitForTimeout(200);
    log("I2 records toolbar:", JSON.stringify(await page.locator(".toolbar").nth(1).locator(".btn, .chip").allInnerTexts()), "| overflow:", JSON.stringify(await overflow(page)));
    await shot(page, "74-m-records");
    await page.locator(".rows .row", { hasText: "Mid Valley" }).first().click(); await page.waitForSelector(".modal .ev-box");
    await page.locator("#e-files").setInputFiles(path.join(__dirname, "tng.png")); await page.waitForSelector(".modal .ev img");
    await page.locator(".overlay").evaluate(el => { el.scrollTop = el.scrollHeight; }); await page.waitForTimeout(100);
    await shot(page, "75-m-record-attach", { fullPage: false });
    await page.locator(".overlay").evaluate(el => { el.scrollTop = el.scrollHeight / 2; }); await page.waitForTimeout(100);
    await shot(page, "76-m-record-mid", { fullPage: false });
    log("I2 record modal:", JSON.stringify(await page.locator(".modal").evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }))));
    log("I2 errors:", JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- I3: saved file with no host: local storage, CSV, LibreOffice-saved workbook ---------- */
  if (!only || only.includes("3")) {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 1280, height: 860 }, mock: false });
    await page.waitForSelector(".empty .btn.primary"); await page.waitForTimeout(200);
    log("I3 empty state buttons:", JSON.stringify(await page.locator(".empty .btn").allInnerTexts()));
    await page.locator(".empty .btn", { hasText: "Import from Excel" }).click(); await page.waitForSelector("#imp-file", { state: "attached" });
    await page.locator(".modal .btn", { hasText: "Download template" }).click(); await page.waitForTimeout(150);
    log("I3 template without downloads:", JSON.stringify(await toastText(page)));
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "lo", "filled.xlsx")); await page.waitForSelector(".modal .rv", { timeout: 15000 }); await page.waitForTimeout(150);
    printReview("I3 review of the LibreOffice copy", await review(page));
    await page.locator(".modal-foot .btn", { hasText: "Change file" }).click();
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "october.csv")); await page.waitForSelector(".modal .rv", { timeout: 15000 }); await page.waitForTimeout(150);
    printReview("I3 review of october.csv", await review(page));
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    await page.reload(); await page.waitForTimeout(800);
    await nav(page, "Records"); await page.waitForTimeout(200);
    log("I3 after reload rows:", await page.locator(".rows .row").count(), "| missing chip:", JSON.stringify(await page.locator(".chip", { hasText: "No receipt yet" }).allInnerTexts()));
    await page.locator(".btn", { hasText: "Export to Excel" }).click(); await page.waitForSelector("#copy-text");
    log("I3 export as text:\n" + (await page.locator("#copy-text").inputValue()).split("\r\n").join("\n"));
    await page.locator(".modal-foot .btn", { hasText: "Close" }).click();
    await page.locator(".rows .row", { hasText: "Pavilion" }).first().click(); await page.waitForSelector(".modal .ev-box");
    log("I3 record without assets:", (await page.locator(".modal .ev-box").innerText()).replace(/\n/g, " | "));
    await page.locator(".modal-head .icon-btn").click();
    log("I3 errors:", JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- I4: the Excel reader can't load ---------- */
  if (!only || only.includes("4")) {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 1280, height: 860 }, noJszip: true });
    await page.waitForSelector(".donut-list .dl-row"); await page.waitForTimeout(200);
    await openImport(page);
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "filled.xlsx"));
    await page.waitForSelector(".modal .banner.bad", { timeout: 15000 });
    log("I4 no reader:", await page.locator(".modal .banner.bad").innerText());
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "october.csv")); await page.waitForSelector(".modal .rv", { timeout: 15000 });
    log("I4 csv still works:", await page.locator(".modal .rv").count(), "rows");
    /* a save failure keeps the review open */
    await page.evaluate(() => { window.__mock.dbFail = { code: "quota_exceeded", message: "full" }; });
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".modal .banner.bad", { timeout: 15000 });
    log("I4 save failure:", await page.locator(".modal .banner.bad").innerText(), "| rows kept:", await page.locator(".modal .rv").count());
    await page.evaluate(() => { window.__mock.dbFail = null; });
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    log("I4 saved after retry:", (await recsOf(page)).length, "| toasts:", JSON.stringify(await toastText(page)));
    log("I4 errors:", JSON.stringify(errors.filter(e => !/jszip|Failed to load resource/.test(e))));
    await ctx.close();
  }
  /* ---------- I5: the save prompt refuses or the template is missing ---------- */
  if (!only || only.includes("5")) {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 1280, height: 860 } });
    await page.waitForSelector(".donut-list .dl-row"); await page.waitForTimeout(200);
    await nav(page, "Settings");
    await page.evaluate(() => { window.__mock.saveFail = { code: "extension_not_enabled", message: "off" }; });
    await page.locator(".btn", { hasText: "Download template" }).click(); await page.waitForTimeout(300);
    log("I5 xlsx not enabled:", JSON.stringify(await toastText(page)));
    await page.evaluate(() => { window.__mock.saveFail = { code: "declined", message: "no" }; });
    const n0 = (await toastText(page)).length;
    await page.locator(".btn", { hasText: "Download template" }).click(); await page.waitForTimeout(300);
    log("I5 declined adds toasts:", (await toastText(page)).length - n0 > 0 && !(await toastText(page)).some(t => /declin|Couldn't/.test(t)) ? "no message" : JSON.stringify(await toastText(page)));
    await openImport(page);
    await page.locator("#imp-file").setInputFiles(path.join(SHEETS, "october.csv")); await page.waitForSelector(".modal .rv", { timeout: 15000 });
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    await page.evaluate(() => { window.__mock.saveFail = { code: "extension_not_enabled", message: "off" }; });
    await page.locator(".btn", { hasText: "Export to Excel" }).click(); await page.waitForSelector("#copy-text", { timeout: 5000 });
    log("I5 export when xlsx is off:", JSON.stringify(await toastText(page)), "| copy text lines:", (await page.locator("#copy-text").inputValue()).split("\n").length);
    log("I5 errors:", JSON.stringify(errors));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
