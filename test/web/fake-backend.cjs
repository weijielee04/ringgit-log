// A stand-in Supabase project for browser tests of the website: Auth (GoTrue), the REST API
// (PostgREST) for the records and profiles tables, Storage for the receipts bucket, and the read and
// delete-account Edge Functions. It answers the real supabase-js client (served to the page from a
// build of its v2.117.2 source) through Playwright's request routing, and applies the same
// per-account rules as the row-level security in supabase/migrations.
const crypto = require("crypto");

const CATS = ["food", "travel", "parking", "shopping", "bills", "other"];
const MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function createBackend(opts) {
  opts = opts || {};
  const S = {
    base: opts.base || "https://rjhfvorbgpdubnqfbexc.supabase.co",
    users: new Map(), byEmail: new Map(), access: new Map(), refresh: new Map(),
    records: [], profiles: new Map(), files: new Map(), outbox: [], reads: new Map(), log: [], unknown: [],
    confirmEmail: !!opts.confirmEmail, signupError: opts.signupError || "", readReady: opts.readReady !== false,
    readLimit: opts.readLimit || 40, readFail: null, tokenSeconds: opts.tokenSeconds || 3600, slowRead: 0
  };
  const now = () => new Date().toISOString();
  const pub = (u) => ({
    id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
    email_confirmed_at: u.confirmed_at, confirmed_at: u.confirmed_at, last_sign_in_at: u.last_sign_in_at || null,
    user_metadata: u.meta, app_metadata: { provider: "email", providers: ["email"] },
    identities: [{ identity_id: u.id, id: u.id, user_id: u.id, provider: "email", identity_data: { email: u.email, sub: u.id } }],
    created_at: u.created_at, updated_at: u.updated_at || u.created_at, is_anonymous: false
  });
  function session(uid) {
    const u = S.users.get(uid);
    const exp = Math.floor(Date.now() / 1000) + S.tokenSeconds;
    const access = b64url({ alg: "HS256", typ: "JWT" }) + "." + b64url({ sub: uid, email: u.email, role: "authenticated", aud: "authenticated", exp: exp, iat: exp - S.tokenSeconds, session_id: crypto.randomUUID() }) + "." + crypto.randomBytes(16).toString("base64url");
    const refresh = crypto.randomBytes(12).toString("hex");
    S.access.set(access, uid); S.refresh.set(refresh, { uid: uid, usedAt: 0 });
    u.last_sign_in_at = now();
    return { access_token: access, token_type: "bearer", expires_in: S.tokenSeconds, expires_at: exp, refresh_token: refresh, user: pub(u) };
  }
  function linkFor(uid, type, redirect) {
    const s = session(uid);
    return (redirect || "https://app.test/ringgit-log/") + "#access_token=" + s.access_token + "&expires_at=" + s.expires_at + "&expires_in=" + s.expires_in + "&refresh_token=" + s.refresh_token + "&token_type=bearer&type=" + type;
  }
  function makeUser(email, password, meta) {
    const id = crypto.randomUUID();
    const u = { id: id, email: email, password: password, meta: meta || {}, created_at: now(), confirmed_at: S.confirmEmail ? null : now() };
    S.users.set(id, u); S.byEmail.set(email, id);
    S.profiles.set(id, { id: id, display_name: String((meta && meta.display_name) || "").slice(0, 80), settings: {}, created_at: now(), updated_at: now() });   /* the sign-up trigger */
    return u;
  }
  function removeUser(uid) {
    const u = S.users.get(uid);
    if (!u) return;
    S.users.delete(uid); S.byEmail.delete(u.email); S.profiles.delete(uid);
    S.records = S.records.filter((r) => r.user_id !== uid);
    for (const [p] of S.files) if (p.startsWith(uid + "/")) S.files.delete(p);
    revoke(uid);
  }
  function revoke(uid) {
    for (const [k, v] of S.access) if (v === uid) S.access.delete(k);
    for (const [k, v] of S.refresh) if (v.uid === uid) S.refresh.delete(k);
  }

  // ---------- HTTP plumbing ----------
  function cors(req) {
    return {
      "access-control-allow-origin": req.headers()["origin"] || "*",
      "access-control-allow-headers": req.headers()["access-control-request-headers"] || "authorization, apikey, content-type",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-expose-headers": "content-range, x-reads-left, x-supabase-api-version",
      "access-control-max-age": "600"
    };
  }
  const json = (route, status, body, extra) => route.fulfill({ status: status, headers: Object.assign(cors(route.request()), { "content-type": "application/json" }, extra || {}), body: body === undefined ? "" : JSON.stringify(body) });
  const empty = (route, status) => route.fulfill({ status: status, headers: cors(route.request()), body: "" });
  function uidOf(req) {
    const a = (req.headers()["authorization"] || "").replace(/^Bearer\s+/i, "");
    return S.access.get(a) || null;
  }
  const authErr = (route, status, code, msg) => json(route, status, { code: status, error_code: code, msg: msg });
  const pgErr = (route, status, code, msg) => json(route, status, { code: code, details: null, hint: null, message: msg });
  const stErr = (route, status, code, msg) => json(route, status, { statusCode: String(status), error: code, message: msg });
  function body(req) { try { return JSON.parse(req.postData() || "null"); } catch (e) { return null; } }

  // ---------- filters for the REST API ----------
  function parseFilters(params) {
    const out = [];
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      const m = v.match(/^(eq|neq|gte|gt|lte|lt|in)\.(.*)$/s);
      if (!m) { out.push({ k: k, bad: true }); continue; }
      let val = m[2];
      if (m[1] === "in") val = val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
      out.push({ k: k, op: m[1], v: val });
    }
    return out;
  }
  function matches(row, filters) {
    return filters.every((f) => {
      const x = row[f.k] == null ? "" : String(row[f.k]);
      switch (f.op) {
        case "eq": return x === f.v; case "neq": return x !== f.v;
        case "gte": return x >= f.v; case "gt": return x > f.v; case "lte": return x <= f.v; case "lt": return x < f.v;
        case "in": return f.v.includes(x);
        default: return false;
      }
    });
  }
  function checkRecord(r) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(r.id || ""))) return "records_id_check";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date || "")) || r.date < "2000-01-01" || r.date > "2099-12-31") return "records_date_check";
    if (r.time && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(r.time)) return "records_time_check";
    if (!(Number(r.amount) >= 0)) return "records_amount_check";
    if (!CATS.includes(r.category)) return "records_category_check";
    if (!["", "toll", "fuel", "transit", "ride", "other"].includes(r.travel_kind || "")) return "records_travel_kind_check";
    if (String(r.description || "").length > 200) return "records_description_check";
    if (String(r.note || "").length > 1000) return "records_note_check";
    if (!/^[a-z]{1,20}$/.test(r.source || "manual")) return "records_source_check";
    if (!Array.isArray(r.attachments || [])) return "records_attachments_check";
    return "";
  }
  async function rest(route, table, url) {
    const req = route.request(), method = req.method(), uid = uidOf(req);
    if (!uid) return pgErr(route, 401, "42501", "permission denied for table " + table);
    const filters = parseFilters(url.searchParams);
    if (filters.some((f) => f.bad)) return pgErr(route, 400, "PGRST100", "failed to parse filter");
    const own = table === "records" ? (r) => r.user_id === uid : (r) => r.id === uid;
    if (method === "GET") {
      let rows = (table === "records" ? S.records : Array.from(S.profiles.values())).filter(own).filter((r) => matches(r, filters));
      const order = url.searchParams.get("order");
      if (order) { const [col, dir] = order.split("."); rows = rows.slice().sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (dir === "desc" ? -1 : 1)); }
      rows = rows.slice(0, Math.min(1000, Number(url.searchParams.get("limit")) || 1000));
      const sel = url.searchParams.get("select");
      if (sel && sel !== "*") { const cols = sel.split(","); rows = rows.map((r) => { const o = {}; cols.forEach((c) => { o[c] = r[c] === undefined ? null : r[c]; }); return o; }); }
      return json(route, 200, JSON.parse(JSON.stringify(rows)), { "content-range": "0-" + Math.max(0, rows.length - 1) + "/*" });
    }
    if (method === "POST") {
      let list = body(req);
      list = Array.isArray(list) ? list : [list];
      const merge = /resolution=merge-duplicates/.test(req.headers()["prefer"] || "");
      for (const row of list) {
        if (table === "records") {
          if (row.user_id !== uid) return pgErr(route, 403, "42501", 'new row violates row-level security policy for table "records"');
          const bad = checkRecord(row);
          if (bad) return pgErr(route, 400, "23514", 'new row for relation "records" violates check constraint "' + bad + '"');
        } else if (row.id !== uid) return pgErr(route, 403, "42501", 'new row violates row-level security policy for table "profiles"');
      }
      for (const row of list) {
        if (table === "records") {
          const i = S.records.findIndex((r) => r.user_id === uid && r.id === row.id);
          if (i >= 0 && !merge) return pgErr(route, 409, "23505", "duplicate key value violates unique constraint \"records_pkey\"");
          const base = i >= 0 ? S.records[i] : { time: "", travel_kind: "", description: "", note: "", source: "manual", parking: null, trip: null, attachments: [], extra: {}, created_at: now() };
          const next = Object.assign({}, base, JSON.parse(JSON.stringify(row)), { updated_at: now() });
          if (i >= 0) { next.created_at = base.created_at; S.records[i] = next; } else S.records.push(next);
        } else {
          const old = S.profiles.get(uid) || { id: uid, display_name: "", settings: {}, created_at: now() };
          S.profiles.set(uid, Object.assign({}, old, JSON.parse(JSON.stringify(row)), { id: uid, created_at: old.created_at, updated_at: now() }));
        }
      }
      S.log.push({ op: "upsert", table: table, n: list.length });
      return empty(route, 201);
    }
    if (method === "DELETE") {
      if (table !== "records") return pgErr(route, 401, "42501", "permission denied for table " + table);
      const before = S.records.length;
      S.records = S.records.filter((r) => !(own(r) && matches(r, filters)));
      S.log.push({ op: "delete", table: table, n: before - S.records.length });
      return empty(route, 204);
    }
    return pgErr(route, 405, "PGRST", "method not allowed");
  }

  // ---------- storage ----------
  function parseMultipart(req) {
    const ct = req.headers()["content-type"] || "";
    const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    const buf = req.postDataBuffer();
    if (!m || !buf) return null;
    const delim = Buffer.from("--" + (m[1] || m[2]));
    const out = [];
    let start = buf.indexOf(delim);
    while (start >= 0) {
      const next = buf.indexOf(delim, start + delim.length);
      if (next < 0) break;
      const part = buf.slice(start + delim.length + 2, next - 2);
      const he = part.indexOf("\r\n\r\n");
      if (he >= 0) {
        const head = part.slice(0, he).toString("utf8");
        out.push({ head: head, name: (head.match(/name="([^"]*)"/) || [])[1], type: (head.match(/content-type:\s*([^\r\n]+)/i) || [])[1] || "", data: part.slice(he + 4) });
      }
      start = next;
    }
    return out;
  }
  async function storage(route, url) {
    const req = route.request(), method = req.method(), uid = uidOf(req);
    const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ""));
    let m;
    if (method === "GET" && (m = p.match(/^\/object\/sign\/receipts\/(.+)$/))) {
      const f = S.files.get(m[1]);
      const token = url.searchParams.get("token");
      if (!f || !token || f.token !== token) return stErr(route, 400, "InvalidSignature", "invalid signature");
      return route.fulfill({ status: 200, headers: Object.assign(cors(req), { "content-type": f.type }), body: f.data });
    }
    if (!uid) return stErr(route, 400, "Unauthorized", "headers must have required property 'authorization'");
    if (method === "POST" && (m = p.match(/^\/object\/sign\/receipts\/(.+)$/))) {
      const f = S.files.get(m[1]);
      if (!f || !m[1].startsWith(uid + "/")) return stErr(route, 400, "not_found", "Object not found");
      f.token = f.token || crypto.randomBytes(10).toString("hex");
      return json(route, 200, { signedURL: "/object/sign/receipts/" + m[1] + "?token=" + f.token });
    }
    if (method === "POST" && (m = p.match(/^\/object\/list\/receipts$/))) {
      const b = body(req) || {};
      const prefix = String(b.prefix || "").replace(/\/$/, "");
      if (prefix !== uid) return json(route, 200, []);
      const items = Array.from(S.files.entries()).filter(([k]) => k.startsWith(prefix + "/")).map(([k, f]) => ({ name: k.slice(prefix.length + 1), id: f.id, updated_at: f.at, created_at: f.at, last_accessed_at: f.at, metadata: { size: f.data.length, mimetype: f.type } }));
      return json(route, 200, items.slice(b.offset || 0, (b.offset || 0) + (b.limit || 100)));
    }
    if (method === "POST" && (m = p.match(/^\/object\/receipts\/(.+)$/))) {
      const path = m[1];
      if (!path.startsWith(uid + "/")) return stErr(route, 403, "Unauthorized", "new row violates row-level security policy");
      const parts = parseMultipart(req) || [];
      const file = parts.find((x) => x.name === "");
      if (!file) return stErr(route, 400, "invalid_request", "no file");
      if (!MIMES.includes(file.type)) return stErr(route, 415, "invalid_mime_type", "mime type " + file.type + " is not supported");
      if (file.data.length > 20971520) return stErr(route, 413, "Payload too large", "The object exceeded the maximum allowed size");
      if (S.files.has(path) && req.headers()["x-upsert"] !== "true") return stErr(route, 409, "Duplicate", "The resource already exists");
      const id = crypto.randomUUID();
      S.files.set(path, { id: id, data: file.data, type: file.type, at: now() });
      return json(route, 200, { Key: "receipts/" + path, Id: id });
    }
    if (method === "DELETE" && p === "/object/receipts") {
      const b = body(req) || {};
      const gone = [];
      (b.prefixes || []).forEach((k) => { if (k.startsWith(uid + "/") && S.files.has(k)) { S.files.delete(k); gone.push({ name: k, bucket_id: "receipts" }); } });
      return json(route, 200, gone);
    }
    S.unknown.push(method + " storage " + p);
    return stErr(route, 404, "not_found", "unknown storage route");
  }

  // ---------- Edge Functions ----------
  const TNG = { source: "tng", period: "", rows: [
    { date: "2026-10-11", time: "08:02", merchant: "LDP Penchala toll", amount: 2.1, kind: "expense", cat: "travel", sub: "toll", park: null, sure: true },
    { date: "2026-10-10", time: "18:40", merchant: "Wilson Parking - Wisma Test", amount: 9, kind: "expense", cat: "parking", sub: "", park: { location: "Wisma Test", operator: "Wilson Parking", entry: "", exit: "18:40", mins: null }, sure: true },
    { date: "2026-10-10", time: "09:00", merchant: "Reload via CIMB", amount: 100, kind: "topup", cat: "other", sub: "", park: null, sure: true },
    { date: "2026-10-09", time: "08:31", merchant: "ZUS Coffee Bangsar", amount: 11.9, kind: "expense", cat: "food", sub: "", park: null, sure: true }
  ] };
  const ROUTES = { from: "Subang Jaya, Selangor", to: "KL Sentral, Kuala Lumpur", confidence: "medium", question: "", routes: [
    { name: "via NPE", roads: ["E10 NPE"], km: 18.4, mins: 28, mins_peak: 50, tolls: [{ plaza: "PJS 5", road: "NPE", rm: 2.3 }, { plaza: "Pantai Dalam", road: "NPE", rm: 2.3 }], note: "" },
    { name: "via Federal Highway", roads: ["Route 2"], km: 19.6, mins: 32, mins_peak: 65, tolls: [], note: "" }
  ] };
  const SHOT = { app: "waze", from: "", to: "Menara Test, Cyberjaya", routes: [{ name: "via E20", roads: ["E20"], km: 33.2, mins: 36, toll_shown: true, toll_rm: 5.5, toll_estimated: false, tolls: [], note: "" }] };
  function statementRows(text) {
    const rows = [];
    String(text || "").split("\n").forEach((line) => {
      const m = line.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s{2,}([\d,]+\.\d{2})(\s+[\d,]+\.\d{2})?/);
      if (!m || /BALANCE/.test(m[4])) return;
      rows.push({ date: m[3] + "-" + m[2] + "-" + m[1], time: "", merchant: m[4].trim(), amount: Number(m[5].replace(/,/g, "")), kind: /RELOAD/.test(m[4]) ? "topup" : /SALARY/.test(m[4]) ? "income" : "expense", cat: /GROCER/.test(m[4]) ? "food" : "other", sub: "", park: null, sure: true });
    });
    return { source: "cimb", period: "2026-09-01..2026-09-30", rows: rows };
  }
  async function functions(route, name) {
    const req = route.request(), uid = uidOf(req);
    if (!uid) return json(route, 401, { code: "session_expired" });
    const b = body(req) || {};
    if (name === "delete-account") {
      if (b.confirm !== "DELETE") return json(route, 400, { code: "bad_request" });
      removeUser(uid);
      return json(route, 200, { deleted: true });
    }
    if (name !== "read") return json(route, 404, { code: "not_found" });
    const used = S.reads.get(uid) || 0;
    if (b.ping) return json(route, 200, { ready: S.readReady, limit: S.readLimit, used: used });
    if (!S.readReady) return json(route, 503, { code: "not_configured" });
    S.log.push({ op: "read", task: b.task, images: (b.images || []).length, types: (b.images || []).map((i) => i.type), sizes: (b.images || []).map((i) => i.data.length), ctx: b.ctx, mode: b.part && b.part.mode, today: b.today });
    if (!["extract", "route", "shot"].includes(b.task)) return json(route, 400, { code: "bad_request" });
    if ((b.images || []).some((i) => !/^image\/(jpeg|png|webp|gif)$/.test(i.type) || !/^[A-Za-z0-9+/]+=*$/.test(i.data))) return json(route, 400, { code: "bad_request" });
    if (used >= S.readLimit) return json(route, 429, { code: "daily_limit" });
    if (S.readFail) { const f = S.readFail; S.readFail = null; return json(route, f.status, { code: f.code }); }
    S.reads.set(uid, used + 1);
    const reply = b.task === "route" ? ROUTES : b.task === "shot" ? SHOT : b.part && b.part.mode === "text" ? statementRows(b.part.text) : TNG;
    const text = JSON.stringify(reply);
    if (S.slowRead) await new Promise((r) => setTimeout(r, S.slowRead));
    return route.fulfill({ status: 200, headers: Object.assign(cors(req), { "content-type": "text/plain; charset=utf-8", "x-reads-left": String(S.readLimit - used - 1) }), body: text + "\u0000" + JSON.stringify({ stop: "end_turn", error: "" }) });
  }

  // ---------- auth ----------
  async function auth(route, url) {
    const req = route.request(), method = req.method(), p = url.pathname.replace(/^\/auth\/v1/, "");
    const b = body(req) || {};
    const redirect = url.searchParams.get("redirect_to") || "";
    if (method === "POST" && p === "/signup") {
      if (S.signupError) return authErr(route, 400, S.signupError, "Email address \"" + b.email + "\" cannot be used as it is not authorized");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "")) return authErr(route, 400, "email_address_invalid", "Email address is invalid");
      if (String(b.password || "").length < 6) return json(route, 422, { code: 422, error_code: "weak_password", msg: "Password should be at least 6 characters.", weak_password: { reasons: ["length"] } });
      if (S.byEmail.has(b.email)) {
        if (S.confirmEmail) return json(route, 200, Object.assign(pub(S.users.get(S.byEmail.get(b.email))), { identities: [] }));
        return authErr(route, 422, "user_already_exists", "User already registered");
      }
      const u = makeUser(b.email, b.password, b.data);
      if (S.confirmEmail) {
        S.outbox.push({ to: b.email, type: "signup", link: linkFor(u.id, "signup", redirect), confirm: () => { u.confirmed_at = now(); } });
        return json(route, 200, pub(u));
      }
      return json(route, 200, session(u.id));
    }
    if (method === "POST" && p === "/token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const uid = S.byEmail.get(b.email), u = uid && S.users.get(uid);
        if (!u || u.password !== b.password) return authErr(route, 400, "invalid_credentials", "Invalid login credentials");
        if (!u.confirmed_at) return authErr(route, 400, "email_not_confirmed", "Email not confirmed");
        return json(route, 200, session(uid));
      }
      if (grant === "refresh_token") {
        /* Like Supabase Auth: each refresh token can be used again for 10 seconds (tabs refreshing at the same time). */
        const t = S.refresh.get(b.refresh_token);
        if (!t || !S.users.has(t.uid)) return authErr(route, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
        if (t.usedAt && Date.now() - t.usedAt > 10000) return authErr(route, 400, "refresh_token_already_used", "Invalid Refresh Token: Already Used");
        t.usedAt = t.usedAt || Date.now();
        S.refreshes = (S.refreshes || 0) + 1;
        return json(route, 200, session(t.uid));
      }
      return authErr(route, 400, "validation_failed", "unsupported grant type");
    }
    if (p === "/user") {
      const uid = uidOf(req), u = uid && S.users.get(uid);
      if (!u) return authErr(route, 403, "bad_jwt", "invalid JWT: unable to parse or verify signature");
      if (method === "GET") return json(route, 200, pub(u));
      if (method === "PUT") {
        if (b.password != null) {
          if (String(b.password).length < 6) return json(route, 422, { code: 422, error_code: "weak_password", msg: "Password should be at least 6 characters.", weak_password: { reasons: ["length"] } });
          if (b.password === u.password) return authErr(route, 422, "same_password", "New password should be different from the old password.");
          u.password = b.password;
        }
        if (b.data) u.meta = Object.assign({}, u.meta, b.data);
        u.updated_at = now();
        return json(route, 200, pub(u));
      }
    }
    if (method === "POST" && p === "/logout") {
      const uid = uidOf(req);
      if (uid) revoke(uid);
      return empty(route, 204);
    }
    if (method === "POST" && p === "/recover") {
      const uid = S.byEmail.get(b.email);
      if (uid) S.outbox.push({ to: b.email, type: "recovery", link: linkFor(uid, "recovery", redirect) });
      return json(route, 200, {});
    }
    S.unknown.push(method + " auth " + p);
    return authErr(route, 404, "not_found", "unknown auth route");
  }

  async function handle(route) {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "OPTIONS") return empty(route, 204);
    if (url.pathname.startsWith("/auth/v1/")) return auth(route, url);
    if (url.pathname === "/rest/v1/records") return rest(route, "records", url);
    if (url.pathname === "/rest/v1/profiles") return rest(route, "profiles", url);
    if (url.pathname.startsWith("/rest/v1/")) return pgErr(route, 404, "PGRST205", "Could not find the table");
    if (url.pathname.startsWith("/storage/v1/")) return storage(route, url);
    const fm = url.pathname.match(/^\/functions\/v1\/([a-z-]+)$/);
    if (fm) return functions(route, fm[1]);
    S.unknown.push(req.method() + " " + url.pathname);
    return empty(route, 404);
  }
  return { S: S, handle: handle, makeUser: makeUser, removeUser: removeUser, revoke: revoke };
}
module.exports = { createBackend };
