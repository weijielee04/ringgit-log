/* ================= the website: accounts, storage and reading on Supabase =================
   - Accounts: Supabase Auth with email and password (sign up, sign in, forgot password,
     change password, delete account).
   - Records: the records table, one row per expense, owned by the signed-in account (user_id).
     Settings such as office parking places: the profiles table.
   - Receipt files: the private "receipts" bucket, in a folder named after the account's id,
     shown through short-lived signed links.
   - Reading pictures and statements: the "read" Edge Function, which checks the sign-in, counts the
     daily limit and asks Claude.
   Row-level security (supabase/migrations) keeps every account to its own rows and files. */
let sb = null;          /* the Supabase client */
let webUser = null;     /* the account whose records are open */
const webState = { profile: null, reads: null };      /* reads: { left, limit } when automatic reading is on */
const authState = { phase: "loading", user: null, notice: "" };   /* loading | recovery-wait | out | in | recovery */
const BUCKET = "receipts";
const FLASH_KEY = "ringgit-log.flash";
const AUTH_KEY = "ringgit-log-auth";   /* where the Supabase client keeps the sign-in in this browser */
const siteUrl = function () { return location.origin + location.pathname.replace(/index\.html$/, ""); };   /* where email links come back to */

/* ---------- records <-> table rows ---------- */
const TRAVEL_KINDS = { toll: 1, fuel: 1, transit: 1, ride: 1, other: 1 };
const RECORD_COLS = "id,date,time,amount,category,travel_kind,description,note,source,parking,trip,attachments,extra,created_at,updated_at";
function rowFromRecord(rec, uid) {
  const cat = CAT[rec.cat] ? rec.cat : "other";
  const extra = {};
  if (rec.img) { extra.img = rec.img; extra.imgN = rec.imgN || 1; if (rec.imgPdf) extra.imgPdf = true; }
  if (rec.batch) extra.batch = String(rec.batch).slice(0, 64);
  return {
    user_id: uid, id: rec.id, date: rec.date, time: normTime(rec.time),
    amount: Math.round((Number(rec.amount) || 0) * 100) / 100,
    category: cat,
    travel_kind: cat === "travel" ? (TRAVEL_KINDS[rec.sub] ? rec.sub : "other") : "",
    description: String(rec.merchant || "").slice(0, 200),
    note: String(rec.note || "").slice(0, 1000),
    source: /^[a-z]{1,20}$/.test(rec.src || "") ? rec.src : "manual",
    parking: cat === "parking" && rec.park ? rec.park : null,
    trip: cat === "travel" && rec.trip ? rec.trip : null,
    attachments: Array.isArray(rec.att) ? rec.att.slice(0, 20) : [],
    extra: extra,
    created_at: rec.createdAt || new Date().toISOString()
  };
}
function recordFromRow(row) {
  const r = {
    id: row.id, date: String(row.date).slice(0, 10), time: row.time || "", amount: Number(row.amount) || 0,
    cat: CAT[row.category] ? row.category : "other", sub: row.travel_kind || "",
    merchant: row.description || "", note: row.note || "", src: row.source || "manual",
    createdAt: row.created_at, updatedAt: row.updated_at
  };
  if (row.parking && typeof row.parking === "object") r.park = row.parking;
  if (row.trip && typeof row.trip === "object") r.trip = row.trip;
  if (Array.isArray(row.attachments) && row.attachments.length) r.att = row.attachments;
  const x = row.extra && typeof row.extra === "object" ? row.extra : {};
  if (x.img) { r.img = x.img; r.imgN = Number(x.imgN) || 1; if (x.imgPdf) r.imgPdf = true; }
  if (x.batch) r.batch = x.batch;
  return r;
}

/* ---------- errors from the database and file storage, in the app's own codes ---------- */
function dbError(e) {
  const code = String((e && e.code) || ""), msg = String((e && e.message) || "");
  if (code === "PGRST301" || code === "PGRST303" || /jwt/i.test(msg)) return { code: "session_expired", message: msg };
  if (code === "42501" || /permission denied|row-level security/i.test(msg)) return { code: "session_expired", message: msg };
  if (/^(23514|23502|22001|22007|22008|22P02|22003)$/.test(code)) return { code: "invalid_argument", message: msg };
  if (code === "53100" || code === "53400") return { code: "quota_exceeded", message: msg };
  return { code: "unavailable", message: msg };
}
function storageError(e) {
  const status = String((e && (e.statusCode || e.status)) || ""), msg = String((e && e.message) || "");
  if (status === "413" || /too large|exceeded the maximum/i.test(msg)) return { code: "too_large", message: msg };
  if (/mime|content type/i.test(msg)) return { code: "unsupported_type", message: msg };
  if (status === "401" || status === "403" || /jwt|unauthori|row-level security/i.test(msg)) return { code: "upstream_auth", message: msg };
  if (status === "429") return { code: "rate_limited", message: msg };
  return { code: "store_unavailable", message: msg };
}

