/* ================= app shell ================= */
const PAGES = [
  { id: "overview", label: "Overview", icon: "grid", tab: "Home" },
  { id: "records", label: "Records", icon: "list", tab: "Records" },
  { id: "calendar", label: "Calendar", icon: "calendar", tab: "Calendar" },
  { id: "trips", label: "Trips & toll", icon: "route", tab: "Trips" },
  { id: "parking", label: "Parking", icon: "parking", tab: "Parking" },
  { id: "settings", label: "Settings", icon: "sliders" }
];
function initialPage() {
  let hsh = "";
  try { hsh = String(location.hash || "").replace(/^#/, ""); } catch (e) {}
  return PAGES.some(x => x.id === hsh) ? hsh : "overview";
}
function MonthSwitch(p) {
  return h("div", { className: "month", role: "group", "aria-label": "Month shown" },
    h("button", { type: "button", "aria-label": "Previous month", onClick: () => p.onChange(addMonths(p.value, -1)) }, h(Icon, { name: "left", size: 16 })),
    h("span", { className: "month-label", "aria-live": "polite" }, monthLabel(p.value, true)),
    h("button", { type: "button", "aria-label": "Next month", onClick: () => p.onChange(addMonths(p.value, 1)) }, h(Icon, { name: "right", size: 16 })));
}
function App() {
  useBus();
  const today = todayStr();
  const [page, setPage] = useState(initialPage);
  const [month, setMonthRaw] = useState(ymOf(today));
  const [wiz, setWiz] = useState(null);
  const [edit, setEdit] = useState(null);
  const [text, setText] = useState(null);
  const [selDay, setSelDay] = useState(today);
  const [calFilter, setCalFilter] = useState([]);
  const [recFilter, setRecFilter] = useState([]);
  const [hint, setHint] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [imp, setImp] = useState(false);
  const [recMissing, setRecMissing] = useState(false);
  const themeState = useTheme(), theme = themeState[0], setTheme = themeState[1];
  const monthRef = useRef(month); monthRef.current = month;

  useEffect(() => { bus.emit(); }, []);   /* pick up anything that changed before this component was listening */
  useEffect(() => { for (let i = 0; i < 6; i++) store.watch(addMonths(month, -i)); }, [month]);

  const setMonth = ym => {
    setMonthRaw(ym);
    setSelDay(d => (ymOf(d) === ym ? d : ym === ymOf(todayStr()) ? todayStr() : ym + "-01"));
  };
  const go = id => {
    setPage(id);
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    try { window.scrollTo(0, 0); } catch (e) {}
  };
  async function saveNew(recs, onProgress) {
    const hadExamples = store.hasExamples();
    const failed = await store.putMany(recs, onProgress);
    const bad = new Set(failed.map(f => f.rec.id));
    const saved = recs.filter(r => !bad.has(r.id));
    if (!saved.length) throw (failed[0] && failed[0].error) || { code: "unavailable" };
    const tally = {}; saved.forEach(r => { const k = ymOf(r.date); tally[k] = (tally[k] || 0) + 1; });
    if (!tally[monthRef.current]) setMonth(Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0]);
    const what = saved.length === 1 ? "Saved " + fmtRM(cents(saved[0])) + " · " + (CAT[saved[0].cat] || CAT.other).label : "Saved " + saved.length + " records · " + fmtRM(sumCents(saved));
    if (hadExamples) {
      /* the made-up records go once the first real one is in; this runs after the save so the save feels instant */
      store.clearExamples().then(() => toasts.push("Example data cleared. From here on it's only your own records.")).catch(() => {});
    }
    toasts.push({
      text: what,
      action: { label: "Undo", run: () => {
        store.removeMany(saved).then(() => {
          const ids = Array.from(new Set(saved.map(r => r.img).filter(Boolean)));
          if (caps.assets) ids.forEach(id => { caps.assets.delete(id).catch(() => {}); });
          toasts.push(saved.length === 1 ? "Removed that record." : "Removed those " + saved.length + " records.");
        }).catch(() => toasts.push("Couldn't undo. Delete the records from the Records page."));
      } }
    });
    if (failed.length) toasts.push({ text: failed.length + (failed.length === 1 ? " record" : " records") + " couldn't be saved. " + saveErrorText(failed[0].error), ms: 9000 });
    return { saved: saved, failed: failed };
  }
  async function saveImport(ops, onProgress) {
    const hadExamples = store.hasExamples();
    const failed = await store.applyMany(ops, onProgress);
    const bad = new Set(failed.map(f => f.rec.id));
    const done = ops.filter(o => !bad.has(o.rec.id));
    if (!done.length) throw (failed[0] && failed[0].error) || { code: "unavailable" };
    const tally = {}; done.forEach(o => { const k = ymOf(o.rec.date); tally[k] = (tally[k] || 0) + 1; });
    if (!tally[monthRef.current]) setMonth(Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0]);
    if (hadExamples) store.clearExamples().then(() => toasts.push("Example data cleared. From here on it's only your own records.")).catch(() => {});
    const nNew = done.filter(o => !o.old).length, nUpd = done.length - nNew;
    const what = (nNew ? "Added " + nNew : "") + (nNew && nUpd ? ", updated " + nUpd : nUpd ? "Updated " + nUpd : "") + (done.length === 1 ? " record" : " records") + " · " + fmtRM(sumCents(done.map(o => o.rec)));
    toasts.push({ text: what, action: { label: "Undo", run: () => {
      store.undoMany(done).then(left => toasts.push(left && left.length ? left.length + (left.length === 1 ? " record" : " records") + " couldn't be put back. Check them on the Records page." : "Import undone."))
        .catch(() => toasts.push("Couldn't undo the import. Check the records on the Records page."));
    } } });
    if (failed.length) toasts.push({ text: failed.length + (failed.length === 1 ? " row" : " rows") + " couldn't be saved. " + saveErrorText(failed[0].error), ms: 9000 });
    return { done: done, failed: failed };
  }
  async function exportMonth(ym) {
    const recs = store.recs(ym).filter(r => !r.example).sort((a, b) => -cmpDesc(a, b));
    if (!recs.length) { toasts.push("There's nothing of yours to export for " + monthLabel(ym) + " yet."); return; }
    const base = "Ringgit Log " + ym;
    if (!caps.downloads) { setText({ title: "Export " + monthLabel(ym), text: toCsv(recs), hint: "Saving files isn't available in this view. Copy the text into a spreadsheet; it can be imported back the same way." }); return; }
    let blob = null;
    try { blob = await buildXlsx(recs); } catch (e) { blob = null; }
    const name = blob ? base + ".xlsx" : base + ".csv";
    try { await caps.downloads.save({ filename: name, data: blob || toCsv(recs) }); toasts.push("Saved " + name + ". Edit it and import it back to update these records."); }
    catch (e) {
      if (fileSaveFailed(e, blob ? "Excel" : "CSV") === "format" || (e && e.code === "unavailable"))
        setText({ title: "Export " + monthLabel(ym), text: toCsv(recs), hint: "Copy the text into a spreadsheet instead; it can be imported back the same way." });
    }
  }
  const A = {
    today: today, month: month, go: go, setMonth: setMonth, saveNew: saveNew, saveImport: saveImport, exportMonth: exportMonth,
    openImport: () => setImp(true),
    showMissing: () => { setRecMissing(true); setRecFilter([]); go("records"); },
    openAdd: preset => setWiz(preset || {}),
    openRec: r => setEdit(r),
    showText: setText,
    pickDay: date => { setMonth(ymOf(date)); setSelDay(date); go("calendar"); },
    planTrip: kind => { go("trips"); setHint({ kind: kind, n: Date.now() }); }
  };
  async function clearExamples() {
    setClearing(true);
    try { await store.clearExamples(); toasts.push("Example data cleared."); } catch (e) { toasts.push("Couldn't clear the examples. Try again."); }
    setClearing(false);
  }

  const cur = PAGES.find(x => x.id === page) || PAGES[0];
  const mode = store.mode(), isCurMonth = month === ymOf(today), scoped = page !== "settings";
  let view = null;
  if (page === "overview") view = h(Overview, { A: A, month: month });
  else if (page === "records") view = h(RecordsPage, { A: A, month: month, filter: recFilter, setFilter: setRecFilter, missingOnly: recMissing, setMissingOnly: setRecMissing });
  else if (page === "calendar") view = h(CalendarPage, { A: A, month: month, filter: calFilter, setFilter: setCalFilter, selDay: selDay, setSelDay: setSelDay });
  else if (page === "trips") view = h(TripsPage, { A: A, month: month, hint: hint });
  else if (page === "parking") view = h(ParkingPage, { A: A, month: month });
  else view = h(SettingsPage, { A: A, theme: theme, setTheme: setTheme });

  const syncText = mode === "cloud" ? "Saved to your account. Private to you." : mode === "local" ? "Saved in this browser only." : "Connecting to your storage…";
  const monthErr = scoped ? store.errorOf(month) : "";

  return h("div", { className: "app" },
    h("aside", { className: "rail" },
      h("div", { className: "brand" }, h(BrandMark), "Ringgit Log"),
      h("nav", { className: "nav", "aria-label": "Sections" }, PAGES.map(x =>
        h("button", { key: x.id, type: "button", className: cx("nav-item", page === x.id && "is-active"), "aria-current": page === x.id ? "page" : undefined, onClick: () => go(x.id) }, h(Icon, { name: x.icon }), x.label))),
      h("div", { className: "rail-foot" },
        PLATFORM.ui.RailAccount && mode !== "local" ? h(PLATFORM.ui.RailAccount)
          : h("div", { className: cx("sync", mode === "cloud" && "is-cloud", mode === "local" && "is-local") }, h("span", { className: "sync-dot" }), h("span", null, syncText)),
        h(Seg, { label: "Theme", value: theme, onChange: setTheme, options: [{ id: "light", label: "Light", icon: "sun" }, { id: "dark", label: "Dark", icon: "moon" }] }))),
    h("div", { className: "main" },
      h("header", { className: "top" },
        h("div", { className: "top-title" }, h("div", { className: "eyebrow" }, scoped ? monthLabel(month) : "Ringgit Log"), h("h1", null, cur.label)),
        h("div", { className: "top-actions" },
          scoped && !isCurMonth ? h("button", { type: "button", className: "btn ghost sm", onClick: () => setMonth(ymOf(today)) }, "This month") : null,
          scoped ? h(MonthSwitch, { value: month, onChange: setMonth }) : null,
          h("button", { type: "button", className: "btn primary add-desktop", onClick: () => A.openAdd() }, h(Icon, { name: "plus", size: 16 }), "Add expense"),
          h("button", { type: "button", className: "icon-btn only-mobile", "aria-label": "Settings", onClick: () => go("settings") }, h(Icon, { name: "sliders" })))),
      h("main", { className: "content" },
        store.hasExamples() ? h("div", { className: "banner", role: "note" }, h(Icon, { name: "info", size: 16 }),
          h("span", { className: "grow" }, h("strong", null, "You're looking at example data."), " These records are made up to show how the app works. They clear themselves when you save your first record."),
          h("button", { type: "button", className: "btn sm", disabled: clearing, onClick: clearExamples }, clearing ? "Clearing…" : "Clear examples")) : null,
        mode === "local" && page === "overview" ? h("div", { className: "banner warn", role: "note" }, h(Icon, { name: "info", size: 16 }),
          h("span", { className: "grow" }, "Records are being saved in this browser only, so they won't show up on your other devices.")) : null,
        monthErr ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }),
          h("span", { className: "grow" }, monthErr === "revoked" ? "Access to your storage was withdrawn while the page was open. Reload the page." : "Records for " + monthLabel(month) + " couldn't be loaded."),
          monthErr === "revoked" ? null : h("button", { type: "button", className: "btn sm", onClick: () => store.retry() }, "Try again")) : null,
        view)),
    h("nav", { className: "tabbar", "aria-label": "Sections" }, PAGES.filter(x => x.tab).map(x =>
      h("button", { key: x.id, type: "button", className: cx("tab", page === x.id && "is-active"), "aria-current": page === x.id ? "page" : undefined, onClick: () => go(x.id) }, h(Icon, { name: x.icon, size: 20 }), x.tab))),
    h("button", { type: "button", className: "fab", "aria-label": "Add expense", onClick: () => A.openAdd() }, h(Icon, { name: "plus", size: 24, sw: 2.2 })),
    wiz ? h(Wizard, { A: A, preset: wiz, onClose: () => setWiz(null) }) : null,
    edit ? h(RecordModal, { key: edit.id, rec: edit, onClose: () => setEdit(null) }) : null,
    text ? h(CopyModal, { title: text.title, text: text.text, hint: text.hint, onClose: () => setText(null) }) : null,
    imp ? h(ImportModal, { A: A, onClose: () => setImp(false) }) : null,
    h(Toasts));
}

startApp();
