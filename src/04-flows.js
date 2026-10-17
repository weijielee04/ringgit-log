/* ================= typing a record in by hand ================= */
function ParkFields(p) {
  const park = p.park || blankPark("onsite"), set = p.onChange, pre = p.idPrefix;
  const mins = minsBetween(park.entry, park.exit) != null ? minsBetween(park.entry, park.exit) : park.mins;
  const rate = mins > 0 && p.amount > 0 ? Math.round((p.amount * 100) / (mins / 60)) : null;
  return h(Fragment, null,
    h("div", { className: "field wide" }, h("span", null, "Which parking"),
      h(Seg, { label: "Which parking", value: park.kind === "office" ? "office" : "onsite", onChange: v => set("kind", v), options: [{ id: "office", label: "Office", icon: "building" }, { id: "onsite", label: "On-site", icon: "pin" }] })),
    h(Field, { label: "Place" }, h("input", { id: pre + "-place", className: "input", type: "text", placeholder: "Building or car park", value: park.location || "", onChange: e => set("location", e.target.value) })),
    h(Field, { label: "Parking company" }, h("input", { id: pre + "-operator", className: "input", type: "text", placeholder: "Operator or council", value: park.operator || "", onChange: e => set("operator", e.target.value) })),
    h(Field, { label: "Time in" }, h("input", { id: pre + "-entry", className: "input", type: "time", value: park.entry || "", onChange: e => set("entry", e.target.value) })),
    h(Field, { label: "Time out" }, h("input", { id: pre + "-exit", className: "input", type: "time", value: park.exit || "", onChange: e => set("exit", e.target.value) })),
    mins > 0 ? h("p", { className: "note wide" }, "Parked for " + fmtMins(mins) + (rate != null ? ", which works out to " + fmtRM(rate) + " an hour." : ".")) : null);
}
function ManualForm(p) {
  const [d, setD] = useState({ date: p.date || todayStr(), time: "", amount: 0, cat: CAT[p.type] ? p.type : "other", sub: "other", merchant: "", note: "", park: blankPark(p.parkKind || "onsite") });
  const [err, setErr] = useState("");
  const set = (k, v) => setD(o => Object.assign({}, o, { [k]: v }));
  const setPark = (k, v) => setD(o => Object.assign({}, o, { park: Object.assign({}, o.park, { [k]: v }) }));
  function submit(e) {
    e.preventDefault();
    if (!isYMD(d.date)) { setErr("Pick a valid date."); return; }
    if (!(d.amount > 0)) { setErr("Enter the amount paid."); return; }
    const rec = { id: newId(), date: d.date, time: normTime(d.time), amount: Math.round(d.amount * 100) / 100, cat: d.cat, sub: d.cat === "travel" ? d.sub : "", merchant: d.merchant.trim() || (d.cat === "parking" && d.park.location.trim()) || CAT[d.cat].label, note: d.note.trim(), src: "manual", createdAt: new Date().toISOString() };
    if (d.cat === "parking") {
      const park = Object.assign({}, d.park, { location: d.park.location.trim(), operator: d.park.operator.trim(), entry: normTime(d.park.entry), exit: normTime(d.park.exit) });
      park.mins = minsBetween(park.entry, park.exit);
      rec.park = park;
    }
    setErr(""); p.onSave(rec);
  }
  return h("form", { onSubmit: submit, noValidate: true, style: { display: "contents" } },
    h("div", { className: "modal-body" },
      h("div", { className: "form-grid" },
        h(Field, { label: "Date" }, h("input", { id: "m-date", className: "input", type: "date", value: d.date, onChange: e => set("date", e.target.value) })),
        h(Field, { label: "Time (optional)" }, h("input", { id: "m-time", className: "input", type: "time", value: d.time, onChange: e => set("time", e.target.value) })),
        h(Field, { label: "Amount (RM)" }, h(AmountInput, { id: "m-amount", className: "input num", value: d.amount || "", label: "Amount in RM", onChange: v => set("amount", v) })),
        h(Field, { label: "Type" }, h("select", { id: "m-cat", className: "select", value: d.cat, onChange: e => set("cat", e.target.value) }, CATS.map(c => h("option", { key: c.id, value: c.id }, c.label)))),
        d.cat === "travel" ? h(Field, { label: "Kind of travel", className: "wide" }, h("select", { id: "m-sub", className: "select", value: d.sub, onChange: e => set("sub", e.target.value) }, Object.keys(SUBS).map(k => h("option", { key: k, value: k }, SUBS[k])))) : null,
        h(Field, { label: d.cat === "parking" ? "Description (optional)" : "Where or what", className: "wide" }, h("input", { id: "m-merchant", className: "input", type: "text", placeholder: d.cat === "food" ? "e.g. Nasi lemak, Restoran Ali" : "Merchant or short description", value: d.merchant, onChange: e => set("merchant", e.target.value) })),
        d.cat === "parking" ? h(ParkFields, { park: d.park, amount: d.amount, onChange: setPark, idPrefix: "m-park" }) : null,
        h(Field, { label: "Note (optional)", className: "wide" }, h("input", { id: "m-note", className: "input", type: "text", value: d.note, onChange: e => set("note", e.target.value) }))),
      err ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, err)) : null,
      p.error ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, p.error)) : null),
    h("div", { className: "modal-foot" },
      h("button", { type: "button", className: "btn ghost", disabled: !!p.busy, onClick: p.onBack }, "Back"),
      h("span", { className: "spacer" }),
      h("button", { type: "submit", className: "btn primary", disabled: !!p.busy }, h(Icon, { name: "check", size: 16 }), p.busy || "Save record")));
}

