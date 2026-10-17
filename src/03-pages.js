/* ================= Overview ================= */
function Stat(p) {
  return h("div", { className: "card stat" },
    h("div", { className: "stat-label" }, h("span", { className: "stat-ico" }, h(Icon, { name: p.icon, size: 16 })), p.label),
    h("div", { className: "stat-value" }, p.value),
    h("div", { className: "stat-sub" }, p.sub));
}
function Overview(p) {
  const A = p.A, month = p.month, today = A.today, isCur = month === ymOf(today);
  const loaded = store.loaded(month), recs = store.recs(month);
  const [mode, setMode] = useState("daily");
  const [asTable, setAsTable] = useState(false);
  const total = sumCents(recs);
  const prevYm = addMonths(month, -1), prev = store.recs(prevYm);
  const dayNo = isCur ? Number(today.slice(8, 10)) : daysIn(month);
  const prevSpan = isCur ? prev.filter(r => Number(String(r.date).slice(8, 10)) <= dayNo) : prev;
  const prevTotal = sumCents(prevSpan);
  const delta = prevTotal > 0 ? (total - prevTotal) / prevTotal : null;
  const days = byDay(recs, month);
  const todays = isCur ? days[dayNo - 1] : null;
  const peak = days.reduce((a, b) => (b.total > a.total ? b : a), days[0]);
  const toll = sumCents(recs.filter(r => r.cat === "travel" && (r.sub === "toll" || r.trip)));
  const park = sumCents(recs.filter(r => r.cat === "parking"));
  const avg = Math.round(total / Math.max(1, dayNo));
  const money = c => (loaded ? h(Money, { c: c }) : "–");
  const mName = monthLabel(month).split(" ")[0];

  let deltaEl = null;
  if (loaded && delta !== null) {
    const pct = Math.abs(delta * 100);
    deltaEl = h(Fragment, null,
      h("span", { className: cx("delta", delta > 0.005 ? "up" : delta < -0.005 ? "down" : "flat") },
        h(Icon, { name: delta >= 0 ? "up" : "downArrow", size: 12, sw: 2.6 }), (pct >= 100 ? Math.round(pct) : pct.toFixed(1)) + "%"),
      h("span", null, (delta > 0.005 ? "more than " : delta < -0.005 ? "less than " : "same as ") + (isCur ? "1–" + dayNo + " " + monthShort(prevYm) : monthLabel(prevYm).split(" ")[0])));
  } else if (loaded) deltaEl = h("span", null, recs.length + (recs.length === 1 ? " record" : " records"));

  const dailyItems = days.map(d => ({ key: d.date, label: String(d.d), major: d.d === 1 || d.d % 5 === 0, title: dayLabel(d.date), parts: d.parts, total: d.total }));
  const monthItems = [5, 4, 3, 2, 1, 0].map(i => { const ym = addMonths(month, -i), rs = store.recs(ym); return { key: ym, label: monthShort(ym), major: true, title: monthLabel(ym), parts: byCat(rs), total: sumCents(rs) }; });
  const items = mode === "daily" ? dailyItems : monthItems;
  const recent = recs.slice().sort(cmpDesc).slice(0, 7);
  const anyHistory = monthItems.some(it => it.total > 0);
  const missing = recs.filter(missingEvidence).length;

  return h(Fragment, null,
    h("section", { className: "stats", "aria-label": "Summary" },
      isCur
        ? h(Stat, { icon: "clock", label: "Today", value: money(todays ? todays.total : 0), sub: loaded ? h("span", null, (todays ? todays.recs.length : 0) + ((todays && todays.recs.length === 1) ? " record" : " records") + " · " + dayLabel(today)) : "Opening your ledger…" })
        : h(Stat, { icon: "chart", label: "Highest day", value: money(peak ? peak.total : 0), sub: h("span", null, peak && peak.total > 0 ? dayLabel(peak.date) : "Nothing recorded") }),
      h(Stat, { icon: "receipt", label: isCur ? mName + " so far" : mName + " total", value: money(total), sub: deltaEl }),
      h(Stat, { icon: "calendar", label: "Daily average", value: money(avg), sub: h("span", null, "over " + dayNo + (dayNo === 1 ? " day" : " days")) }),
      h(Stat, { icon: "route", label: "Toll and parking", value: money(toll + park), sub: h("span", null, "Toll ", h("span", { className: "num" }, fmtNum(toll)), " · Parking ", h("span", { className: "num" }, fmtNum(park))) })),

    loaded && missing ? h("div", { className: "banner warn", role: "note" }, h(Icon, { name: "receipt", size: 16 }),
      h("span", { className: "grow" }, missing + (missing === 1 ? " parking, toll or trip record" : " parking, toll and trip records") + " in " + monthLabel(month) + (missing === 1 ? " has" : " have") + " no receipt yet. You can attach one any time."),
      h("button", { type: "button", className: "btn sm", onClick: A.showMissing }, "Show them")) : null,
    !loaded
      ? h("section", { className: "card" }, h(Empty, { icon: "layers", title: "Opening your ledger…", text: "Your records for " + monthLabel(month) + " will appear here: a breakdown by type, a day-by-day chart and your latest receipts." }))
      : recs.length === 0 && !anyHistory
        ? h("section", { className: "card" }, h(Empty, { icon: "receipt", title: "Nothing recorded for " + monthLabel(month) + " yet", text: "Add a receipt photo, a TnG or CIMB screenshot, or a statement PDF. You say what kind of expense it is, then the amounts are read for you to check." },
            h("div", { className: "toolbar", style: { justifyContent: "center" } },
              h("button", { type: "button", className: "btn primary", onClick: () => A.openAdd() }, h(Icon, { name: "plus", size: 16 }), "Add expense"),
              h("button", { type: "button", className: "btn", onClick: A.openImport }, h(Icon, { name: "table", size: 16 }), "Import from Excel"))))
        : h("section", { className: "split" },
            h("div", { className: "card" },
              h("div", { className: "card-head" }, h("h2", null, "By type"), h("span", { className: "card-sub" }, monthLabel(month))),
              h("div", { className: "card-body" }, h(Donut, { parts: byCat(recs), total: total, centerLabel: mName }))),
            h("div", { className: "card" },
              h("div", { className: "card-head" }, h("h2", null, "Spending trend"), h("span", { className: "spacer" }),
                h(Seg, { label: "Chart period", value: mode, onChange: setMode, options: [{ id: "daily", label: "Daily" }, { id: "months", label: "6 months" }] }),
                h("button", { type: "button", className: "btn sm ghost", "aria-pressed": asTable, onClick: () => setAsTable(!asTable) }, h(Icon, { name: asTable ? "chart" : "table", size: 15 }), asTable ? "Chart" : "Table")),
              h("div", { className: "card-body" },
                asTable ? h(TrendTable, { items: items, head: mode === "daily" ? "Day" : "Month" })
                  : h(Fragment, null,
                      h(Columns, { key: mode, height: 300, items: items, label: mode === "daily" ? "Spending per day in " + monthLabel(month) : "Spending per month, last six months", empty: "Nothing spent in " + monthLabel(month), onSelect: it => (mode === "daily" ? A.pickDay(it.key) : A.setMonth(it.key)) }),
                      h(Legend, { items: items }))))),

    loaded && recs.length > 0 ? h("section", { className: "card" },
      h("div", { className: "card-head" }, h("h2", null, "Latest records"), h("span", { className: "spacer" }), h("button", { type: "button", className: "btn sm ghost", onClick: () => A.go("records") }, "See all " + recs.length)),
      h("div", { className: "rows", style: { marginTop: "12px" } }, recent.map(r => h(RecRow, { key: r.id, r: r, A: A, withDate: true })))) : null);
}

