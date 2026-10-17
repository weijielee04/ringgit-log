// Browser tests of the website build (dist/index.html) with the real supabase-js client (built from the
// v2.117.2 source) talking to the stand-in Supabase project in fake-backend.cjs. The page is served at
// https://app.test/ringgit-log/, the way GitHub Pages serves a project site, with its Content-Security-Policy on.
//   SHOTS=<folder> node test/web/run-web.cjs        (ONLY=W1,W3 runs some scenarios)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { createBackend } = require("./fake-backend.cjs");

const ROOT = path.join(__dirname, "..", "..");
const TEST = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SB = "https://rjhfvorbgpdubnqfbexc.supabase.co";
const APP = "https://app.test/ringgit-log/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "out");
const FILES = path.join(SHOTS, "files");
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
fs.mkdirSync(FILES, { recursive: true });
const TYPES = { ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".js": "text/javascript" };

let passed = 0, failed = 0;
const fails = [];
const log = (...a) => console.log(...a);
function ok(cond, label, detail) {
  if (cond) { passed++; log("  ok   " + label); }
  else { failed++; fails.push(label); log("  FAIL " + label + (detail !== undefined ? "  :: " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : "")); }
  return !!cond;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 10000)) { try { if (fn()) return true; } catch (e) {} await sleep(50); }
  try { return !!fn(); } catch (e) { return false; }
}
const shot = (page, name, opt) => page.screenshot(Object.assign({ path: path.join(SHOTS, name + ".png") }, opt || { fullPage: true })).catch((e) => log("  (screenshot " + name + " failed: " + e.message + ")"));
const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
const nav = async (page, label) => { await page.locator(".rail .nav-item", { hasText: label }).click(); await page.waitForTimeout(250); };
const tab = async (page, label) => { await page.locator(".tabbar .tab", { hasText: label }).click(); await page.waitForTimeout(250); };
const toasts = (page) => page.locator(".toast").allInnerTexts();
const thisMonth = async (page) => { const b = page.locator(".top .btn", { hasText: "This month" }); if (await b.count()) { await b.click(); await page.waitForTimeout(250); } };
const recs = (be, uid) => be.S.records.filter((r) => r.user_id === uid);
const filesOf = (be, uid) => Array.from(be.S.files.keys()).filter((k) => k.startsWith(uid + "/"));
const reads = (be) => be.S.log.filter((x) => x.op === "read");