/* ================= checking what was read ================= */
const ReviewRow = React.memo(function ReviewRow(p) {
  const row = p.row, set = (k, v) => p.patch(row.key, { [k]: v });
  const setPark = (k, v) => p.patch(row.key, { park: Object.assign({}, row.park || blankPark("onsite"), { [k]: v }) });
  const tags = [];
  if (row.kind === "topup") tags.push(h("span", { key: "k", className: "tag" }, "Top-up or own transfer, not counted"));
  if (row.kind === "income") tags.push(h("span", { key: "k", className: "tag" }, "Money in, not counted"));
  if (row.kind === "refund") tags.push(h("span", { key: "k", className: "tag" }, "Refund, not counted"));
  if (row.dup) tags.push(h("span", { key: "d", className: "tag warn" }, h(Icon, { name: "alert", size: 12 }), "Looks already recorded"));
  if (!row.sure) tags.push(h("span", { key: "s", className: "tag warn" }, h(Icon, { name: "alert", size: 12 }), "Hard to read, please check"));
  if (!isYMD(row.date)) tags.push(h("span", { key: "x", className: "tag warn" }, "Needs a date"));
  if (!(row.amount > 0) && !(row.cat === "travel" && row.trip)) tags.push(h("span", { key: "a", className: "tag warn" }, "Needs an amount"));
  if (row.warn) tags.push(h("span", { key: "w", className: "tag warn" }, h(Icon, { name: "alert", size: 12 }), row.warn));
  if (row.upd) tags.push(row.same ? h("span", { key: "u", className: "tag" }, "Same as saved, no change") : h("span", { key: "u", className: "tag good" }, "Updates a saved record"));
  if (row.line) tags.unshift(h("span", { key: "l", className: "tag" }, "Row " + row.line));
  const k = row.key;
  const setTrip = (f, v) => p.patch(row.key, { trip: Object.assign({}, row.trip || {}, { [f]: v }) });
  return h("div", { className: cx("rv", !row.on && "is-off") },
    h("label", { className: "rv-chk" }, h("input", { id: k + "-on", type: "checkbox", checked: row.on, "aria-label": "Save " + row.merchant, onChange: e => set("on", e.target.checked) })),
    h("input", { id: k + "-date", className: "input rv-date", type: "date", value: row.date, "aria-label": "Date", onChange: e => set("date", e.target.value) }),
    h("input", { id: k + "-time", className: "input rv-time", type: "time", value: row.time, "aria-label": "Time", onChange: e => set("time", e.target.value) }),
    h("input", { id: k + "-mer", className: "input rv-mer", type: "text", value: row.merchant, "aria-label": "Description", onChange: e => set("merchant", e.target.value) }),
    h("select", { id: k + "-cat", className: "select rv-cat", value: row.cat, "aria-label": "Type", onChange: e => set("cat", e.target.value) }, CATS.map(c => h("option", { key: c.id, value: c.id }, c.label))),
    h(AmountInput, { id: k + "-amt", className: "input rv-amt num", value: row.amount, label: "Amount in RM", onChange: v => set("amount", v) }),
    row.cat === "parking" && row.park ? h("div", { className: "rv-extra" },
      h("select", { id: k + "-pk", className: "select", value: row.park.kind === "office" ? "office" : "onsite", "aria-label": "Which parking", onChange: e => setPark("kind", e.target.value) }, h("option", { value: "office" }, "Office"), h("option", { value: "onsite" }, "On-site")),
      h("input", { id: k + "-pl", className: "input", type: "text", placeholder: "Place", value: row.park.location || "", "aria-label": "Parking place", onChange: e => setPark("location", e.target.value) }),
      h("input", { id: k + "-po", className: "input rv-op", type: "text", placeholder: "Parking company", value: row.park.operator || "", "aria-label": "Parking company", onChange: e => setPark("operator", e.target.value) }),
      h("span", { className: "unit-wrap pre" }, h("span", { className: "unit", "aria-hidden": "true" }, "In"), h("input", { id: k + "-pi", className: "input", type: "time", value: row.park.entry || "", "aria-label": "Time in", title: "Time in", onChange: e => setPark("entry", e.target.value) })),
      h("span", { className: "unit-wrap pre" }, h("span", { className: "unit", "aria-hidden": "true" }, "Out"), h("input", { id: k + "-px", className: "input", type: "time", value: row.park.exit || "", "aria-label": "Time out", title: "Time out", onChange: e => setPark("exit", e.target.value) }))) : null,
    row.cat === "travel" && row.trip ? h("div", { className: "rv-extra" },
      h("input", { id: k + "-tf", className: "input", type: "text", placeholder: "From", value: row.trip.from || "", "aria-label": "Trip from", onChange: e => setTrip("from", e.target.value) }),
      h("input", { id: k + "-tt", className: "input", type: "text", placeholder: "To", value: row.trip.to || "", "aria-label": "Trip to", onChange: e => setTrip("to", e.target.value) }),
      h("span", { className: "unit-wrap" }, h(NumInput, { id: k + "-tk", value: row.trip.km, digits: 1, blankZero: true, placeholder: "Distance", label: "Distance in km", onChange: v => setTrip("km", v) }), h("span", { className: "unit", "aria-hidden": "true" }, "km")),
      h("span", { className: "unit-wrap" }, h(NumInput, { id: k + "-tm", value: row.trip.mins, digits: 0, blankZero: true, placeholder: "Time", label: "Travel time in minutes", onChange: v => setTrip("mins", v) }), h("span", { className: "unit", "aria-hidden": "true" }, "min")),
      h("label", { className: "check" }, h("input", { id: k + "-tr", type: "checkbox", checked: !!row.trip.round, onChange: e => setTrip("round", e.target.checked) }), "Round trip")) : null,
    row.cat === "travel" && !row.trip ? h("div", { className: "rv-extra one" },
      h("select", { id: k + "-sub", className: "select", value: row.sub || "other", "aria-label": "Kind of travel", onChange: e => set("sub", e.target.value) }, Object.keys(SUBS).map(s => h("option", { key: s, value: s }, SUBS[s])))) : null,
    tags.length ? h("div", { className: "rv-tags" }, tags) : null);
});