/* ================= Records ================= */
function RecordsPage(p) {
  const A = p.A, month = p.month, filter = p.filter;
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("");
  const all = store.recs(month), loaded = store.loaded(month);
  const counts = {}; all.forEach(r => { counts[r.cat] = (counts[r.cat] || 0) + 1; });
  const needle = q.trim().toLowerCase();
  const missingCount = all.filter(missingEvidence).length;
  const list = all.filter(r => (!filter.length || filter.indexOf(r.cat) >= 0) && (!src || r.src === src) && (!p.missingOnly || missingEvidence(r)) &&
    (!needle || [r.merchant, r.note, r.park && r.park.location, r.park && r.park.operator, r.trip && r.trip.route].filter(Boolean).join(" ").toLowerCase().indexOf(needle) >= 0)).sort(cmpDesc);
  const groups = []; list.forEach(r => { const g = groups[groups.length - 1]; if (g && g.date === r.date) g.recs.push(r); else groups.push({ date: r.date, recs: [r] }); });
  const sources = Array.from(new Set(all.map(r => r.src).filter(s => SOURCES[s])));
  return h(Fragment, null,
    h("div", { className: "toolbar" },
      h(CatChips, { value: filter, onChange: p.setFilter, counts: counts })),
    h("div", { className: "toolbar" },
      h("label", { className: "search" }, h("span", { className: "sr" }, "Search records"), h(Icon, { name: "search", size: 16 }),
        h("input", { id: "rec-search", className: "input", type: "search", placeholder: "Search merchant, place or note", value: q, onChange: e => setQ(e.target.value) })),
      sources.length > 1 ? h("select", { id: "rec-source", className: "select", style: { width: "auto" }, value: src, "aria-label": "Source", onChange: e => setSrc(e.target.value) },
        h("option", { value: "" }, "All sources"), sources.map(s => h("option", { key: s, value: s }, SOURCES[s]))) : null,
      missingCount || p.missingOnly ? h("button", { type: "button", className: cx("chip", p.missingOnly && "is-on"), "aria-pressed": !!p.missingOnly, onClick: () => p.setMissingOnly(!p.missingOnly) },
        h(Icon, { name: "receipt", size: 14 }), "No receipt yet", h("span", { className: "chip-n num" }, missingCount)) : null,
      h("span", { className: "spacer" }),
      h("button", { type: "button", className: "btn", onClick: A.openImport }, h(Icon, { name: "upload", size: 16 }), "Import from Excel"),
      h("button", { type: "button", className: "btn", disabled: !all.some(r => !r.example), onClick: () => A.exportMonth(month) }, h(Icon, { name: "download", size: 16 }), "Export to Excel")),
    h("section", { className: "card" },
      h("div", { className: "card-head", style: { paddingBottom: "14px" } }, h("h2", null, monthLabel(month)), h("span", { className: "card-sub" }, list.length + (list.length === 1 ? " record" : " records") + (list.length !== all.length ? " of " + all.length : "")), h("span", { className: "spacer" }), h("span", { className: "num", style: { fontWeight: 500, fontSize: "15px" } }, fmtRM(sumCents(list)))),
      !loaded ? h(Empty, { icon: "layers", title: "Opening your ledger…" })
        : !list.length ? h(Empty, { icon: "list", title: all.length ? "No records match" : "No records for " + monthLabel(month), text: all.length ? "Clear the search or pick another type." : "Records you add appear here, grouped by day." },
            all.length ? h("button", { type: "button", className: "btn", onClick: () => { setQ(""); setSrc(""); p.setFilter([]); p.setMissingOnly(false); } }, "Clear filters") : h("button", { type: "button", className: "btn primary", onClick: () => A.openAdd() }, h(Icon, { name: "plus", size: 16 }), "Add expense"))
        : h("div", { className: "rows" }, groups.map(g => h(Fragment, { key: g.date },
            h("div", { className: "day-head" }, h("span", null, dayLabel(g.date)), h("span", { className: "num" }, fmtRM(sumCents(g.recs)))),
            g.recs.map(r => h(RecRow, { key: r.id, r: r, A: A })))))));
}

