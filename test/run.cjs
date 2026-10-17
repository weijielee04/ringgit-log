// One pass over the main flows with the host capabilities mocked to the published type definitions.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const ROOT = "/home/claude/ringgit-log";
const SHOTS = process.env.SHOTS;
const SEED = JSON.parse(fs.readFileSync(process.env.SEED, "utf8"));
fs.mkdirSync(SHOTS, { recursive: true });
const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
const pageHtml = () => SKELETON + fs.readFileSync(ROOT + "/ringgit-log.html", "utf8") + "</body></html>";
const PNG1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function mockInit(arg) {
  const seed = arg.seed, withData = arg.withData, flags = arg.flags || {};
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const uid = "u_testtesttesttesttest01";
  const docs = new Map(), subs = new Set();
  const M = (window.__mock = { prompts: [], saves: [], uploads: [], deleted: [], docs: docs, uid: uid });
  if (withData) {
    docs.set("data/users/" + uid + "/ledger", { exampleMonths: Array.from(new Set(seed.map(e => e.ym))).sort(), officePlaces: [] });
    seed.forEach(e => docs.set("data/users/" + uid + "/ledger/" + e.ym + "/" + e.id, e.data));
  }
  const freeze = v => Object.freeze(JSON.parse(JSON.stringify(v)));
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = p => { const d = docs.get(p); return { id: p.split("/").pop(), exists: d !== undefined, data: () => (d === undefined ? undefined : freeze(d)), metadata: meta }; };
  const notify = () => subs.forEach(s => setTimeout(() => { if (subs.has(s)) s.fire(); }, 8));
  const check = (p, odd) => { const n = p.split("/").length; if ((n % 2 === 1) !== odd) throw new TypeError("path parity: " + p); if (!/^[A-Za-z0-9_\-.~:@+\/]+$/.test(p)) throw new TypeError("path chars: " + p); };
  function docRef(p) {
    check(p, false);
    return {
      id: p.split("/").pop(), path: p,
      get: async () => { await delay(10); return snapDoc(p); },
      set: async d => { if (!d || typeof d !== "object" || Array.isArray(d)) throw { code: "invalid_argument" }; await delay(12); if (M.dbFail) throw M.dbFail; docs.set(p, JSON.parse(JSON.stringify(d))); notify(); },
      update: async d => { if (!docs.has(p)) throw { code: "invalid_argument" }; docs.set(p, Object.assign({}, docs.get(p), d)); notify(); },
      delete: async () => { await delay(8); docs.delete(p); notify(); },
      onSnapshot: (next) => { const s = { fire: () => next(snapDoc(p)) }; subs.add(s); setTimeout(() => subs.has(s) && s.fire(), 30); return () => subs.delete(s); },
      collection: name => colRef(p + "/" + name)
    };
  }
  function colRef(p, q) {
    check(p, true); q = q || { wheres: [], limit: 0 };
    const list = () => {
      const pre = p + "/"; let out = [];
      docs.forEach((v, k) => { if (k.startsWith(pre) && k.slice(pre.length).indexOf("/") < 0) out.push(snapDoc(k)); });
      q.wheres.forEach(w => { out = out.filter(s => { const x = s.data()[w[0]]; return w[1] === "==" ? x === w[2] : true; }); });
      out.sort((a, b) => (a.id < b.id ? -1 : 1));
      return q.limit ? out.slice(0, q.limit) : out;
    };
    const snap = () => { const l = list(); return { docs: l, size: l.length, empty: !l.length, docChanges: () => [], metadata: meta }; };
    return {
      path: p,
      where: (f, op, v) => colRef(p, { wheres: q.wheres.concat([[f, op, v]]), limit: q.limit }),
      orderBy: () => colRef(p, q), limit: n => colRef(p, { wheres: q.wheres, limit: n }),
      get: async () => { await delay(10); return snap(); },
      onSnapshot: (next) => { const s = { fire: () => next(snap()) }; subs.add(s); if (flags.cacheFirst) setTimeout(() => next({ docs: [], size: 0, empty: true, docChanges: () => [], metadata: { fromCache: true, hasPendingWrites: false } }), 10); setTimeout(() => subs.has(s) && s.fire(), flags.cacheFirst ? 900 : 40); return () => subs.delete(s); },
      doc: id => docRef(p + "/" + (id || Math.random().toString(36).slice(2))),
      add: async d => { const r = docRef(p + "/" + Math.random().toString(36).slice(2)); await r.set(d); return r; }
    };
  }
  const TNG = { source: "tng", period: "", rows: [
    { date: "2026-10-11", time: "08:02", merchant: "LDP Penchala toll", amount: 2.1, kind: "expense", cat: "travel", sub: "toll", park: null, sure: true },
    { date: "2026-10-10", time: "18:40", merchant: "Wilson Parking - Wisma Test", amount: 9, kind: "expense", cat: "parking", sub: "", park: { location: "Wisma Test", operator: "Wilson Parking", entry: "", exit: "18:40", mins: null }, sure: true },
    { date: "2026-10-10", time: "09:00", merchant: "Reload via CIMB", amount: 100, kind: "topup", cat: "other", sub: "", park: null, sure: true },
    { date: "2026-10-09", time: "08:31", merchant: "ZUS Coffee Bangsar", amount: 11.9, kind: "expense", cat: "food", sub: "", park: null, sure: true },
    { date: "2026-10-09", time: "07:55", merchant: "SPRINT Damansara toll", amount: 2, kind: "expense", cat: "travel", sub: "toll", park: null, sure: true },
    { date: "2026-10-08", time: "13:10", merchant: "myNEWS KL Sentral", amount: 6.4, kind: "expense", cat: "food", sub: "", park: null, sure: false }
  ] };
  const ROUTES = { from: "Subang Jaya, Selangor", to: "KL Sentral, Kuala Lumpur", confidence: "medium", question: "", routes: [
    { name: "via NPE", roads: ["E10 NPE"], km: 18.4, mins: 28, mins_peak: 50, tolls: [{ plaza: "PJS 5", road: "NPE", rm: 2.3 }, { plaza: "Pantai Dalam", road: "NPE", rm: 2.3 }], note: "" },
    { name: "via Federal Highway", roads: ["Route 2"], km: 19.6, mins: 32, mins_peak: 65, tolls: [], note: "Heavy at rush hour near Mid Valley." },
    { name: "via KESAS and Jalan Klang Lama", roads: ["E5 KESAS"], km: 22.1, mins: 35, mins_peak: 60, tolls: [{ plaza: "Sunway", road: "KESAS", rm: 2 }], note: "" }
  ] };
  const SHOT = { app: "waze", from: "", to: "Menara Test, Cyberjaya", routes: [
    { name: "via E20", roads: ["E20"], km: 33.2, mins: 36, toll_shown: true, toll_rm: 5.5, toll_estimated: false, tolls: [], note: "" },
    { name: "via E6", roads: ["E6"], km: 41.0, mins: 44, toll_shown: true, toll_rm: 7.9, toll_estimated: false, tolls: [], note: "" }
  ] };
  function statementReply(prompt) {
    const body = prompt.split("\nBEGIN\n")[1].split("\nEND")[0];
    const rows = [];
    body.split("\n").forEach(line => {
      const m = line.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s{2,}([\d,]+\.\d{2})(\s+[\d,]+\.\d{2})?/);
      if (!m || /BALANCE/.test(m[4])) return;
      const kind = /SALARY/.test(m[4]) ? "income" : /RELOAD/.test(m[4]) ? "topup" : "expense";
      const cat = /GROCER/.test(m[4]) ? "food" : /UNIFI|MAXIS/.test(m[4]) ? "bills" : /PETRONAS/.test(m[4]) ? "travel" : /SHOPEE/.test(m[4]) ? "shopping" : "other";
      rows.push({ date: m[3] + "-" + m[2] + "-" + m[1], time: "", merchant: m[4].trim(), amount: Number(m[5].replace(/,/g, "")), kind: kind, cat: cat, sub: cat === "travel" ? "fuel" : "", park: null, sure: true });
    });
    return { source: "cimb", period: "2026-09-01..2026-09-30", rows: rows };
  }
  async function sample(input, opts) {
    opts = opts || {};
    const prompt = typeof input === "string" ? input : input.map(m => m.content).join("\n");
    const imgs = opts.images ? Array.from(opts.images.length === undefined ? [opts.images] : opts.images) : [];
    M.prompts.push({ prompt: prompt, images: imgs.length, sizes: imgs.map(b => b.size), types: imgs.map(b => b.type) });
    await delay(300);
    if (opts.signal && opts.signal.aborted) throw { code: "cancelled", message: "aborted" };
    if (M.fail) { const f = M.fail; if (!f.sticky) M.fail = null; throw f.error; }
    const reply = prompt.indexOf("estimate a car trip") >= 0 ? ROUTES : prompt.indexOf("navigation app") >= 0 ? SHOT : prompt.indexOf("\nBEGIN\n") >= 0 ? statementReply(prompt) : TNG;
    const text = JSON.stringify(reply), half = Math.floor(text.length / 2);
    if (opts.onText) { opts.onText({ text: text.slice(0, half), delta: text.slice(0, half) }); await delay(60); opts.onText({ text: text, delta: text.slice(half) }); }
    return { text: text, truncated: false, modelTierApplied: "default" };
  }
  sample.json = async (input, opts) => JSON.parse((await sample(input, opts)).text);
  sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 5, maxInputBytes: 20971520, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] }, tools: { maxCount: 8 } });
  const hex = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const mocks = {
    db: { doc: docRef, collection: p => colRef(p) },
    user: { id: async () => uid, isOwner: async () => true, canEdit: async () => true, can: async () => true, me: async () => ({ id: uid, name: "", avatarUrl: "", color: "#888", email: null, isOwner: true, canEdit: true }) },
    sample: sample,
    assets: {
      upload: async (blob, o) => { await delay(40); const id = hex(); M.uploads.push({ id: id, size: blob.size, type: (o && o.type) || blob.type }); return { id: id, url: "/_blob/" + id, sizeBytes: blob.size, contentType: (o && o.type) || blob.type }; },
      list: async () => ({ assets: [], usage: { files: M.uploads.length, bytes: M.uploads.reduce((s, u) => s + u.size, 0), maxFiles: 1000, maxBytes: 524288000 } }),
      delete: async id => { M.deleted.push(id); return { deleted: true }; }
    },
    downloads: { save: async r => {
      if (M.saveFail) { const f = M.saveFail; M.saveFail = null; throw f; }
      if (r.data instanceof Blob) {
        const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(r.data); });
        M.saves.push({ filename: r.filename, size: r.data.size, type: r.data.type, head: "(blob)", b64: b64 });
      } else M.saves.push({ filename: r.filename, size: String(r.data).length, head: String(r.data).slice(0, 400) });
      return { status: "saved" };
    } }
  };
  if (flags.noDownloads) delete mocks.downloads;
  window.claude = { use: async name => { await delay(50); return mocks[name] || null; } };
}