/* ================= the add-expense flow ================= */
function Wizard(p) {
  const A = p.A, preset = p.preset || {};
  useBus();
  const [step, setStep] = useState(preset.step || "type");
  const [type, setType] = useState(preset.type || "");
  const [parkKind, setParkKind] = useState(preset.parkKind || "");
  const [via, setVia] = useState("upload");
  const [files, setFiles] = useState([]);
  const [over, setOver] = useState(false);
  const [stage, setStage] = useState("");
  const [found, setFound] = useState(0);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ source: "", period: "", problems: [] });
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState("");
  const [pw, setPw] = useState({});
  const [needPw, setNeedPw] = useState(null);
  const [pwText, setPwText] = useState("");
  const ctl = useRef(null), inputRef = useRef(null), kindRef = useRef(parkKind), keptRef = useRef({});
  kindRef.current = type === "parking" ? parkKind : "";
  const aiOn = ai.ready(), aiWait = ai.loading();

  const thumbs = useMemo(() => files.map(f => (isPdfFile(f) ? "" : URL.createObjectURL(f))), [files]);
  useEffect(() => () => { thumbs.forEach(u => { if (u) URL.revokeObjectURL(u); }); }, [thumbs]);
  useEffect(() => () => { if (ctl.current) ctl.current.abort(); }, []);

  const addFiles = list => {
    const ok = [], bad = [];
    Array.from(list || []).forEach(f => {
      const pic = /^image\//.test(f.type || "") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name || "");
      if (!isPdfFile(f) && !pic) bad.push((f.name || "That file") + " isn't a picture or a PDF");
      else if (f.size > 20 * 1048576) bad.push((f.name || "That file") + " is over 20 MB");
      else ok.push(f);
    });
    if (ok.length) { setFiles(files.concat(ok).slice(0, 12)); setPw({}); setNeedPw(null); keptRef.current = {}; }
    setErr(bad.length ? bad.join(". ") + "." : "");
  };
  useEffect(() => {
    if (step !== "source") return;
    const onPaste = e => { const fs = e.clipboardData && e.clipboardData.files; if (fs && fs.length) { e.preventDefault(); addFiles(fs); } };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [step, files]);

  async function read(fresh, pwMap) {
    setErr(""); setNeedPw(null); setStep("reading"); setFound(0); setStage("Getting ready…");
    const c = new AbortController(); ctl.current = c;
    try {
      const out = await extractAll(files, { type: type, parkKind: kindRef.current, places: store.officePlaces(), fallbackDate: preset.date }, {
        signal: c.signal, fresh: !!fresh, passwords: pwMap || pw,
        onStage: s => { if (!c.signal.aborted) setStage(s); }, onFound: n => { if (!c.signal.aborted) setFound(n); }
      });
      if (c.signal.aborted) return;
      setStage("Checking against what you've already recorded…");
      await store.whenLoaded(Array.from(new Set(out.rows.map(r => ymOf(r.date)))).slice(0, 14), 4000);
      if (c.signal.aborted) return;
      markDuplicates(out.rows);
      setRows(out.rows); setMeta(out); setStep("review");
    } catch (e) {
      if (c.signal.aborted || (e && e.code === "cancelled")) return;
      if (e && (e.code === "pdf_password" || e.code === "pdf_wrong_password")) { setNeedPw({ index: e.file, wrong: e.code === "pdf_wrong_password" }); setPwText(""); setStep("source"); return; }
      setErr(ai.ready() ? readErrorText(e) : ""); setStep("source");
    }
  }
  const stop = () => { if (ctl.current) ctl.current.abort(); setStep("source"); };
  const unlock = () => { if (!needPw || !pwText) return; const map = Object.assign({}, pw, { [needPw.index]: pwText }); setPw(map); read(false, map); };

  const patchRow = useCallback((key, patch) => {
    setRows(list => list.map(r => {
      if (r.key !== key) return r;
      const n = Object.assign({}, r, patch);
      if (patch.cat) {
        if (n.cat === "parking" && !n.park) n.park = blankPark(kindRef.current || guessParkKind(n.merchant, store.officePlaces()));
        if (n.cat === "travel" && !n.sub) n.sub = "other";
      }
      return n;
    }));
  }, []);

  const chosen = rows.filter(r => r.on && r.amount > 0 && isYMD(r.date));
  const anyOn = rows.some(r => r.on);
  const tickAll = () => setRows(list => list.map(r => Object.assign({}, r, { on: anyOn ? false : r.kind === "expense" })));
  const chosenTotal = Math.round(chosen.reduce((s, r) => s + r.amount * 100, 0));
  const hasPhotos = files.some(f => !isPdfFile(f)) || meta.source === "receipt";

  async function finish(recs) {
    const res = await A.saveNew(recs, (d, t) => setBusy("Saving " + d + " of " + t + "…"));
    const offices = res.saved.filter(r => r.park && r.park.kind === "office" && r.park.location && r.park.location.length >= 3).map(r => r.park.location);
    if (offices.length) {
      const cur = store.officePlaces();
      const add = Array.from(new Set(offices)).filter(x => !cur.some(y => y.toLowerCase() === x.toLowerCase()));
      if (add.length) store.saveSettings({ officePlaces: cur.concat(add).slice(-20) });
    }
    p.onClose();
  }
  async function save() {
    if (!chosen.length || busy) return;
    setBusy("Saving…"); setErr("");
    try {
      const kept = keep ? keptRef.current : {};
      if (keep && caps.assets) {
        const used = Array.from(new Set(chosen.map(r => r.file)));
        for (let i = 0; i < used.length; i++) {
          const f = used[i], file = files[f];
          if (!file || kept[f]) continue;
          const pdf = isPdfFile(file);
          if (pdf && meta.source !== "receipt") continue;           /* statements are read, not kept */
          try {
            setBusy("Keeping " + file.name + "…");
            const up = pdf ? await caps.assets.upload(file, { type: "application/pdf" }) : await caps.assets.upload(await archiveCopy(file));
            kept[f] = { id: up.id, pdf: pdf };
          } catch (e) { /* the record is still saved without its photo */ }
        }
      }
      const share = {}; chosen.forEach(r => { if (kept[r.file]) share[r.file] = (share[r.file] || 0) + 1; });
      const batch = newId(), now = new Date().toISOString();
      const recs = chosen.map(r => {
        const o = { id: newId(), date: r.date, time: normTime(r.time), amount: Math.round(r.amount * 100) / 100, cat: r.cat, sub: r.cat === "travel" ? (SUBS[r.sub] ? r.sub : "other") : "", merchant: r.merchant.trim() || CAT[r.cat].label, note: "", src: SOURCES[meta.source] ? meta.source : "other", batch: batch, createdAt: now };
        if (r.cat === "parking") {
          const pk = Object.assign(blankPark("onsite"), r.park || {});
          pk.location = String(pk.location || "").trim(); pk.operator = String(pk.operator || "").trim(); pk.entry = normTime(pk.entry); pk.exit = normTime(pk.exit);
          const m = minsBetween(pk.entry, pk.exit); if (m != null) pk.mins = m;
          o.park = pk;
        }
        if (kept[r.file]) { o.img = kept[r.file].id; o.imgN = share[r.file]; if (kept[r.file].pdf) o.imgPdf = true; }
        return o;
      });
      await finish(recs);
    } catch (e) { setBusy(""); setErr(saveErrorText(e)); }
  }
  async function saveManual(rec) {
    setBusy("Saving…"); setErr("");
    try { await finish([rec]); } catch (e) { setBusy(""); setErr(saveErrorText(e)); }
  }

  const stepNo = step === "type" ? 1 : step === "review" ? 3 : 2;
  const head = h("div", { className: "steps", "aria-label": "Step " + stepNo + " of 3" },
    [["Type", 1], [step === "manual" ? "Details" : "Receipt", 2], ["Check", 3]].map(s => (step === "manual" && s[1] === 3 ? null : h("span", { key: s[1], className: stepNo === s[1] ? "is-on" : "" }, h("em", null, s[1]), h("i", null, s[0])))));
  const typeName = type === "mixed" ? "Mixed statement" : type === "parking" ? "Parking · " + (PARK_KINDS[parkKind] || "") : type ? CAT[type].label : "";
  const typeOk = !!type && (type !== "parking" || !!parkKind);
  let body = null, foot = null;

  if (step === "type") {
    body = h("div", { className: "modal-body" },
      h("div", { className: "q" }, "What kind of expense is this?"),
      h("div", { className: "tiles", role: "group", "aria-label": "Expense type" },
        CATS.map(c => h("button", { key: c.id, type: "button", className: cx("tile", type === c.id && "is-on"), "aria-pressed": type === c.id, onClick: () => setType(c.id) },
          h("span", { className: "tile-ico", style: { "--c": catColor(c.id) } }, h(Icon, { name: c.icon })),
          h("span", { className: "tile-text" }, h("span", { className: "tile-name" }, c.label), h("span", { className: "tile-hint" }, c.hint)))),
        h("button", { type: "button", className: cx("tile wide", type === "mixed" && "is-on"), "aria-pressed": type === "mixed", onClick: () => setType("mixed") },
          h("span", { className: "tile-ico" }, h(Icon, { name: "layers" })),
          h("span", { className: "tile-text" }, h("span", { className: "tile-name" }, "Mixed statement"), h("span", { className: "tile-hint" }, "A TnG eWallet history or CIMB statement with different kinds of spending. Each line is sorted for you.")))),
      type === "parking" ? h(Fragment, null,
        h("div", { className: "q" }, "Which parking?"),
        h(Seg, { label: "Which parking", value: parkKind, onChange: setParkKind, options: [{ id: "office", label: "Office parking", icon: "building" }, { id: "onsite", label: "On-site parking", icon: "pin" }] })) : null,
      type === "travel" ? h(Fragment, null,
        h("div", { className: "q" }, "How do you want to add it?"),
        h("div", { className: "opts", role: "group", "aria-label": "How to add travel" },
          [["upload", "receipt", "Receipt or TnG history", "A photo, screenshot or PDF of toll, fuel or a ride"], ["route", "route", "Plan a route", "Enter start and destination to get distance, time and toll"], ["shot", "image", "Route screenshot", "From Waze or Google Maps"]].map(o =>
            h("button", { key: o[0], type: "button", className: cx("tile", via === o[0] && "is-on"), "aria-pressed": via === o[0], onClick: () => setVia(o[0]) },
              h("span", { className: "tile-ico" }, h(Icon, { name: o[1] })),
              h("span", { className: "tile-text" }, h("span", { className: "tile-name" }, o[2]), h("span", { className: "tile-hint" }, o[3])))))) : null,
      h("p", { className: "note" }, "Have a month of expenses in a spreadsheet? ", h("button", { type: "button", className: "linkish", onClick: () => { p.onClose(); A.openImport(); } }, "Import from Excel"), " instead."));
    foot = h("div", { className: "modal-foot" },
      h("button", { type: "button", className: "btn ghost", onClick: p.onClose }, "Cancel"),
      h("button", { type: "button", className: "btn primary", disabled: !typeOk, onClick: () => { if (type === "travel" && via !== "upload") { p.onClose(); A.planTrip(via); } else setStep("source"); } }, "Continue"));
  } else if (step === "source") {
    body = h("div", { className: "modal-body" },
      h("div", { className: "toolbar" }, h("span", { className: "tag" }, typeName), h("button", { type: "button", className: "linkish", onClick: () => setStep("type") }, "Change type")),
      !aiOn && !aiWait ? h("div", { className: "banner warn" }, h(Icon, { name: "info", size: 16 }), h("span", { className: "grow" }, aiOffText()))
        : h("div", { className: cx("drop", over && "is-over"),
            onDragOver: e => { e.preventDefault(); setOver(true); }, onDragLeave: () => setOver(false),
            onDrop: e => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer && e.dataTransfer.files); } },
            h("span", { className: "empty-ico" }, h(Icon, { name: "upload", size: 22 })),
            h("p", null, h("strong", null, "Add the receipt, screenshot or statement."), " Drop files here, paste a screenshot, or choose from your device. Photos and PDFs both work."),
            h("input", { id: "wiz-files", ref: inputRef, type: "file", accept: "image/*,application/pdf,.pdf", multiple: true, hidden: true, onChange: e => { addFiles(e.target.files); e.target.value = ""; } }),
            h("button", { type: "button", className: "btn", onClick: () => inputRef.current && inputRef.current.click() }, h(Icon, { name: "image", size: 16 }), files.length ? "Add more files" : "Choose files")),
      files.length ? h("div", { className: "files" }, files.map((f, i) => h("div", { key: i + f.name, className: "file" },
        h("span", { className: "file-thumb" }, thumbs[i] ? h("img", { src: thumbs[i], alt: "" }) : h(Icon, { name: "file" })),
        h("span", { className: "file-name" }, f.name || "Pasted picture", h("small", null, (isPdfFile(f) ? "PDF" : "Picture") + " · " + fmtBytes(f.size))),
        h("button", { type: "button", className: "icon-btn", "aria-label": "Remove " + (f.name || "file"), onClick: () => { setFiles(files.filter((x, j) => j !== i)); setPw({}); setNeedPw(null); keptRef.current = {}; } }, h(Icon, { name: "x", size: 16 }))))) : null,
      needPw && files[needPw.index] ? h("div", { className: "banner" }, h(Icon, { name: "lock", size: 16 }),
        h("span", { className: "grow" }, h("strong", null, files[needPw.index].name + " is locked."), needPw.wrong ? " That password didn't work. Try again." : " Enter its password to open it. The password stays in this browser and is not saved."),
        h("input", { id: "wiz-pw", className: "input", style: { maxWidth: "200px" }, type: "password", autoComplete: "off", placeholder: "PDF password", value: pwText, onChange: e => setPwText(e.target.value), onKeyDown: e => { if (e.key === "Enter") unlock(); } }),
        h("button", { type: "button", className: "btn sm", disabled: !pwText, onClick: unlock }, "Unlock and read")) : null,
      err ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, err)) : null);
    foot = h("div", { className: "modal-foot" },
      h("button", { type: "button", className: "btn ghost", onClick: () => setStep("type") }, "Back"),
      h("span", { className: "spacer" }),
      h("button", { type: "button", className: aiOn || aiWait ? "btn ghost" : "btn primary", onClick: () => { setErr(""); setStep("manual"); } }, h(Icon, { name: "keyboard", size: 16 }), "Type it in instead"),
      aiOn || aiWait ? h("button", { type: "button", className: "btn primary", disabled: !files.length || !aiOn, onClick: () => read(false) }, h(Icon, { name: "spark", size: 16 }), !aiOn ? "Connecting…" : files.length > 1 ? "Read " + files.length + " files" : "Read file") : null);
  } else if (step === "reading") {
    body = h("div", { className: "modal-body" }, h("div", { className: "reading", role: "status", "aria-live": "polite" },
      h("div", { className: "spinner" }), h("p", null, h("strong", null, stage)),
      h("p", { className: "note" }, found > 0 ? found + (found === 1 ? " transaction" : " transactions") + " found so far" : "Reading usually takes 10 to 40 seconds for each picture or page."),
      h("button", { type: "button", className: "btn sm", onClick: stop }, "Stop")));
  } else if (step === "review") {
    const skipped = rows.filter(r => r.kind !== "expense").length, dups = rows.filter(r => r.dup).length;
    body = h("div", { className: "modal-body" },
      h("div", { className: "slip" },
        h("div", { className: "slip-head" }, h("span", null, h("b", null, rows.length + (rows.length === 1 ? " transaction" : " transactions")), " read" + (SOURCES[meta.source] && meta.source !== "other" ? " from " + (meta.source === "receipt" ? "a receipt" : meta.source === "bank" ? "a bank statement" : SOURCES[meta.source]) : "")),
          meta.period ? h("span", { className: "num" }, meta.period.replace("..", " to ")) : null,
          h("span", { className: "spacer" }),
          rows.length > 1 ? h("button", { type: "button", className: "linkish", onClick: tickAll }, anyOn ? "Untick all" : "Tick all expenses") : null,
          h("span", { className: "tag" }, typeName)),
        rows.map(r => h(ReviewRow, { key: r.key, row: r, patch: patchRow }))),
      meta.problems && meta.problems.length ? h("div", { className: "banner warn" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, meta.problems.join(" "))) : null,
      h("p", { className: "note" }, "Check each line against your document and fix anything that was read wrongly. Only ticked lines are saved." + (skipped ? " " + skipped + (skipped === 1 ? " line is" : " lines are") + " money in or a top-up, so " + (skipped === 1 ? "it is" : "they are") + " left unticked." : "") + (dups ? " " + dups + (dups === 1 ? " line matches" : " lines match") + " a record you already have." : "")),
      caps.assets && hasPhotos ? h("label", { className: "check" }, h("input", { id: "wiz-keep", type: "checkbox", checked: keep, onChange: e => setKeep(e.target.checked) }), "Keep the " + (files.length > 1 ? "pictures" : "picture") + " with these records") : null,
      err ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, err)) : null);
    foot = h("div", { className: "modal-foot" },
      h("button", { type: "button", className: "btn ghost", disabled: !!busy, onClick: () => setStep("source") }, "Back"),
      h("button", { type: "button", className: "btn ghost hide-narrow", disabled: !!busy, onClick: () => read(true) }, "Read again"),
      h("span", { className: "spacer" }),
      h("button", { type: "button", className: "btn primary", disabled: !chosen.length || !!busy, onClick: save }, h(Icon, { name: "check", size: 16 }), busy || (chosen.length ? "Save " + chosen.length + (chosen.length === 1 ? " record" : " records") + " · " + fmtRM(chosenTotal) : "Nothing ticked")));
  } else if (step === "manual") {
    return h(Modal, { title: "Add expense", head: head, onClose: p.onClose, locked: !!busy },
      h(ManualForm, { type: type, parkKind: kindRef.current, date: preset.date, busy: busy, error: err, onBack: () => { setErr(""); setStep("source"); }, onSave: saveManual }));
  }
  return h(Modal, { title: "Add expense", head: head, onClose: p.onClose, locked: !!busy || step === "reading" }, body, foot);
}