/* ================= Calendar ================= */
function CalendarPage(p) {
  const A = p.A, month = p.month, today = A.today, filter = p.filter, selDay = p.selDay;
  const [asTable, setAsTable] = useState(false);
  const all = store.recs(month), loaded = store.loaded(month);
  const recs = filter.length ? all.filter(r => filter.indexOf(r.cat) >= 0) : all;
  const days = byDay(recs, month);
  const total = sumCents(recs);
  const maxDay = days.reduce((a, d) => Math.max(a, d.total), 0);
  const active = days.filter(d => d.total > 0).length;
  const isCur = month === ymOf(today);
  const span = isCur ? Number(today.slice(8, 10)) : daysIn(month);
  const peak = days.reduce((a, b) => (b.total > a.total ? b : a), days[0]);
  const sel = days.find(d => d.date === selDay) || null;
  const lead = (parseYMD(month + "-01").getDay() + 6) % 7;   /* weeks start on Monday */
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  days.forEach(d => cells.push(d));
  while (cells.length % 7) cells.push(null);
  const counts = {}; all.forEach(r => { counts[r.cat] = (counts[r.cat] || 0) + 1; });
  const items = days.map(d => ({ key: d.date, label: String(d.d), major: d.d === 1 || d.d % 5 === 0, title: dayLabel(d.date), parts: d.parts, total: d.total }));
  const filterNote = filter.length ? filter.map(c => CAT[c].label).join(", ") + " only" : "All types";

  return h(Fragment, null,
    h("div", { className: "toolbar" }, h(CatChips, { value: filter, onChange: p.setFilter, counts: counts })),
    h("section", { className: "split even" },
      h("div", { className: "card" },
        h("div", { className: "card-head" }, h("h2", null, monthLabel(month)), h("span", { className: "card-sub" }, filterNote)),
        h("div", { className: "card-body" },
          h("div", { className: "cal-summary", style: { marginBottom: "14px" } },
            h("span", null, "Month total ", h("b", null, loaded ? fmtRM(total) : "–")),
            h("span", null, "Daily average ", h("b", null, loaded ? fmtRM(Math.round(total / Math.max(1, span))) : "–")),
            h("span", null, "Days with spending ", h("b", null, loaded ? active + " of " + span : "–")),
            peak && peak.total > 0 ? h("span", null, "Highest ", h("b", null, fmtRM(peak.total)), " on " + dayLabel(peak.date)) : null),
          h("div", { className: "cal", role: "group", "aria-label": "Days of " + monthLabel(month) },
            ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => h("div", { key: d, className: "cal-dow", "aria-hidden": "true" }, d)),
            cells.map((d, i) => {
              if (!d) return h("div", { key: "pad" + i, className: "cal-cell is-pad", "aria-hidden": "true" });
              const ratio = maxDay > 0 ? d.total / maxDay : 0;
              const heat = d.total > 0 ? (ratio > 0.66 ? "h3" : ratio > 0.33 ? "h2" : "h1") : "";
              return h("button", {
                key: d.date, type: "button", className: cx("cal-cell", heat, d.date === today && "is-today", d.date === selDay && "is-sel", d.date > today && "is-future"),
                "aria-pressed": d.date === selDay, "aria-label": dayLabel(d.date) + (d.total ? ", " + fmtRM(d.total) + ", " + d.recs.length + (d.recs.length === 1 ? " record" : " records") : ", nothing recorded"),
                onClick: () => p.setSelDay(d.date)
              },
                h("span", { className: "cal-num" }, d.d),
                d.total > 0 ? h("span", { className: "cal-amt num" }, fmtShort(d.total)) : null,
                d.total > 0 ? h("span", { className: "cal-bar" }, STACK.filter(c => d.parts[c] > 0).map(c => h("i", { key: c, style: { background: catColor(c), flexGrow: d.parts[c], flexBasis: 0 } }))) : null);
            })),
          h("div", { className: "legend" }, CATS.filter(c => counts[c.id] && (!filter.length || filter.indexOf(c.id) >= 0)).map(c => h("span", { key: c.id }, h("i", { className: "sw", style: { background: catColor(c.id) } }), c.label))))),
      h("div", { className: "card" },
        h("div", { className: "card-head" }, h("h2", null, sel ? dayLabel(sel.date) : "Pick a day"), sel && sel.date === today ? h("span", { className: "tag" }, "Today") : null),
        h("div", { className: "card-body" },
          h("div", { className: "day-total" }, h("span", { className: "cur" }, "RM"), fmtNum(sel ? sel.total : 0)),
          h("p", { className: "note" }, sel ? sel.recs.length + (sel.recs.length === 1 ? " record" : " records") + (filter.length ? " · " + filterNote.toLowerCase() : "") : "Choose a day in the calendar to see what was spent.")),
        sel && sel.recs.length ? h("div", { className: "rows compact" }, sel.recs.slice().sort(cmpDesc).map(r => h(RecRow, { key: r.id, r: r, A: A }))) : null,
        sel ? h("div", { className: "card-foot" }, h("button", { type: "button", className: "btn sm", onClick: () => A.openAdd({ date: sel.date }) }, h(Icon, { name: "plus", size: 15 }), "Add expense for this day")) : null)),
    h("section", { className: "card" },
      h("div", { className: "card-head" }, h("h2", null, "Spending per day"), h("span", { className: "card-sub" }, filterNote), h("span", { className: "spacer" }),
        h("button", { type: "button", className: "btn sm ghost", "aria-pressed": asTable, onClick: () => setAsTable(!asTable) }, h(Icon, { name: asTable ? "chart" : "table", size: 15 }), asTable ? "Chart" : "Table")),
      h("div", { className: "card-body" },
        asTable ? h(TrendTable, { items: items, head: "Day" })
          : h(Fragment, null, h(Columns, { items: items, label: "Spending per day in " + monthLabel(month), selectedKey: selDay, empty: "Nothing spent in " + monthLabel(month) + (filter.length ? " for these types" : ""), onSelect: it => p.setSelDay(it.key) }), h(Legend, { items: items })))));
}

