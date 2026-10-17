// Second pass: paths the first run did not reach (scanned PDFs, failures, undo, navigation, fallbacks).
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const helpers = fs.readFileSync(path.join(__dirname, "run.cjs"), "utf8").split("(async () => {")[0]
  .replace('const { chromium } = require("playwright");', "").replace('const fs = require("fs");', "").replace('const path = require("path");', "");
eval(helpers.replace(/^const /gm, "var "));
(async () => {
  const browser = await chromium.launch();
  {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 1440, height: 900 }, flags: { cacheFirst: true, noDownloads: true } });
    await page.waitForTimeout(350);
    log("A at 350ms (cached empty first):", JSON.stringify(await page.locator(".empty h3").allInnerTexts()), "| stat:", (await page.locator(".stat").first().innerText()).replace(/\n/g, " "));
    await page.waitForSelector(".donut-list .dl-row", { timeout: 8000 });
    log("A after server snapshot rows:", await page.locator(".rows .row").count());
    /* chart click goes to the calendar day; month navigation */
    await page.locator(".chart svg g rect[fill=transparent]").nth(2).click(); await page.waitForTimeout(250);
    log("A chart click -> page:", await page.locator(".top h1").innerText(), "| day panel:", await page.locator(".split .card").nth(1).locator("h2").innerText());
    await page.locator(".month button[aria-label='Previous month']").click(); await page.waitForTimeout(300);
    log("A prev month:", await page.locator(".month-label").innerText(), "| summary:", (await page.locator(".cal-summary").innerText()).replace(/\n/g, " | "), "| sel:", await page.locator(".split .card").nth(1).locator("h2").innerText());
    await page.locator(".top .btn", { hasText: "This month" }).click(); await page.waitForTimeout(200);
    /* a trip record opens with its details */
    await nav(page, "Trips & toll");
    await page.locator(".rows .row", { hasText: "Cyberjaya" }).first().click(); await page.waitForSelector(".modal .kv");
    log("A trip record:", (await page.locator(".modal .kv").innerText()).replace(/\n/g, " | "));
    await shot(page, "50-trip-record", { fullPage: false });
    await page.locator(".modal-head .icon-btn").click();
    /* clear examples from the banner */
    await page.locator(".banner .btn", { hasText: "Clear examples" }).click();
    await page.waitForFunction(() => { let n = 0; window.__mock.docs.forEach(v => { if (v.example) n++; }); return n === 0; }, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    log("A after clear: docs", JSON.stringify(await docCount(page)), "| banner left:", await page.locator(".banner", { hasText: "example data" }).count());

    /* scanned PDF (two image pages) plus the same screenshot twice: rows with a time are not doubled */
    await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
    await page.locator(".tile", { hasText: "Mixed statement" }).click(); await page.locator(".modal-foot .btn.primary").click();
    await page.locator("#wiz-files").setInputFiles([path.join(__dirname, "scan.pdf"), path.join(__dirname, "tng.png")]);
    const before = await page.evaluate(() => window.__mock.prompts.length);
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".rv", { timeout: 40000 });
    log("A scanned: calls", await page.evaluate(b => window.__mock.prompts.slice(b).map(p => ({ images: p.images, sizes: p.sizes, slices: /consecutive slices/.test(p.prompt) })), before).then(JSON.stringify), "| rows:", await page.locator(".rv").count(), "| note:", JSON.stringify(await page.locator(".modal .banner.warn").allInnerTexts()));
    /* a database failure while saving is reported and nothing is lost from the review */
    await page.evaluate(() => { window.__mock.dbFail = { code: "quota_exceeded", message: "full" }; });
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".modal .banner.bad"); log("A save failure text:", await page.locator(".modal .banner.bad").innerText(), "| rows still there:", await page.locator(".rv").count());
    await page.evaluate(() => { window.__mock.dbFail = null; });
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(300);
    log("A saved after retry:", JSON.stringify(await docCount(page)), "| uploads:", await page.evaluate(() => window.__mock.uploads.length));
    /* undo removes them and their kept picture */
    await page.locator(".toast button", { hasText: "Undo" }).last().click();
    await page.waitForFunction(() => { let n = 0; window.__mock.docs.forEach((v, k) => { if (k.split("/").length === 6) n++; }); return n === 0; }, null, { timeout: 15000 });
    log("A after undo:", JSON.stringify(await docCount(page)), "| assets deleted:", await page.evaluate(() => window.__mock.deleted.length));

    /* reading failures: garbled reply with salvageable rows, then a usage limit, then a declined consent */
    const openMixed = async () => { await page.locator(".top .btn.primary", { hasText: "Add expense" }).click(); await page.locator(".tile", { hasText: "Mixed statement" }).click(); await page.locator(".modal-foot .btn.primary").click(); await page.locator("#wiz-files").setInputFiles(path.join(__dirname, "tng.png")); };
    await openMixed();
    await page.evaluate(() => { window.__mock.fail = { error: { code: "invalid_json", message: "cut", text: '{"source":"tng","period":"","rows":[{"date":"2026-10-11","time":"08:02","merchant":"LDP Penchala toll","amount":2.1,"kind":"expense","cat":"travel","sub":"toll","park":null,"sure":true},{"date":"2026-10-10","ti' } }; });
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".rv", { timeout: 15000 });
    log("A salvaged rows:", await page.locator(".rv").count(), "| note:", JSON.stringify(await page.locator(".modal .banner.warn").allInnerTexts()));
    await page.locator(".modal-head .icon-btn").click();
    await openMixed();
    await page.evaluate(() => { window.__mock.fail = { error: { code: "rate_limited", message: "slow down" } }; });
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal .banner.bad", { timeout: 15000 });
    log("A rate limit text:", await page.locator(".modal .banner.bad").innerText(), "| step shows files:", await page.locator(".file").count());
    await page.evaluate(() => { window.__mock.fail = { sticky: true, error: { code: "not_granted", message: "declined" } }; });
    await page.locator(".modal-foot .btn.primary", { hasText: "Read" }).click();
    await page.waitForFunction(() => /declined for this visit/.test(document.querySelector(".modal").innerText), null, { timeout: 15000 });
    log("A declined:", JSON.stringify(await page.locator(".modal .banner").allInnerTexts()), "| buttons:", JSON.stringify(await page.locator(".modal-foot .btn").allInnerTexts()));
    await page.locator(".modal-head .icon-btn").click();
    await nav(page, "Trips & toll"); await page.waitForTimeout(200);
    log("A trips with reading off:", JSON.stringify(await page.locator(".planner-actions .btn").allInnerTexts()), "|", await page.locator(".content .card").first().locator(".note").first().innerText());
    await page.locator(".btn", { hasText: "Enter a trip by hand" }).click();
    await page.locator("#trip-from").fill("Home"); await page.locator("#trip-to").fill("Client site");
    await page.locator("#route-km").fill("12.5"); await page.locator("#route-mins").fill("25"); await page.locator("#route-toll").fill("3.3");
    await page.locator(".btn", { hasText: "Save trip" }).click();
    await page.waitForFunction(() => { let t = null; window.__mock.docs.forEach(v => { if (v.trip && v.trip.basis === "manual") t = v; }); return !!t; }, null, { timeout: 10000 });
    log("A manual trip:", JSON.stringify(await page.evaluate(() => { let t = null; window.__mock.docs.forEach(v => { if (v.trip && v.trip.basis === "manual") t = { amount: v.amount, km: v.trip.km, mins: v.trip.mins, src: v.src }; }); return t; })));
    /* export without the downloads capability falls back to copyable text */
    await nav(page, "Records"); await page.locator(".btn", { hasText: "Export to Excel" }).click(); await page.waitForSelector("#copy-text");
    const csvText = await page.locator("#copy-text").inputValue();
    log("A csv fallback chars:", csvText.length, "| lines:", JSON.stringify(csvText.split("\r\n").map(l => l.slice(0, 160))));
    await page.locator(".modal-foot .btn", { hasText: "Close" }).click();
    log("A errors:", JSON.stringify(errors));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