/* ---------- the storage driver: records and settings ---------- */
function supabaseDriver(user) {
  const uid = user.id;
  const cache = new Map();       /* "yyyy-mm" -> Map(id -> record) */
  const listeners = new Map();   /* "yyyy-mm" -> Set of { data, error } */
  let lastRefresh = Date.now();
  function emit(ym) {
    const set = listeners.get(ym);
    if (!set) return;
    const map = cache.get(ym) || new Map();
    set.forEach(function (l) { l.data(new Map(map), {}); });
  }
  async function load(ym) {
    const res = await sb.from("records").select(RECORD_COLS).eq("user_id", uid)
      .gte("date", ym + "-01").lt("date", addMonths(ym, 1) + "-01").order("date", { ascending: true }).limit(5000);
    if (res.error) throw dbError(res.error);
    const map = new Map();
    (res.data || []).forEach(function (row) { const r = recordFromRow(row); map.set(r.id, r); });
    cache.set(ym, map);
    emit(ym);
  }
  function fail(ym, e) { const set = listeners.get(ym); if (set) set.forEach(function (l) { l.error((e && e.code) || "unavailable"); }); }
  /* After a save: put the record in its month (taking it out of any other) and tell that month's listeners. */
  function place(rec) {
    const ym = ymOf(rec.date);
    cache.forEach(function (map, k) { if (k !== ym && map.delete(rec.id)) emit(k); });
    const map = cache.get(ym);
    if (map) { map.set(rec.id, Object.assign(clone(rec), { updatedAt: new Date().toISOString() })); emit(ym); }
  }
  function drop(rec) { cache.forEach(function (map, k) { if (map.delete(rec.id)) emit(k); }); }
  async function upsert(list) {
    const res = await sb.from("records").upsert(list.map(function (r) { return rowFromRecord(r, uid); }), { onConflict: "user_id,id" });
    if (res.error) throw dbError(res.error);
  }
  async function del(ids) {
    const res = await sb.from("records").delete().eq("user_id", uid).in("id", ids);
    if (res.error) throw dbError(res.error);
  }
  return {
    byMonthPath: false,
    listen: function (ym, onData, onError) {
      const l = { data: onData, error: onError };
      if (!listeners.has(ym)) listeners.set(ym, new Set());
      listeners.get(ym).add(l);
      if (cache.has(ym)) setTimeout(function () { onData(new Map(cache.get(ym)), {}); }, 0);
      else load(ym).catch(function (e) { fail(ym, e); });
      return function () { const s = listeners.get(ym); if (s) s.delete(l); };
    },
    watchSettings: function (onData, onError) {
      sb.from("profiles").select("display_name,settings").eq("id", uid).maybeSingle().then(function (res) {
        if (res.error) { onError(dbError(res.error).code); return; }
        webState.profile = res.data || { display_name: "", settings: {} };
        bus.emit();
        onData(webState.profile.settings || {});
      }, function () { onError("unavailable"); });
    },
    put: async function (rec) { await retrying(function () { return upsert([rec]); }); place(rec); },
    remove: async function (rec) { await retrying(function () { return del([rec.id]); }); drop(rec); },
    putMany: async function (list, onProgress) {
      const failed = [];
      for (let i = 0; i < list.length; i += 200) {
        const part = list.slice(i, i + 200);
        try { await retrying(function () { return upsert(part); }); part.forEach(place); }
        catch (e) {
          list.slice(i, STOP_CODES[e && e.code] ? list.length : i + 200).forEach(function (r) { failed.push({ rec: r, error: e }); });
          if (STOP_CODES[e && e.code]) break;
        }
        if (onProgress) onProgress(Math.min(i + 200, list.length), list.length);
      }
      return failed;
    },
    removeMany: async function (list) {
      const failed = [];
      for (let i = 0; i < list.length; i += 200) {
        const part = list.slice(i, i + 200);
        try { await retrying(function () { return del(part.map(function (r) { return r.id; })); }); part.forEach(drop); }
        catch (e) { part.forEach(function (r) { failed.push({ rec: r, error: e }); }); }
      }
      return failed;
    },
    saveSettings: function (snap) {
      return retrying(async function () {
        const res = await sb.from("profiles").upsert({ id: uid, settings: snap }, { onConflict: "id" });
        if (res.error) throw dbError(res.error);
      });
    },
    /* Pick up changes made on another device when this tab comes back into view. */
    refresh: function () {
      if (Date.now() - lastRefresh < 15000) return;
      lastRefresh = Date.now();
      listeners.forEach(function (set, ym) { if (set.size) load(ym).catch(function () {}); });
    }
  };
}
async function connectWebStorage() { return webUser ? { driver: supabaseDriver(webUser) } : { local: "signedout" }; }