/* ================= Trips and toll ================= */
function NumInput(p) {
  const digits = p.digits == null ? 1 : p.digits;
  const fmt = v => (v || (v === 0 && !p.blankZero) ? String(Math.round(Number(v) * Math.pow(10, digits)) / Math.pow(10, digits)) : "");
  const [txt, setTxt] = useState(fmt(p.value));
  const last = useRef(p.value);
  useEffect(() => { if (p.value !== last.current) { last.current = p.value; setTxt(fmt(p.value)); } }, [p.value]);
  return h("input", { id: p.id, className: "input num", type: "text", inputMode: "decimal", autoComplete: "off", value: txt, placeholder: p.placeholder || "", "aria-label": p.label,
    onChange: e => { const t = e.target.value.replace(/[^0-9.]/g, ""); setTxt(t); const n = parseFloat(t), v = isFinite(n) ? n : 0; last.current = v; p.onChange(v); } });
}
function RoutePlanner(p) {
  const A = p.A;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(A.today);
  const [time, setTime] = useState(nowHM());
  const [round, setRound] = useState(false);
  const [keep, setKeep] = useState(true);
  const [phase, setPhase] = useState("idle");
  const [busyText, setBusyText] = useState("");
  const [routes, setRoutes] = useState([]);
  const [pick, setPick] = useState(0);
  const [basis, setBasis] = useState("estimate");
  const [info, setInfo] = useState({});
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const ctl = useRef(null), fileRef = useRef(null), fromRef = useRef(null);
  const aiOn = ai.ready();

  useEffect(() => {
    if (!p.hint) return;
    if (p.hint.kind === "shot" && fileRef.current) fileRef.current.click();
    else if (fromRef.current) fromRef.current.focus();
  }, [p.hint && p.hint.n]);

  const fail = e => {
    if (!(e && e.code === "cancelled")) setErr(e && e.code === "nothing_found" ? "No route could be worked out from that. Check the place names or the screenshot, or enter the trip by hand." : readErrorText(e));
    setPhase(routes.length ? "done" : "idle");
  };
  async function plan(fresh) {
    if (!from.trim() || !to.trim()) { setErr("Enter both a starting point and a destination."); return; }
    setErr(""); setPhase("busy"); setBusyText("Working out routes from " + from.trim() + " to " + to.trim() + "…");
    const c = new AbortController(); ctl.current = c;
    try {
      const reply = await ai.json({ task: "route", from: from.trim(), to: to.trim() }, { signal: c.signal, fresh: fresh });
      const list = (reply && Array.isArray(reply.routes) ? reply.routes : []).map(normRoute).filter(r => r && r.km > 0).slice(0, 3);
      if (!list.length) throw { code: "nothing_found" };
      setRoutes(list); setPick(0); setBasis("estimate");
      setInfo({ low: reply.confidence === "low", question: String(reply.question || "").slice(0, 200), from: String(reply.from || "").slice(0, 90), to: String(reply.to || "").slice(0, 90) });
      setPhase("done");
    } catch (e) { fail(e); }
  }
  async function fromShot(file) {
    if (!file) return;
    setErr(""); setPhase("busy"); setBusyText("Reading " + file.name + "…");
    const c = new AbortController(); ctl.current = c;
    try {
      if (!ai.canImages()) throw { code: "images_unavailable" };
      const src = await decodeImage(file);
      const tiles = await tilesFrom(src, Math.max(1, Math.min(3, ai.maxImages())));
      const reply = await ai.json({ task: "shot", count: tiles.length }, { images: tiles, signal: c.signal });
      const list = (reply && Array.isArray(reply.routes) ? reply.routes : []).map(normRoute).filter(r => r && (r.km > 0 || r.mins > 0)).slice(0, 4);
      if (!list.length) throw { code: "nothing_found" };
      setRoutes(list); setPick(0); setBasis("screenshot");
      setInfo({ app: reply.app, shot: file });
      if (reply.from && !from.trim()) setFrom(String(reply.from).slice(0, 90));
      if (reply.to && !to.trim()) setTo(String(reply.to).slice(0, 90));
      setPhase("done");
    } catch (e) { fail(e); }
  }
  function byHand() {
    setErr(""); setRoutes([{ name: "My route", roads: [], km: 0, mins: 0, minsPeak: 0, tolls: [], toll: 0, tollNote: "manual", note: "" }]);
    setPick(0); setBasis("manual"); setInfo({}); setPhase("done");
  }
  const patchRoute = (i, patch) => setRoutes(routes.map((r, j) => (j === i ? Object.assign({}, r, patch) : r)));
  async function save() {
    const r = routes[pick];
    if (!r) return;
    if (!isYMD(date)) { setErr("Pick a valid date for the trip."); return; }
    if (!from.trim() || !to.trim()) { setErr("Fill in where the trip started and ended so you can recognise it later."); return; }
    const k = round ? 2 : 1;
    const rec = {
      id: newId(), date: date, time: normTime(time), amount: Math.round(r.toll * k * 100) / 100, cat: "travel", sub: "toll",
      merchant: from.trim() + " → " + to.trim(), note: r.name,
      src: basis === "screenshot" ? (info.app === "waze" ? "waze" : info.app === "google_maps" ? "gmaps" : "other") : basis === "manual" ? "manual" : "route",
      trip: { from: from.trim(), to: to.trim(), route: r.name, roads: r.roads, km: Math.round(r.km * k * 10) / 10, mins: Math.round(r.mins * k), tolls: r.tolls, round: round, basis: basis },
      createdAt: new Date().toISOString()
    };
    setSaving(true); setErr("");
    try {
      if (basis === "screenshot" && info.shot && keep && caps.assets) {
        try { const up = await caps.assets.upload(await archiveCopy(info.shot)); rec.img = up.id; rec.imgN = 1; } catch (e) {}
      }
      await A.saveNew([rec]);
      setRoutes([]); setPhase("idle"); setInfo({}); setFrom(""); setTo(""); setRound(false);
    } catch (e) { setErr(saveErrorText(e)); }
    setSaving(false);
  }
  const k = round ? 2 : 1, chosen = routes[pick];
  const mapsUrl = from.trim() && to.trim() ? "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=" + encodeURIComponent(from.trim()) + "&destination=" + encodeURIComponent(to.trim()) : "";
  const places = Array.from(new Set(p.past.reduce((a, r) => (r.trip ? a.concat([r.trip.from, r.trip.to]) : a), []).filter(Boolean))).slice(0, 30);

  return h("section", { className: "card" },
    h("div", { className: "card-head" }, h("h2", null, "Plan a trip"), h("span", { className: "card-sub" }, "Distance, driving time and toll for a Class 1 car")),
    h("div", { className: "card-body" },
      h("div", { className: "planner" },
        h(Field, { label: "Starting point" }, h("input", { id: "trip-from", ref: fromRef, className: "input", type: "text", list: "trip-places", placeholder: "e.g. Subang Jaya", value: from, onChange: e => setFrom(e.target.value) })),
        h(Field, { label: "Destination" }, h("input", { id: "trip-to", className: "input", type: "text", list: "trip-places", placeholder: "e.g. KL Sentral", value: to, onChange: e => setTo(e.target.value), onKeyDown: e => { if (e.key === "Enter" && aiOn && phase !== "busy") plan(false); } })),
        h(Field, { label: "Date" }, h("input", { id: "trip-date", className: "input", type: "date", value: date, onChange: e => setDate(e.target.value) })),
        h(Field, { label: "Time" }, h("input", { id: "trip-time", className: "input", type: "time", value: time, onChange: e => setTime(e.target.value) }))),
      h("datalist", { id: "trip-places" }, places.map(x => h("option", { key: x, value: x }))),
      h("input", { id: "trip-shot", ref: fileRef, type: "file", accept: "image/*", hidden: true, onChange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; fromShot(f); } }),
      h("div", { className: "planner-actions" },
        aiOn ? h("button", { type: "button", className: "btn primary", disabled: phase === "busy", onClick: () => plan(routes.length > 0 && basis === "estimate") }, h(Icon, { name: "route", size: 16 }), routes.length && basis === "estimate" ? "Find routes again" : "Find routes") : null,
        aiOn ? h("button", { type: "button", className: "btn", disabled: phase === "busy", onClick: () => fileRef.current && fileRef.current.click() }, h(Icon, { name: "image", size: 16 }), "Use a Waze or Google Maps screenshot") : null,
        h("button", { type: "button", className: "btn ghost", disabled: phase === "busy", onClick: byHand }, h(Icon, { name: "keyboard", size: 16 }), "Enter a trip by hand"),
        h("label", { className: "check" }, h("input", { id: "trip-round", type: "checkbox", checked: round, onChange: e => setRound(e.target.checked) }), "Round trip")),
      !aiOn && !ai.loading() ? h("p", { className: "note", style: { marginTop: "10px" } }, aiOffText().replace("details need typing in", "trips need entering by hand")) : null,
      err ? h("div", { className: "banner bad", role: "alert", style: { marginTop: "12px" } }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, err)) : null,
      phase === "busy" ? h("div", { className: "reading" }, h("div", { className: "spinner" }), h("p", null, busyText), h("p", { className: "note" }, "This usually takes 10 to 40 seconds."),
        h("button", { type: "button", className: "btn sm", onClick: () => ctl.current && ctl.current.abort() }, "Stop")) : null,
      phase === "done" && routes.length ? h(Fragment, null,
        basis === "estimate" ? h("div", { className: "banner", style: { marginTop: "14px" } }, h(Icon, { name: "info", size: 16 }),
          h("span", { className: "grow" }, h("strong", null, "These are estimates."), " Claude worked them out from general road knowledge and the toll table below, not from live traffic. " + (info.low && info.question ? info.question + " " : "") + "For exact figures, check the route in a map app or upload its screenshot."),
          mapsUrl ? h("a", { className: "btn sm", href: mapsUrl, target: "_blank", rel: "noopener noreferrer" }, h(Icon, { name: "link", size: 14 }), "Open in Google Maps") : null) : null,
        basis === "screenshot" ? h("p", { className: "note", style: { marginTop: "14px" } }, "Read from your " + (info.app === "waze" ? "Waze" : info.app === "google_maps" ? "Google Maps" : "navigation") + " screenshot. Check the numbers against the picture before saving.") : null,
        h("div", { className: "routes" }, routes.map((r, i) => h("div", { key: i, className: cx("route", i === pick && "is-on") },
          h("button", { type: "button", className: "route-top", "aria-pressed": i === pick, onClick: () => setPick(i) },
            h("span", { className: "route-radio" }), h("span", { className: "route-name" }, r.name), r.roads.map((x, j) => h("span", { key: j, className: "hw" }, x)),
            h("span", { className: "route-stats" },
              h("span", null, h("b", null, fmtKm(r.km * k))),
              h("span", null, h("b", null, fmtMins(r.mins * k)), r.minsPeak ? " · rush hour " + fmtMins(r.minsPeak * k) : ""),
              h("span", null, "Toll ", h("b", null, r.tollNote === "unknown" ? "not shown" : fmtRM(Math.round(r.toll * k * 100)))))),
          r.tolls.length ? h("div", { className: "plazas" }, r.tolls.map((t, j) => h("span", { key: j, className: "plaza" }, t.plaza + (t.road ? " · " + t.road : ""), h("b", null, t.rm.toFixed(2))))) : null,
          r.note ? h("p", { className: "note" }, r.note) : null,
          i === pick ? h("div", { className: "route-edit" },
            h(Field, { label: "One-way distance (km)" }, h(NumInput, { id: "route-km", value: r.km, digits: 1, label: "One-way distance in km", onChange: v => patchRoute(i, { km: v }) })),
            h(Field, { label: "One-way time (minutes)" }, h(NumInput, { id: "route-mins", value: r.mins, digits: 0, label: "One-way driving time in minutes", onChange: v => patchRoute(i, { mins: v }) })),
            h(Field, { label: "One-way toll (RM)" }, h(AmountInput, { id: "route-toll", className: "input num", value: r.toll, label: "One-way toll in RM", onChange: v => patchRoute(i, { toll: v, tollNote: "manual" }) }))) : null))),
        h("div", { className: "planner-actions" },
          h("button", { type: "button", className: "btn primary", disabled: saving || !chosen, onClick: save }, h(Icon, { name: "check", size: 16 }), saving ? "Saving…" : "Save trip" + (chosen ? " · " + fmtRM(Math.round(chosen.toll * k * 100)) + " toll" : "")),
          basis === "screenshot" && caps.assets ? h("label", { className: "check" }, h("input", { id: "trip-keep", type: "checkbox", checked: keep, onChange: e => setKeep(e.target.checked) }), "Keep the screenshot with this trip") : null,
          h("button", { type: "button", className: "btn ghost", onClick: () => { setRoutes([]); setPhase("idle"); setErr(""); } }, "Discard"))) : null));
}
function TripsPage(p) {
  const A = p.A, month = p.month;
  const [showRates, setShowRates] = useState(false);
  const all = store.recs(month);
  const trips = all.filter(r => r.trip).sort(cmpDesc);
  const tolls = all.filter(r => r.cat === "travel" && r.sub === "toll" && !r.trip);
  const km = trips.reduce((s, r) => s + (Number(r.trip.km) || 0), 0), mins = trips.reduce((s, r) => s + (Number(r.trip.mins) || 0), 0);
  const roads = []; TOLL_FIXED.forEach(t => { const g = roads[roads.length - 1]; if (g && g.road === t[0]) g.plazas.push(t); else roads.push({ road: t[0], plazas: [t] }); });
  return h(Fragment, null,
    h(RoutePlanner, { A: A, hint: p.hint, past: trips }),
    h("section", { className: "card" },
      h("div", { className: "card-head" }, h("h2", null, "Trips in " + monthLabel(month)), h("span", { className: "card-sub" }, trips.length + (trips.length === 1 ? " trip" : " trips"))),
      h("div", { className: "card-body" },
        h("div", { className: "park-stats" },
          h("div", { className: "mini" }, h("small", null, "Distance"), h("b", null, fmtKm(km))),
          h("div", { className: "mini" }, h("small", null, "Driving time"), h("b", null, fmtMins(mins))),
          h("div", { className: "mini" }, h("small", null, "Toll on trips"), h("b", null, fmtRM(sumCents(trips))))),
        tolls.length ? h("p", { className: "note", style: { marginTop: "10px" } }, "Plus " + tolls.length + (tolls.length === 1 ? " toll payment" : " toll payments") + " from receipts and statements, " + fmtRM(sumCents(tolls)) + ". They are listed under Records.") : null),
      trips.length ? h("div", { className: "rows" }, trips.map(r => h(RecRow, { key: r.id, r: r, A: A, withDate: true })))
        : h(Empty, { icon: "route", title: "No trips saved for " + monthLabel(month), text: "Plan a trip above or upload a route screenshot. Each saved trip records the distance, the driving time and the toll." })),
    h("section", { className: "card" },
      h("div", { className: "card-head", style: { paddingBottom: showRates ? 0 : "16px" } }, h("h2", null, "Toll rates used for estimates"), h("span", { className: "card-sub" }, "Class 1 cars · checked " + TOLL_CHECKED), h("span", { className: "spacer" }),
        h("button", { type: "button", className: "btn sm ghost", "aria-expanded": showRates, onClick: () => setShowRates(!showRates) }, showRates ? "Hide" : "Show rates")),
      showRates ? h("div", { className: "card-body" },
        h("p", { className: "note", style: { marginBottom: "10px" } }, "Flat charge at each plaza on open-system highways. Rates change from time to time, so adjust the toll on a trip before saving if yours differs."),
        h("div", { className: "tbl-wrap" }, h("table", { className: "tbl" },
          h("thead", null, h("tr", null, h("th", null, "Highway"), h("th", { className: "l" }, "Plazas"), h("th", null, "RM"))),
          h("tbody", null, roads.map(g => {
            const rates = Array.from(new Set(g.plazas.map(t => t[2])));
            return rates.map((rate, i) => h("tr", { key: g.road + rate }, h("td", null, i === 0 ? g.road : ""), h("td", { className: "l", style: { whiteSpace: "normal" } }, g.plazas.filter(t => t[2] === rate).map(t => t[1]).join(", ")), h("td", { className: "num" }, rate.toFixed(2))));
          })))),
        h("p", { className: "note", style: { marginTop: "12px" } }, "Distance-based highways: " + TOLL_PER_KM.map(t => t[0] + " at about RM " + t[1].toFixed(3) + " per km").join("; ") + ". Known fares: " + TOLL_FARES + ".")) : null));
}

