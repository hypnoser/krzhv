/*
  analytics.js — ядро панелі /secret/analytics/: завантаження й розшифровка знімка, фільтри, агрегація, графіки.
  Вкладки (що саме показувати) — у analytics-tabs.js. Знімок готує scripts/fetch-analytics.js у GitHub Actions.
  Усі дані з Cloudflare (і значення рефереру/шляху, які може підробити будь-хто) екрануються через esc().
*/
(function () {
  "use strict";

  const AN = (window.AN = { tabs: [], fn: {} });
  const K = window.KrzhvSecret;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nfmt = new Intl.NumberFormat("uk-UA");
  const num = (n) => nfmt.format(Math.round(n));
  const pad = (n) => (n < 10 ? "0" : "") + n;
  const pc = (a, b) => { if (!b) return "—"; const p = (a / b) * 100; return (p < 10 ? p.toFixed(1) : String(Math.round(p))).replace(".", ",") + "%"; };
  const dec = (n, d) => Number(n).toFixed(d == null ? 1 : d).replace(".", ",");

  /* ---------- Довідники ---------- */
  const PAL = ["#3D5A4A", "#C77A4F", "#7A93A8", "#E4C77A", "#8C6BA8", "#5E9C8F", "#B5714A", "#94897E"];
  const DEV = { desktop: "Комп'ютер", mobile: "Смартфон", tablet: "Планшет", "": "(не визначено)" };
  const NAV = { navigate: "Перехід за посиланням", reload: "Оновлення сторінки", back_forward: "Назад / вперед", back_forward_cache: "Назад / вперед (кеш)", prerender: "Попередня підгрузка", "": "(не визначено)" };
  const CATL = { direct: "Прямі / невідомо", search: "Пошук", social: "Соцмережі й месенджери", ai: "ШІ-асистенти", internal: "Внутрішні переходи", other: "Інші сайти" };
  const CATC = { direct: "#94897E", search: "#3D5A4A", social: "#C77A4F", ai: "#8C6BA8", internal: "#7A93A8", other: "#E4C77A" };
  const MON = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
  const MONF = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];
  const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  const FAMS = [
    ["ai", "ChatGPT", /(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/],
    ["ai", "Claude", /(^|\.)claude\.ai$/],
    ["ai", "Perplexity", /(^|\.)perplexity\.ai$/],
    ["ai", "Gemini", /^(gemini|bard)\.google\.com$/],
    ["ai", "Copilot", /^copilot\.microsoft\.com$/],
    ["ai", "DeepSeek", /(^|\.)deepseek\.com$/],
    ["search", "Google", /(^|\.)google\.[a-z.]+$/],
    ["search", "Bing", /(^|\.)bing\.com$/],
    ["search", "DuckDuckGo", /(^|\.)duckduckgo\.com$/],
    ["search", "Yandex", /(^|\.)(yandex\.[a-z.]+|ya\.ru)$/],
    ["search", "Yahoo", /(^|\.)yahoo\.[a-z.]+$/],
    ["search", "Ecosia", /(^|\.)ecosia\.org$/],
    ["search", "Brave Search", /^search\.brave\.com$/],
    ["search", "Startpage", /(^|\.)startpage\.com$/],
    ["search", "Baidu", /(^|\.)baidu\.com$/],
    ["search", "Qwant", /(^|\.)qwant\.com$/],
    ["social", "Facebook", /(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
    ["social", "Instagram", /(^|\.)instagram\.com$/],
    ["social", "Telegram", /(^|\.)(t\.me|telegram\.org|telegram\.me)$/],
    ["social", "X (Twitter)", /(^|\.)(twitter\.com|x\.com|t\.co)$/],
    ["social", "LinkedIn", /(^|\.)(linkedin\.com|lnkd\.in)$/],
    ["social", "YouTube", /(^|\.)(youtube\.com|youtu\.be)$/],
    ["social", "Reddit", /(^|\.)reddit\.com$/],
    ["social", "TikTok", /(^|\.)tiktok\.com$/],
    ["social", "Threads", /(^|\.)threads\.(net|com)$/],
    ["social", "VK / OK", /(^|\.)(vk\.com|ok\.ru)$/],
    ["social", "WhatsApp", /(^|\.)(whatsapp\.com|wa\.me)$/],
    ["social", "Viber", /(^|\.)viber\.com$/],
    ["social", "Pinterest", /(^|\.)pinterest\.[a-z.]+$/],
  ];
  const FACETS = [
    { k: "country", label: "Країна", col: "country" },
    { k: "device", label: "Пристрій", col: "device" },
    { k: "cat", label: "Тип джерела", col: "refHost" },
    { k: "src", label: "Джерело", col: "refHost" },
    { k: "path", label: "Сторінка", col: "path" },
    { k: "rpath", label: "Звідки (сторінка)", col: "refPath" },
    { k: "browser", label: "Браузер", col: "browser" },
    { k: "os", label: "ОС", col: "os" },
    { k: "nav", label: "Тип переходу", col: "nav" },
  ];
  const FAC = {};
  FACETS.forEach((f) => (FAC[f.k] = f));

  let regionNames = null;
  try { regionNames = new Intl.DisplayNames(["uk"], { type: "region" }); } catch (e) { /* без назв */ }
  const cname = (c) => {
    if (!c) return "(не визначено)";
    if (c === "XX") return "Невідомо";
    if (c === "T1") return "Tor";
    try { return (regionNames && regionNames.of(c)) || c; } catch (e) { return c; }
  };
  const flag = (c) => (/^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? String.fromCodePoint(127397 + c.charCodeAt(0), 127397 + c.charCodeAt(1)) : "🌐");

  /* ---------- Стан ---------- */
  const newState = () => {
    const s = { tab: "overview", p: "30", from: "", to: "", metric: "views", cmp: true, exSecret: true, gran: "auto", page: "", f: {} };
    FACETS.forEach((f) => (s.f[f.k] = { sel: [], ex: false }));
    return s;
  };
  let S = newState();
  let D = null;       // розпакований знімок
  let C = null;       // контекст поточного відображення
  let KEY = null;
  let TT = {};        // шлях → заголовок сторінки
  const COLL = new Intl.Collator("uk");
  const SORT = {}, LIMIT = {}, TSEARCH = {}, TBLS = {}, EXPORT = {};

  function loadHash() {
    try {
      const o = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      const s = newState();
      ["tab", "p", "from", "to", "metric", "gran", "page"].forEach((k) => { if (typeof o[k] === "string") s[k] = o[k]; });
      ["cmp", "exSecret"].forEach((k) => { if (typeof o[k] === "boolean") s[k] = o[k]; });
      FACETS.forEach((f) => { const x = o.f && o.f[f.k]; if (x && Array.isArray(x.sel)) s.f[f.k] = { sel: x.sel.filter((v) => typeof v === "string").slice(0, 200), ex: !!x.ex }; });
      S = s;
    } catch (e) { /* стан за замовчуванням */ }
  }
  function saveHash() {
    try { history.replaceState(null, "", "#" + encodeURIComponent(JSON.stringify(S))); } catch (e) { /* ігноруємо */ }
  }

  /* ---------- Дати (за київським часом) ---------- */
  let kyiv;
  try { kyiv = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }); }
  catch (e) { kyiv = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kiev", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }); }
  function kparts(ms) {
    const o = {};
    kyiv.formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; });
    const day = Date.UTC(+o.year, +o.month - 1, +o.day) / 864e5;
    return { day, hour: +o.hour % 24, wd: (((day + 3) % 7) + 7) % 7 };
  }
  const dayDate = (n) => new Date(n * 864e5);
  const dstr = (n) => { const d = dayDate(n); return pad(d.getUTCDate()) + "." + pad(d.getUTCMonth() + 1) + "." + d.getUTCFullYear(); };
  const dshort = (n) => { const d = dayDate(n); return pad(d.getUTCDate()) + "." + pad(d.getUTCMonth() + 1); };
  const diso = (n) => dayDate(n).toISOString().slice(0, 10);
  const dfromiso = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; };
  const wstart = (n) => n - ((((n + 3) % 7) + 7) % 7);

  /* ---------- Нормалізація ---------- */
  function normPath(p) {
    if (!p) return "";
    p = String(p).split(/[?#]/)[0];
    if (p.charAt(0) !== "/") p = "/" + p;
    try { p = decodeURIComponent(p); } catch (e) { /* лишаємо як є */ }
    p = p.replace(/\/index\.html?$/, "/");
    if (!/\.[a-z0-9]{1,5}$/i.test(p) && p.slice(-1) !== "/") p += "/";
    return p;
  }
  const normHost = (h) => String(h || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^www\./, "");
  const titleOf = (p) => (p === "" ? "(невідомо)" : TT[p] || p);

  /* ---------- Розпакування знімка ---------- */
  function ingest(payload, demo) {
    const cols = payload.cols, rows = payload.rows, n = rows.length, nc = cols.length;
    const d = (D = { raw: payload, demo: !!demo, n, has: {}, dict: {}, c: {}, views: new Float64Array(n), visits: new Float64Array(n) });
    cols.forEach((k) => { d.has[k] = true; d.dict[k] = payload.dict[k].slice(); d.c[k] = new Int32Array(n); });
    for (let r = 0; r < n; r++) {
      const row = rows[r];
      for (let i = 0; i < nc; i++) d.c[cols[i]][r] = row[i];
      d.views[r] = row[nc]; d.visits[r] = row[nc + 1];
    }
    ["country", "device", "refHost", "refPath", "path", "browser", "os", "nav"].forEach((k) => {
      if (!d.has[k]) { d.dict[k] = [""]; d.c[k] = new Int32Array(n); }
    });
    if (!d.has.t) { d.dict.t = [new Date().toISOString()]; d.c.t = new Int32Array(n); }
    const remap = (k, fn) => {
      const old = d.dict[k], map = new Int32Array(old.length), nd = [], idx = new Map();
      old.forEach((v, i) => { const nv = fn(v); let j = idx.get(nv); if (j === undefined) { j = nd.length; nd.push(nv); idx.set(nv, j); } map[i] = j; });
      const a = d.c[k];
      for (let i = 0; i < a.length; i++) a[i] = map[a[i]];
      d.dict[k] = nd;
    };
    remap("path", normPath); remap("refPath", normPath); remap("refHost", normHost);
    remap("country", (v) => String(v || "").toUpperCase());
    d.host = normHost(payload.host || location.hostname);
    // Класифікація джерел
    d.src = {};
    d.dict.refHost.forEach((h) => {
      let r;
      if (h === "") r = { cat: "direct", name: "Прямі / невідомо" };
      else if (h === d.host || h.endsWith("." + d.host)) r = { cat: "internal", name: "Цей сайт" };
      else {
        const f = FAMS.find((x) => x[2].test(h));
        r = f ? { cat: f[0], name: f[1] } : { cat: "other", name: h };
      }
      d.src[h] = r;
    });
    // Час
    const ti = d.dict.t.map((s) => (s ? kparts(Date.parse(s)) : { day: 0, hour: 0, wd: 0 }));
    d.rd = new Int32Array(n); d.rh = new Uint8Array(n); d.rw = new Uint8Array(n);
    const tc = d.c.t;
    for (let r = 0; r < n; r++) { const x = ti[tc[r]]; d.rd[r] = x.day; d.rh[r] = x.hour; d.rw[r] = x.wd; }
    d.hourly = new Set(ti.map((x) => x.hour)).size > 2;
    d.d0 = kparts(Date.parse(payload.from)).day;
    d.d1 = kparts(Date.parse(payload.to)).day;
    d.gen = payload.generatedAt ? Date.parse(payload.generatedAt) : Date.now();
    FACETS.forEach((f) => { delete f._v; });
    // Заголовки сторінок із карти, вбудованої в HTML
    TT = {};
    try {
      const m = JSON.parse($("#anTitles").textContent);
      Object.keys(m).forEach((u) => { TT[normPath(u)] = m[u]; });
    } catch (e) { /* без заголовків */ }
    return d;
  }

  /* ---------- Фільтрація й агрегація ---------- */
  const M = () => (S.metric === "visits" ? 1 : 0);
  function facetVals(f) {
    if (f._v) return f._v;
    const dd = D.dict[f.col];
    f._v = f.k === "cat" ? dd.map((h) => D.src[h].cat) : f.k === "src" ? dd.map((h) => D.src[h].name) : dd;
    return f._v;
  }
  function allowOf(f) {
    const st = S.f[f.k], set = new Set(st.sel);
    return Uint8Array.from(facetVals(f), (x) => ((st.ex ? !set.has(x) : set.has(x)) ? 1 : 0));
  }
  function select(r0, r1, skip) {
    const act = [];
    FACETS.forEach((f) => { if (f.k !== skip && S.f[f.k].sel.length) act.push([D.c[f.col], allowOf(f)]); });
    if (S.exSecret) act.push([D.c.path, Uint8Array.from(D.dict.path, (p) => (p.indexOf("/secret/") === 0 ? 0 : 1))]);
    const out = [], rd = D.rd, na = act.length;
    outer: for (let r = 0; r < D.n; r++) {
      const d = rd[r];
      if (d < r0 || d > r1) continue;
      for (let j = 0; j < na; j++) if (!act[j][1][act[j][0][r]]) continue outer;
      out.push(r);
    }
    return out;
  }
  function tally(sel, keyFn) {
    const m = new Map();
    for (let i = 0; i < sel.length; i++) {
      const r = sel[i], k = keyFn(r);
      let a = m.get(k);
      if (!a) { a = [0, 0]; m.set(k, a); }
      a[0] += D.views[r]; a[1] += D.visits[r];
    }
    return m;
  }
  const tallyF = (sel, f) => { const v = facetVals(f), c = D.c[f.col]; return tally(sel, (r) => v[c[r]]); };
  const tallyC = (sel, col) => { const c = D.c[col], dd = D.dict[col]; return tally(sel, (r) => dd[c[r]]); };
  const sum = (sel) => { let v = 0, vi = 0; for (let i = 0; i < sel.length; i++) { v += D.views[sel[i]]; vi += D.visits[sel[i]]; } return [v, vi]; };
  function top(map, n, m) {
    m = m == null ? M() : m;
    let arr = Array.from(map, ([k, p]) => ({ k, v: p[0], vi: p[1], n: p[m] }));
    if (!arr.some((x) => x.n)) arr = arr.map((x) => Object.assign(x, { n: x.v }));
    arr.sort((a, b) => b.n - a.n);
    return n ? arr.slice(0, n) : arr;
  }

  function range() {
    if (S.p === "custom") {
      const a = dfromiso(S.from), b = dfromiso(S.to);
      if (!isNaN(a) && !isNaN(b)) return a <= b ? [a, b] : [b, a];
    }
    if (S.p === "all") return [D.d0, D.d1];
    const len = parseInt(S.p, 10) || 30;
    return [D.d1 - len + 1, D.d1];
  }
  function ctx() {
    const [r0, r1] = range(), len = r1 - r0 + 1;
    const hasPrev = S.cmp && S.p !== "all" && r0 - 1 >= D.d0;
    const c = { r0, r1, len, hasPrev, prevPartial: hasPrev && r0 - len < D.d0, pr0: r0 - len, pr1: r0 - 1, M: M() };
    c.cur = select(r0, r1);
    c.tot = sum(c.cur);
    c.prev = hasPrev ? select(c.pr0, c.pr1) : [];
    c.ptot = sum(c.prev);
    C = c;
    return c;
  }

  /* ---------- Часові ряди ---------- */
  function granOf(len) {
    if (S.gran !== "auto") return S.gran;
    return len <= 92 ? "day" : len <= 400 ? "week" : "month";
  }
  function buckets(r0, r1, gran) {
    const list = [];
    if (gran === "day") for (let d = r0; d <= r1; d++) list.push({ s: d, label: dshort(d), tip: dstr(d) + " (" + WD[(((d + 3) % 7) + 7) % 7] + ")" });
    else if (gran === "week") for (let d = wstart(r0); d <= r1; d += 7) list.push({ s: d, label: dshort(d), tip: "тиждень з " + dstr(d) });
    else {
      const a = dayDate(r0), b = dayDate(r1);
      for (let y = a.getUTCFullYear(), m = a.getUTCMonth(); y * 12 + m <= b.getUTCFullYear() * 12 + b.getUTCMonth(); m++) {
        if (m > 11) { m = 0; y++; }
        list.push({ s: Date.UTC(y, m, 1) / 864e5, label: MON[m] + " " + String(y).slice(2), tip: MONF[m] + " " + y });
      }
    }
    const first = wstart(r0), a0 = dayDate(r0);
    const idx = (day) => {
      if (gran === "day") return day - r0;
      if (gran === "week") return Math.floor((wstart(day) - first) / 7);
      const d = dayDate(day);
      return d.getUTCFullYear() * 12 + d.getUTCMonth() - (a0.getUTCFullYear() * 12 + a0.getUTCMonth());
    };
    return { list, idx, gran };
  }
  function series(sel, r0, r1, gran) {
    const b = buckets(r0, r1, gran), n = b.list.length;
    const v = new Array(n).fill(0), vi = new Array(n).fill(0);
    for (let i = 0; i < sel.length; i++) {
      const r = sel[i], k = b.idx(D.rd[r]);
      if (k >= 0 && k < n) { v[k] += D.views[r]; vi[k] += D.visits[r]; }
    }
    return { b, v, vi };
  }

  /* ---------- Графіки (SVG без бібліотек) ---------- */
  function nice(m) {
    if (m <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(m))), f = m / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function lineChart(o) {
    const W = 720, H = o.h || 240, L = 44, R = 10, T = 10, B = 26, n = o.labels.length;
    if (!n) return '<div class="an-empty">Немає даних</div>';
    let mx = 0;
    o.series.forEach((s) => s.vals.forEach((v) => { if (v > mx) mx = v; }));
    mx = nice(mx);
    const step = n > 1 ? (W - L - R) / (n - 1) : W - L - R;
    const x = (i) => L + (n > 1 ? i * step : step / 2);
    const y = (v) => T + (H - T - B) * (1 - v / mx);
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const v = (mx * i) / 4, yy = y(v);
      g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#E6E0D3" stroke-width="1"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end">${num(v)}</text>`;
    }
    const every = Math.ceil(n / 8);
    for (let i = 0; i < n; i += every) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(o.labels[i])}</text>`;
    o.series.forEach((s) => {
      const pts = s.vals.map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1));
      if (s.area) g += `<path d="M${x(0)},${y(0)} L${pts.join(" L")} L${x(n - 1)},${y(0)} Z" fill="${s.color}" opacity=".13"/>`;
      g += `<polyline points="${pts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2}"${s.dash ? ' stroke-dasharray="5 4"' : ""} stroke-linejoin="round"/>`;
      if (n <= 45 && !s.dash) s.vals.forEach((v, i) => { g += `<circle cx="${x(i)}" cy="${y(v)}" r="2.5" fill="${s.color}"/>`; });
    });
    for (let i = 0; i < n; i++) {
      const tip = o.labels[i] === undefined ? "" : (o.tips ? o.tips[i] : o.labels[i]) + "\n" + o.series.map((s) => s.name + ": " + num(s.vals[i])).join("\n");
      g += `<rect class="hv" x="${x(i) - step / 2}" y="${T}" width="${step}" height="${H - T - B}" data-tip="${esc(tip)}"/>`;
    }
    return `<div class="an-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || "Графік")}">${g}</svg></div>` + legend(o.series);
  }
  const legend = (series) => '<div class="an-legend">' + series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("") + "</div>";
  function columnChart(o) {
    const W = 720, H = o.h || 180, L = 40, R = 6, T = 8, B = 24, n = o.vals.length;
    const mx = nice(Math.max.apply(null, o.vals.concat([0])));
    const bw = (W - L - R) / n, y = (v) => T + (H - T - B) * (1 - v / mx);
    let g = "";
    for (let i = 0; i <= 3; i++) { const v = (mx * i) / 3, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#E6E0D3"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end">${num(v)}</text>`; }
    o.vals.forEach((v, i) => {
      const hh = Math.max(0, y(0) - y(v));
      g += `<rect x="${L + i * bw + bw * 0.12}" y="${y(v)}" width="${bw * 0.76}" height="${hh}" rx="2" fill="${(o.colors && o.colors[i]) || o.color || PAL[0]}"/>`;
      if (!o.every || i % o.every === 0) g += `<text x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(o.labels[i])}</text>`;
      g += `<rect class="hv" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" data-tip="${esc((o.tips ? o.tips[i] : o.labels[i]) + "\n" + num(v))}"/>`;
    });
    return `<div class="an-chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
  }
  function donut(items, total) {
    total = total || items.reduce((a, b) => a + b.v, 0);
    if (!total) return '<div class="an-empty">Немає даних</div>';
    const r = 40, c = 2 * Math.PI * r;
    let off = 0, arcs = "";
    items.forEach((it) => {
      const len = (it.v / total) * c;
      arcs += `<circle cx="65" cy="65" r="${r}" fill="none" stroke="${it.color}" stroke-width="22" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 65 65)" data-tip="${esc(it.label + "\n" + num(it.v) + " · " + pc(it.v, total))}"/>`;
      off += len;
    });
    const lg = items.map((it) => `<div style="font-size:13px;display:flex;gap:8px;align-items:center"><i style="width:10px;height:10px;border-radius:2px;background:${it.color};display:inline-block"></i><span>${esc(it.label)}</span><b style="margin-left:auto;font-weight:600">${pc(it.v, total)}</b></div>`).join("");
    return `<div class="an-donut"><svg viewBox="0 0 130 130">${arcs}</svg><div style="flex:1;min-width:140px;display:grid;gap:4px">${lg}</div></div>`;
  }
  function spark(vals, color) {
    const n = vals.length, mx = Math.max.apply(null, vals.concat([1]));
    if (n < 2) return "";
    const pts = vals.map((v, i) => ((i / (n - 1)) * 100).toFixed(1) + "," + (44 - (v / mx) * 40).toFixed(1));
    return `<svg class="an-spark" viewBox="0 0 100 46" preserveAspectRatio="none"><polyline points="${pts.join(" ")}" fill="none" stroke="${color || PAL[0]}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  /* Горизонтальні смуги. items: [{label, sub, n, v, vi, prev, f:[facet, value], page, alt}] */
  function barList(items, o) {
    o = o || {};
    if (!items.length) return '<div class="an-empty">Немає даних</div>';
    const mx = Math.max.apply(null, items.map((i) => i.n)) || 1, total = o.total || 0;
    return '<div class="an-bars">' + items.map((it) => {
      const attr = it.f ? `data-fadd="${esc(it.f[0] + "|" + it.f[1])}"` : it.page ? `data-page="${esc(it.page)}"` : "";
      const name = attr ? `<button class="name" ${attr} title="${esc(it.title || it.label)}">${it.html || esc(it.label)}</button>` : `<span class="name" title="${esc(it.title || it.label)}">${it.html || esc(it.label)}</span>`;
      const d = C && C.hasPrev && it.prev != null ? " " + delta(it.n, it.prev) : "";
      return `<div class="an-bar">${name}<span class="num">${num(it.n)}${total ? "<small>" + pc(it.n, total) + "</small>" : ""}${d}</span><span class="track"><span class="fill${it.alt ? " alt" : ""}" style="width:${Math.max(1, (it.n / mx) * 100)}%"></span></span></div>`;
    }).join("") + "</div>";
  }
  function delta(c, p) {
    if (!C || !C.hasPrev) return "";
    if (!p) return c ? '<span class="up">нове</span>' : '<span class="flat">—</span>';
    const d = ((c - p) / p) * 100, a = Math.abs(d);
    const cls = a < 1 ? "flat" : d > 0 ? "up" : "down";
    return `<span class="${cls}">${a < 1 ? "≈" : d > 0 ? "▲" : "▼"} ${a < 10 ? dec(a) : Math.round(a)}%</span>`;
  }

  /* ---------- Таблиці з сортуванням, пошуком, «показати ще» і CSV ---------- */
  function table(id, cols, rows, o) {
    o = o || {};
    TBLS[id] = { cols, rows, o };
    if (!SORT[id]) SORT[id] = { k: o.sort || (cols.find((c) => !c.left) || cols[0]).k, dir: o.asc ? 1 : -1 };
    if (!LIMIT[id]) LIMIT[id] = o.limit || 15;
    if (TSEARCH[id] == null) TSEARCH[id] = "";
    const tools = (o.search ? `<input type="search" placeholder="Пошук…" data-tsearch="${id}" value="${esc(TSEARCH[id])}" style="min-width:200px">` : "") + `<button class="an-btn ghost sm" type="button" data-csv="${id}">CSV</button>`;
    return `<div class="an-sel" style="justify-content:flex-end;margin-bottom:8px">${tools}</div><div data-tin="${id}">${tableInner(id)}</div>`;
  }
  function tableRows(id) {
    const t = TBLS[id], q = (TSEARCH[id] || "").toLowerCase().trim(), s = SORT[id], col = t.cols.find((c) => c.k === s.k) || t.cols[0];
    let rows = t.rows;
    if (q && t.o.text) rows = rows.filter((r) => t.o.text(r).toLowerCase().indexOf(q) >= 0);
    const val = (r) => (col.num ? col.num(r) : String(col.text ? col.text(r) : ""));
    const dec2 = rows.map((r) => [val(r), r]);
    dec2.sort((a, b) => (typeof a[0] === "number" ? a[0] - b[0] : COLL.compare(a[0], b[0])) * s.dir);
    return dec2.map((x) => x[1]);
  }
  function tableInner(id) {
    const t = TBLS[id], s = SORT[id], all = tableRows(id), rows = all.slice(0, LIMIT[id]);
    EXPORT[id] = { head: t.cols.map((c) => c.label), rows: all.map((r) => t.cols.map((c) => (c.csv ? c.csv(r) : c.num ? Math.round(c.num(r) * 100) / 100 : c.text ? c.text(r) : ""))) };
    if (!all.length) return '<div class="an-empty">Нічого не знайдено</div>';
    const head = t.cols.map((c) => `<th class="${c.left ? "l" : ""}${s.k === c.k ? " on" + (s.dir > 0 ? " asc" : "") : ""}" data-sort="${id}|${c.k}">${esc(c.label)}</th>`).join("");
    const body = rows.map((r) => "<tr>" + t.cols.map((c) => `<td class="${c.left ? "l" : ""}">${c.html ? c.html(r) : c.num ? num(c.num(r)) : esc(c.text(r))}</td>`).join("") + "</tr>").join("");
    const more = all.length > rows.length ? `<div class="an-more"><button class="an-btn ghost sm" type="button" data-more="${id}">Показати ще (${all.length - rows.length})</button></div>` : "";
    return `<div class="an-scroll"><table class="an-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${more}`;
  }
  function refreshTable(id) {
    const el = $(`[data-tin="${id}"]`);
    if (el && TBLS[id]) el.innerHTML = tableInner(id);
  }
  function downloadCsv(id) {
    const e = EXPORT[id];
    if (!e) return;
    const q = (v) => { v = v == null ? "" : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const text = "﻿" + [e.head].concat(e.rows).map((r) => r.map(q).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = "krzhv-" + id + "-" + diso(C ? C.r0 : 0) + "_" + diso(C ? C.r1 : 0) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- Підписи значень фасетів ---------- */
  function facLabel(k, v) {
    switch (k) {
      case "country": return flag(v) + " " + cname(v);
      case "device": return DEV[v] != null ? DEV[v] : v;
      case "cat": return CATL[v] || v;
      case "nav": return NAV[v] != null ? NAV[v] : v;
      case "path": case "rpath": return v === "" ? "(не визначено)" : titleOf(v);
      default: return v === "" ? "(не визначено)" : v;
    }
  }

  /* ---------- Панель фільтрів ---------- */
  function initFilters() {
    const el = $("#anFilters");
    el.innerHTML = '<div class="an-row" id="anRowTop"></div><div class="an-row" id="anRowFac"><span class="lbl">Фільтри</span>' +
      FACETS.filter((f) => D.has[f.col] || f.k === "cat" || f.k === "src").map((f) =>
        `<details class="an-fac" data-fac="${f.k}"><summary>${f.label}</summary><div class="an-pop"><input type="search" placeholder="Пошук…" data-fsearch="${f.k}"><div class="list" data-flist="${f.k}"></div><div class="foot"><label class="an-chk"><input type="checkbox" data-fex="${f.k}"> виключити вибране</label><button class="an-link" data-fclear="${f.k}" type="button">скинути</button></div></div></details>`).join("") +
      '</div><div class="an-row" id="anRowChips"></div>';
  }
  function renderFilters() {
    const seg = (items, cur, attr) => '<div class="an-seg">' + items.map((i) => `<button type="button" class="${i[0] === cur ? "on" : ""}" ${attr}="${i[0]}">${i[1]}</button>`).join("") + "</div>";
    const maxLen = D.d1 - D.d0 + 1;
    let top = '<span class="lbl">Період</span>' + seg([["7", "7 днів"], ["30", "30"], ["90", "90"], ["180", "180"], ["all", "Весь"], ["custom", "Свій"]], S.p, "data-p");
    if (S.p === "custom") {
      const [a, b] = range();
      top += `<input type="date" data-date="from" value="${diso(a)}" min="${diso(D.d0)}" max="${diso(D.d1)}"> — <input type="date" data-date="to" value="${diso(b)}" min="${diso(D.d0)}" max="${diso(D.d1)}">`;
    }
    top += '<span class="lbl" style="margin-left:12px;min-width:0">Крок</span>' + seg([["auto", "авто"], ["day", "день"], ["week", "тиждень"], ["month", "місяць"]], S.gran, "data-gran");
    top += '<span class="lbl" style="margin-left:12px;min-width:0">Рахувати</span>' + seg([["views", "перегляди"], ["visits", "візити"]], S.metric, "data-metric");
    top += `<label class="an-chk" style="margin-left:12px"><input type="checkbox" data-opt="cmp" ${S.cmp ? "checked" : ""}> порівняти з попереднім</label>`;
    top += `<label class="an-chk"><input type="checkbox" data-opt="exSecret" ${S.exSecret ? "checked" : ""}> без /secret/</label>`;
    top += `<button class="an-link" type="button" data-resetall style="margin-left:auto">скинути все</button>`;
    $("#anRowTop").innerHTML = top;
    void maxLen;
    // Підписи фасетів
    FACETS.forEach((f) => {
      const d = $(`[data-fac="${f.k}"]`);
      if (!d) return;
      const st = S.f[f.k];
      d.classList.toggle("has", st.sel.length > 0);
      $("summary", d).textContent = f.label + (st.sel.length ? (st.ex ? ": не " : ": ") + (st.sel.length === 1 ? facLabel(f.k, st.sel[0]) : st.sel.length) : "");
      const ex = $(`[data-fex="${f.k}"]`, d);
      if (ex) ex.checked = st.ex;
    });
    // Чипи
    let chips = "";
    FACETS.forEach((f) => S.f[f.k].sel.forEach((v) => {
      chips += `<span class="an-chip${S.f[f.k].ex ? " ex" : ""}">${esc(f.label)}: ${S.f[f.k].ex ? "не " : ""}${esc(facLabel(f.k, v))}<button type="button" data-chip="${esc(f.k + "|" + v)}" aria-label="Прибрати">×</button></span>`;
    }));
    $("#anRowChips").innerHTML = chips ? '<span class="lbl">Активні</span><div class="an-chips">' + chips + "</div>" : "";
  }
  function fillFacet(k) {
    const f = FAC[k], box = $(`[data-flist="${k}"]`);
    if (!box) return;
    const q = ($(`[data-fsearch="${k}"]`).value || "").toLowerCase().trim();
    const m = tallyF(select(C.r0, C.r1, k), f), st = S.f[k];
    const items = Array.from(m, ([v, p]) => ({ v, n: p[C.M] || p[0] }));
    st.sel.forEach((v) => { if (!m.has(v)) items.push({ v, n: 0 }); });
    const list = items.filter((i) => !q || facLabel(k, i.v).toLowerCase().indexOf(q) >= 0 || String(i.v).toLowerCase().indexOf(q) >= 0)
      .sort((a, b) => b.n - a.n).slice(0, 150);
    box.innerHTML = list.length ? list.map((i) =>
      `<label title="${esc(i.v)}"><input type="checkbox" data-fk="${k}" data-fv="${esc(i.v)}" ${st.sel.indexOf(i.v) >= 0 ? "checked" : ""}><span class="t">${esc(facLabel(k, i.v))}</span><span class="c">${num(i.n)}</span></label>`).join("") : '<div class="an-empty">Немає значень</div>';
  }

  /* ---------- Рендер ---------- */
  function renderTabs() {
    $("#anTabs").innerHTML = AN.tabs.map((t) => `<button type="button" role="tab" class="${t.id === S.tab ? "on" : ""}" data-tab="${t.id}">${t.label}</button>`).join("");
  }
  function renderBanner() {
    const rs = D.raw, parts = [];
    if (D.demo) parts.push('<div class="an-demo">ДЕМО-ДАНІ: це згенерований приклад, а не справжня статистика сайту.</div>');
    if (rs.warnings && rs.warnings.length) parts.push('<div class="an-warn"><b>Попередження збірки:</b><ul style="margin:6px 0 0 18px">' + rs.warnings.map((w) => "<li>" + esc(w) + "</li>").join("") + "</ul></div>");
    if (!D.n && !D.demo) parts.push('<div class="an-warn">Cloudflare поки не повернув жодного рядка. Якщо Web Analytics увімкнено недавно, дані з\'являться за годину-дві; інакше відкрийте в GitHub → Actions останній запуск → крок «Fetch analytics snapshot»: там видно, які сайти знайдено в акаунті Cloudflare.</div>');
    $("#anBanner").innerHTML = parts.join("");
    const g = new Date(D.gen);
    $("#anFresh").textContent = "Знімок: " + dstr(kparts(D.gen).day) + " " + pad(g.getHours()) + ":" + pad(g.getMinutes()) +
      " · охоплено " + dstr(D.d0) + " — " + dstr(D.d1) + (rs.sampleInterval && rs.sampleInterval > 1.05 ? " · вибірка ≈ 1 з " + dec(rs.sampleInterval, 0) : "");
  }
  function render() {
    ctx();
    renderFilters();
    renderTabs();
    const t = AN.tabs.find((x) => x.id === S.tab) || AN.tabs[0];
    $("#anBody").innerHTML = D.n || D.demo ? t.render(C) : '<div class="an-empty">Даних ще немає.</div>';
    saveHash();
    const open = $(".an-fac[open]");
    if (open) fillFacet(open.dataset.fac);
  }

  /* ---------- Події ---------- */
  const tip = document.createElement("div");
  tip.className = "an-tip";
  document.body.appendChild(tip);
  function onTip(ev) {
    const t = ev.target.closest && ev.target.closest("[data-tip]");
    if (!t) { tip.classList.remove("show"); return; }
    tip.textContent = t.getAttribute("data-tip");
    tip.style.left = Math.min(window.innerWidth - 90, Math.max(90, ev.clientX)) + "px";
    tip.style.top = ev.clientY - 12 + "px";
    tip.classList.add("show");
  }
  function addFilter(k, v) {
    const st = S.f[k];
    if (st.sel.indexOf(v) < 0) st.sel.push(v);
    render();
  }
  function bind() {
    const app = $("#anApp");
    app.addEventListener("mouseover", onTip); app.addEventListener("mousemove", onTip);
    app.addEventListener("mouseleave", () => tip.classList.remove("show"));
    app.addEventListener("click", (ev) => {
      const t = ev.target.closest("button, [data-fadd], [data-page], summary");
      if (!t) return;
      const ds = t.dataset;
      if (ds.p) { S.p = ds.p; render(); }
      else if (ds.gran) { S.gran = ds.gran; render(); }
      else if (ds.metric) { S.metric = ds.metric; render(); }
      else if (ds.tab) { S.tab = ds.tab; render(); window.scrollTo({ top: $("#anTabs").offsetTop - 80 }); }
      else if (ds.chip) { const i = ds.chip.indexOf("|"), k = ds.chip.slice(0, i), v = ds.chip.slice(i + 1); S.f[k].sel = S.f[k].sel.filter((x) => x !== v); render(); }
      else if (ds.fclear) { S.f[ds.fclear] = { sel: [], ex: false }; render(); }
      else if (ds.fadd) { const i = ds.fadd.indexOf("|"); addFilter(ds.fadd.slice(0, i), ds.fadd.slice(i + 1)); }
      else if (ds.page != null && ds.page !== "") { S.page = ds.page; render(); const x = $("#anPageBox"); if (x) x.scrollIntoView({ behavior: "smooth", block: "start" }); }
      else if (ds.pageclear != null) { S.page = ""; render(); }
      else if (ds.resetall != null) { const keep = S.tab; S = newState(); S.tab = keep; render(); }
      else if (ds.sort) { const [id, k] = ds.sort.split("|"), s = SORT[id]; SORT[id] = s.k === k ? { k, dir: -s.dir } : { k, dir: -1 }; refreshTable(id); }
      else if (ds.more) { LIMIT[ds.more] += 25; refreshTable(ds.more); }
      else if (ds.csv) downloadCsv(ds.csv);
      else if (ds.act && AN.fn[ds.act]) AN.fn[ds.act](t);
    });
    app.addEventListener("change", (ev) => {
      const t = ev.target, ds = t.dataset;
      if (ds.date) {
        S.p = "custom";
        if (!S.from) { const [a, b] = range(); S.from = diso(a); S.to = diso(b); }
        S[ds.date] = t.value; render();
      } else if (ds.opt) { S[ds.opt] = t.checked; render(); }
      else if (ds.fex) { S.f[ds.fex].ex = t.checked; render(); }
      else if (ds.fk) {
        const st = S.f[ds.fk], v = t.getAttribute("data-fv"), i = st.sel.indexOf(v);
        if (t.checked && i < 0) st.sel.push(v); else if (!t.checked && i >= 0) st.sel.splice(i, 1);
        render();
      } else if (ds.pagepick != null) { S.page = normPath(t.value.trim()); render(); }
      else if (ds.act && AN.fn[ds.act]) AN.fn[ds.act](t);
    });
    app.addEventListener("input", (ev) => {
      const t = ev.target, ds = t.dataset;
      if (ds.fsearch) fillFacet(ds.fsearch);
      else if (ds.tsearch) { TSEARCH[ds.tsearch] = t.value; LIMIT[ds.tsearch] = TBLS[ds.tsearch].o.limit || 15; refreshTable(ds.tsearch); }
    });
    app.addEventListener("toggle", (ev) => {
      const d = ev.target;
      if (!d.classList || !d.classList.contains("an-fac") || !d.open) return;
      $$(".an-fac[open]").forEach((o) => { if (o !== d) o.open = false; });
      fillFacet(d.dataset.fac);
    }, true);
    document.addEventListener("click", (ev) => { if (!ev.target.closest(".an-fac")) $$(".an-fac[open]").forEach((o) => (o.open = false)); });
    $("#anOut").addEventListener("click", () => { K.logout(); location.reload(); });
    $("#anReload").addEventListener("click", () => { load(); });
  }

  /* ---------- Завантаження ---------- */
  async function fetchSnapshot(key) {
    const r = await fetch("/secret/analytics/data.json?" + Date.now(), { cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("Сервер відповів HTTP " + r.status);
    let blob;
    try { blob = await r.json(); } catch (e) { return null; }
    if (!blob || !blob.ct) return null;
    const b = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    let buf;
    try { buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b(blob.iv) }, key, b(blob.ct)); }
    catch (e) { throw new Error("Не вдалося розшифрувати знімок: секрет SECRET_PASSWORD у GitHub має збігатися з паролем розділу /secret/."); }
    if (blob.z === "gzip") {
      if (typeof DecompressionStream === "undefined") throw new Error("Цей браузер не вміє розпаковувати дані (DecompressionStream). Оновіть його.");
      const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
      return JSON.parse(await new Response(stream).text());
    }
    return JSON.parse(new TextDecoder().decode(buf));
  }
  function showSetup(msg) {
    $("#anApp").hidden = true;
    const el = $("#anSetup");
    el.hidden = false;
    el.innerHTML = (msg ? `<div class="an-warn">${esc(msg)}</div>` : "") +
      `<h3 style="font:400 20px var(--serif);margin:0 0 6px">Статистика ще не підключена</h3>
      <p class="an-note">Знімок даних Cloudflare Web Analytics готується під час збірки сайту. Потрібно один раз додати три секрети:</p>
      <ol>
        <li>Cloudflare → <b>My Profile → API Tokens → Create Token → Custom</b>: дозвіл <b>Account · Account Analytics · Read</b>. Скопіюйте токен.</li>
        <li>Cloudflare → будь-який домен → правий стовпчик Overview → <b>Account ID</b>.</li>
        <li>GitHub → репозиторій → <b>Settings → Secrets and variables → Actions → New repository secret</b>: <code>CF_ANALYTICS_TOKEN</code> (токен), <code>CF_ACCOUNT_ID</code> (ID акаунта), <code>SECRET_PASSWORD</code> (той самий пароль, яким ви входите в /secret/).</li>
        <li>GitHub → <b>Actions → Deploy → Run workflow</b>. Далі знімок оновлюється щогодини автоматично.</li>
      </ol>
      <p style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center"><button class="an-btn" id="anDemo" type="button">Переглянути на демо-даних</button><button class="an-link" id="anOut2" type="button">Вийти</button></p>`;
    $("#anDemo").addEventListener("click", () => use(AN.demo(), true));
    $("#anOut2").addEventListener("click", () => { K.logout(); location.reload(); });
  }
  let bound = false;
  function use(payload, demo) {
    ingest(payload, demo);
    $("#anSetup").hidden = true;
    $("#anApp").hidden = false;
    if (!bound) { loadHash(); bound = true; bind(); }
    if (!AN.tabs.find((t) => t.id === S.tab)) S.tab = "overview";
    initFilters();
    renderBanner();
    render();
  }
  async function load() {
    const fresh = $("#anFresh");
    if (fresh) fresh.textContent = "Завантажую…";
    try {
      const p = await fetchSnapshot(KEY);
      if (!p) { if (!D || !D.demo) showSetup(); return; }
      use(p, false);
    } catch (e) { showSetup(e.message); }
  }
  async function start(key) {
    KEY = key;
    $("#anLogin").hidden = true;
    if (/[?&]demo\b/.test(location.search)) { use(AN.demo(), true); return; }
    await load();
  }
  async function boot() {
    $("#anForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = $("#anBtn"), msg = $("#anMsg");
      btn.disabled = true; msg.textContent = "Перевіряю…";
      try {
        const key = await K.login($("#anPw").value);
        if (!key) { msg.textContent = "Невірний пароль"; btn.disabled = false; return; }
        start(key);
      } catch (e) { msg.textContent = "Помилка: " + e.message; btn.disabled = false; }
    });
    const key = await K.savedKey();
    if (key) start(key);
    else { $("#anLogin").hidden = false; $("#anPw").focus(); }
  }

  Object.assign(AN.fn, {});
  Object.assign(AN, {
    $, $$, esc, num, pc, dec, pad, delta, PAL, DEV, NAV, CATL, CATC, MON, MONF, WD, FACETS, FAC,
    cname, flag, facLabel, titleOf, normPath, dstr, dshort, diso, kparts,
    select, tally, tallyF, tallyC, sum, top, series, buckets, granOf, nice,
    lineChart, columnChart, donut, spark, barList, table, refreshTable, ingest,
    S: () => S, D: () => D, C: () => C, TT: () => TT, render, boot,
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);
})();