async function newPage(browser, opts) {
  const ctx = await browser.newContext({ viewport: opts.viewport, deviceScaleFactor: opts.dpr || 1, colorScheme: opts.dark ? "dark" : "light", locale: "en-MY", timezoneId: "Asia/Kuala_Lumpur", hasTouch: !!opts.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url === "https://app.test/" || url.startsWith("https://app.test/#")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: pageHtml() });
    if (url.startsWith("https://app.test/_blob/")) return route.fulfill({ contentType: "image/png", body: PNG1 });
    if (url.includes("cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js")) return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(__dirname, "react-global.js")) });
    if (url.includes("cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js")) return route.fulfill({ contentType: "text/javascript", body: "/* bundled with react in the test */" });
    if (url.startsWith("https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/")) {
      const file = "/opt/npm-tools/node_modules/pdfjs-dist/" + url.split("pdfjs-dist@6.2.108/")[1];
      return route.fulfill({ contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(file) });
    }
    if (url.includes("fonts.googleapis.com")) return route.fulfill({ contentType: "text/css", body: "" });
    if (url === "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js") return opts.noJszip ? route.abort() : route.fulfill({ contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync("/opt/npm-tools/node_modules/jszip/dist/jszip.min.js") });
    errors.push("blocked request: " + url);
    return route.abort();
  });
  if (opts.mock !== false) await page.addInitScript(mockInit, { seed: SEED, withData: opts.seed !== false, flags: opts.flags || {} });
  await page.goto("https://app.test/");
  return { page, ctx, errors };
}
const shot = (page, name, opt) => page.screenshot(Object.assign({ path: path.join(SHOTS, name + ".png") }, opt || { fullPage: true }));
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
const nav = async (page, label) => { await page.locator(".rail .nav-item", { hasText: label }).click(); await page.waitForTimeout(250); };
const tab = async (page, label) => { await page.locator(".tabbar .tab", { hasText: label }).click(); await page.waitForTimeout(250); };
const log = (...a) => console.log(...a);
const docCount = page => page.evaluate(() => { const out = {}; window.__mock.docs.forEach((v, k) => { const p = k.split("/"); const key = p.length === 6 ? p[4] : "root"; out[key] = (out[key] || 0) + 1; }); return out; });