function serve(route, be, out, opts) {
  const req = route.request(), url = req.url(), u = new URL(url);
  if (u.origin === SB) return be.handle(route);
  if (u.origin === "https://app.test") {
    if (u.pathname === "/ringgit-log") return route.fulfill({ status: 301, headers: { location: APP } });
    if (!u.pathname.startsWith("/ringgit-log/")) { out.missing.push(url); return route.fulfill({ status: 404, body: "not found" }); }
    const rel = decodeURIComponent(u.pathname.slice("/ringgit-log/".length)) || "index.html";
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { out.missing.push(url); return route.fulfill({ status: 404, body: "not found" }); }
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  }
  const js = (file, cors) => route.fulfill({ contentType: "text/javascript", headers: cors ? { "access-control-allow-origin": "*" } : {}, body: fs.readFileSync(file) });
  if (url === "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js") return js(path.join(TEST, "react-global.js"));
  if (url === "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js") return route.fulfill({ contentType: "text/javascript", body: "/* bundled with react in the test */" });
  if (url === "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js") return opts.noSupabase ? route.abort() : js(path.join(__dirname, "supabase-umd.js"));
  if (url.startsWith("https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/")) return js("/opt/npm-tools/node_modules/pdfjs-dist/" + url.split("pdfjs-dist@6.2.108/")[1], true);
  if (url === "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js") return js("/opt/npm-tools/node_modules/jszip/dist/jszip.min.js", true);
  if (u.hostname === "fonts.googleapis.com") return route.fulfill({ contentType: "text/css", body: "" });
  if (u.hostname === "fonts.gstatic.com") return route.abort();
  out.blocked.push(url);
  return route.abort();
}
function watch(page, out) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/^Failed to load resource/.test(t)) out.http.push(t); else out.errors.push("console: " + t);
  });
  page.on("pageerror", (e) => out.errors.push("pageerror: " + e.message));
  page.on("dialog", (d) => { out.errors.push("dialog: " + d.message()); d.dismiss().catch(() => {}); });
}
async function newContext(browser, be, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, deviceScaleFactor: opts.dpr || 1, colorScheme: opts.dark ? "dark" : "light", locale: "en-MY", timezoneId: "Asia/Kuala_Lumpur", hasTouch: !!opts.touch, acceptDownloads: true });
  const out = { errors: [], http: [], blocked: [], missing: [] };
  await ctx.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => console.error("CSP blocked " + e.violatedDirective + " " + e.blockedURI));
  });
  await ctx.route("**/*", (route) => serve(route, be, out, opts));
  const open = async (url) => { const page = await ctx.newPage(); watch(page, out); await page.goto(url || APP); return page; };
  return { ctx, out, open };
}
function cleanRun(label, out, be) {
  ok(!out.errors.length, label + ": no script errors or blocked content", out.errors.slice(0, 6));
  ok(!out.blocked.length && !out.missing.length, label + ": every request went to an allowed place", out.blocked.concat(out.missing).slice(0, 6));
  if (be) ok(!be.S.unknown.length, label + ": the client only used known Supabase endpoints", be.S.unknown.slice(0, 6));
}
async function signUp(page, name, email, password) {
  await page.waitForSelector(".auth-card");
  if (!(await page.locator("#auth-name").count())) await page.locator(".auth-alt .linkish", { hasText: "Create an account" }).click();
  if (name) await page.locator("#auth-name").fill(name);
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-password").fill(password);
  await page.locator(".auth-card .btn.primary").click();
}
async function signIn(page, email, password) {
  await page.waitForSelector(".auth-card");
  if (await page.locator("#auth-name").count()) await page.locator(".auth-alt .linkish", { hasText: "Sign in" }).click();
  await page.locator("#auth-email").fill(email);
  await page.locator("#auth-password").fill(password);
  await page.locator(".auth-card .btn.primary").click();
}
const inApp = (page, mobile) => page.waitForSelector(mobile ? ".tabbar .tab" : ".rail .nav-item", { timeout: 15000 });
const authError = async (page) => { await page.waitForSelector(".auth-card .banner.bad", { timeout: 10000 }); return page.locator(".auth-card .banner.bad").innerText(); };
async function addManual(page, type, amount, merchant) {
  await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
  await page.locator(".tile", { hasText: type }).first().click();
  await page.locator(".modal-foot .btn.primary", { hasText: "Continue" }).click();
  await page.locator(".btn", { hasText: "Type it in instead" }).click();
  await page.locator("#m-amount").fill(amount);
  await page.locator("#m-merchant").fill(merchant);
  await page.locator(".modal-foot .btn.primary").click();
}
var review = (page) => page.evaluate(() => Array.from(document.querySelectorAll(".modal .rv")).map((r) => {
  const q = (s) => r.querySelector(s);
  return { on: q(".rv-chk input").checked, date: q(".rv-date").value, cat: q(".rv-cat").value, amt: q(".rv-amt").value, mer: q(".rv-mer").value, tags: Array.from(r.querySelectorAll(".rv-tags .tag")).map((t) => t.innerText).join(" / ") };
}));
async function step(name, fn) {
  log("- " + name);
  try { await fn(); } catch (e) { failed++; fails.push(name + " (threw)"); log("  FAIL " + name + " threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
}
const want = (id) => !ONLY.length || ONLY.includes(id);

(async () => {
  const browser = await chromium.launch();

  /* ---------- W1: desktop, light: one account from sign-up to deletion ---------- */
  if (want("W1")) await (async () => {
    log("W1 desktop: a new account from sign-up to deletion");
    const be = createBackend();
    const { ctx, out, open } = await newContext(browser, be);
    let page = await open();
    const MAIL = "aisyah@example.com";
    let A = "";

    await step("signed-out visitors see the sign-in form", async () => {
      await page.waitForSelector(".auth-card");
      ok((await page.title()) === "Ringgit Log", "page title");
      ok(/Sign in/.test(await page.locator(".auth-card h2").innerText()), "sign-in form first");
      const head = await page.evaluate(async () => {
        const m = await fetch("manifest.webmanifest").then((r) => r.json());
        const icons = await Promise.all(["icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png"].map((f) => fetch(f).then((r) => r.status + " " + r.headers.get("content-type"))));
        return { manifest: { name: m.name, start: m.start_url, scope: m.scope, display: m.display, icons: (m.icons || []).length }, icons: icons, csp: (document.querySelector("meta[http-equiv='Content-Security-Policy']") || {}).content || "" };
      });
      log("  manifest:", JSON.stringify(head.manifest), "| icons:", JSON.stringify(head.icons));
      ok(head.icons.every((s) => /^200 /.test(s)) && head.manifest.icons >= 2, "manifest and icons are served");
      ok(head.csp.includes("connect-src 'self' " + SB) && !/__SUPABASE/.test(head.csp), "the security policy names the project address");
      await shot(page, "w01-signin");
    });

    await step("sign up", async () => {
      await signUp(page, "Aisyah", MAIL, "short");
      ok(/at least 8 characters/.test(await authError(page)), "a short password is caught before sending");
      ok(be.S.users.size === 0, "nothing was sent for it");
      await page.locator("#auth-password").fill("teh-tarik-2026");
      await shot(page, "w02-signup", { fullPage: false });
      await page.locator(".auth-card .btn.primary").click();
      await inApp(page);
      A = be.S.byEmail.get(MAIL);
      ok(!!A, "the account was created");
      ok(be.S.profiles.get(A) && be.S.profiles.get(A).display_name === "Aisyah", "its profile has the name given at sign-up");
      await page.waitForFunction(() => /Aisyah/.test((document.querySelector(".rail .acct") || {}).innerText || ""), null, { timeout: 5000 });
      ok(/aisyah@example\.com/.test(await page.locator(".rail .acct").innerText()), "the rail shows who is signed in");
      const stored = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("ringgit-log-auth") || "null"); } catch (e) { return "bad"; } });
      ok(stored && stored.access_token && stored.user && stored.user.email === MAIL, "the sign-in is kept in this browser under the app's own key");
      await page.waitForTimeout(500);
      await shot(page, "w03-new-account");
    });

    await step("type an expense in", async () => {
      await addManual(page, "Food", "12.50", "Nasi lemak Tanglin");
      await page.waitForSelector(".modal", { state: "detached", timeout: 10000 });
      ok(await until(() => recs(be, A).length === 1), "saved to the records table");
      const r = recs(be, A)[0] || {};
      ok(r.amount === 12.5 && r.category === "food" && r.description === "Nasi lemak Tanglin" && r.user_id === A && /^\d{4}-\d{2}-\d{2}$/.test(r.date), "with the right fields", r);
      await page.waitForTimeout(300);
      ok(/12\.50/.test(await page.locator(".content").innerText()), "the overview shows it");
    });

    await step("read a TnG screenshot", async () => {
      await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
      await page.locator(".tile", { hasText: "Mixed statement" }).click();
      await page.locator(".modal-foot .btn.primary", { hasText: "Continue" }).click();
      await page.locator("#wiz-files").setInputFiles(path.join(TEST, "tng.png"));
      await page.waitForSelector(".file");
      await page.locator(".modal-foot .btn.primary", { hasText: "Read file" }).click();
      await page.waitForSelector(".rv", { timeout: 20000 });
      const job = reads(be).pop() || {};
      log("  read job:", JSON.stringify(job));
      ok(job.task === "extract" && job.mode === "image" && job.images >= 1 && job.images <= 4 && job.ctx && job.ctx.type === "mixed" && job.types.every((t) => /^image\/(jpeg|png|webp)$/.test(t)), "the picture went to the read function as a job (in " + job.images + " tiles), not a prompt");
      ok(/^\d{4}-\d{2}-\d{2}$/.test(job.today || ""), "with today's date");
      const rv = await review(page);
      ok(rv.length === 4 && rv.filter((x) => x.on).length === 3, "4 lines to review, the 3 expenses ticked", rv);
      await shot(page, "w04-review", { fullPage: false });
      ok(await page.locator("#wiz-keep").isChecked(), "keeping the picture is on");
      await page.locator(".modal-foot .btn.primary").click();
      await page.waitForSelector(".modal", { state: "detached", timeout: 20000 });
      ok(await until(() => recs(be, A).length === 4), "3 more records saved");
      const fl = filesOf(be, A);
      ok(fl.length === 1, "the picture was stored once, in the account's folder", fl);
      const f = be.S.files.get(fl[0]) || {};
      const withImg = recs(be, A).filter((x) => x.extra && x.extra.img === fl[0]);
      ok(withImg.length === 3 && withImg.every((x) => x.extra.imgN === 3), "the 3 records point to it", recs(be, A).map((x) => x.extra));
      ok(f.type && /^image\//.test(f.type) && f.data.length > 1000 && fl[0].endsWith(f.type === "image/png" ? ".png" : ".jpg"), "stored with its own content type", { type: f.type, bytes: f.data && f.data.length, path: fl[0] });
      ok(be.S.log.some((x) => x.op === "upsert" && x.table === "records" && x.n === 3), "saved in one batch");
    });

    await step("a record shows its receipt through a signed link", async () => {
      await nav(page, "Records");
      await page.locator(".rows .row", { hasText: "ZUS Coffee" }).first().click();
      await page.waitForSelector(".modal .ev img", { timeout: 10000 });
      const src = await page.locator(".modal .ev img").first().getAttribute("src");
      ok(src.startsWith(SB + "/storage/v1/object/sign/receipts/" + A + "/") && /[?&]token=/.test(src), "the thumbnail uses a signed link", src);
      ok(await page.waitForFunction(() => { const i = document.querySelector(".modal .ev img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 }).then(() => true, () => false), "and the picture loads");
      await page.locator(".modal .ev .btn", { hasText: "View" }).click();
      ok(await page.waitForFunction(() => { const i = document.querySelector(".modal img.receipt-img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 }).then(() => true, () => false), "the full view loads too");
      await shot(page, "w05-record-receipt", { fullPage: false });
      const before = recs(be, A).find((x) => x.description === "ZUS Coffee Bangsar");
      await page.locator("#e-amount").fill("12.90");
      await page.locator(".modal-foot .btn.primary").click();
      await page.waitForSelector(".modal", { state: "detached" });
      ok(await until(() => { const x = recs(be, A).find((y) => y.description === "ZUS Coffee Bangsar"); return x && x.amount === 12.9; }), "an edit is saved");
      const after = recs(be, A).find((x) => x.description === "ZUS Coffee Bangsar");
      ok(after.created_at === before.created_at && after.extra.img === before.extra.img, "and keeps when it was added and its picture");
    });

    await step("delete a record", async () => {
      await page.locator(".rows .row", { hasText: "Nasi lemak" }).first().click(); await page.waitForSelector(".modal");
      await page.locator(".modal-foot .btn", { hasText: "Delete" }).click();
      await page.locator(".modal-foot .btn.primary", { hasText: "Delete" }).click();
      await page.waitForSelector(".modal", { state: "detached" });
      ok(await until(() => !recs(be, A).some((x) => x.description === "Nasi lemak Tanglin")), "it's removed from the table");
      ok(filesOf(be, A).length === 1, "the shared picture stays (other records use it)");
      log("  toasts:", JSON.stringify(await toasts(page)));
    });

    await step("trips: routes and a map screenshot", async () => {
      await nav(page, "Trips & toll");
      await page.locator("#trip-from").fill("Subang Jaya"); await page.locator("#trip-to").fill("KL Sentral");
      await page.locator(".btn", { hasText: "Find routes" }).click();
      await page.waitForSelector(".route", { timeout: 15000 });
      const job = reads(be).pop() || {};
      ok(job.task === "route" && job.images === 0, "routes come from the read function", job);
      await page.locator(".btn", { hasText: "Save trip" }).click();
      ok(await until(() => recs(be, A).some((x) => x.trip && x.category === "travel" && x.travel_kind === "toll")), "the trip is saved with its route");
      const t = recs(be, A).find((x) => x.trip) || {};
      log("  trip row:", JSON.stringify({ amount: t.amount, description: t.description, trip: t.trip }));
      await page.locator("#trip-shot").setInputFiles(path.join(TEST, "tng.png"));
      await page.waitForFunction(() => /screenshot\. Check the numbers/.test(document.body.innerText), null, { timeout: 15000 });
      const job2 = reads(be).pop() || {};
      ok(job2.task === "shot" && job2.images >= 1 && job2.images <= 3, "a map screenshot is read as a shot job", job2);
      await shot(page, "w06-trips", { fullPage: false });
    });

    await step("a CIMB PDF statement", async () => {
      await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
      await page.locator(".tile", { hasText: "Mixed statement" }).click();
      await page.locator(".modal-foot .btn.primary", { hasText: "Continue" }).click();
      await page.locator("#wiz-files").setInputFiles(path.join(TEST, "statement.pdf"));
      await page.locator(".modal-foot .btn.primary", { hasText: "Read file" }).click();
      await page.waitForSelector(".rv", { timeout: 30000 });
      const jobs = reads(be).filter((x) => x.mode === "text");
      ok(jobs.length >= 1 && jobs.every((x) => x.images === 0), "the PDF's text was read in the browser and sent as text", jobs);
      const n = (await review(page)).filter((x) => x.on).length;
      const before = recs(be, A).length;
      await page.locator(".modal-foot .btn.primary").click();
      await page.waitForSelector(".modal", { state: "detached", timeout: 20000 });
      ok(await until(() => recs(be, A).length === before + n), "its " + n + " expenses were saved");
      ok(recs(be, A).filter((x) => x.date.startsWith("2026-09")).length === n, "in September 2026");
      ok(filesOf(be, A).length === 1, "a text PDF isn't kept as a picture");
    });

    let importCount = 0;
    await step("Excel import, undo and import again", async () => {
      await nav(page, "Records");
      await thisMonth(page);
      const before = recs(be, A).length;
      await page.locator(".toolbar .btn", { hasText: "Import from Excel" }).click();
      await page.waitForSelector("#imp-file", { state: "attached" });
      await page.locator("#imp-file").setInputFiles(path.join(TEST, "sheets", "filled.xlsx"));
      await page.waitForSelector(".modal .rv", { timeout: 15000 });
      const teh = page.locator(".modal .rv", { has: page.locator("input.rv-mer[value='Teh tarik']") });
      await teh.locator(".rv-amt").fill("4.50"); await teh.locator(".rv-amt").blur();
      const roti = page.locator(".modal .rv", { has: page.locator("input.rv-mer[value='Roti canai']") });
      await roti.locator(".rv-date").fill("2026-10-12"); await page.waitForTimeout(100);
      importCount = (await review(page)).filter((x) => x.on).length;
      log("  import button:", await page.locator(".modal-foot .btn.primary").innerText());
      await page.locator(".modal-foot .btn.primary").click();
      await page.waitForSelector(".modal", { state: "detached", timeout: 20000 });
      ok(await until(() => recs(be, A).length === before + importCount), importCount + " rows imported");
      ok(be.S.log.some((x) => x.op === "upsert" && x.n === importCount), "in one batch");
      ok(recs(be, A).filter((x) => x.source === "sheet").length === importCount || recs(be, A).filter((x) => x.extra && x.extra.batch).length >= importCount, "marked as imported", recs(be, A).map((x) => x.source));
      await page.locator(".toast button", { hasText: "Undo" }).last().click();
      ok(await until(() => recs(be, A).length === before), "undo takes the whole import back out");
      ok(be.S.log.some((x) => x.op === "delete" && x.n === importCount), "with one delete");
      await page.waitForTimeout(300);
      await page.locator(".toolbar .btn", { hasText: "Import from Excel" }).click();
      await page.locator("#imp-file").setInputFiles(path.join(TEST, "sheets", "filled.xlsx"));
      await page.waitForSelector(".modal .rv", { timeout: 15000 });
      await page.locator(".modal .rv", { has: page.locator("input.rv-mer[value='Teh tarik']") }).locator(".rv-amt").fill("4.50");
      await page.locator(".modal .rv", { has: page.locator("input.rv-mer[value='Roti canai']") }).locator(".rv-date").fill("2026-10-12");
      await page.waitForTimeout(100);
      await page.locator(".modal-foot .btn.primary").click();
      await page.waitForSelector(".modal", { state: "detached", timeout: 20000 });
      ok(await until(() => recs(be, A).length === before + importCount), "imported again");
    });

    await step("Excel export, edit it, import it back", async () => {
      await nav(page, "Records");
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.locator(".btn", { hasText: "Export to Excel" }).click()]);
      const exp = path.join(FILES, "web-export.xlsx");
      await dl.saveAs(exp);
      ok(/\.xlsx$/.test(dl.suggestedFilename()), "the browser downloads " + dl.suggestedFilename());
      let report = "";
      try { report = cp.execFileSync("python3", [path.join(TEST, "check_export.py"), exp, "--edit", path.join(FILES, "web-edited.xlsx")], { encoding: "utf8" }); } catch (e) { report = "FAILED " + (e.stdout || "") + (e.stderr || ""); }
      ok((report.match(/schema-valid/g) || []).length === 3 && /edited copy written/.test(report), "the export is a valid workbook", report.slice(0, 600));
      log("  export rows:", (report.match(/^ {3}\[/gm) || []).length);
      await page.locator(".toolbar .btn", { hasText: "Import from Excel" }).click();
      await page.locator("#imp-file").setInputFiles(path.join(FILES, "web-edited.xlsx"));
      await page.waitForSelector(".modal .rv", { timeout: 15000 });
      const rv = await review(page);
      ok(rv.filter((x) => /Updates a saved record/.test(x.tags)).length >= 3, "edited rows update the saved records", rv.map((x) => x.mer + ": " + x.tags));
      const count = recs(be, A).length;
      await page.locator(".modal-foot .btn.primary").click();
      await page.waitForSelector(".modal", { state: "detached", timeout: 20000 });
      ok(await until(() => recs(be, A).some((x) => x.description === "Mamak")), "the new row is added");
      const mine = recs(be, A);
      ok(mine.length === count + 1, "and nothing is duplicated", mine.length + " vs " + (count + 1));
      ok((mine.find((x) => x.description === "Nasi kandar") || {}).amount === 14, "changed amount saved");
      ok((mine.find((x) => x.description === "Kopitiam") || {}).date === "2026-09-30", "moved to another month");
      ok(mine.some((x) => x.description === "PLUS Sg Buloh (to office)"), "renamed");
    });

    await step("attach receipts to records afterwards", async () => {
      await nav(page, "Records");
      await page.locator(".rows .row", { hasText: "Office car park" }).first().click(); await page.waitForSelector(".modal .ev-box");
      await page.locator("#e-files").setInputFiles(path.join(TEST, "tng.png")); await page.waitForSelector(".modal .ev img");
      await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 });
      ok(await until(() => { const r = recs(be, A).find((x) => x.description === "Office car park"); return r && r.attachments.length === 1; }), "a picture attached later is saved on the record");
      const att = recs(be, A).find((x) => x.description === "Office car park").attachments[0];
      const f = be.S.files.get(att.id) || {};
      ok(att.id.startsWith(A + "/") && /^image\//.test(f.type || ""), "in the account's folder, with its content type", { att: att, type: f.type });
      await page.locator(".rows .row", { hasText: "PLUS Sg Buloh" }).first().click(); await page.waitForSelector(".modal .ev-box");
      await page.locator("#e-files").setInputFiles([path.join(TEST, "statement.pdf"), path.join(TEST, "tng.png")]); await page.waitForTimeout(200);
      await page.locator(".modal-foot .btn.primary").click(); await page.waitForSelector(".modal", { state: "detached", timeout: 15000 });
      ok(await until(() => { const r = recs(be, A).find((x) => /PLUS Sg Buloh/.test(x.description)); return r && r.attachments.length === 2; }), "a PDF and a picture attached together");
      const plus = recs(be, A).find((x) => /PLUS Sg Buloh/.test(x.description));
      const types = plus.attachments.map((a) => (be.S.files.get(a.id) || {}).type);
      ok(types.includes("application/pdf") && types.some((t) => /^image\//.test(t)), "each stored as what it is", types);
      await page.locator(".rows .row", { hasText: "PLUS Sg Buloh" }).first().click(); await page.waitForSelector(".modal .ev-box");
      await page.waitForSelector(".modal .ev a.btn", { timeout: 10000 });
      const href = await page.locator(".modal .ev a.btn").first().getAttribute("href");
      const got = await page.evaluate((u) => fetch(u).then((r) => r.status + " " + r.headers.get("content-type")), href);
      ok(got === "200 application/pdf", "the PDF's Open link works", got);
      await shot(page, "w07-record-files", { fullPage: false });
      const ids = plus.attachments.map((a) => a.id);
      await page.locator(".modal-foot .btn", { hasText: "Delete" }).click();
      await page.locator(".modal-foot .btn.primary", { hasText: "Delete" }).click();
      await page.waitForSelector(".modal", { state: "detached", timeout: 15000 });
      ok(await until(() => ids.every((id) => !be.S.files.has(id))), "deleting the record deletes its files");
    });

    await step("settings: account card", async () => {
      await nav(page, "Settings");
      await page.waitForSelector(".acct-card");
      const card = await page.locator(".acct-card").innerText();
      ok(/aisyah@example\.com/.test(card), "shows the account's email");
      const used = reads(be).length;
      ok(new RegExp((40 - used) + " of 40 readings left today").test(card), "and readings left today", card.match(/Automatic reading[^\n]*/));
      await page.locator("#acct-name").fill("Aisyah Rahman");
      await page.locator(".acct-card .inline-form .btn").first().click();
      ok(await until(() => be.S.profiles.get(A).display_name === "Aisyah Rahman"), "a new display name is saved");
      await page.waitForFunction(() => /Aisyah Rahman/.test(document.querySelector(".rail .acct").innerText), null, { timeout: 5000 });
      await page.locator("#acct-password").fill("short");
      await page.locator(".acct-card .inline-form .btn").nth(1).click();
      ok(/at least 8 characters/.test(await page.locator(".acct-card .banner.bad").innerText()), "a short new password is refused");
      await page.locator("#acct-password").fill("kopi-o-kosong-99");
      await page.locator(".acct-card .inline-form .btn").nth(1).click();
      ok(await until(() => be.S.users.get(A).password === "kopi-o-kosong-99"), "the password is changed");
      await page.locator(".btn", { hasText: "Check receipt storage" }).click();
      await page.waitForTimeout(400);
      const usage = await page.locator(".card", { hasText: "Check receipt storage" }).innerText();
      log("  storage:", usage.split("\n").filter((l) => /file|MB|KB|stored/i.test(l)).join(" | "));
      ok(new RegExp("\\b" + filesOf(be, A).length + " (files|file)\\b").test(usage), "receipt storage counts this account's files", filesOf(be, A).length);
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.locator(".btn", { hasText: "Download template" }).click()]);
      const tpl = path.join(FILES, "web-template.xlsx"); await dl.saveAs(tpl);
      ok(Buffer.compare(fs.readFileSync(tpl), fs.readFileSync(path.join(ROOT, "template/ringgit-log-template.xlsx"))) === 0, "the template downloads unchanged");
      await shot(page, "w08-settings");
    });

    await step("sign out, wrong password, sign back in", async () => {
      await page.locator(".rail .acct .icon-btn[aria-label='Sign out']").click();
      await page.waitForSelector(".auth-card", { timeout: 15000 });
      ok(!Array.from(be.S.access.values()).includes(A), "the session is ended on the server");
      ok((await page.evaluate(() => localStorage.getItem("ringgit-log-auth"))) === null, "and forgotten in the browser");
      await signIn(page, MAIL, "teh-tarik-2026");
      ok(/don't match/.test(await authError(page)), "the old password no longer works");
      await shot(page, "w09-wrong-password", { fullPage: false });
      await page.locator("#auth-password").fill("kopi-o-kosong-99");
      await page.locator(".auth-card .btn.primary").click();
      await inApp(page);
      await nav(page, "Records");
      await thisMonth(page);
      await page.waitForSelector(".rows .row", { timeout: 10000 });
      const shown = await page.locator(".rows .row").count();
      const oct = recs(be, A).filter((x) => x.date.startsWith("2026-10")).length;
      ok(shown === oct, "this month's records come back from the database", shown + " shown, " + oct + " stored");
    });

    await step("a second account sees only its own records", async () => {
      await page.locator(".rail .acct .icon-btn[aria-label='Sign out']").click();
      await page.waitForSelector(".auth-card", { timeout: 15000 });
      await signUp(page, "", "ben@example.com", "roti-canai-77");
      await inApp(page);
      const B = be.S.byEmail.get("ben@example.com");
      await nav(page, "Records");
      await page.waitForTimeout(600);
      ok((await page.locator(".rows .row").count()) === 0, "a new account starts empty");
      ok(recs(be, B).length === 0 && recs(be, A).length > 0, "and the first account's records are untouched");
      await nav(page, "Settings");
      ok(/ben@example\.com/.test(await page.locator(".acct-card").innerText()), "settings show the second account");
      ok(/^B$/.test((await page.locator(".rail .acct-ico").innerText()).trim()), "the rail shows its initial");
      await addManual(page, "Bills", "89.00", "Unifi");
      await page.waitForSelector(".modal", { state: "detached", timeout: 10000 });
      ok(await until(() => recs(be, B).length === 1), "it saves under its own account");
    });

    await step("forgot password, with the link opened in a new tab", async () => {
      await page.locator(".rail .acct .icon-btn[aria-label='Sign out']").click();
      await page.waitForSelector(".auth-card", { timeout: 15000 });
      await page.locator(".auth-forgot").click();
      await page.locator("#auth-email").fill(MAIL);
      await page.locator(".auth-card .btn.primary").click();
      await page.waitForFunction(() => /Check your email/.test(document.querySelector(".auth-card h2").innerText), null, { timeout: 10000 });
      const mail = be.S.outbox.filter((m) => m.type === "recovery" && m.to === MAIL).pop();
      ok(mail && mail.link.startsWith(APP + "#access_token="), "a reset link that comes back to the site", mail && mail.link.slice(0, 60));
      const p2 = await open(mail.link);
      await p2.waitForFunction(() => /Choose a new password/.test((document.querySelector(".auth-card h2") || {}).innerText || ""), null, { timeout: 15000 });
      ok(!/access_token/.test(p2.url()), "the token is taken out of the address", p2.url());
      ok(/aisyah@example\.com/.test(await p2.locator(".auth-lead").innerText()), "it says which account");
      await shot(p2, "w10-new-password", { fullPage: false });
      await p2.locator("#auth-password").fill("sambal-belacan-1");
      await p2.locator(".auth-card .btn.primary").click();
      await inApp(p2);
      ok(await until(() => be.S.users.get(A).password === "sambal-belacan-1"), "the new password is saved");
      ok(/Password changed/.test((await toasts(p2)).join(" ")), "and confirmed", await toasts(p2));
      ok(await page.waitForSelector(".rail .nav-item", { timeout: 10000 }).then(() => true, () => false), "the first tab signs in too instead of asking again");
      await p2.close();
    });

    await step("delete the account", async () => {
      await nav(page, "Settings");
      await page.locator(".acct-card .btn", { hasText: "Delete account" }).click();
      await page.locator("#acct-delete").fill("delete");
      ok(await page.locator(".danger-box .btn.primary").isDisabled(), "needs DELETE typed exactly");
      await page.locator("#acct-delete").fill("DELETE");
      await shot(page, "w11-delete", { fullPage: false });
      const filesBefore = filesOf(be, A).length;
      await page.locator(".danger-box .btn.primary").click();
      await page.waitForSelector(".auth-card", { timeout: 15000 });
      ok(!be.S.users.has(A) && recs(be, A).length === 0 && filesOf(be, A).length === 0 && !be.S.profiles.has(A), "the account, its records and its " + filesBefore + " files are gone");
      ok(/account, its records and its receipt files were deleted/.test(await page.locator(".auth-card .banner").first().innerText()), "and the sign-in page says so");
      ok(be.S.users.has(be.S.byEmail.get("ben@example.com")), "the other account is still there");
      await shot(page, "w12-deleted", { fullPage: false });
    });
    cleanRun("W1", out, be);
    log("  http errors seen (expected for refused requests):", out.http.length);
    await ctx.close();
  })();

  /* ---------- W2: email confirmation on ---------- */
  if (want("W2")) await (async () => {
    log("W2 email confirmation required");
    const be = createBackend({ confirmEmail: true });
    const { ctx, out, open } = await newContext(browser, be);
    const page = await open();
    await step("sign up asks to check email", async () => {
      await signUp(page, "Chong", "chong@example.com", "char-kway-teow");
      await page.waitForFunction(() => /Check your email/.test(document.querySelector(".auth-card h2").innerText), null, { timeout: 10000 });
      ok(/chong@example\.com/.test(await page.locator(".auth-lead").innerText()), "names the address");
      const mail = be.S.outbox.find((m) => m.type === "signup");
      ok(mail && mail.link.startsWith(APP), "the confirmation link comes back to the site");
      await page.locator(".auth-alt .linkish").click();
      await signIn(page, "chong@example.com", "char-kway-teow");
      ok(/Confirm your email first/.test(await authError(page)), "signing in before confirming explains why");
      mail.confirm();
      const p2 = await open(mail.link);
      ok(await inApp(p2).then(() => true, () => false), "the link signs the new account in");
      ok(!/access_token/.test(p2.url()), "and is cleaned from the address");
      await p2.close();
    });
    cleanRun("W2", out, be);
    await ctx.close();
  })();

  /* ---------- W3: sign-ups refused and expired links ---------- */
  if (want("W3")) await (async () => {
    log("W3 refused sign-ups and expired links");
    const be = createBackend({ signupError: "email_address_not_authorized" });
    const { ctx, out, open } = await newContext(browser, be);
    const page = await open();
    await step("default email limits", async () => {
      await signUp(page, "", "someone@example.com", "nasi-goreng-1");
      ok(/can't send email to that address/.test(await authError(page)), "explains that the site can't email that address yet");
    });
    await step("an expired email link", async () => {
      const p2 = await open(APP + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
      await p2.waitForSelector(".auth-card .banner", { timeout: 10000 });
      ok(/expired or was already used/.test(await p2.locator(".auth-card .banner").innerText()), "says the link expired");
      ok(p2.url() === APP, "and cleans the address", p2.url());
      await shot(p2, "w13-expired-link", { fullPage: false });
    });
    await step("the sign-in library fails to load", async () => {
      const c2 = await newContext(browser, be, { noSupabase: true });
      const p3 = await c2.open();
      await p3.waitForTimeout(800);
      ok(/sign-in service couldn't load/.test(await p3.locator("#app").innerText()), "the page says so instead of staying blank");
      await c2.ctx.close();
    });
    cleanRun("W3", out, be);
    await ctx.close();
  })();

  /* ---------- W4: reading not set up yet ---------- */
  if (want("W4")) await (async () => {
    log("W4 automatic reading not set up (no Anthropic key yet)");
    const be = createBackend({ readReady: false });
    const { ctx, out, open } = await newContext(browser, be);
    const page = await open();
    await step("typing in still works", async () => {
      await signUp(page, "Devi", "devi@example.com", "thosai-masala-3");
      await inApp(page);
      await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
      await page.locator(".tile", { hasText: "Parking" }).first().click();
      await page.locator(".seg button", { hasText: "Office parking" }).click();
      await page.locator(".modal-foot .btn.primary", { hasText: "Continue" }).click();
      const banner = await page.locator(".modal .banner.warn").innerText();
      ok(/isn't set up on this site yet/.test(banner), "the upload step says reading isn't set up", banner);
      ok(/primary/.test(await page.locator(".modal-foot .btn", { hasText: "Type it in instead" }).getAttribute("class")), "typing in is the main button");
      await shot(page, "w14-no-reading", { fullPage: false });
      await page.locator(".modal-head .icon-btn").click();
      await nav(page, "Settings");
      ok(/isn't set up on this site yet/.test(await page.locator(".acct-card").innerText()), "settings say the same");
      ok(reads(be).length === 0, "nothing was sent for reading");
    });
    cleanRun("W4", out, be);
    await ctx.close();
  })();

  /* ---------- W5: daily limit, short-lived tokens, a session ended elsewhere ---------- */
  if (want("W5")) await (async () => {
    log("W5 daily limit, token refresh, and a revoked session");
    const be = createBackend({ readLimit: 1, tokenSeconds: 92 });
    const { ctx, out, open } = await newContext(browser, be);
    const page = await open();
    let E = "";
    await step("the daily limit", async () => {
      await signUp(page, "Ema", "ema@example.com", "cendol-durian-5");
      await inApp(page);
      E = be.S.byEmail.get("ema@example.com");
      for (let i = 0; i < 2; i++) {
        await page.locator(".top .btn.primary", { hasText: "Add expense" }).click();
        await page.locator(".tile", { hasText: "Mixed statement" }).click();
        await page.locator(".modal-foot .btn.primary", { hasText: "Continue" }).click();
        await page.locator("#wiz-files").setInputFiles(path.join(TEST, "tng.png"));
        await page.locator(".modal-foot .btn.primary", { hasText: "Read file" }).click();
        if (i === 0) {
          await page.waitForSelector(".rv", { timeout: 20000 });
          await page.locator(".modal-head .icon-btn").click();
          await page.waitForTimeout(200);
          if (await page.locator(".modal").count()) await page.locator(".modal .btn", { hasText: /Discard|Close|Leave/ }).first().click().catch(() => {});
        } else {
          await page.waitForSelector(".modal .banner.bad", { timeout: 20000 });
          const t = await page.locator(".modal .banner.bad").innerText();
          ok(/today's automatic readings for this account/.test(t), "the second reading explains the daily limit", t);
          await shot(page, "w15-daily-limit", { fullPage: false });
          await page.locator(".modal-head .icon-btn").click();
        }
      }
      await nav(page, "Settings");
      ok(/0 of 1 readings left today/.test(await page.locator(".acct-card").innerText()), "settings show none left");
    });
    await step("tokens refresh while the app is used", async () => {
      const before = be.S.refreshes || 0;
      await page.waitForTimeout(2500);
      await addManual(page, "Food", "7.20", "Teh ais");
      await page.waitForSelector(".modal", { state: "detached", timeout: 10000 });
      ok(await until(() => recs(be, E).some((x) => x.description === "Teh ais")), "saving works across a token refresh");
      ok((be.S.refreshes || 0) > before, "the token was refreshed", { refreshes: be.S.refreshes });
      ok(/ema@example\.com/.test(await page.locator(".rail .acct").innerText()), "and the app stayed signed in");
    });
    await step("a session ended elsewhere", async () => {
      be.revoke(E);
      await addManual(page, "Food", "3.00", "Kuih");
      await page.waitForSelector(".modal .banner.bad", { timeout: 15000 });
      const t = await page.locator(".modal .banner.bad").innerText();
      ok(/sign-in has expired/i.test(t), "saving says to sign in again", t);
      await shot(page, "w16-expired", { fullPage: false });
    });
    cleanRun("W5", out, be);
    await ctx.close();
  })();

  /* ---------- W6: phone, dark ---------- */
  if (want("W6")) await (async () => {
    log("W6 phone, dark");
    const be = createBackend();
    const u = be.makeUser("farid@example.com", "mee-goreng-mamak", { display_name: "Farid" });
    const day = (d) => "2026-10-" + String(d).padStart(2, "0");
    [["food", "", 14.5, "Mamak Bistro"], ["travel", "toll", 2.1, "LDP Penchala toll"], ["parking", "", 8, "Wisma Parking"], ["bills", "", 89, "Unifi"], ["shopping", "", 45.9, "Uniqlo"]].forEach((x, i) => be.S.records.push({ user_id: u.id, id: "seed" + i, date: day(3 + i * 2), time: "12:00", amount: x[2], category: x[0], travel_kind: x[1], description: x[3], note: "", source: "manual", parking: x[0] === "parking" ? { kind: "onsite", location: "Wisma Parking", operator: "", entry: "", exit: "", mins: null } : null, trip: null, attachments: [], extra: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    const { ctx, out, open } = await newContext(browser, be, { viewport: { width: 390, height: 844 }, dpr: 2, dark: true, touch: true });
    const page = await open();
    await step("sign-in page fits", async () => {
      await page.waitForSelector(".auth-card");
      await shot(page, "w17-m-signin");
      const o = await overflow(page);
      ok(o.sw <= o.iw, "no sideways scroll on the sign-in page", o);
      ok(await page.locator(".auth-card .auth-brand").isVisible(), "the brand shows above the form on a phone");
      await page.locator(".auth-alt .linkish", { hasText: "Create an account" }).click();
      await shot(page, "w18-m-signup", { fullPage: false });
    });
    await step("the app on a phone", async () => {
      await signIn(page, "farid@example.com", "mee-goreng-mamak");
      await inApp(page, true);
      await page.waitForSelector(".donut-list .dl-row", { timeout: 10000 });
      await page.waitForTimeout(300);
      await shot(page, "w19-m-overview");
      for (const t of ["Calendar", "Records", "Parking", "Trips"]) { await tab(page, t); const o = await overflow(page); ok(o.sw <= o.iw, t + " fits", o); }
      await page.locator(".top .icon-btn.only-mobile").click(); await page.waitForTimeout(300);
      await page.waitForSelector(".acct-card");
      await shot(page, "w20-m-settings");
      const o = await overflow(page);
      ok(o.sw <= o.iw, "settings with the account card fit", o);
      await page.locator(".acct-card .btn", { hasText: "Delete account" }).click();
      await page.waitForTimeout(150);
      const o2 = await overflow(page);
      ok(o2.sw <= o2.iw, "so does the delete confirmation", o2);
      await shot(page, "w21-m-delete", { fullPage: false });
      await page.locator(".danger-box .btn", { hasText: "Keep my account" }).click();
      await page.locator(".acct-card .btn", { hasText: "Sign out" }).click();
      await page.waitForSelector(".auth-card", { timeout: 15000 });
      ok(true, "signing out from settings works on a phone");
    });
    cleanRun("W6", out, be);
    await ctx.close();
  })();

  /* ---------- W7: desktop, dark sign-in page ---------- */
  if (want("W7")) await (async () => {
    log("W7 desktop, dark");
    const be = createBackend();
    const { ctx, out, open } = await newContext(browser, be, { viewport: { width: 1280, height: 820 }, dark: true });
    const page = await open();
    await page.waitForSelector(".auth-card");
    await shot(page, "w22-dark-signin", { fullPage: false });
    await page.locator(".auth-forgot").click();
    await shot(page, "w23-dark-forgot", { fullPage: false });
    cleanRun("W7", out, be);
    await ctx.close();
  })();

  await browser.close();
  log("\n" + passed + " passed, " + failed + " failed");
  if (failed) { log("failed:\n  " + fails.join("\n  ")); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exitCode = 2; });