/* ================= Parking ================= */
function ParkPanel(p) {
  const A = p.A, kind = p.kind, list = p.list.slice().sort(cmpDesc);
  const total = sumCents(list), n = list.length;
  const timed = list.filter(r => r.park && r.park.mins > 0);
  const hours = timed.reduce((s, r) => s + r.park.mins, 0) / 60;
  const rate = hours > 0 ? Math.round(sumCents(timed) / hours) : null;
  const map = {};
  list.forEach(r => {
    const name = (r.park && r.park.location) || r.merchant || "Unnamed place";
    const g = map[name] = map[name] || { name: name, op: "", n: 0, c: 0, mins: 0, tc: 0 };
    g.n++; g.c += cents(r);
    if (r.park && r.park.operator) g.op = r.park.operator;
    if (r.park && r.park.mins > 0) { g.mins += r.park.mins; g.tc += cents(r); }
  });
  const places = Object.keys(map).map(k => map[k]).sort((a, b) => b.c - a.c);
  return h("section", { className: "card" },
    h("div", { className: "card-head" },
      h("span", { className: "stat-ico" }, h(Icon, { name: kind === "office" ? "building" : "pin", size: 16 })),
      h("div", null, h("h2", null, kind === "office" ? "Office parking" : "On-site parking"), h("div", { className: "card-sub" }, kind === "office" ? "Where you park for work" : "Client sites, errands and everywhere else")),
      h("span", { className: "spacer" }),
      h("button", { type: "button", className: "btn sm primary", onClick: () => A.openAdd({ type: "parking", parkKind: kind, step: "source" }) }, h(Icon, { name: "upload", size: 15 }), "Add receipt")),
    h("div", { className: "card-body" },
      h("div", { className: "park-stats" },
        h("div", { className: "mini" }, h("small", null, "This month"), h("b", null, fmtRM(total))),
        h("div", { className: "mini" }, h("small", null, "Visits"), h("b", null, n)),
        h("div", { className: "mini" }, h("small", null, "Typical rate"), h("b", null, rate != null ? fmtRM(rate) + "/h" : "–")))),
    places.length ? h(Fragment, null,
      h("div", { className: "sub-head", style: { paddingTop: 0 } }, "Rates by place"),
      h("div", { className: "tbl-wrap", style: { padding: "0 8px" } }, h("table", { className: "tbl" },
        h("thead", null, h("tr", null, h("th", null, "Place"), h("th", null, "Visits"), h("th", null, "Average"), h("th", null, "Per hour"))),
        h("tbody", null, places.map(g => h("tr", { key: g.name },
          h("td", { style: { whiteSpace: "normal" } }, g.name, g.op ? h("div", { className: "note" }, g.op) : null),
          h("td", { className: "num" }, g.n), h("td", { className: "num" }, fmtNum(Math.round(g.c / g.n))), h("td", { className: "num" }, g.mins > 0 ? fmtNum(Math.round(g.tc / (g.mins / 60))) : "–")))))),
      h("div", { className: "sub-head" }, "Receipts"),
      h("div", { className: "rows compact" }, list.map(r => h(RecRow, { key: r.id, r: r, A: A, withDate: true }))))
      : h(Empty, { icon: "parking", title: "No " + (kind === "office" ? "office" : "on-site") + " parking this month", text: "Upload a parking receipt or a TnG screenshot. The place, the operator, the amount and the time are filled in for you to check." }));
}
function ParkingPage(p) {
  const recs = store.recs(p.month).filter(r => r.cat === "parking");
  const office = recs.filter(r => r.park && r.park.kind === "office"), onsite = recs.filter(r => !(r.park && r.park.kind === "office"));
  return h(Fragment, null,
    h("div", { className: "cal-summary" },
      h("span", null, "Parking in " + monthLabel(p.month) + " ", h("b", null, fmtRM(sumCents(recs)))),
      h("span", null, "Office ", h("b", null, fmtRM(sumCents(office)))),
      h("span", null, "On-site ", h("b", null, fmtRM(sumCents(onsite))))),
    h("div", { className: "two" }, h(ParkPanel, { A: p.A, kind: "office", list: office }), h(ParkPanel, { A: p.A, kind: "onsite", list: onsite })));
}