(async () => {
  const browser = await chromium.launch();
  /* ---------- S1: desktop, light, seeded ---------- */
  {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 1440, height: 900 } });
    await page.waitForSelector(".donut-list .dl-row");
    await page.waitForTimeout(400);
    await shot(page, "01-overview");
    log("S1 stats:", JSON.stringify(await page.locator(".stat").allInnerTexts()));
    const col = page.locator(".chart svg g rect[fill=transparent]").nth(2);
    await col.hover(); await page.waitForTimeout(150);
    await shot(page, "02-trend-tip", { clip: await page.locator(".split .card").nth(1).boundingBox() });
    await page.locator(".seg button", { hasText: "6 months" }).click(); await page.waitForTimeout(200);
    await page.locator(".chart svg g rect[fill=transparent]").nth(4).hover(); await page.waitForTimeout(150);
    await shot(page, "03-trend-months", { clip: await page.locator(".split .card").nth(1).boundingBox() });
    await page.locator(".card-head .btn", { hasText: "Table" }).click(); await page.waitForTimeout(150);
    log("S1 trend table rows:", await page.locator(".tbl tbody tr").count());
    await nav(page, "Calendar"); await shot(page, "04-calendar");
    await page.locator(".chip", { hasText: "Parking" }).click(); await page.waitForTimeout(200);
    log("S1 calendar parking summary:", (await page.locator(".cal-summary").innerText()).replace(/\n/g, " | "));
    await page.locator(".cal-cell", { hasText: /^6/ }).first().click(); await page.waitForTimeout(150);
    await shot(page, "05-calendar-parking");
    await nav(page, "Records"); await shot(page, "06-records");
    await page.locator("#rec-search").fill("toll"); await page.waitForTimeout(150);
    log("S1 search 'toll' rows:", await page.locator(".rows .row").count());
    await page.locator("#rec-search").fill("");
    log("S1 export with only examples disabled:", await page.locator(".btn", { hasText: "Export to Excel" }).isDisabled());
    await nav(page, "Parking"); await shot(page, "07-parking");
    await nav(page, "Trips & toll");
    await page.locator("#trip-from").fill("Subang Jaya"); await page.locator("#trip-to").fill("KL Sentral");
    await page.locator(".btn", { hasText: "Find routes" }).click();
    await page.waitForSelector(".route"); await page.locator("#trip-round").check(); await page.waitForTimeout(150);
    await page.locator(".card-head .btn", { hasText: "Show rates" }).click(); await page.waitForTimeout(100);
    await shot(page, "08-trips");
    log("S1 route prompt chars:", await page.evaluate(() => window.__mock.prompts[window.__mock.prompts.length - 1].prompt.length));
    await page.locator(".btn", { hasText: "Save trip" }).click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".toast")).some(t => /Saved RM/.test(t.innerText)), null, { timeout: 15000 });
    log("S1 trip toast:", JSON.stringify(await page.locator(".toast").allInnerTexts()));
    await page.waitForFunction(() => { let n = 0; window.__mock.docs.forEach(v => { if (v.example) n++; }); return n === 0; }, null, { timeout: 30000 });
    await page.waitForTimeout(400);
    log("S1 after trip save, docs:", JSON.stringify(await docCount(page)), "| toasts:", JSON.stringify(await page.locator(".toast").allInnerTexts()));
    const trip = await page.evaluate(() => { let t = null; window.__mock.docs.forEach(v => { if (v.trip && !v.example) t = v; }); return t; });
    log("S1 saved trip:", JSON.stringify(trip));
    await page.locator("#trip-shot").setInputFiles(path.join(__dirname, "tng.png"));
    await page.waitForFunction(() => /screenshot\. Check the numbers/.test(document.body.innerText), null, { timeout: 15000 }); await page.waitForTimeout(150);
    await shot(page, "09-trips-shot", { clip: await page.locator(".content .card").first().boundingBox() });
    log("S1 shot prompt images:", JSON.stringify(await page.evaluate(() => { const p = window.__mock.prompts[window.__mock.prompts.length - 1]; return { images: p.images, sizes: p.sizes, types: p.types }; })));

    /* wizard with a phone screenshot, mixed statement */
    await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
    await page.waitForSelector(".tiles"); await shot(page, "10-wizard-type", { fullPage: false });
    await page.locator(".tile", { hasText: "Mixed statement" }).click();
    await page.locator(".modal-foot .btn.primary").click();
    await page.locator("#wiz-files").setInputFiles(path.join(__dirname, "tng.png"));
    await page.waitForSelector(".file"); await shot(page, "11-wizard-source", { fullPage: false });
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".rv", { timeout: 15000 }); await page.waitForTimeout(200);
    await shot(page, "12-wizard-review", { fullPage: false });
    log("S1 tng prompt:", JSON.stringify(await page.evaluate(() => { const p = window.__mock.prompts[window.__mock.prompts.length - 1]; return { images: p.images, sizes: p.sizes, head: p.prompt.slice(0, 260) }; })));
    log("S1 review rows:", await page.locator(".rv").count(), "| checked:", await page.locator(".rv-chk input:checked").count(), "| tags:", JSON.stringify(await page.locator(".rv-tags").allInnerTexts()));
    await page.locator(".slip-head .linkish").click(); const none = await page.locator(".rv-chk input:checked").count();
    await page.locator(".slip-head .linkish").click(); const allExp = await page.locator(".rv-chk input:checked").count();
    log("S1 tick-all: after untick", none, "| after tick all expenses", allExp);
    log("S1 save button:", await page.locator(".modal-foot .btn.primary").innerText());
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".modal", { state: "detached", timeout: 15000 }); await page.waitForTimeout(500);
    log("S1 after tng save, docs:", JSON.stringify(await docCount(page)), "| uploads:", JSON.stringify(await page.evaluate(() => window.__mock.uploads)), "| toasts:", JSON.stringify(await page.locator(".toast").allInnerTexts()));
    log("S1 root doc:", JSON.stringify(await page.evaluate(() => window.__mock.docs.get("data/users/" + window.__mock.uid + "/ledger"))));
    await nav(page, "Overview"); await page.waitForTimeout(300); await shot(page, "13-after-save");

    /* text PDF statement */
    await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
    await page.locator(".tile", { hasText: "Mixed statement" }).click(); await page.locator(".modal-foot .btn.primary").click();
    await page.locator("#wiz-files").setInputFiles(path.join(__dirname, "statement.pdf"));
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".rv", { timeout: 30000 }); await page.waitForTimeout(200);
    const pdfPrompts = await page.evaluate(() => window.__mock.prompts.filter(p => p.prompt.indexOf("\nBEGIN\n") >= 0).map(p => ({ len: p.prompt.length, images: p.images, label: (p.prompt.match(/extracted from a PDF \(([^)]*)\)/) || [])[1], period: (p.prompt.match(/statement period is ([^.]*\.\.[^ ]*)/) || [])[1], text: p.prompt.split("\nBEGIN\n")[1].slice(0, 700) })));
    log("S1 pdf prompts:", pdfPrompts.length, JSON.stringify(pdfPrompts.map(p => ({ len: p.len, label: p.label, period: p.period }))));
    log("S1 pdf text sample:\n" + pdfPrompts[0].text);
    log("S1 pdf review rows:", await page.locator(".rv").count(), "| checked:", await page.locator(".rv-chk input:checked").count(), "| head:", await page.locator(".slip-head").innerText());
    await shot(page, "14-review-pdf", { fullPage: false });
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".modal", { state: "detached", timeout: 20000 }); await page.waitForTimeout(500);
    log("S1 after pdf save, docs:", JSON.stringify(await docCount(page)), "| month shown:", await page.locator(".month-label").innerText(), "| toast:", JSON.stringify(await page.locator(".toast").allInnerTexts()));

    /* locked PDF */
    await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
    await page.locator(".tile", { hasText: "Bills" }).click(); await page.locator(".modal-foot .btn.primary").click();
    await page.locator("#wiz-files").setInputFiles(path.join(__dirname, "locked.pdf"));
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector("#wiz-pw", { timeout: 15000 });
    await page.locator("#wiz-pw").fill("nope"); await page.locator(".btn", { hasText: "Unlock and read" }).click();
    await page.waitForFunction(() => /didn't work/.test(document.querySelector(".modal").innerText), null, { timeout: 15000 });
    await shot(page, "15-locked", { fullPage: false });
    await page.locator("#wiz-pw").fill("1234"); await page.locator(".btn", { hasText: "Unlock and read" }).click();
    await page.waitForSelector(".rv", { timeout: 30000 });
    log("S1 locked pdf rows:", await page.locator(".rv").count(), "| dup tags:", await page.locator(".tag.warn", { hasText: "already recorded" }).count(), "| cat of first:", await page.locator(".rv-cat").first().inputValue());
    await page.locator(".modal-head .icon-btn").click(); await page.waitForTimeout(200);

    /* manual office parking */
    await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
    await page.locator(".tile", { hasText: "Parking" }).first().click();
    await page.locator(".seg button", { hasText: "Office parking" }).click();
    await page.locator(".modal-foot .btn.primary").click();
    await page.locator(".btn", { hasText: "Type it in instead" }).click();
    await page.locator("#m-amount").fill("8.5"); await page.locator("#m-park-place").fill("Menara Ujian"); await page.locator("#m-park-operator").fill("Metro Parking");
    await page.locator("#m-park-entry").fill("08:30"); await page.locator("#m-park-exit").fill("18:00");
    await shot(page, "16-manual-parking", { fullPage: false });
    await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".modal", { state: "detached", timeout: 10000 }); await page.waitForTimeout(400);
    log("S1 manual parking:", JSON.stringify(await page.evaluate(() => { let t = null; window.__mock.docs.forEach(v => { if (v.park && v.park.location === "Menara Ujian") t = v; }); return t; })));
    log("S1 root doc after manual:", JSON.stringify(await page.evaluate(() => window.__mock.docs.get("data/users/" + window.__mock.uid + "/ledger"))));

    /* record modal: edit and delete */
    await page.locator(".month button[aria-label='Next month']").click().catch(() => {});
    await page.locator(".top .btn", { hasText: "This month" }).click().catch(() => {});
    await nav(page, "Records"); await page.waitForTimeout(200);
    await page.locator(".rows .row", { hasText: "Wisma Test" }).first().click();
    await page.waitForSelector(".modal"); await page.waitForTimeout(200); await shot(page, "17-record", { fullPage: false });
    await page.locator("#e-amount").fill("10"); await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".modal", { state: "detached" }); await page.waitForTimeout(300);
    log("S1 edited amount:", JSON.stringify(await page.evaluate(() => { let t = null; window.__mock.docs.forEach(v => { if (v.park && v.park.location === "Wisma Test") t = { amount: v.amount, img: !!v.img, imgN: v.imgN, kind: v.park.kind }; }); return t; })));
    await page.locator(".rows .row", { hasText: "myNEWS" }).first().click(); await page.waitForSelector(".modal");
    await page.locator(".modal-foot .btn", { hasText: "Delete" }).click(); await page.locator(".modal-foot .btn.primary", { hasText: "Delete" }).click();
    await page.waitForSelector(".modal", { state: "detached" }); await page.waitForTimeout(300);
    log("S1 after delete docs:", JSON.stringify(await docCount(page)), "| assets deleted:", JSON.stringify(await page.evaluate(() => window.__mock.deleted)));
    await page.locator(".btn", { hasText: "Export to Excel" }).click();
    await page.waitForFunction(() => window.__mock.saves.length > 0, null, { timeout: 10000 });
    log("S1 export:", JSON.stringify(await page.evaluate(() => window.__mock.saves.map(x => ({ filename: x.filename, size: x.size, type: x.type, head: x.head })))), "| toast:", JSON.stringify(await page.locator(".toast").allInnerTexts()));
    await nav(page, "Settings"); await page.locator(".btn", { hasText: "Check photo storage" }).click(); await page.waitForTimeout(300); await shot(page, "18-settings");
    await nav(page, "Parking"); await page.waitForTimeout(200); await shot(page, "19-parking-real");
    log("S1 errors:", JSON.stringify(errors));
    await ctx.close();
  }
  /* ---------- S2: phone, dark, seeded ---------- */
  {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 390, height: 844 }, dpr: 2, dark: true, touch: true });
    await page.waitForSelector(".donut-list .dl-row"); await page.waitForTimeout(400);
    await shot(page, "20-m-overview"); log("S2 overflow overview:", JSON.stringify(await overflow(page)));
    await tab(page, "Calendar"); await shot(page, "21-m-calendar"); log("S2 overflow calendar:", JSON.stringify(await overflow(page)));
    await tab(page, "Records"); log("S2 overflow records:", JSON.stringify(await overflow(page)));
    await tab(page, "Parking"); await shot(page, "22-m-parking"); log("S2 overflow parking:", JSON.stringify(await overflow(page)));
    await tab(page, "Trips");
    await page.locator("#trip-from").fill("Subang Jaya"); await page.locator("#trip-to").fill("KL Sentral");
    await page.locator(".btn", { hasText: "Find routes" }).click(); await page.waitForSelector(".route"); await page.waitForTimeout(150);
    await shot(page, "23-m-trips"); log("S2 overflow trips:", JSON.stringify(await overflow(page)));
    await page.locator(".fab").click(); await page.waitForSelector(".tiles"); await shot(page, "24-m-wizard-type", { fullPage: false });
    await page.locator(".tile", { hasText: "Mixed statement" }).click(); await page.locator(".modal-foot .btn.primary").click();
    await page.locator("#wiz-files").setInputFiles(path.join(__dirname, "tng.png")); await page.locator(".modal-foot .btn.primary").click();
    await page.waitForSelector(".rv", { timeout: 15000 }); await page.waitForTimeout(200);
    await shot(page, "25-m-review", { fullPage: false }); log("S2 overflow review:", JSON.stringify(await overflow(page)), "| modal width:", JSON.stringify(await page.locator(".modal").evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }))));
    await page.locator(".modal-head .icon-btn").click();
    await page.locator(".top .icon-btn.only-mobile").click(); await page.waitForTimeout(200); await shot(page, "26-m-settings"); log("S2 overflow settings:", JSON.stringify(await overflow(page)));
    log("S2 errors:", JSON.stringify(errors));
    await ctx.close();
  }
  /* ---------- S3: desktop, dark ---------- */
  {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 1280, height: 860 }, dark: true });
    await page.waitForSelector(".donut-list .dl-row"); await page.waitForTimeout(400);
    await shot(page, "30-dark-overview");
    await nav(page, "Calendar"); await shot(page, "31-dark-calendar");
    await page.locator(".rail .seg button", { hasText: "Light" }).click(); await page.waitForTimeout(150);
    log("S3 theme attr after toggle:", await page.evaluate(() => document.documentElement.getAttribute("data-theme")), "| bg:", await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
    log("S3 errors:", JSON.stringify(errors));
    await ctx.close();
  }
  /* ---------- S4: no host at all (saved file): local storage, empty state ---------- */
  {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 1280, height: 860 }, mock: false });
    await page.waitForSelector(".empty .btn.primary"); await page.waitForTimeout(200);
    await shot(page, "40-local-empty");
    await page.locator(".empty .btn.primary").click();
    await page.locator(".tile", { hasText: "Food" }).click(); await page.locator(".modal-foot .btn.primary").click();
    log("S4 source step text:", (await page.locator(".modal-body").innerText()).replace(/\n/g, " | ").slice(0, 200));
    await page.locator(".btn", { hasText: "Type it in instead" }).click();
    await page.locator("#m-amount").fill("12.50"); await page.locator("#m-merchant").fill("Nasi lemak");
    await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached" }); await page.waitForTimeout(300);
    await page.reload(); await page.waitForSelector(".rows .row"); await page.waitForTimeout(200);
    log("S4 after reload rows:", await page.locator(".rows .row").count(), "| stat:", (await page.locator(".stat").first().innerText()).replace(/\n/g, " "));
    await shot(page, "41-local-one");
    log("S4 errors:", JSON.stringify(errors));
    await ctx.close();
  }
  /* ---------- S5: empty cloud ledger (what a brand-new viewer sees) ---------- */
  {
    const { page, ctx, errors } = await newPage(browser, { viewport: { width: 1280, height: 860 }, seed: false });
    await page.waitForSelector(".empty .btn.primary"); await page.waitForTimeout(300);
    log("S5 empty title:", await page.locator(".empty h3").innerText(), "| sync:", await page.locator(".sync").innerText());
    log("S5 errors:", JSON.stringify(errors));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