/* ---------- receipt files ---------- */
const signedLinks = new Map();   /* path -> { url (string or promise), until } */
function webFileUrl(id) {
  const hit = signedLinks.get(id);
  if (hit && hit.until > Date.now()) return hit.url;
  const p = sb.storage.from(BUCKET).createSignedUrl(id, 7200).then(function (res) {
    if (res.error || !res.data || !res.data.signedUrl) { signedLinks.delete(id); return ""; }
    signedLinks.set(id, { url: res.data.signedUrl, until: Date.now() + 100 * 60000 });
    return res.data.signedUrl;
  }, function () { signedLinks.delete(id); return ""; });
  signedLinks.set(id, { url: p, until: Date.now() + 100 * 60000 });
  return p;
}
const webFiles = {
  upload: async function (blob, opts) {
    const type = (opts && opts.type) || blob.type || "image/jpeg";
    const ext = { "application/pdf": "pdf", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[type] || "jpg";
    const path = webUser.id + "/" + newId() + "." + ext;
    /* The client sends a Blob as a form upload whose part takes the Blob's own type, so give it the right one. */
    const body = blob.type === type ? blob : new Blob([blob], { type: type });
    const res = await sb.storage.from(BUCKET).upload(path, body, { contentType: type, upsert: false, cacheControl: "3600" });
    if (res.error) throw storageError(res.error);
    return { id: path, sizeBytes: blob.size, contentType: type };
  },
  delete: async function (id) {
    if (!id || String(id).indexOf(webUser.id + "/") !== 0) return { deleted: false };
    const res = await sb.storage.from(BUCKET).remove([id]);
    if (res.error) throw storageError(res.error);
    signedLinks.delete(id);
    return { deleted: true };
  },
  list: async function () {
    let files = 0, bytes = 0;
    for (let offset = 0; offset < 100000; offset += 1000) {
      const res = await sb.storage.from(BUCKET).list(webUser.id, { limit: 1000, offset: offset });
      if (res.error) throw storageError(res.error);
      const page = res.data || [];
      page.forEach(function (o) { if (o && o.id) { files++; bytes += (o.metadata && Number(o.metadata.size)) || 0; } });
      if (page.length < 1000) break;
    }
    return { assets: [], usage: { files: files, bytes: bytes, maxFiles: 0, maxBytes: 0 } };
  }
};
/* Files are saved the ordinary way: the browser downloads them. */
const webDownloads = {
  save: async function (r) {
    const blob = r.data instanceof Blob ? r.data : new Blob([r.data], { type: /\.csv$/i.test(r.filename) ? "text/csv;charset=utf-8" : "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = r.filename; a.rel = "noopener"; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    return { status: "saved" };
  }
};
async function connectWebFiles() { return { assets: webFiles, downloads: webDownloads, fileUrl: webFileUrl }; }

/* ---------- reading, through the read Edge Function ---------- */
const READ_END = "\u0000";   /* the function sends Claude's text, then this, then a status line */
async function functionHeaders() {
  const s = (await sb.auth.getSession()).data.session;
  if (!s) throw { code: "session_expired" };
  return { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token, apikey: PLATFORM.key };
}
function blobBase64(b) {
  return new Promise(function (resolve, reject) {
    const fr = new FileReader();
    fr.onload = function () { resolve(String(fr.result).split(",")[1] || ""); };
    fr.onerror = function () { reject({ code: "image_unreadable" }); };
    fr.readAsDataURL(b);
  });
}
function noteReadsLeft(res) {
  const left = res.headers.get("x-reads-left");
  if (left != null && webState.reads) { webState.reads = { left: Number(left), limit: webState.reads.limit }; bus.emit(); }
}
async function webRead(task, opts) {
  opts = opts || {};
  const images = [];
  for (let i = 0; i < (opts.images || []).length; i++) { const b = opts.images[i]; images.push({ type: b.type || "image/jpeg", data: await blobBase64(b) }); }
  const body = Object.assign({}, task, { today: todayStr(), images: images });
  let res;
  try { res = await fetch(PLATFORM.url + "/functions/v1/read", { method: "POST", headers: await functionHeaders(), body: JSON.stringify(body), signal: opts.signal }); }
  catch (e) { if (opts.signal && opts.signal.aborted) throw { code: "cancelled" }; if (e && e.code) throw e; throw { code: "unavailable" }; }
  if (!res.ok) {
    let j = {};
    try { j = await res.json(); } catch (e) {}
    if (j.code === "daily_limit" && webState.reads) { webState.reads = { left: 0, limit: webState.reads.limit }; bus.emit(); }
    throw { code: j.code || (res.status === 401 ? "session_expired" : res.status === 429 ? "rate_limited" : res.status === 413 ? "prompt_too_large" : "unavailable"), message: j.message || "" };
  }
  noteReadsLeft(res);
  const reader = res.body.getReader(), dec = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      text += dec.decode(r.value, { stream: true });
      if (opts.onText) { const k = text.indexOf(READ_END); opts.onText({ text: k >= 0 ? text.slice(0, k) : text }); }
    }
    text += dec.decode();
  } catch (e) {
    if (opts.signal && opts.signal.aborted) throw { code: "cancelled" };
    throw { code: "invalid_json", text: text.split(READ_END)[0] };   /* the connection dropped: keep what arrived */
  }
  const k = text.indexOf(READ_END);
  if (k < 0) throw { code: "invalid_json", text: text };
  let tail = {};
  try { tail = JSON.parse(text.slice(k + 1)); } catch (e) { tail = {}; }
  text = text.slice(0, k);
  if (tail.error) throw { code: tail.error, text: text };
  return { text: text, truncated: tail.stop === "max_tokens" };
}
async function connectWebReader() {
  try {
    const res = await fetch(PLATFORM.url + "/functions/v1/read", { method: "POST", headers: await functionHeaders(), body: JSON.stringify({ ping: true }) });
    if (res.status === 404) return { off: "not_configured" };
    if (!res.ok) return { off: "unavailable" };
    const j = await res.json();
    if (!j.ready) return { off: "not_configured" };
    webState.reads = { left: Math.max(0, (Number(j.limit) || 0) - (Number(j.used) || 0)), limit: Number(j.limit) || 0 };
    bus.emit();
    return { fn: webRead, limits: { images: { maxCount: 4 } }, serverPrompts: true };
  } catch (e) { return { off: "unavailable" }; }
}

/* ---------- signing in and out ---------- */
function authErrorText(e) {
  const code = String((e && e.code) || ""), msg = String((e && e.message) || "");
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) return "That email and password don't match an account.";
  if (code === "email_not_confirmed") return "Confirm your email first: open the link we sent you, then sign in.";
  if (code === "user_already_exists" || code === "email_exists" || /already (been )?registered/i.test(msg)) return "There's already an account with this email. Sign in instead.";
  if (code === "weak_password") return "Choose a stronger password: at least 8 characters, ideally with letters and numbers.";
  if (code === "same_password") return "That's already your password. Choose a different one.";
  if (code === "over_email_send_rate_limit") return "Too many emails have been sent just now. Wait a few minutes and try again.";
  if (code === "over_request_rate_limit") return "Too many attempts. Wait a few minutes and try again.";
  if (code === "email_address_not_authorized") return "This site can't send email to that address yet, so the account couldn't be created. Ask the site's owner to finish setting up sign-ups.";
  if (code === "signup_disabled") return "New accounts can't be created on this site right now.";
  if (code === "email_address_invalid") return "Enter a valid email address.";
  if (code === "session_not_found" || code === "session_expired" || code === "refresh_token_not_found" || code === "bad_jwt") return "Your sign-in has expired. Sign in again.";
  if ((e && e.name === "AuthRetryableFetchError") || /failed to fetch|network|load failed/i.test(msg)) return "Couldn't reach the server. Check your connection and try again.";
  return msg || "Something went wrong. Try again.";
}
function flash(text) { try { sessionStorage.setItem(FLASH_KEY, text); } catch (e) {} }
function takeFlash() { try { const t = sessionStorage.getItem(FLASH_KEY) || ""; sessionStorage.removeItem(FLASH_KEY); return t; } catch (e) { return ""; } }
/* Supabase sends people back from email links with details in the address. Read them before the client does. */
function takeUrlNotice() {
  const hash = String(location.hash || "").replace(/^#/, ""), query = String(location.search || "").replace(/^\?/, "");
  const p = new URLSearchParams(/error|access_token/.test(hash) ? hash : query);
  const out = { recovery: p.get("type") === "recovery" && !!p.get("access_token"), error: "" };
  const code = p.get("error_code") || p.get("error");
  if (code) {
    out.error = code === "otp_expired" ? "That link has expired or was already used. Ask for a new one below."
      : (p.get("error_description") || "That link didn't work. Try again.").replace(/\+/g, " ");
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
  }
  return out;
}
/* Opens the app for a signed-in account (once per page load). */
function enterApp(user) {
  if (!user) return;
  authState.user = user;
  authState.phase = "in";
  bus.emit();
  if (webUser) return;
  webUser = user;
  store.init(connectWebStorage);
  ai.init(connectWebReader);
  initCaps(connectWebFiles);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") store.refresh(); });
  window.addEventListener("focus", function () { store.refresh(); });
}
let recoveryTab = false;   /* this tab was opened from a password reset link */
function onAuthEvent(event, session) {
  const user = (session && session.user) || null;
  if (event === "PASSWORD_RECOVERY") {
    /* Other tabs hear about the reset link too. Only the tab it opened in asks for the new password; the rest just sign in. */
    if (!recoveryTab && user) { onAuthEvent("SIGNED_IN", session); return; }
    authState.user = user; authState.phase = "recovery"; bus.emit(); return;
  }
  if (event === "SIGNED_OUT" || !user) {
    if (webUser) { restart(); return; }   /* signed out here or in another tab: start clean */
    authState.user = null;
    if (event === "SIGNED_OUT" || authState.phase === "loading" || authState.phase === "recovery-wait") { authState.phase = "out"; bus.emit(); }
    return;
  }
  if (webUser && webUser.id !== user.id) { restart(); return; }   /* another account signed in in another tab */
  authState.user = user;
  if (webUser) { webUser = user; bus.emit(); return; }   /* token refreshed or details changed */
  if (authState.phase === "recovery" || authState.phase === "recovery-wait") { bus.emit(); return; }
  enterApp(user);
}
let leaving = false;
function restart() { if (leaving) return; leaving = true; location.reload(); }
/* Ends the session on the server and here. If the server can't be reached, the sign-in is still forgotten here. */
function forgetHere() { try { localStorage.removeItem(AUTH_KEY); } catch (e) {} }
async function signOut() {
  let r = null;
  try { r = await sb.auth.signOut(); } catch (e) { r = { error: e }; }
  if (r && r.error) forgetHere();
  restart();
}
async function callFunction(name, body) {
  let res;
  try { res = await fetch(PLATFORM.url + "/functions/v1/" + name, { method: "POST", headers: await functionHeaders(), body: JSON.stringify(body || {}) }); }
  catch (e) { throw (e && e.code) ? e : { code: "unavailable" }; }
  let j = {};
  try { j = await res.json(); } catch (e) {}
  if (!res.ok) throw { code: j.code || "unavailable", message: j.message || "" };
  return j;
}

/* ---------- screens ---------- */
function PasswordField(p) {
  const [show, setShow] = useState(false);
  return h(Field, { label: p.label },
    h("span", { className: "pw" },
      h("input", { id: p.id, className: "input", type: show ? "text" : "password", value: p.value, autoComplete: p.autoComplete, minLength: p.min || undefined, required: true, onChange: function (e) { p.onChange(e.target.value); } }),
      h("button", { type: "button", className: "btn sm ghost", "aria-pressed": show, "aria-label": show ? "Hide password" : "Show password", onClick: function () { setShow(!show); } }, show ? "Hide" : "Show")),
    p.hint ? h("small", { className: "note" }, p.hint) : null);
}
function AuthScreen() {
  useBus();
  const recovering = authState.phase === "recovery";
  const [view, setView] = useState(recovering ? "recovery" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState(authState.notice || "");
  const alive = useRef(true);
  useEffect(function () { return function () { alive.current = false; }; }, []);
  useEffect(function () { if (recovering && view !== "recovery") setView("recovery"); }, [recovering]);
  const go = function (v) { setView(v); setErr(""); setPassword(""); setNotice(""); };
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const mail = email.trim();
    setErr("");
    if (view !== "recovery" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setErr("Enter a valid email address."); return; }
    if ((view === "signup" || view === "recovery") && password.length < 8) { setErr("Use at least 8 characters for your password."); return; }
    if (view === "signin" && !password) { setErr("Enter your password."); return; }
    setBusy(true);
    try {
      if (view === "signin") {
        const r = await sb.auth.signInWithPassword({ email: mail, password: password });
        if (r.error) throw r.error;
        enterApp(r.data.user);
      } else if (view === "signup") {
        const r = await sb.auth.signUp({ email: mail, password: password, options: { data: { display_name: name.trim().slice(0, 80) }, emailRedirectTo: siteUrl() } });
        if (r.error) throw r.error;
        if (r.data && r.data.session) enterApp(r.data.user);
        else if (alive.current) setView("check");
      } else if (view === "forgot") {
        const r = await sb.auth.resetPasswordForEmail(mail, { redirectTo: siteUrl() });
        if (r.error) throw r.error;
        if (alive.current) setView("sent");
      } else if (view === "recovery") {
        const r = await sb.auth.updateUser({ password: password });
        if (r.error) throw r.error;
        toasts.push("Password changed. You're signed in.");
        enterApp(r.data.user);
      }
    } catch (x) { if (alive.current) setErr(authErrorText(x)); }
    if (alive.current) setBusy(false);
  }
  const mailField = h(Field, { label: "Email" }, h("input", { id: "auth-email", className: "input", type: "email", inputMode: "email", autoComplete: "email", required: true, value: email, onChange: function (e) { setEmail(e.target.value); } }));
  const alt = function (text, label, v) { return h("p", { className: "auth-alt" }, text, " ", h("button", { type: "button", className: "linkish", onClick: function () { go(v); } }, label)); };
  let title, lead, form = null, foot = null;
  if (view === "signin") {
    title = "Sign in"; lead = "Welcome back. Your records are where you left them.";
    form = h(Fragment, null, mailField,
      h(PasswordField, { id: "auth-password", label: "Password", value: password, onChange: setPassword, autoComplete: "current-password" }),
      h("button", { type: "button", className: "linkish auth-forgot", onClick: function () { go("forgot"); } }, "Forgot your password?"),
      h("button", { type: "submit", className: "btn primary", disabled: busy }, busy ? "Signing in…" : "Sign in"));
    foot = alt("New to Ringgit Log?", "Create an account", "signup");
  } else if (view === "signup") {
    title = "Create your account"; lead = "Free to use. Your records are private: only you can see them.";
    form = h(Fragment, null,
      h(Field, { label: "Your name (optional)" }, h("input", { id: "auth-name", className: "input", type: "text", autoComplete: "name", maxLength: 80, value: name, onChange: function (e) { setName(e.target.value); } })),
      mailField,
      h(PasswordField, { id: "auth-password", label: "Password", value: password, onChange: setPassword, autoComplete: "new-password", min: 8, hint: "At least 8 characters." }),
      h("button", { type: "submit", className: "btn primary", disabled: busy }, busy ? "Creating your account…" : "Create account"));
    foot = alt("Already have an account?", "Sign in", "signin");
  } else if (view === "forgot") {
    title = "Reset your password"; lead = "Enter the email you signed up with and we'll send a link to choose a new password.";
    form = h(Fragment, null, mailField, h("button", { type: "submit", className: "btn primary", disabled: busy }, busy ? "Sending…" : "Send reset link"));
    foot = alt("Remembered it?", "Back to sign in", "signin");
  } else if (view === "check") {
    title = "Check your email"; lead = "We sent a link to " + email.trim() + ". Open it to confirm your address and you'll be signed in.";
    foot = alt("Wrong address?", "Start again", "signup");
  } else if (view === "sent") {
    title = "Check your email"; lead = "If " + email.trim() + " has an account, a link to choose a new password is on its way. It can take a few minutes, so check your spam folder too.";
    foot = alt("", "Back to sign in", "signin");
  } else {
    title = "Choose a new password"; lead = "For " + ((authState.user && authState.user.email) || "your account") + ". You'll stay signed in on this device.";
    form = h(Fragment, null,
      h(PasswordField, { id: "auth-password", label: "New password", value: password, onChange: setPassword, autoComplete: "new-password", min: 8, hint: "At least 8 characters." }),
      h("button", { type: "submit", className: "btn primary", disabled: busy }, busy ? "Saving…" : "Save new password"));
  }
  return h("div", { className: "auth" },
    h("section", { className: "auth-side", "aria-label": "About Ringgit Log" },
      h("div", { className: "brand" }, h(BrandMark), "Ringgit Log"),
      h("h1", null, "Every ringgit, sorted by day and by type."),
      h("p", null, "Upload a TnG eWallet or CIMB statement, a receipt or a Waze screenshot, check what was read, and see your month at a glance."),
      h("ul", { className: "auth-points" },
        [["receipt", "Statements, receipts and screenshots", "Read for you, checked by you before anything is saved."],
         ["route", "Trips and toll", "Routes with distance, time and toll, or straight from a map screenshot."],
         ["parking", "Office and on-site parking", "Where, which operator, how long and how much."],
         ["table", "Excel in and out", "Fill a month in the template and import it in one go."]].map(function (x) {
          return h("li", { key: x[0] }, h("span", { className: "stat-ico" }, h(Icon, { name: x[0], size: 16 })), h("span", null, h("strong", null, x[1]), h("br"), x[2]));
        }))),
    h("main", { className: "auth-main" },
      h("div", { className: "auth-card" },
        h("div", { className: "brand auth-brand" }, h(BrandMark), "Ringgit Log"),
        h("div", null, h("h2", null, title), h("p", { className: "auth-lead" }, lead)),
        notice ? h("div", { className: "banner", role: "status" }, h(Icon, { name: "info", size: 16 }), h("span", { className: "grow" }, notice)) : null,
        form ? h("form", { onSubmit: submit, noValidate: true }, form) : null,
        err ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, err)) : null,
        foot)));
}
function initialOf(user) {
  const n = String((webState.profile && webState.profile.display_name) || (user && user.email) || "?").trim();
  return (n.charAt(0) || "?").toUpperCase();
}
function RailAccount() {
  useBus();
  const user = webUser || authState.user;
  const name = (webState.profile && webState.profile.display_name) || "";
  return h("div", { className: "acct" },
    h("span", { className: "acct-ico", "aria-hidden": "true" }, initialOf(user)),
    h("span", { className: "acct-text" }, name ? h("b", null, name) : null, h("small", null, (user && user.email) || "")),
    h("button", { type: "button", className: "icon-btn", "aria-label": "Sign out", title: "Sign out", onClick: signOut }, h(Icon, { name: "logout", size: 18 })));
}
function AccountCard() {
  useBus();
  const user = webUser || authState.user || {};
  const [name, setName] = useState((webState.profile && webState.profile.display_name) || "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const saved = (webState.profile && webState.profile.display_name) || "";
  useEffect(function () { setName(saved); }, [saved]);
  async function saveName() {
    setBusy("name"); setErr("");
    const v = name.trim().slice(0, 80);
    const res = await sb.from("profiles").upsert({ id: user.id, display_name: v }, { onConflict: "id" });
    setBusy("");
    if (res.error) { setErr(saveErrorText(dbError(res.error))); return; }
    webState.profile = Object.assign({}, webState.profile || {}, { display_name: v });
    bus.emit(); toasts.push("Name saved.");
  }
  async function savePassword() {
    if (pw.length < 8) { setErr("Use at least 8 characters for your new password."); return; }
    setBusy("pw"); setErr("");
    const r = await sb.auth.updateUser({ password: pw });
    setBusy("");
    if (r.error) { setErr(authErrorText(r.error)); return; }
    setPw(""); toasts.push("Password changed.");
  }
  async function deleteAccount() {
    setBusy("delete"); setErr("");
    try {
      await callFunction("delete-account", { confirm: "DELETE" });
      flash("Your account, its records and its receipt files were deleted.");
      try { await sb.auth.signOut({ scope: "local" }); } catch (e) {}
      forgetHere();
      restart();
    } catch (e) {
      setBusy("");
      setErr(e && e.code === "session_expired" ? "Your sign-in has expired. Sign in again, then delete the account." : "The account couldn't be deleted just now. Try again in a moment.");
    }
  }
  const reads = webState.reads;
  return h("section", { className: "card" },
    h("div", { className: "card-head" }, h("h2", null, "Your account")),
    h("div", { className: "card-body acct-card" },
      h("div", { className: "acct-row" },
        h("span", { className: "acct-ico lg", "aria-hidden": "true" }, initialOf(user)),
        h("span", { className: "acct-text" }, h("b", null, user.email || ""), h("small", null, "Signed in. Your records are private to this account.")),
        h("button", { type: "button", className: "btn", onClick: signOut }, h(Icon, { name: "logout", size: 16 }), "Sign out")),
      h("div", { className: "form-grid" },
        h(Field, { label: "Display name" },
          h("span", { className: "inline-form" },
            h("input", { id: "acct-name", className: "input", type: "text", maxLength: 80, value: name, autoComplete: "name", onChange: function (e) { setName(e.target.value); } }),
            h("button", { type: "button", className: "btn", disabled: busy === "name" || name.trim() === saved, onClick: saveName }, busy === "name" ? "Saving…" : "Save"))),
        h(Field, { label: "New password" },
          h("span", { className: "inline-form" },
            h("input", { id: "acct-password", className: "input", type: "password", autoComplete: "new-password", minLength: 8, value: pw, onChange: function (e) { setPw(e.target.value); } }),
            h("button", { type: "button", className: "btn", disabled: busy === "pw" || !pw, onClick: savePassword }, busy === "pw" ? "Saving…" : "Change")))),
      h("p", { className: "note" }, reads ? "Automatic reading: " + reads.left + " of " + reads.limit + " readings left today for this account." : ai.loading() ? "Checking automatic reading…" : aiOffText()),
      err ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, err)) : null,
      confirm
        ? h("div", { className: "danger-box" },
            h("p", null, h("strong", null, "Delete this account for good?"), " All its records and receipt files are removed and can't be brought back. Export any months you want to keep first."),
            h("label", { className: "field" }, h("span", null, "Type DELETE to confirm"), h("input", { id: "acct-delete", className: "input", type: "text", autoComplete: "off", value: typed, onChange: function (e) { setTyped(e.target.value); } })),
            h("div", { className: "toolbar" },
              h("button", { type: "button", className: "btn", disabled: busy === "delete", onClick: function () { setConfirm(false); setTyped(""); } }, "Keep my account"),
              h("button", { type: "button", className: "btn primary", disabled: busy === "delete" || typed.trim() !== "DELETE", onClick: deleteAccount }, busy === "delete" ? "Deleting…" : "Delete account")))
        : h("div", { className: "toolbar" }, h("button", { type: "button", className: "btn ghost danger", onClick: function () { setConfirm(true); setErr(""); } }, h(Icon, { name: "trash", size: 16 }), "Delete account…"))));
}
PLATFORM.ui.RailAccount = RailAccount;
PLATFORM.ui.AccountCard = AccountCard;

