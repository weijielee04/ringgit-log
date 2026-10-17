/* ================= icons ================= */
const ICONS = {
  grid: [["rect", { x: 3.5, y: 3.5, width: 7, height: 7, rx: 1.6 }], ["rect", { x: 13.5, y: 3.5, width: 7, height: 7, rx: 1.6 }], ["rect", { x: 3.5, y: 13.5, width: 7, height: 7, rx: 1.6 }], ["rect", { x: 13.5, y: 13.5, width: 7, height: 7, rx: 1.6 }]],
  list: [["path", { d: "M9 6.5h11M9 12h11M9 17.5h11" }], ["path", { d: "M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01", strokeWidth: 2.8 }]],
  calendar: [["rect", { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 }], ["path", { d: "M3.5 10h17M8 3v4M16 3v4" }]],
  route: [["circle", { cx: 6, cy: 18, r: 2.5 }], ["circle", { cx: 18, cy: 4.5, r: 2.5 }], ["path", { d: "M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.25 3.25 0 0 1 0-6.5h6.5" }]],
  parking: [["rect", { x: 3.5, y: 3.5, width: 17, height: 17, rx: 4 }], ["path", { d: "M9.5 17V7.5h3.25a2.75 2.75 0 0 1 0 5.5H9.5" }]],
  sliders: [["path", { d: "M4 7h9M17 7h3M4 17h3M11 17h9" }], ["circle", { cx: 15, cy: 7, r: 2 }], ["circle", { cx: 9, cy: 17, r: 2 }]],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  upload: [["path", { d: "M12 15.5V4M7.5 8.5 12 4l4.5 4.5M4.5 15.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5" }]],
  image: [["rect", { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.5 }], ["circle", { cx: 8.5, cy: 9.5, r: 1.5 }], ["path", { d: "m20.5 15-4.5-4.5L6.5 19.5" }]],
  file: [["path", { d: "M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" }], ["path", { d: "M13.5 3.5V9H19" }]],
  left: [["path", { d: "m14.5 6-6 6 6 6" }]],
  right: [["path", { d: "m9.5 6 6 6-6 6" }]],
  search: [["circle", { cx: 11, cy: 11, r: 6.5 }], ["path", { d: "m20 20-4.2-4.2" }]],
  x: [["path", { d: "M6 6l12 12M18 6 6 18" }]],
  check: [["path", { d: "m5 12.5 4.5 4.5L19 7.5" }]],
  trash: [["path", { d: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5" }]],
  receipt: [["path", { d: "M6 3.5h12v17l-2.4-1.6-2.4 1.6-1.2-.8-1.2.8-2.4-1.6L6 20.5z" }], ["path", { d: "M9 8.5h6M9 12.5h6" }]],
  download: [["path", { d: "M12 4v11.5M7.5 11 12 15.5 16.5 11M4.5 20h15" }]],
  sun: [["circle", { cx: 12, cy: 12, r: 4 }], ["path", { d: "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" }]],
  moon: [["path", { d: "M20 14.2A8 8 0 0 1 9.8 4a7.5 7.5 0 1 0 10.2 10.2z" }]],
  food: [["path", { d: "M7 3.5v17M4.5 3.5v4a2.5 2.5 0 0 0 5 0v-4M17 20.5v-8M17 12.5c-1.7 0-2.5-1.2-2.5-3.5 0-3 1-5 2.5-5.5z" }]],
  car: [["path", { d: "M5 16.5H3.5v-3.8l1.9-5A2 2 0 0 1 7.3 6.4h9.4a2 2 0 0 1 1.9 1.3l1.9 5v3.8H19" }], ["path", { d: "M4 12.5h16M9.5 16.5h5" }], ["circle", { cx: 7.2, cy: 16.5, r: 2 }], ["circle", { cx: 16.8, cy: 16.5, r: 2 }]],
  bag: [["path", { d: "M5.5 8h13l-1 12.5h-11z" }], ["path", { d: "M9 8V6.5a3 3 0 0 1 6 0V8" }]],
  bolt: [["path", { d: "M13 2.8 5.5 13.5H11l-1 7.7 7.5-10.7H12z" }]],
  dots: [["path", { d: "M6 12h.01M12 12h.01M18 12h.01", strokeWidth: 2.8 }]],
  alert: [["path", { d: "M12 4.5 21 19.5H3z" }], ["path", { d: "M12 10v4.5M12 17h.01" }]],
  clock: [["circle", { cx: 12, cy: 12, r: 8.5 }], ["path", { d: "M12 7.5V12l3 2" }]],
  pin: [["path", { d: "M12 21s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0c0 5.2 6.5 11 6.5 11z" }], ["circle", { cx: 12, cy: 10, r: 2.4 }]],
  link: [["path", { d: "M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v3.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2H10" }]],
  table: [["rect", { x: 3.5, y: 5, width: 17, height: 14, rx: 2 }], ["path", { d: "M3.5 10h17M3.5 14.5h17M9.5 5v14" }]],
  chart: [["path", { d: "M4 20h16M7 20v-7M12 20V5M17 20v-10" }]],
  spark: [["path", { d: "M11 3.5 12.8 9 18.5 11 12.8 13 11 18.5 9.2 13 3.5 11 9.2 9z" }], ["path", { d: "M18.5 15.5v4M16.5 17.5h4" }]],
  info: [["circle", { cx: 12, cy: 12, r: 8.5 }], ["path", { d: "M12 11v5.5M12 7.8h.01" }]],
  lock: [["rect", { x: 5, y: 10.5, width: 14, height: 10, rx: 2.2 }], ["path", { d: "M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" }]],
  keyboard: [["rect", { x: 3, y: 6.5, width: 18, height: 11, rx: 2.2 }], ["path", { d: "M7 10.5h.01M11 10.5h.01M15 10.5h.01M8 14h8", strokeWidth: 2 }]],
  building: [["path", { d: "M5 20.5V5.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15M16 9.5h2a1.5 1.5 0 0 1 1.5 1.5v9.5M3.5 20.5h17" }], ["path", { d: "M8.5 8h.01M12.5 8h.01M8.5 12h.01M12.5 12h.01M8.5 16h.01M12.5 16h.01", strokeWidth: 2.2 }]],
  layers: [["path", { d: "m12 4 8.5 4.5L12 13 3.5 8.5z" }], ["path", { d: "m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" }]],
  up: [["path", { d: "M12 19V6M6.5 11.5 12 6l5.5 5.5" }]],
  downArrow: [["path", { d: "M12 5v13M6.5 12.5 12 18l5.5-5.5" }]],
  logout: [["path", { d: "M14 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7" }], ["path", { d: "M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" }]]
};
function Icon(p) {
  const defs = ICONS[p.name] || ICONS.dots, size = p.size || 18;
  return h("svg", { className: "ico", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: p.sw || 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", focusable: "false" },
    defs.map(function (d, i) { return h(d[0], Object.assign({ key: i }, d[1])); }));
}
function BrandMark() {
  return h("span", { className: "brand-mark", "aria-hidden": "true" },
    h("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("path", { d: "M6 3.5h12v17l-2.4-1.6-2.4 1.6-1.2-.8-1.2.8-2.4-1.6L6 20.5z" }), h("path", { d: "M9.5 8.5h5M9.5 12.5h5" })));
}

/* ================= hooks ================= */
function useBus() {
  const st = useState(0), set = st[1];
  useEffect(function () { const f = function (v) { set(v); }; bus.subs.add(f); return function () { bus.subs.delete(f); }; }, []);
}
function useWidth() {
  const ref = useRef(null), st = useState(0), w = st[0], setW = st[1];
  useLayoutEffect(function () {
    const el = ref.current; if (!el) return;
    const update = function () { setW(el.clientWidth); };
    update();
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", update); return function () { window.removeEventListener("resize", update); }; }
    const ro = new ResizeObserver(update); ro.observe(el);
    return function () { ro.disconnect(); };
  }, []);
  return [ref, w];
}
function useTheme() {
  const read = function () {
    const a = document.documentElement.getAttribute("data-theme");
    if (a === "dark" || a === "light") return a;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };
  const st = useState(read), theme = st[0], setTheme = st[1];
  useEffect(function () {
    let saved = null;
    try { saved = localStorage.getItem("ringgit-log.theme"); } catch (e) {}
    if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
    setTheme(read());
    const mo = new MutationObserver(function () { setTheme(read()); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const on = function () { setTheme(read()); };
    if (mq && mq.addEventListener) mq.addEventListener("change", on);
    return function () { mo.disconnect(); if (mq && mq.removeEventListener) mq.removeEventListener("change", on); };
  }, []);
  const choose = function (t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("ringgit-log.theme", t); } catch (e) {}
    setTheme(t);
  };
  return [theme, choose];
}

/* ================= toasts ================= */
const toasts = {
  list: [], n: 0,
  push: function (t) {
    const item = typeof t === "string" ? { text: t } : Object.assign({}, t);
    item.id = ++toasts.n;
    toasts.list = toasts.list.concat(item).slice(-3); bus.emit();
    setTimeout(function () { toasts.drop(item.id); }, item.ms || (item.action ? 9000 : 4200));
    return item.id;
  },
  drop: function (id) { const n = toasts.list.length; toasts.list = toasts.list.filter(function (x) { return x.id !== id; }); if (toasts.list.length !== n) bus.emit(); }
};
function Toasts() {
  useBus();
  return h("div", { className: "toasts", role: "status", "aria-live": "polite" }, toasts.list.map(function (t) {
    return h("div", { key: t.id, className: "toast" }, h("span", null, t.text),
      t.action ? h("button", { type: "button", onClick: function () { toasts.drop(t.id); t.action.run(); } }, t.action.label) : null);
  }));
}

/* ================= kept receipt files =================
   On the Claude host a file's address is known at once; on the website it is a short-lived signed link. */
function useFileUrl(id) {
  const now = function () { if (!id || !caps.fileUrl) return ""; const v = caps.fileUrl(id); return typeof v === "string" ? v : null; };
  const st = useState(now), url = st[0], setUrl = st[1];
  useEffect(function () {
    let live = true;
    if (!id || !caps.fileUrl) { setUrl(""); return; }
    const v = caps.fileUrl(id);
    if (typeof v === "string") { setUrl(v); return; }
    setUrl(null);
    Promise.resolve(v).then(function (u) { if (live) setUrl(u || ""); }, function () { if (live) setUrl(""); });
    return function () { live = false; };
  }, [id]);
  return url;   /* null while the address is being fetched, "" when the file can't be shown */
}
function FileImg(p) {
  const url = useFileUrl(p.id);
  if (url === null) return h("span", { className: "file-wait", "aria-label": "Loading picture" });
  if (!url) { if (p.onMissing) p.onMissing(); return h(Icon, { name: "image", size: 20 }); }
  return h("img", { src: url, alt: p.alt || "", className: p.className, loading: p.lazy ? "lazy" : undefined, onError: p.onError });
}
function FileLink(p) {
  const url = useFileUrl(p.id);
  if (!url) return h("button", { type: "button", className: p.className, disabled: true }, p.children);
  return h("a", { className: p.className, href: url, target: "_blank", rel: "noopener noreferrer" }, p.children);
}

/* ================= small pieces ================= */
function Money(p) { return h("span", { className: p.className }, h("span", { className: "cur" }, "RM"), fmtNum(p.c)); }
function Seg(p) {
  return h("div", { className: cx("seg", p.className), role: "group", "aria-label": p.label },
    p.options.map(function (o) {
      return h("button", { key: o.id, type: "button", className: o.id === p.value ? "is-on" : "", "aria-pressed": o.id === p.value, onClick: function () { p.onChange(o.id); } },
        o.icon ? h(Icon, { name: o.icon, size: 15 }) : null, o.label);
    }));
}
function CatChips(p) {
  const on = p.value;
  const toggle = function (id) { p.onChange(on.indexOf(id) >= 0 ? on.filter(function (x) { return x !== id; }) : on.concat(id)); };
  return h("div", { className: "chips", role: "group", "aria-label": "Show only these types" },
    h("button", { type: "button", className: cx("chip", !on.length && "is-on"), "aria-pressed": !on.length, onClick: function () { p.onChange([]); } }, "All types"),
    CATS.map(function (c) {
      const active = on.indexOf(c.id) >= 0;
      return h("button", { key: c.id, type: "button", className: cx("chip", active && "is-on"), "aria-pressed": active, onClick: function () { toggle(c.id); } },
        h("i", { className: "dot", style: { background: catColor(c.id) } }), c.label,
        p.counts ? h("span", { className: "chip-n num" }, p.counts[c.id] || 0) : null);
    }));
}
function Field(p) { return h("label", { className: cx("field", p.className) }, h("span", null, p.label), p.children); }
function AmountInput(p) {
  const fmt = function (v) { return v || v === 0 ? Number(v).toFixed(2) : ""; };
  const st = useState(fmt(p.value)), txt = st[0], setTxt = st[1];
  const last = useRef(p.value);
  useEffect(function () { if (p.value !== last.current) { last.current = p.value; setTxt(fmt(p.value)); } }, [p.value]);
  return h("input", {
    id: p.id, className: p.className, type: "text", inputMode: "decimal", autoComplete: "off", placeholder: p.placeholder || "0.00", value: txt, "aria-label": p.label,
    onChange: function (e) {
      const t = e.target.value.replace(/[^0-9.]/g, "");
      setTxt(t);
      const n = Math.round(parseFloat(t) * 100) / 100, v = isFinite(n) ? n : 0;
      last.current = v; p.onChange(v);
    },
    onBlur: function () { const n = parseFloat(txt); if (isFinite(n)) setTxt(n.toFixed(2)); }
  });
}
function Modal(p) {
  useEffect(function () {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = function (e) { if (e.key === "Escape" && !p.locked) p.onClose(); };
    window.addEventListener("keydown", onKey);
    return function () { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [p.locked]);
  return h("div", { className: "overlay" },
    h("div", { className: cx("modal", p.narrow && "narrow"), role: "dialog", "aria-modal": "true", "aria-label": p.title },
      h("div", { className: "modal-head" }, h("h2", null, p.title), p.head || null, h("span", { className: "spacer" }),
        h("button", { type: "button", className: "icon-btn", "aria-label": "Close", disabled: !!p.locked, onClick: p.onClose }, h(Icon, { name: "x" }))),
      p.children));
}
function Empty(p) {
  return h("div", { className: "empty" }, h("span", { className: "empty-ico" }, h(Icon, { name: p.icon || "receipt", size: 22 })),
    h("h3", null, p.title), p.text ? h("p", null, p.text) : null, p.children || null);
}

/* ================= charts ================= */
function niceStep(x) { if (!(x > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))), n = x / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
function fmtAxis(c, step) {
  const v = c / 100;
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "k";
  return v.toFixed(step >= 100 ? 0 : step >= 10 ? 1 : 2);
}
function topRounded(x, y, w, hh, r) {
  r = Math.max(0, Math.min(r, w / 2, hh));
  return "M" + x + " " + (y + hh) + "V" + (y + r) + "Q" + x + " " + y + " " + (x + r) + " " + y + "H" + (x + w - r) + "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + r) + "V" + (y + hh) + "Z";
}
/* Stacked columns: one column per day or month, segments in the palette's stack order with 2px surface gaps. */
function Columns(p) {
  const items = p.items, H = p.height || 232;
  const wr = useWidth(), ref = wr[0], W = wr[1];
  const st = useState(-1), act = st[0], setAct = st[1];
  const m = { l: 44, r: 6, t: 10, b: 26 };
  const iw = Math.max(0, W - m.l - m.r), ih = H - m.t - m.b;
  const max = items.reduce(function (a, it) { return Math.max(a, it.total); }, 0);
  const step = niceStep((max || 40000) / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const n = items.length, band = n ? iw / n : 0;
  const bw = Math.max(2, Math.min(24, band - (band > 10 ? 4 : 1)));
  const yOf = function (c) { return m.t + ih - (c / top) * ih; };
  const ticks = []; for (let t = 0; t <= top + 1; t += step) ticks.push(t);
  const dense = band < 26; let lastX = -1e9;
  const showTick = items.map(function (it, i) { const x = m.l + (i + 0.5) * band; let show = !dense || !!it.major; if (show && x - lastX < 22) show = false; if (show) lastX = x; return show; });
  const cur = act >= 0 && act < n ? items[act] : null;
  const move = function (dir) { if (!n) return; let i = act < 0 ? (dir > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, act + dir)); setAct(i); };
  const onKey = function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    else if (e.key === "Escape") setAct(-1);
    else if ((e.key === "Enter" || e.key === " ") && cur && p.onSelect) { e.preventDefault(); p.onSelect(cur); }
  };
  let tip = null;
  if (cur && W > 0) {
    const x = m.l + (act + 0.5) * band, off = Math.max(12, band / 2 + 8);
    const style = x < W / 2 ? { left: Math.min(W - 140, x + off) + "px", top: m.t + "px" } : { right: Math.min(W - 140, W - x + off) + "px", top: m.t + "px" };
    const parts = STACK.filter(function (c) { return (cur.parts[c] || 0) > 0; });
    tip = h("div", { className: "tip", style: style },
      h("div", { className: "tip-title" }, cur.title),
      h("div", { className: "tip-total" }, fmtRM(cur.total)),
      parts.map(function (c) { return h("div", { key: c, className: "tip-row" }, h("i", { className: "tip-key", style: { background: catColor(c) } }), h("span", null, CAT[c].label), h("b", null, fmtNum(cur.parts[c]))); }));
  }
  return h("div", { className: "chart", ref: ref, style: { height: H + "px" }, tabIndex: 0, role: "group", "aria-label": p.label + ". Use the left and right arrow keys to read each column.", onKeyDown: onKey, onBlur: function () { setAct(-1); }, onPointerLeave: function () { setAct(-1); } },
    W > 0 ? h("svg", { width: W, height: H, role: "presentation" },
      ticks.map(function (t) { return h("line", { key: "g" + t, className: t === 0 ? "ax" : "gl", x1: m.l, x2: W - m.r, y1: Math.round(yOf(t)) + 0.5, y2: Math.round(yOf(t)) + 0.5 }); }),
      ticks.map(function (t) { return h("text", { key: "t" + t, className: "tk", x: m.l - 8, y: yOf(t) + 4, textAnchor: "end" }, fmtAxis(t, step)); }),
      items.map(function (it, i) {
        const x0 = m.l + i * band, x = x0 + (band - bw) / 2;
        const parts = STACK.filter(function (c) { return (it.parts[c] || 0) > 0; });
        let y = m.t + ih; const segs = [];
        parts.forEach(function (c, k) {
          const hh = Math.max(1.5, (it.parts[c] / top) * ih), y1 = y - hh, isTop = k === parts.length - 1, gap = !isTop && hh > 5 ? 2 : 0;
          segs.push(isTop
            ? h("path", { key: c, d: topRounded(x, y1, bw, hh, 4), style: { fill: catColor(c) } })
            : h("rect", { key: c, x: x, y: y1 + gap, width: bw, height: hh - gap, style: { fill: catColor(c) } }));
          y = y1;
        });
        const sel = p.selectedKey === it.key;
        return h("g", { key: it.key },
          h("rect", { className: cx("band", i === act && "is-act", sel && i !== act && "is-sel"), x: x0, y: m.t, width: Math.max(0, band), height: ih, rx: 4 }),
          segs,
          showTick[i] ? h("text", { className: cx("tk", sel && "is-sel"), x: x0 + band / 2, y: H - 8, textAnchor: "middle" }, it.label) : null,
          h("rect", { x: x0, y: 0, width: Math.max(0, band), height: H, fill: "transparent", style: { cursor: p.onSelect ? "pointer" : "default" }, onPointerEnter: function () { setAct(i); }, onPointerDown: function () { setAct(i); }, onClick: function () { if (p.onSelect) p.onSelect(it); } }));
      })) : null,
    max === 0 ? h("div", { className: "chart-empty" }, p.empty || "Nothing spent in this period") : null,
    tip);
}
function Legend(p) {
  const cats = STACK.filter(function (c) { return p.items.some(function (it) { return (it.parts[c] || 0) > 0; }); });
  if (cats.length < 2) return null;
  return h("div", { className: "legend" }, cats.map(function (c) { return h("span", { key: c }, h("i", { className: "sw", style: { background: catColor(c) } }), CAT[c].label); }));
}
function TrendTable(p) {
  const cats = STACK.filter(function (c) { return p.items.some(function (it) { return (it.parts[c] || 0) > 0; }); });
  const rows = p.items.filter(function (it) { return it.total > 0; });
  if (!rows.length) return h("p", { className: "note" }, "Nothing spent in this period.");
  return h("div", { className: "tbl-wrap" }, h("table", { className: "tbl" },
    h("thead", null, h("tr", null, h("th", null, p.head || "Period"), cats.map(function (c) { return h("th", { key: c }, CAT[c].label); }), h("th", null, "Total"))),
    h("tbody", null, rows.map(function (it) {
      return h("tr", { key: it.key }, h("td", null, it.title), cats.map(function (c) { return h("td", { key: c, className: "num" }, it.parts[c] ? fmtNum(it.parts[c]) : "–"); }), h("td", { className: "num" }, fmtNum(it.total)));
    }))));
}
function arcPath(cx0, cy0, r0, r1, a0, a1) {
  const pt = function (r, a) { return (cx0 + r * Math.sin(a)).toFixed(2) + " " + (cy0 - r * Math.cos(a)).toFixed(2); };
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return "M" + pt(r1, a0) + "A" + r1 + " " + r1 + " 0 " + large + " 1 " + pt(r1, a1) + "L" + pt(r0, a1) + "A" + r0 + " " + r0 + " 0 " + large + " 0 " + pt(r0, a0) + "Z";
}
function Donut(p) {
  const st = useState(""), hot = st[0], setHot = st[1];
  const parts = p.parts, total = p.total;
  const S = 176, c0 = S / 2, r1 = 82, r0 = 57;
  const segs = []; let a = 0;
  STACK.forEach(function (c) { const v = parts[c] || 0; if (v <= 0 || total <= 0) return; const f = v / total; segs.push({ c: c, v: v, f: f, a0: a, a1: a + f * Math.PI * 2 }); a += f * Math.PI * 2; });
  const list = segs.slice().sort(function (x, y) { return y.v - x.v; });
  const h1 = segs.find(function (s) { return s.c === hot; });
  return h("div", { className: "donut-wrap" },
    h("div", { className: "donut" },
      h("svg", { width: S, height: S, viewBox: "0 0 " + S + " " + S, role: "img", "aria-label": "Share of spending by type. The list beside it has the amounts." },
        !segs.length ? h("circle", { className: "donut-ring", cx: c0, cy: c0, r: (r0 + r1) / 2, strokeWidth: r1 - r0 }) : null,
        segs.length === 1 ? h("circle", { cx: c0, cy: c0, r: (r0 + r1) / 2, fill: "none", strokeWidth: r1 - r0, style: { stroke: catColor(segs[0].c) }, onPointerEnter: function () { setHot(segs[0].c); }, onPointerLeave: function () { setHot(""); } }) : null,
        segs.length > 1 ? segs.map(function (s) {
          return h("path", { key: s.c, className: "donut-seg", d: arcPath(c0, c0, r0, r1, s.a0, s.a1), style: { fill: catColor(s.c), opacity: hot && hot !== s.c ? 0.45 : 1 }, onPointerEnter: function () { setHot(s.c); }, onPointerLeave: function () { setHot(""); } });
        }) : null),
      h("div", { className: "donut-center" },
        h("small", null, h1 ? CAT[h1.c].label : (p.centerLabel || "Total")),
        h("b", null, h("span", { className: "cur" }, "RM"), fmtNum(h1 ? h1.v : total)),
        h1 ? h("i", null, Math.round(h1.f * 100) + "% of the month") : null)),
    h("div", { className: "donut-list" }, list.length ? list.map(function (s) {
      return h("div", { key: s.c, className: cx("dl-row", hot === s.c && "is-hot"), onPointerEnter: function () { setHot(s.c); }, onPointerLeave: function () { setHot(""); } },
        h("i", { className: "sw", style: { background: catColor(s.c) } }), h("span", null, CAT[s.c].label), h("span", { className: "num" }, fmtNum(s.v)), h("span", { className: "pct num" }, (s.f * 100 < 1 ? "<1" : Math.round(s.f * 100)) + "%"));
    }) : h("p", { className: "note" }, "Nothing spent yet.")));
}

/* ================= record rows ================= */
function recMeta(r, withDate) {
  const bits = [];
  if (withDate) bits.push(dayLabel(r.date));
  if (r.time) bits.push(r.time);
  if (r.park) { if (r.park.location && r.park.location !== r.merchant) bits.push(r.park.location); if (r.park.operator) bits.push(r.park.operator); if (r.park.mins) bits.push(fmtMins(r.park.mins)); }
  if (r.trip) { if (r.trip.km) bits.push(fmtKm(r.trip.km)); if (r.trip.mins) bits.push(fmtMins(r.trip.mins)); if (r.trip.round) bits.push("round trip"); }
  if (SOURCES[r.src]) bits.push(SOURCES[r.src]);
  return bits.join(" · ");
}
function RecRow(p) {
  const r = p.r, c = CAT[r.cat] || CAT.other;
  return h("button", { type: "button", className: "row", onClick: function () { p.A.openRec(r); } },
    h("span", { className: "row-ico", style: { "--c": catColor(r.cat) } }, h(Icon, { name: c.icon, size: 17 })),
    h("span", { className: "row-main" },
      h("span", { className: "row-title" }, r.merchant || c.label, r.example ? h("span", { className: "tag ex" }, "Example") : null,
        evidenceCount(r) ? h("span", { className: "tag" }, h(Icon, { name: "receipt", size: 12 }), evidenceCount(r) === 1 ? "Receipt" : evidenceCount(r) + " files") : missingEvidence(r) ? h("span", { className: "tag warn" }, "No receipt yet") : null),
      h("span", { className: "row-meta" }, recMeta(r, p.withDate))),
    h("span", { className: "row-cat" }, h("i", { className: "dot", style: { background: catColor(r.cat) } }), catLabel(r)),
    h("span", { className: "row-amt num" }, fmtNum(cents(r))));
}
