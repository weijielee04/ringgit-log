/* ================= platform: a Claude artifact =================
   Storage, receipt files, file saving and reading all come from the page's host (window.claude).
   The website build uses src/00-web.js and src/07-web.js instead. */
const PLATFORM = { web: false, ui: {} };

/* Records live at data/users/<uid>/ledger/<yyyy-mm>/<record id>; settings on the ledger document itself. */
async function connectStorage() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") return { local: "standalone" };
  let db = null, user = null;
  try { const got = await Promise.all([c.use("db"), c.use("user")]); db = got[0]; user = got[1]; } catch (e) { db = null; }
  if (!db || !user) return { local: "unavailable" };
  let uid = null;
  try { uid = await user.id(); } catch (e) { uid = null; }
  if (!uid) return { local: "signedout" };
  let rootDoc = null;
  try { rootDoc = db.doc("data/users/" + uid + "/ledger"); } catch (e) { return { local: "unavailable" }; }
  return { driver: hostDriver(rootDoc) };
}
function hostDriver(rootDoc) {
  return {
    byMonthPath: true,
    listen: function (ym, onData, onError) {
      return rootDoc.collection(ym).limit(1000).onSnapshot(function (snap) {
        const map = new Map();
        snap.docs.forEach(function (d) {
          const v = d.data();
          if (v && typeof v === "object" && typeof v.date === "string") map.set(d.id, Object.assign({}, v, { id: d.id }));
        });
        onData(map, { fromCache: !!(snap.metadata && snap.metadata.fromCache) });
      }, function (err) { onError((err && err.code) || "unavailable"); });
    },
    watchSettings: function (onData, onError) {
      rootDoc.onSnapshot(function (snap) { onData(snap.exists ? (snap.data() || {}) : {}); }, function (err) { onError(err && err.code); });
    },
    put: function (rec) { return retrying(function () { return rootDoc.collection(ymOf(rec.date)).doc(rec.id).set(recordBody(rec)); }); },
    remove: function (rec) { return retrying(function () { return rootDoc.collection(ymOf(rec.date)).doc(rec.id).delete(); }); },
    saveSettings: function (snap) { return retrying(function () { return rootDoc.set(snap); }); },
    clearExamples: async function (list) {
      for (let i = 0; i < list.length; i++) {
        let snap = null;
        try { snap = await retrying(function () { return rootDoc.collection(list[i]).where("example", "==", true).limit(1000).get(); }); } catch (e) { snap = null; }
        if (!snap) continue;
        const col = rootDoc.collection(list[i]);
        await runPool(snap.docs.map(function (d) { return d.id; }), function (id) { return retrying(function () { return col.doc(id).delete(); }); });
      }
    }
  };
}
async function connectFiles() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") return {};
  try {
    const got = await Promise.all([c.use("assets"), c.use("downloads")]);
    return { assets: got[0] || null, downloads: got[1] || null, fileUrl: got[0] ? function (id) { return "/_blob/" + id; } : null };
  } catch (e) { return {}; }
}
async function connectReader() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") return { off: "standalone" };
  let fn = null;
  try { fn = await c.use("sample"); } catch (e) { fn = null; }
  if (typeof fn !== "function") return { off: "unavailable" };
  let lim = null;
  try { lim = await fn.limits(); } catch (e) { lim = null; }
  return { fn: fn, limits: lim };
}
function startApp() {
  ReactDOM.createRoot(document.getElementById("app")).render(h(App));
  store.init(connectStorage);
  ai.init(connectReader);
  initCaps(connectFiles);
}