function WebRoot() {
  useBus();
  const ph = authState.phase;
  if (ph === "in") return h(App);
  if (ph === "out" || ph === "recovery") return h(AuthScreen, { key: ph });
  return h("div", { className: "boot" }, h("strong", null, "Ringgit Log"), h("span", null, "Signing you in…"));
}
function startApp() {
  const boot = document.getElementById("boot-msg");
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    if (boot) boot.textContent = "The sign-in service couldn't load. Check your connection and reload the page.";
    return;
  }
  const notice = takeUrlNotice();
  recoveryTab = notice.recovery;
  authState.phase = notice.recovery ? "recovery-wait" : "loading";
  authState.notice = notice.error || takeFlash();
  sb = window.supabase.createClient(PLATFORM.url, PLATFORM.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: AUTH_KEY }
  });
  /* Handle auth events outside the client's own callback, as Supabase recommends. */
  sb.auth.onAuthStateChange(function (event, session) { setTimeout(function () { onAuthEvent(event, session); }, 0); });
  if (notice.recovery) setTimeout(function () { if (authState.phase === "recovery-wait") { if (authState.user) enterApp(authState.user); else { authState.phase = "out"; bus.emit(); } } }, 6000);
  ReactDOM.createRoot(document.getElementById("app")).render(h(WebRoot));
}