/* ================= Settings ================= */
function SettingsPage(p) {
  const A = p.A;
  const [place, setPlace] = useState("");
  const [usage, setUsage] = useState(null);
  const [busy, setBusy] = useState("");
  const places = store.officePlaces();
  const mode = store.mode();
  const addPlace = () => { const v = place.trim(); if (!v) return; if (!places.some(x => x.toLowerCase() === v.toLowerCase())) store.saveSettings({ officePlaces: places.concat(v).slice(-20) }); setPlace(""); };
  const dropPlace = v => store.saveSettings({ officePlaces: places.filter(x => x !== v) });
  async function checkUsage() {
    if (!caps.assets) return;
    setBusy("usage");
    try { const r = await caps.assets.list(); setUsage(r.usage); } catch (e) { toasts.push("Couldn't check photo storage just now."); }
    setBusy("");
  }
  async function clearEx() {
    setBusy("examples");
    try { await store.clearExamples(); toasts.push("Example data cleared."); } catch (e) { toasts.push("Couldn't clear the examples. Try again."); }
    setBusy("");
  }
  const storeText = mode === "cloud" ? (PLATFORM.web ? "Your records are saved in this site's database under your account, so they're on every device you sign in on. They are private: every account has its own records, and no one else can read yours."
      : "Your records are saved with this page under your Claude account. They are private to you: anyone else who opens this page gets their own empty ledger.")
    : mode === "local" ? (store.why() === "standalone" ? "This copy of the page is running on its own, so records are kept in this browser only." : "Online storage isn't available in this view, so records are kept in this browser only. They won't appear on your other devices.")
    : "Connecting to your storage…";
  const readText = PLATFORM.web ? "When you press Read, photos, screenshots and PDF pages are sent to Claude (by Anthropic) through this site to be read. PDFs are opened in your browser first; if a PDF has selectable text, only that text is sent."
    : "Photos, screenshots and PDF pages are sent to Claude to be read, on your own Claude account, when you press Read. PDFs are opened in your browser first; if a PDF has selectable text, only that text is sent.";
  const usageText = usage ? usage.files + (usage.files === 1 ? " file" : " files") + " kept · " + fmtBytes(usage.bytes) + (usage.maxBytes ? " of " + fmtBytes(usage.maxBytes) : "") + " used" : "";
  return h(Fragment, null,
    PLATFORM.ui.AccountCard && mode === "cloud" ? h(PLATFORM.ui.AccountCard, { A: A }) : null,
    h("section", { className: "card" },
      h("div", { className: "card-head" }, h("h2", null, "Office parking places")),
      h("div", { className: "card-body" },
        h("p", { className: "note", style: { marginBottom: "12px", maxWidth: "70ch" } }, "When a statement or screenshot has parking at one of these places, it is filed under Office; everything else goes under On-site. A place is added here whenever you save an office parking record."),
        h("div", { className: "chips", style: { marginBottom: "12px" } }, places.length ? places.map(v => h("span", { key: v, className: "chip" }, v, h("button", { type: "button", "aria-label": "Remove " + v, onClick: () => dropPlace(v), style: { display: "grid" } }, h(Icon, { name: "x", size: 14 })))) : h("span", { className: "note" }, "No places yet.")),
        h("div", { className: "toolbar" },
          h("input", { id: "office-place", className: "input", style: { maxWidth: "320px" }, type: "text", placeholder: "Building or car park name", value: place, onChange: e => setPlace(e.target.value), onKeyDown: e => { if (e.key === "Enter") addPlace(); } }),
          h("button", { type: "button", className: "btn", onClick: addPlace }, "Add place")))),
    h("section", { className: "card" },
      h("div", { className: "card-head" }, h("h2", null, "Spreadsheets")),
      h("div", { className: "card-body" },
        h("p", { style: { maxWidth: "70ch", marginBottom: "12px" } }, "Fill in a month in the Excel template and import it in one go. To change many records at once, export the month, edit the file and import it back: rows keep a Record ID, so they update instead of being added twice."),
        h("div", { className: "toolbar" },
          h("button", { type: "button", className: "btn", onClick: saveTemplate }, h(Icon, { name: "download", size: 16 }), "Download template"),
          h("button", { type: "button", className: "btn", onClick: A.openImport }, h(Icon, { name: "upload", size: 16 }), "Import from Excel"),
          h("button", { type: "button", className: "btn", onClick: () => A.exportMonth(A.month) }, h(Icon, { name: "table", size: 16 }), "Export " + monthLabel(A.month) + " to Excel")))),
    h("section", { className: "card" },
      h("div", { className: "card-head" }, h("h2", null, "Where your data is kept")),
      h("div", { className: "card-body" },
        h("p", { style: { maxWidth: "70ch" } }, storeText),
        h("p", { className: "note", style: { marginTop: "10px", maxWidth: "70ch" } }, readText),
        caps.assets ? h("div", { className: "toolbar", style: { marginTop: "12px" } },
          h("button", { type: "button", className: "btn sm", disabled: busy === "usage", onClick: checkUsage }, busy === "usage" ? "Checking…" : PLATFORM.web ? "Check receipt storage" : "Check photo storage"),
          usage ? h("span", { className: "note" }, usageText) : h("span", { className: "note" }, PLATFORM.web ? "Receipts are kept in a private folder for your account and shown through links that expire." : "Receipt photos are stored with this page. Only people you give edit access to the page could reach them."))
          : h("p", { className: "note", style: { marginTop: "10px" } }, "Receipt photos aren't kept in this view; the details read from them still are."))),
    store.hasExamples() ? h("section", { className: "card" },
      h("div", { className: "card-head" }, h("h2", null, "Example data")),
      h("div", { className: "card-body" },
        h("p", { style: { maxWidth: "70ch", marginBottom: "12px" } }, "The records marked Example are made up, so you can see how the charts and lists look. They clear themselves when you save your first record."),
        h("button", { type: "button", className: "btn", disabled: busy === "examples", onClick: clearEx }, busy === "examples" ? "Clearing…" : "Clear examples now"))) : null,
    h("section", { className: "card" },
      h("div", { className: "card-head" }, h("h2", null, "Appearance")),
      h("div", { className: "card-body" }, h(Seg, { label: "Theme", value: p.theme, onChange: p.setTheme, options: [{ id: "light", label: "Light", icon: "sun" }, { id: "dark", label: "Dark", icon: "moon" }] }))));
}