/* ================= viewing and editing one record, with its receipts ================= */
const UPLOAD_CODES = { too_large: 1, unsupported_type: 1, quota_or_state: 1, rate_limited: 1, upstream_auth: 1, image_unreadable: 1, invalid_request: 1, store_unavailable: 1, upstream_error: 1, capability_disabled: 1 };
function uploadErrorText(e) {
  switch (e && e.code) {
    case "too_large": return "That file is too large to keep. Pictures and PDFs up to 20 MB can be attached.";
    case "unsupported_type": return "That kind of file can't be attached. Use a photo, a screenshot or a PDF.";
    case "quota_or_state": return "There's no room left for more files. Remove some old receipts and try again.";
    case "rate_limited": return "Too many files at once. Wait a moment and try again.";
    case "upstream_auth": return "Your sign-in needs refreshing. Reload the page and try again.";
    case "image_unreadable": return "That picture couldn't be opened in this browser. Try a screenshot or a JPG or PNG copy.";
    default: return "The file couldn't be attached. Check your connection and try again.";
  }
}
function listJoin(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
const BASIS = { screenshot: "Read from a navigation screenshot", manual: "Entered by hand", sheet: "Imported from a spreadsheet", estimate: "Estimated, not from live map data" };
function RecordModal(p) {
  const rec = p.rec;
  const [d, setD] = useState(() => { const c = clone(rec); if (c.cat === "parking" && !c.park) c.park = blankPark("onsite"); return c; });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [staged, setStaged] = useState([]);
  const [dropped, setDropped] = useState([]);
  const [broken, setBroken] = useState({});
  const [preview, setPreview] = useState("");
  const [fill, setFill] = useState(null);
  const fileRef = useRef(null), fillCtl = useRef(null), alive = useRef(true), urls = useRef([]);
  useEffect(() => () => { alive.current = false; urls.current.forEach(u => URL.revokeObjectURL(u)); if (fillCtl.current) fillCtl.current.abort(); }, []);
  const set = (k, v) => setD(o => { const n = Object.assign({}, o, { [k]: v }); if (k === "cat" && v === "parking" && !n.park) n.park = blankPark("onsite"); return n; });
  const setPark = (k, v) => setD(o => Object.assign({}, o, { park: Object.assign({}, o.park || blankPark("onsite"), { [k]: v }) }));
  const setTrip = (k, v) => setD(o => Object.assign({}, o, { trip: Object.assign({}, o.trip || {}, { [k]: v }) }));

  const addFiles = list => {
    const ok = [], bad = [];
    Array.from(list || []).forEach(f => {
      const pdf = isPdfFile(f), pic = /^image\//.test(f.type || "") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name || "");
      if (!pdf && !pic) bad.push((f.name || "That file") + " isn't a picture or a PDF");
      else if (f.size > 20 * 1048576) bad.push((f.name || "That file") + " is over 20 MB");
      else { const url = pdf ? "" : URL.createObjectURL(f); if (url) urls.current.push(url); ok.push({ key: newId(), file: f, pdf: pdf, url: url, up: null }); }
    });
    if (ok.length) setStaged(s => s.concat(ok).slice(0, 8));
    setErr(bad.length ? bad.join(". ") + "." : "");
  };
  useEffect(() => {
    const onPaste = e => { const fs = e.clipboardData && e.clipboardData.files; if (fs && fs.length && caps.assets) { e.preventDefault(); addFiles(fs); } };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function fillFrom(s) {
    if (fillCtl.current) fillCtl.current.abort();
    const c = new AbortController(); fillCtl.current = c;
    const cur = d;
    setFill({ key: s.key, busy: true });
    try {
      const next = clone(cur), changed = [];
      let shown = null, shownDate = "";
      if (cur.cat === "travel" && cur.trip && !s.pdf) {
        if (!ai.canImages()) throw { code: "images_unavailable" };
        const src = await decodeImage(s.file);
        const tiles = await tilesFrom(src, Math.max(1, Math.min(3, ai.maxImages())));
        const reply = await ai.json({ task: "shot", count: tiles.length }, { images: tiles, signal: c.signal });
        const route = (reply && Array.isArray(reply.routes) ? reply.routes : []).map(normRoute).filter(Boolean)[0];
        if (!route) throw { code: "nothing_found" };
        const k = cur.trip.round ? 2 : 1;
        next.trip = Object.assign({}, cur.trip);
        if (!(Number(cur.trip.km) > 0) && route.km > 0) { next.trip.km = Math.round(route.km * k * 10) / 10; changed.push("distance"); }
        if (!(Number(cur.trip.mins) > 0) && route.mins > 0) { next.trip.mins = route.mins * k; changed.push("travel time"); }
        if (!cur.trip.from && reply.from) { next.trip.from = String(reply.from).slice(0, 90); changed.push("start"); }
        if (!cur.trip.to && reply.to) { next.trip.to = String(reply.to).slice(0, 90); changed.push("destination"); }
        if (!next.trip.route && route.name) next.trip.route = route.name;
        if (changed.indexOf("distance") >= 0 || changed.indexOf("travel time") >= 0) next.trip.basis = "screenshot";
        if (route.tollNote === "shown") shown = Math.round(route.toll * k * 100) / 100;
      } else {
        const out = await extractAll([s.file], { type: CAT[cur.cat] ? cur.cat : "mixed", parkKind: cur.cat === "parking" && cur.park ? cur.park.kind : "", places: store.officePlaces(), fallbackDate: cur.date },
          { signal: c.signal, fresh: false, passwords: {}, onStage: () => {}, onFound: () => {} });
        const want = Math.round((Number(cur.amount) || 0) * 100);
        const score = r => (r.date === cur.date ? 0 : 1e9) + Math.abs(Math.round(r.amount * 100) - want);
        const spends = out.rows.filter(r => r.kind === "expense");
        const row = (spends.length ? spends : out.rows).slice().sort((a, b) => score(a) - score(b))[0];
        if (!cur.time && row.time) { next.time = row.time; changed.push("time"); }
        if ((!cur.merchant || cur.merchant === (CAT[cur.cat] || CAT.other).label) && row.merchant) { next.merchant = row.merchant; changed.push("description"); }
        if (cur.cat === "parking" && row.park) {
          const pk = Object.assign(blankPark("onsite"), cur.park || {});
          [["location", "place"], ["operator", "parking company"], ["entry", "time in"], ["exit", "time out"]].forEach(f => { if (!pk[f[0]] && row.park[f[0]]) { pk[f[0]] = row.park[f[0]]; changed.push(f[1]); } });
          next.park = pk;
        }
        if (want <= 0 && row.amount > 0) { next.amount = row.amount; changed.push("amount"); } else shown = row.amount;
        if (row.sure && row.date && row.date !== cur.date) shownDate = row.date;
      }
      if (!alive.current || c.signal.aborted) return;
      setD(next);
      const diff = shown != null && Math.round(shown * 100) !== Math.round((Number(next.amount) || 0) * 100) ? shown : null;
      setFill({ key: s.key, text: changed.length ? "Filled in the " + listJoin(changed) + " from the picture. Check them, then save." : "Nothing was missing, so nothing was changed.", amount: diff, date: shownDate });
    } catch (e) {
      if (!alive.current || (e && e.code === "cancelled")) return;
      const code = e && e.code;
      setFill({ key: s.key, error: code === "nothing_found" ? "Nothing readable was found in that picture." : code === "pdf_password" || code === "pdf_wrong_password" ? "That PDF is locked, so it can't be read. It can still be attached." : readErrorText(e) });
    }
  }

  async function save() {
    if (!isYMD(d.date)) { setErr("Pick a valid date."); return; }
    setErr("");
    let phase = "upload";
    try {
      const added = [];
      for (let i = 0; i < staged.length; i++) {
        const s = staged[i];
        if (!s.up) {
          setBusy("Attaching " + (s.file.name || "file") + "…");
          const blob = s.pdf ? s.file : await archiveCopy(s.file);
          s.up = await caps.assets.upload(blob, s.pdf ? { type: "application/pdf" } : undefined);
        }
        added.push({ id: s.up.id, pdf: s.pdf, name: String(s.file.name || (s.pdf ? "Receipt.pdf" : "Receipt.jpg")).slice(0, 80), at: new Date().toISOString() });
      }
      phase = "save"; setBusy("save");
      const out = clone(d);
      out.time = normTime(out.time); out.amount = Math.round((Number(out.amount) || 0) * 100) / 100;
      out.merchant = String(out.merchant || "").trim() || (CAT[out.cat] || CAT.other).label; out.note = String(out.note || "").trim();
      if (out.cat === "parking") {
        out.park = Object.assign(blankPark("onsite"), out.park || {});
        out.park.entry = normTime(out.park.entry); out.park.exit = normTime(out.park.exit);
        const m = minsBetween(out.park.entry, out.park.exit); if (m != null) out.park.mins = m;
      } else delete out.park;
      if (out.cat === "travel" && out.trip) {
        out.trip = Object.assign({}, out.trip, { from: String(out.trip.from || "").trim(), to: String(out.trip.to || "").trim(), km: Math.round((Number(out.trip.km) || 0) * 10) / 10, mins: Math.round(Number(out.trip.mins) || 0), round: !!out.trip.round });
        out.sub = "toll";
      } else { delete out.trip; out.sub = out.cat === "travel" ? (SUBS[out.sub] ? out.sub : "other") : ""; }
      out.att = (Array.isArray(rec.att) ? rec.att : []).filter(a => dropped.indexOf(a.id) < 0).concat(added);
      if (!out.att.length) delete out.att;
      let freeLegacy = "";
      if (rec.img && dropped.indexOf("legacy") >= 0) { if (rec.imgN === 1) freeLegacy = rec.img; delete out.img; delete out.imgN; delete out.imgPdf; }
      await store.update(rec, out);
      if (caps.assets) {
        dropped.filter(x => x !== "legacy").forEach(id => { caps.assets.delete(id).catch(() => {}); });
        if (freeLegacy) caps.assets.delete(freeLegacy).catch(() => {});
      }
      toasts.push(added.length ? (added.length === 1 ? "Receipt attached." : added.length + " files attached.") : "Changes saved.");
      p.onClose();
    } catch (e) {
      if (!alive.current) return;
      setBusy(""); setErr(phase === "upload" ? uploadErrorText(e) : saveErrorText(e));
    }
  }
  async function del() {
    setBusy("del"); setErr("");
    try {
      await store.remove(rec);
      if (caps.assets) {
        (Array.isArray(rec.att) ? rec.att : []).forEach(a => { caps.assets.delete(a.id).catch(() => {}); });
        if (rec.img && rec.imgN === 1) caps.assets.delete(rec.img).catch(() => {});
      }
      toasts.push("Record deleted."); p.onClose();
    } catch (e) { setErr(saveErrorText(e)); setBusy(""); setConfirm(false); }
  }

  const keptLegacy = !!rec.img && dropped.indexOf("legacy") < 0;
  const keptAtt = (Array.isArray(rec.att) ? rec.att : []).filter(a => dropped.indexOf(a.id) < 0);
  const nFiles = (keptLegacy ? 1 : 0) + keptAtt.length + staged.length;
  const needs = wantsEvidence(d) && !rec.example;
  const nKept = (rec.img ? 1 : 0) + (Array.isArray(rec.att) ? rec.att.length : 0);
  const savedItem = (key, id, pdf, name, note) => h("div", { key: key, className: "ev" },
    pdf ? h("span", { className: "ev-thumb" }, h(Icon, { name: "file", size: 20 }))
      : h("button", { type: "button", className: "ev-thumb", "aria-label": "Show " + name, onClick: () => setPreview(preview === id ? "" : id) },
          broken[id] ? h(Icon, { name: "image", size: 20 }) : h(FileImg, { id: id, lazy: true, onError: () => setBroken(b => Object.assign({}, b, { [id]: true })) })),
    h("span", { className: "ev-text" }, h("b", null, name), h("small", null, broken[id] ? "This file is no longer available." : note)),
    h("span", { className: "ev-actions" },
      pdf ? h(FileLink, { id: id, className: "btn sm ghost" }, "Open") : h("button", { type: "button", className: "btn sm ghost", onClick: () => setPreview(preview === id ? "" : id) }, preview === id ? "Hide" : "View"),
      h("button", { type: "button", className: "icon-btn", "aria-label": "Remove " + name, disabled: !!busy, onClick: () => { setDropped(x => x.concat(key)); if (preview === id) setPreview(""); } }, h(Icon, { name: "trash", size: 16 }))));
  const t = d.cat === "travel" ? d.trip : null;
  const details = t && ((t.roads || []).length || (t.tolls || []).length || t.route || t.basis);

  return h(Modal, { title: "Record", narrow: true, onClose: p.onClose, locked: !!busy,
    head: h(Fragment, null, rec.example ? h("span", { className: "tag ex" }, "Example") : null, SOURCES[rec.src] ? h("span", { className: "tag" }, SOURCES[rec.src]) : null) },
    h("div", { className: "modal-body" },
      h("div", { className: "form-grid" },
        h(Field, { label: "Date" }, h("input", { id: "e-date", className: "input", type: "date", value: d.date, onChange: e => set("date", e.target.value) })),
        h(Field, { label: "Time" }, h("input", { id: "e-time", className: "input", type: "time", value: d.time || "", onChange: e => set("time", e.target.value) })),
        h(Field, { label: "Amount (RM)" }, h(AmountInput, { id: "e-amount", className: "input num", value: d.amount, label: "Amount in RM", onChange: v => set("amount", v) })),
        h(Field, { label: "Type" }, h("select", { id: "e-cat", className: "select", value: CAT[d.cat] ? d.cat : "other", onChange: e => set("cat", e.target.value) }, CATS.map(c => h("option", { key: c.id, value: c.id }, c.label)))),
        d.cat === "travel" && !d.trip ? h(Field, { label: "Kind of travel", className: "wide" }, h("select", { id: "e-sub", className: "select", value: SUBS[d.sub] ? d.sub : "other", onChange: e => set("sub", e.target.value) }, Object.keys(SUBS).map(k => h("option", { key: k, value: k }, SUBS[k])))) : null,
        h(Field, { label: "Description", className: "wide" }, h("input", { id: "e-merchant", className: "input", type: "text", value: d.merchant || "", onChange: e => set("merchant", e.target.value) })),
        d.cat === "parking" ? h(ParkFields, { park: d.park, amount: Number(d.amount) || 0, onChange: setPark, idPrefix: "e-park" }) : null,
        t ? h(Fragment, null,
          h(Field, { label: "From" }, h("input", { id: "e-from", className: "input", type: "text", value: t.from || "", onChange: e => setTrip("from", e.target.value) })),
          h(Field, { label: "To" }, h("input", { id: "e-to", className: "input", type: "text", value: t.to || "", onChange: e => setTrip("to", e.target.value) })),
          h(Field, { label: "Distance (km)" }, h(NumInput, { id: "e-km", value: t.km, digits: 1, blankZero: true, label: "Distance in km", onChange: v => setTrip("km", v) })),
          h(Field, { label: "Travel time (min)" }, h(NumInput, { id: "e-mins", value: t.mins, digits: 0, blankZero: true, label: "Travel time in minutes", onChange: v => setTrip("mins", v) })),
          h("label", { className: "check wide" }, h("input", { id: "e-round", type: "checkbox", checked: !!t.round, onChange: e => setTrip("round", e.target.checked) }), "Round trip (distance and time are for both ways)")) : null,
        h(Field, { label: "Note", className: "wide" }, h("input", { id: "e-note", className: "input", type: "text", value: d.note || "", onChange: e => set("note", e.target.value) }))),
      details ? h("div", { className: "slip", style: { padding: "12px 14px" } },
        h("dl", { className: "kv" },
          t.route || (t.roads || []).length ? h(Fragment, null, h("dt", null, "Route"), h("dd", null, t.route || "", (t.roads || []).length ? h("span", null, " ", t.roads.map((x, i) => h("span", { key: i, className: "hw", style: { marginRight: "4px" } }, x))) : null)) : null,
          (t.tolls || []).length ? h(Fragment, null, h("dt", null, "Toll plazas"), h("dd", null, h("span", { className: "plazas" }, t.tolls.map((x, i) => h("span", { key: i, className: "plaza" }, x.plaza, h("b", null, Number(x.rm || 0).toFixed(2))))))) : null,
          h("dt", null, "Worked out"), h("dd", null, BASIS[t.basis] || BASIS.estimate))) : null,
      h("div", { className: "ev-box" },
        h("div", { className: "ev-head" },
          h("strong", null, "Receipts and screenshots"),
          nFiles ? h("span", { className: "card-sub" }, nFiles + (nFiles === 1 ? " file" : " files")) : needs ? h("span", { className: "tag warn" }, "No receipt yet") : null,
          h("span", { className: "spacer" }),
          caps.assets ? h("button", { type: "button", className: "btn sm", disabled: !!busy, onClick: () => fileRef.current && fileRef.current.click() }, h(Icon, { name: "upload", size: 15 }), nFiles ? "Attach another" : "Attach receipt") : null,
          h("input", { id: "e-files", ref: fileRef, type: "file", hidden: true, multiple: true, accept: "image/*,application/pdf,.pdf", onChange: e => { addFiles(e.target.files); e.target.value = ""; } })),
        keptLegacy ? savedItem("legacy", rec.img, !!rec.imgPdf, rec.imgPdf ? "Saved PDF" : "Saved picture", "Kept when this record was added") : null,
        keptAtt.map(a => savedItem(a.id, a.id, !!a.pdf, a.name || (a.pdf ? "PDF" : "Picture"), a.at ? "Attached " + dayLabel(String(a.at).slice(0, 10)) : "Attached")),
        staged.map(s => h("div", { key: s.key, className: "ev" },
          h("span", { className: "ev-thumb" }, s.url ? h("img", { src: s.url, alt: "" }) : h(Icon, { name: "file", size: 20 })),
          h("span", { className: "ev-text" }, h("b", null, s.file.name || "Pasted picture"), h("small", null, fill && fill.key === s.key && fill.busy ? "Reading…" : "Kept when you save")),
          h("span", { className: "ev-actions" },
            ai.ready() ? h("button", { type: "button", className: "btn sm", disabled: !!busy || !!(fill && fill.busy), onClick: () => fillFrom(s) }, h(Icon, { name: "spark", size: 14 }), "Fill in from it") : null,
            h("button", { type: "button", className: "icon-btn", "aria-label": "Remove " + (s.file.name || "file"), disabled: !!busy, onClick: () => { setStaged(x => x.filter(y => y.key !== s.key)); if (s.url) URL.revokeObjectURL(s.url); if (fill && fill.key === s.key) setFill(null); } }, h(Icon, { name: "x", size: 16 }))))),
        preview ? h(FileImg, { id: preview, className: "receipt-img", alt: "Receipt for " + (rec.merchant || "this record") }) : null,
        fill && !fill.busy ? h("div", { className: cx("banner", fill.error && "bad") }, h(Icon, { name: fill.error ? "alert" : "spark", size: 16 }),
          h("span", { className: "grow" }, fill.error || fill.text, fill.amount != null ? " The picture shows " + fmtRM(Math.round(fill.amount * 100)) + "; this record says " + fmtRM(Math.round((Number(d.amount) || 0) * 100)) + "." : "", fill.date ? " The picture is dated " + dayLabel(fill.date) + "." : ""),
          fill.amount != null ? h("button", { type: "button", className: "btn sm", onClick: () => { set("amount", fill.amount); setFill(Object.assign({}, fill, { amount: null })); } }, "Use " + fmtRM(Math.round(fill.amount * 100))) : null,
          fill.date ? h("button", { type: "button", className: "btn sm", onClick: () => { set("date", fill.date); setFill(Object.assign({}, fill, { date: "" })); } }, "Use that date") : null) : null,
        !caps.assets ? h("p", { className: "note" }, "Attaching files isn't available in this view.")
          : !nFiles ? h("p", { className: "note" }, needs ? (d.cat === "parking" ? "Attach the parking receipt or the TnG screenshot whenever you have it." : t ? "Attach the Waze or Google Maps screenshot of the route, or the toll receipt, whenever you have it." : "Attach the toll receipt or the TnG screenshot whenever you have it.") + " You can also paste a screenshot here." : "Attach a receipt if you want to keep one with this record.") : null),
      err ? h("div", { className: "banner bad", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", { className: "grow" }, err)) : null),
    confirm
      ? h("div", { className: "modal-foot" }, h("span", { className: "grow" }, h("strong", null, "Delete this record for good?"), nKept ? " Its saved receipts go too." : ""),
          h("button", { type: "button", className: "btn", disabled: !!busy, onClick: () => setConfirm(false) }, "Keep it"),
          h("button", { type: "button", className: "btn primary", disabled: !!busy, onClick: del }, busy === "del" ? "Deleting…" : "Delete"))
      : h("div", { className: "modal-foot" },
          h("button", { type: "button", className: "btn ghost danger", disabled: !!busy, onClick: () => setConfirm(true) }, h(Icon, { name: "trash", size: 16 }), "Delete"),
          h("span", { className: "spacer" }),
          h("button", { type: "button", className: "btn ghost hide-narrow", disabled: !!busy, onClick: p.onClose }, "Cancel"),
          h("button", { type: "button", className: "btn primary", disabled: !!busy, onClick: save }, busy === "save" ? "Saving…" : busy ? busy : staged.length ? "Save and attach" : "Save changes")));
}

/* ================= fallback when a file can't be saved from this view ================= */
function CopyModal(p) {
  const ref = useRef(null);
  const [done, setDone] = useState(false);
  const pick = () => { const ta = ref.current; if (ta) { ta.focus(); ta.select(); } };
  const copy = () => {
    const fallback = () => { pick(); toasts.push("Text selected. Press Ctrl+C (or ⌘C) to copy it."); };
    try { navigator.clipboard.writeText(p.text).then(() => setDone(true), fallback); } catch (e) { fallback(); }
  };
  return h(Modal, { title: p.title, onClose: p.onClose },
    h("div", { className: "modal-body" }, h("p", { className: "note" }, p.hint),
      h("textarea", { id: "copy-text", ref: ref, className: "input num", readOnly: true, rows: 12, value: p.text, onFocus: pick, style: { fontSize: "12px", whiteSpace: "pre" } })),
    h("div", { className: "modal-foot" }, h("button", { type: "button", className: "btn ghost", onClick: p.onClose }, "Close"),
      h("button", { type: "button", className: "btn primary", onClick: copy }, h(Icon, { name: done ? "check" : "file", size: 16 }), done ? "Copied" : "Copy text")));
}
