/*
  analytics-tabs.js — вкладки панелі /secret/analytics/ і генератор демо-даних.
  Залежить від analytics.js (глобальний AN).
*/
(function () {
  "use strict";
  const A = window.AN;
  const { esc, num, pc, dec, delta, PAL, DEV, NAV, CATL, CATC, WD, FAC, cname, flag, facLabel, titleOf,
    select, tally, tallyF, tallyC, sum, top, series, granOf, lineChart, columnChart, donut, spark, barList, table, dstr, dshort } = A;

  const sec = (title, sub, body, cls) => `<section class="an-card ${cls || ""}"><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ""}${body}</section>`;
  const mname = () => (A.S().metric === "visits" ? "візити" : "перегляди");
  const pageCell = (p) => `<button class="lnk" data-page="${esc(p)}">${esc(titleOf(p))}</button>${titleOf(p) !== p ? `<span class="p">${esc(p)}</span>` : ""}`;
  const pageItems = (m, n, prev, total) => top(m, n).map((x) => ({ label: titleOf(x.k), title: x.k, n: x.n, f: ["path", x.k], prev: prev ? (prev.get(x.k) || [0, 0])[A.C().M] : null }));

  function kpi(label, val, cur, prev, hint) {
    const C = A.C();
    const d = C.hasPrev && prev != null ? `<div class="d">${delta(cur, prev)} <span class="flat">vs попередній</span></div>` : `<div class="d flat">${hint || "&nbsp;"}</div>`;
    return `<div class="an-kpi"><div class="k">${label}</div><div class="v">${val}</div>${d}</div>`;
  }

  /* ---------- Огляд ---------- */
  function insights(C) {
    const D = A.D(), out = [];
    if (!C.tot[0]) return ["За вибраний період і фільтри даних немає."];
    const dv = C.hasPrev && C.ptot[0] ? ` (${delta(C.tot[0], C.ptot[0])} до попереднього періоду)` : "";
    out.push(`За <b>${C.len}</b> дн. — <b>${num(C.tot[0])}</b> переглядів і <b>${num(C.tot[1])}</b> візитів${dv}.`);
    const pg = top(tallyC(C.cur, "path"), 1, 0)[0];
    if (pg) out.push(`Найпопулярніша сторінка — <b>${esc(titleOf(pg.k))}</b>: ${pc(pg.n, C.tot[0])} усіх переглядів.`);
    const src = tallyF(C.cur, FAC.src);
    const ext = top(src, 0, 1).filter((x) => x.k !== "Цей сайт" && x.k !== "Прямі / невідомо");
    if (ext[0] && ext[0].n) out.push(`Головне зовнішнє джерело — <b>${esc(ext[0].k)}</b> (${num(ext[0].n)} візитів, ${pc(ext[0].n, C.tot[1])}).`);
    const dir = src.get("Прямі / невідомо");
    if (dir && C.tot[1]) out.push(`Прямі й невизначені заходи: ${pc(dir[1], C.tot[1])} візитів.`);
    const ctr = tallyC(C.cur, "country"), ua = (ctr.get("UA") || [0])[0];
    const foreign = top(ctr, 0, 0).filter((x) => x.k !== "UA" && x.k !== "");
    out.push(`З України — ${pc(ua, C.tot[0])} переглядів` + (foreign[0] ? `; найбільша інша країна — <b>${esc(flag(foreign[0].k) + " " + cname(foreign[0].k))}</b> (${pc(foreign[0].v, C.tot[0])}).` : "."));
    const dev = tallyC(C.cur, "device");
    if (dev.get("mobile")) out.push(`Зі смартфонів — ${pc(dev.get("mobile")[0], C.tot[0])}: перевіряйте, як виглядають нові сторінки на малому екрані.`);
    const daily = series(C.cur, C.r0, C.r1, "day");
    if (daily.v.length > 6) {
      const mx = Math.max.apply(null, daily.v), mean = daily.v.reduce((a, b) => a + b, 0) / daily.v.length;
      const sd = Math.sqrt(daily.v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / daily.v.length), i = daily.v.indexOf(mx);
      out.push(mx > mean + 2 * sd && mx > 20 ? `Помітний пік: <b>${esc(daily.b.list[i].tip)}</b> — ${num(mx)} переглядів (у середньому ${num(mean)} на день).` : `Найжвавіший день — <b>${esc(daily.b.list[i].tip)}</b> (${num(mx)} переглядів).`);
    }
    if (D.hourly) {
      const wd = new Array(7).fill(0), hr = new Array(24).fill(0);
      C.cur.forEach((r) => { wd[D.rw[r]] += D.views[r]; hr[D.rh[r]] += D.views[r]; });
      const bw = wd.indexOf(Math.max.apply(null, wd)), bh = hr.indexOf(Math.max.apply(null, hr));
      out.push(`Найактивніший день тижня — <b>${WD[bw]}</b>, година — <b>${A.pad(bh)}:00</b> (за київським часом).`);
    }
    if (C.hasPrev) {
      const a = tallyC(C.cur, "path"), b = tallyC(C.prev, "path");
      const diffs = Array.from(a, ([k, p]) => ({ k, d: p[0] - (b.get(k) || [0])[0], c: p[0] })).filter((x) => x.c >= 5);
      diffs.sort((x, y) => y.d - x.d);
      if (diffs[0] && diffs[0].d > 0) out.push(`Найбільше зросла: <b>${esc(titleOf(diffs[0].k))}</b> (+${num(diffs[0].d)} переглядів).`);
      const last = diffs[diffs.length - 1];
      if (last && last.d < 0 && last !== diffs[0]) out.push(`Найбільше просіла: <b>${esc(titleOf(last.k))}</b> (${num(last.d)} переглядів).`);
    }
    if (C.tot[1]) out.push(`У середньому <b>${dec(C.tot[0] / C.tot[1])}</b> перегляду на візит (чим більше, тим глибше читають).`);
    return out;
  }

  function overview(C) {
    const D = A.D(), S = A.S();
    const ctr = tallyC(C.cur, "country"), pctr = tallyC(C.prev, "country");
    const ctrN = Array.from(ctr.values()).filter((p) => p[0] > 0).length;
    const ua = (ctr.get("UA") || [0])[0], pua = (pctr.get("UA") || [0])[0];
    const dev = tallyC(C.cur, "device"), mob = (dev.get("mobile") || [0])[0];
    const kp = [
      kpi("Перегляди", num(C.tot[0]), C.tot[0], C.ptot[0]),
      kpi("Візити", num(C.tot[1]), C.tot[1], C.ptot[1]),
      kpi("Переглядів на візит", C.tot[1] ? dec(C.tot[0] / C.tot[1]) : "—", C.tot[1] ? C.tot[0] / C.tot[1] : 0, C.ptot[1] ? C.ptot[0] / C.ptot[1] : 0),
      kpi("Країн", num(ctrN), ctrN, Array.from(pctr.values()).filter((p) => p[0] > 0).length),
      kpi("Не з України", pc(C.tot[0] - ua, C.tot[0]), C.tot[0] - ua, C.ptot[0] - pua),
      kpi("Зі смартфонів", pc(mob, C.tot[0]), mob, C.hasPrev ? (tallyC(C.prev, "device").get("mobile") || [0])[0] : 0),
    ].join("");
    const gran = granOf(C.len), cur = series(C.cur, C.r0, C.r1, gran);
    const ser = [{ name: "Перегляди", color: PAL[0], vals: cur.v, area: true }, { name: "Візити", color: PAL[1], vals: cur.vi }];
    if (C.hasPrev) {
      const pv = series(C.prev, C.pr0, C.pr1, gran), n = cur.v.length;
      ser.push({ name: "Перегляди, попередній період", color: PAL[7], vals: pv.v.slice(0, n), dash: true, w: 1.5 });
    }
    const chart = lineChart({ labels: cur.b.list.map((x) => x.label), tips: cur.b.list.map((x) => x.tip), series: ser, title: "Динаміка відвідувань" });
    const pages = tallyC(C.cur, "path"), ppages = tallyC(C.prev, "path");
    const srcAll = tallyF(C.cur, FAC.src), psrc = tallyF(C.prev, FAC.src);
    const srcItems = top(srcAll, 8).map((x) => ({ label: x.k, n: x.n, f: ["src", x.k], prev: (psrc.get(x.k) || [0, 0])[C.M], alt: x.k === "Цей сайт" }));
    const ctrItems = top(ctr, 8).map((x) => ({ label: flag(x.k) + " " + cname(x.k), n: x.n, f: ["country", x.k], prev: (pctr.get(x.k) || [0, 0])[C.M] }));
    const devItems = top(dev, 0, 0).map((x, i) => ({ label: facLabel("device", x.k), v: x.v, color: PAL[i % PAL.length] }));
    const catItems = top(tallyF(C.cur, FAC.cat), 0, 0).map((x) => ({ label: CATL[x.k] || x.k, v: x.v, color: CATC[x.k] || PAL[7] }));
    void D; void S;
    return `<div class="an-kpis">${kp}</div>` +
      `<div class="an-grid two">${sec("Динаміка", "Перегляди й візити · крок: " + { day: "день", week: "тиждень", month: "місяць" }[gran], chart)}` +
      sec("Висновки", "Формуються автоматично з поточних даних і фільтрів", '<ul class="an-ins">' + insights(C).map((x) => "<li>" + x + "</li>").join("") + "</ul>") + "</div>" +
      `<div class="an-grid">${sec("Топ сторінок", mname() + " · клік додає фільтр", barList(pageItems(pages, 8, ppages), { total: C.tot[C.M] }))}` +
      sec("Джерела", mname() + " · «Цей сайт» — переходи всередині сайту", barList(srcItems, { total: C.tot[C.M] })) +
      sec("Країни", mname(), barList(ctrItems, { total: C.tot[C.M] })) + "</div>" +
      `<div class="an-grid">${sec("Типи джерел", "перегляди", donut(catItems))}${sec("Пристрої", "перегляди", donut(devItems))}</div>`;
  }

  /* ---------- Сторінки ---------- */
  function pageExplorer(C) {
    const S = A.S(), D = A.D(), pg = S.page;
    if (!pg) return "";
    const base = select(C.r0, C.r1, "path"), pc0 = D.c.path, dp = D.dict.path;
    const rows = base.filter((r) => dp[pc0[r]] === pg);
    const t = sum(rows);
    const rp = D.c.refPath, drp = D.dict.refPath, rh = D.c.refHost, srcOf = (r) => D.src[D.dict.refHost[rh[r]]];
    const inExt = rows.filter((r) => srcOf(r).cat !== "internal");
    const inInt = rows.filter((r) => srcOf(r).cat === "internal");
    const outRows = base.filter((r) => drp[rp[r]] === pg && srcOf(r).cat === "internal" && dp[pc0[r]] !== pg);
    const gran = granOf(C.len), s = series(rows, C.r0, C.r1, gran);
    const ext = top(tally(inExt, (r) => srcOf(r).name), 8).map((x) => ({ label: x.k, n: x.n, f: ["src", x.k] }));
    const from = top(tally(inInt, (r) => drp[rp[r]]), 8).map((x) => ({ label: titleOf(x.k), title: x.k, n: x.n, page: x.k }));
    const to = top(tally(outRows, (r) => dp[pc0[r]]), 8).map((x) => ({ label: titleOf(x.k), title: x.k, n: x.n, page: x.k }));
    const ctr = top(tallyC(rows, "country"), 6).map((x) => ({ label: flag(x.k) + " " + cname(x.k), n: x.n }));
    const stay = sum(outRows)[0];
    return `<section class="an-card" id="anPageBox" style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h3>${esc(titleOf(pg))}</h3><div class="sub">${esc(pg)} · ${num(t[0])} переглядів, ${num(t[1])} візитів (входів на сайт через цю сторінку)</div></div><button class="an-btn ghost sm" type="button" data-pageclear="1">Закрити</button></div>` +
      lineChart({ labels: s.b.list.map((x) => x.label), tips: s.b.list.map((x) => x.tip), series: [{ name: "Перегляди", color: PAL[0], vals: s.v, area: true }, { name: "Входи", color: PAL[1], vals: s.vi }], h: 170 }) +
      `<div class="an-grid" style="margin:16px 0 0"><div><h3>Звідки прийшли</h3><div class="sub">зовнішні джерела</div>${barList(ext)}</div><div><h3>З яких сторінок сайту</h3><div class="sub">внутрішні переходи сюди</div>${barList(from)}</div><div><h3>Куди йдуть далі</h3><div class="sub">${num(stay)} переходів на інші сторінки</div>${barList(to)}</div></div>` +
      `<div class="an-grid" style="margin:16px 0 0"><div><h3>Країни</h3>${barList(ctr)}</div></div></section>`;
  }
  function sections(C) {
    const D = A.D(), m = tally(C.cur, (r) => { const p = D.dict.path[D.c.path[r]], x = p.split("/")[1]; return x ? "/" + x + "/" : "/"; });
    const names = { "/": "Головна та інше", "/statti/": "Статті", "/blog/": "Блог", "/kviz/": "Опитувальники" };
    return barList(top(m, 10).map((x) => ({ label: names[x.k] || x.k, title: x.k, n: x.n, alt: false })), { total: C.tot[C.M] });
  }
  function pages(C) {
    const D = A.D(), gran = granOf(C.len);
    const m = tallyC(C.cur, "path"), pm = tallyC(C.prev, "path"), tot = C.tot[0];
    const bk = A.buckets(C.r0, C.r1, gran), nb = bk.list.length, ser = new Map();
    C.cur.forEach((r) => {
      const p = D.dict.path[D.c.path[r]];
      let a = ser.get(p);
      if (!a) { a = new Array(nb).fill(0); ser.set(p, a); }
      const k = bk.idx(D.rd[r]);
      if (k >= 0 && k < nb) a[k] += D.views[r];
    });
    const rows = Array.from(m, ([k, p]) => ({ k, v: p[0], vi: p[1], pv: (pm.get(k) || [0, 0])[0] }));
    const cols = [
      { k: "page", label: "Сторінка", left: true, text: (r) => titleOf(r.k), html: (r) => pageCell(r.k), csv: (r) => r.k },
      { k: "v", label: "Перегляди", num: (r) => r.v },
      { k: "share", label: "Частка", num: (r) => r.v, html: (r) => pc(r.v, tot), csv: (r) => (tot ? Math.round((r.v / tot) * 1000) / 10 : 0) },
      { k: "vi", label: "Входи", num: (r) => r.vi },
      { k: "d", label: "Зміна", num: (r) => (r.pv ? (r.v - r.pv) / r.pv : r.v ? 9 : 0), html: (r) => (C.hasPrev ? delta(r.v, r.pv) : "—"), csv: (r) => r.pv },
      { k: "sp", label: "Тренд", num: (r) => 0, html: (r) => spark(ser.get(r.k) || []), csv: () => "" },
    ];
    return pageExplorer(C) +
      `<div class="an-grid two">${sec("Розділи сайту", mname(), sections(C))}` +
      sec("Як читати таблицю", "", `<p class="an-note">«Входи» — скільки разів сторінка була першою на візиті (відвідувач прийшов ззовні). «Зміна» — перегляди проти попереднього періоду. Клік по назві відкриває картку сторінки: звідки приходять, куди йдуть далі, країни. Заголовки колонок сортують таблицю.</p>`) + "</div>" +
      sec("Усі сторінки", "Знайдено сторінок: " + num(rows.length), table("pages", cols, rows, { search: true, text: (r) => titleOf(r.k) + " " + r.k, sort: "v", limit: 15 }));
  }

  /* ---------- Джерела ---------- */
  function sources(C) {
    const D = A.D(), S = A.S();
    const catM = tallyF(C.cur, FAC.cat), pcat = tallyF(C.prev, FAC.cat);
    const catItems = top(catM, 0, 0).map((x) => ({ label: CATL[x.k] || x.k, v: x.v, color: CATC[x.k] || PAL[7] }));
    const catBars = top(catM, 0).map((x) => ({ label: CATL[x.k] || x.k, n: x.n, f: ["cat", x.k], prev: (pcat.get(x.k) || [0, 0])[C.M], alt: x.k === "internal" }));
    // Динаміка типів джерел
    const gran = granOf(C.len), cats = top(catM, 4, 0).map((x) => x.k), vf = A.FAC.cat, v = (function () { const dd = D.dict.refHost; return dd.map((h) => D.src[h].cat); })();
    const sers = cats.map((c, i) => {
      const rows = C.cur.filter((r) => v[D.c.refHost[r]] === c), s = series(rows, C.r0, C.r1, gran);
      return { name: CATL[c] || c, color: CATC[c] || PAL[i], vals: s.v };
    });
    const base = series([], C.r0, C.r1, gran);
    void vf; void S;
    const trend = lineChart({ labels: base.b.list.map((x) => x.label), tips: base.b.list.map((x) => x.tip), series: sers, title: "Типи джерел у часі" });
    // Таблиця джерел (без внутрішніх)
    const sm = tallyF(C.cur, FAC.src), psm = tallyF(C.prev, FAC.src), catOf = {};
    Object.keys(D.src).forEach((h) => { catOf[D.src[h].name] = D.src[h].cat; });
    const ext = Array.from(sm, ([k, p]) => ({ k, v: p[0], vi: p[1], pv: (psm.get(k) || [0, 0])[C.M === 1 ? 1 : 0], cat: catOf[k] })).filter((r) => r.cat !== "internal");
    const tv = ext.reduce((a, r) => a + r.v, 0);
    const cols = [
      { k: "k", label: "Джерело", left: true, text: (r) => r.k, html: (r) => `<button class="lnk" data-fadd="${esc("src|" + r.k)}">${esc(r.k)}</button><span class="p">${esc(CATL[r.cat] || "")}</span>`, csv: (r) => r.k },
      { k: "vi", label: "Візити", num: (r) => r.vi },
      { k: "v", label: "Перегляди", num: (r) => r.v },
      { k: "sh", label: "Частка", num: (r) => r.v, html: (r) => pc(r.v, tv), csv: (r) => (tv ? Math.round((r.v / tv) * 1000) / 10 : 0) },
      { k: "d", label: "Зміна", num: (r) => (r.pv ? ((C.M ? r.vi : r.v) - r.pv) / r.pv : 9), html: (r) => delta(C.M ? r.vi : r.v, r.pv), csv: (r) => r.pv },
    ];
    // Джерело → сторінка входу
    const pairM = tally(C.cur.filter((r) => D.src[D.dict.refHost[D.c.refHost[r]]].cat !== "internal"), (r) => D.src[D.dict.refHost[D.c.refHost[r]]].name + "\u0001" + D.dict.path[D.c.path[r]]);
    const pairs = Array.from(pairM, ([k, p]) => { const i = k.indexOf("\u0001"); return { s: k.slice(0, i), p: k.slice(i + 1), v: p[0], vi: p[1] }; });
    const pcols = [
      { k: "s", label: "Джерело", left: true, text: (r) => r.s, html: (r) => esc(r.s) },
      { k: "p", label: "Сторінка входу", left: true, text: (r) => titleOf(r.p), html: (r) => pageCell(r.p), csv: (r) => r.p },
      { k: "vi", label: "Візити", num: (r) => r.vi },
      { k: "v", label: "Перегляди", num: (r) => r.v },
    ];
    const hostM = tally(C.cur.filter((r) => D.src[D.dict.refHost[D.c.refHost[r]]].cat !== "internal" && D.dict.refHost[D.c.refHost[r]] !== ""), (r) => D.dict.refHost[D.c.refHost[r]]);
    const hosts = top(hostM, 12).map((x) => ({ label: x.k, n: x.n }));
    const ai = top(tally(C.cur.filter((r) => D.src[D.dict.refHost[D.c.refHost[r]]].cat === "ai"), (r) => D.src[D.dict.refHost[D.c.refHost[r]]].name), 6).map((x) => ({ label: x.k, n: x.n, f: ["src", x.k] }));
    return `<div class="an-grid two">${sec("Типи джерел", "перегляди", donut(catItems))}${sec("Типи джерел: клік додає фільтр", mname(), barList(catBars, { total: C.tot[C.M] }))}</div>` +
      sec("Типи джерел у часі", "перегляди", trend) +
      `<div class="an-grid" style="margin-top:20px">${sec("Домени-реферери", "точні хости без підсумовування за брендом", barList(hosts))}${sec("ШІ-асистенти", "переходи з ChatGPT, Claude, Perplexity тощо", ai.length ? barList(ai) : '<div class="an-empty">Поки не було</div>')}</div>` +
      sec("Усі джерела", "без внутрішніх переходів · «Прямі» — без реферера (закладки, месенджери, застосунки)", table("sources", cols, ext, { sort: C.M ? "vi" : "v", limit: 15 }), "") +
      '<div style="height:20px"></div>' +
      sec("Джерело → сторінка входу", "Звідки люди приходять і куди саме потрапляють", table("srcpages", pcols, pairs, { sort: C.M ? "vi" : "v", search: true, text: (r) => r.s + " " + titleOf(r.p) + " " + r.p, limit: 15 }));
  }

  /* ---------- Аудиторія ---------- */
  function audience(C) {
    const ctr = tallyC(C.cur, "country"), pctr = tallyC(C.prev, "country");
    const cItems = top(ctr, 15).map((x) => ({ label: flag(x.k) + " " + cname(x.k), n: x.n, f: ["country", x.k], prev: (pctr.get(x.k) || [0, 0])[C.M] }));
    const rows = Array.from(ctr, ([k, p]) => ({ k, v: p[0], vi: p[1], pv: (pctr.get(k) || [0, 0])[0] }));
    const cols = [
      { k: "k", label: "Країна", left: true, text: (r) => cname(r.k), html: (r) => `<button class="lnk" data-fadd="${esc("country|" + r.k)}">${esc(flag(r.k) + " " + cname(r.k))}</button>`, csv: (r) => r.k + " " + cname(r.k) },
      { k: "v", label: "Перегляди", num: (r) => r.v },
      { k: "vi", label: "Візити", num: (r) => r.vi },
      { k: "sh", label: "Частка", num: (r) => r.v, html: (r) => pc(r.v, C.tot[0]), csv: (r) => (C.tot[0] ? Math.round((r.v / C.tot[0]) * 1000) / 10 : 0) },
      { k: "d", label: "Зміна", num: (r) => (r.pv ? (r.v - r.pv) / r.pv : 9), html: (r) => delta(r.v, r.pv), csv: (r) => r.pv },
    ];
    const fresh = C.hasPrev ? rows.filter((r) => !r.pv && r.v && r.k).sort((a, b) => b.v - a.v).slice(0, 8) : [];
    const simple = (col, label, mapLabel, fk) => barList(top(tallyC(C.cur, col), 10).map((x) => ({ label: mapLabel ? mapLabel(x.k) : x.k || "(не визначено)", n: x.n, f: fk ? [fk, x.k] : null })), { total: C.tot[C.M] });
    const dev = top(tallyC(C.cur, "device"), 0, 0).map((x, i) => ({ label: facLabel("device", x.k), v: x.v, color: PAL[i % PAL.length] }));
    return `<div class="an-grid two">${sec("Країни", mname(), barList(cItems, { total: C.tot[C.M] }))}${sec("Пристрої", "перегляди", donut(dev))}</div>` +
      `<div class="an-grid">${sec("Браузери", mname(), simple("browser", "", null, "browser"))}${sec("Операційні системи", mname(), simple("os", "", null, "os"))}${sec("Тип переходу", "як відкрито сторінку", simple("nav", "", (v) => facLabel("nav", v), "nav"))}</div>` +
      (C.hasPrev ? sec("Нові країни", "були відсутні в попередньому періоді", fresh.length ? barList(fresh.map((x) => ({ label: flag(x.k) + " " + cname(x.k), n: x.v, f: ["country", x.k] }))) : '<div class="an-empty">Нових країн немає</div>') + '<div style="height:20px"></div>' : "") +
      sec("Усі країни", "Зміна — перегляди проти попереднього періоду", table("countries", cols, rows, { sort: "v", limit: 15 }));
  }

  /* ---------- Шляхи ---------- */
  function sankey(pairs) {
    const W = 720, LX = 210, RX = 500, NW = 10, PADY = 6;
    if (!pairs.length) return '<div class="an-empty">Внутрішніх переходів у цій вибірці немає</div>';
    const ls = new Map(), rs = new Map();
    pairs.forEach((p) => { ls.set(p.a, (ls.get(p.a) || 0) + p.n); rs.set(p.b, (rs.get(p.b) || 0) + p.n); });
    const L = Array.from(ls, ([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n), R = Array.from(rs, ([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
    const total = pairs.reduce((a, b) => a + b.n, 0), rowsMax = Math.max(L.length, R.length), H = Math.max(280, rowsMax * 30);
    const scale = Math.min((H - (L.length - 1) * PADY) / total, (H - (R.length - 1) * PADY) / total);
    const place = (arr) => { let y = 0; arr.forEach((n) => { n.y = y; n.h = Math.max(2, n.n * scale); y += n.h + PADY; n.off = 0; }); };
    place(L); place(R);
    const lm = new Map(L.map((n) => [n.k, n])), rm = new Map(R.map((n) => [n.k, n]));
    const color = new Map(L.map((n, i) => [n.k, PAL[i % PAL.length]]));
    let svg = "";
    pairs.slice().sort((a, b) => lm.get(a.a).y - lm.get(b.a).y || rm.get(a.b).y - rm.get(b.b).y).forEach((p) => {
      const a = lm.get(p.a), b = rm.get(p.b), h = Math.max(1, p.n * scale), y0 = a.y + a.off, y1 = b.y + b.off, xm = (LX + NW + RX) / 2;
      a.off += h; b.off += h;
      svg += `<path d="M${LX + NW},${y0} C${xm},${y0} ${xm},${y1} ${RX},${y1} L${RX},${y1 + h} C${xm},${y1 + h} ${xm},${y0 + h} ${LX + NW},${y0 + h} Z" fill="${color.get(p.a)}" opacity=".32" data-tip="${esc(titleOf(p.a) + "\n→ " + titleOf(p.b) + "\n" + num(p.n))}"/>`;
    });
    const cut = (s) => (s.length > 30 ? s.slice(0, 29) + "…" : s);
    L.forEach((n) => { svg += `<g class="node" data-page="${esc(n.k)}"><rect x="${LX}" y="${n.y}" width="${NW}" height="${n.h}" fill="${color.get(n.k)}"/><text x="${LX - 6}" y="${n.y + Math.min(n.h, 14) / 2 + 4}" text-anchor="end">${esc(cut(titleOf(n.k)))}</text></g>`; });
    R.forEach((n) => { svg += `<g class="node" data-page="${esc(n.k)}"><rect x="${RX}" y="${n.y}" width="${NW}" height="${n.h}" fill="#3D5A4A"/><text x="${RX + NW + 6}" y="${n.y + Math.min(n.h, 14) / 2 + 4}">${esc(cut(titleOf(n.k)))}</text></g>`; });
    return `<div class="an-flow"><svg viewBox="0 0 ${W} ${H + 4}">${svg}</svg></div>`;
  }
  function flows(C) {
    const D = A.D(), S = A.S();
    const srcCat = (r) => D.src[D.dict.refHost[D.c.refHost[r]]].cat;
    const internal = C.cur.filter((r) => srcCat(r) === "internal" && D.dict.refPath[D.c.refPath[r]] !== "");
    const prevInt = C.prev.filter((r) => srcCat(r) === "internal" && D.dict.refPath[D.c.refPath[r]] !== "");
    const key = (r) => D.dict.refPath[D.c.refPath[r]] + "\u0001" + D.dict.path[D.c.path[r]];
    const pm = tally(internal, key), ppm = tally(prevInt, key);
    const all = Array.from(pm, ([k, p]) => { const i = k.indexOf("\u0001"); return { a: k.slice(0, i), b: k.slice(i + 1), v: p[0], pv: (ppm.get(k) || [0])[0] }; });
    const moves = all.filter((x) => x.a !== x.b), reloads = all.filter((x) => x.a === x.b).reduce((s, x) => s + x.v, 0);
    const topPairs = moves.slice().sort((a, b) => b.v - a.v).slice(0, 22).map((x) => ({ a: x.a, b: x.b, n: x.v }));
    const intViews = moves.reduce((s, x) => s + x.v, 0);
    const entry = top(tally(C.cur.filter((r) => srcCat(r) !== "internal"), (r) => D.dict.path[D.c.path[r]]), 10).map((x) => ({ label: titleOf(x.k), title: x.k, n: x.n, page: x.k }));
    const outM = new Map(), inM = new Map();
    moves.forEach((x) => { outM.set(x.a, (outM.get(x.a) || [0, 0])); outM.get(x.a)[0] += x.v; inM.set(x.b, (inM.get(x.b) || [0, 0])); inM.get(x.b)[0] += x.v; });
    const outI = top(outM, 8, 0).map((x) => ({ label: titleOf(x.k), title: x.k, n: x.n, page: x.k }));
    const inI = top(inM, 8, 0).map((x) => ({ label: titleOf(x.k), title: x.k, n: x.n, page: x.k }));
    const cols = [
      { k: "a", label: "Звідки", left: true, text: (r) => titleOf(r.a), html: (r) => pageCell(r.a), csv: (r) => r.a },
      { k: "b", label: "Куди", left: true, text: (r) => titleOf(r.b), html: (r) => pageCell(r.b), csv: (r) => r.b },
      { k: "v", label: "Переходи", num: (r) => r.v },
      { k: "d", label: "Зміна", num: (r) => (r.pv ? (r.v - r.pv) / r.pv : 9), html: (r) => delta(r.v, r.pv), csv: (r) => r.pv },
    ];
    const pages = Array.from(new Set(D.dict.path)).filter((p) => p && p.indexOf("/secret/") !== 0).sort();
    const picker = `<div class="an-sel"><label for="anPick" class="an-note">Картка сторінки:</label><input id="anPick" list="anPages" data-pagepick="1" placeholder="Почніть вводити адресу, напр. /statti/…" value="${esc(S.page)}"><datalist id="anPages">${pages.slice(0, 500).map((p) => `<option value="${esc(p)}">${esc(titleOf(p))}</option>`).join("")}</datalist></div>`;
    return `<div class="an-kpis">${kpi("Внутрішніх переходів", num(intViews), intViews, null)}${kpi("Частка від переглядів", pc(intViews, C.tot[0]), 0, null)}${kpi("Оновлень сторінки", num(reloads), 0, null, "перехід на ту саму сторінку")}${kpi("Пар «звідки → куди»", num(moves.length), 0, null)}</div>` +
      sec("Потоки між сторінками", "Ліворуч — звідки, праворуч — куди; ширина = кількість переходів. Клік по сторінці відкриває її картку.", sankey(topPairs)) +
      '<div style="height:20px"></div>' + picker + pageExplorer(C) +
      `<div class="an-grid">${sec("Точки входу", "куди потрапляють ззовні (візити)", barList(entry))}${sec("Звідки йдуть далі", "сторінки з найбільшим виходом на інші", barList(outI))}${sec("Куди приводять", "сторінки, на які найчастіше переходять зсередини", barList(inI))}</div>` +
      sec("Усі переходи", "Пари сторінок · дані лише про переходи всередині сайту", table("flows", cols, moves, { sort: "v", search: true, text: (r) => titleOf(r.a) + " " + r.a + " " + titleOf(r.b) + " " + r.b, limit: 15 })) +
      '<p class="an-note" style="margin-top:14px">Cloudflare Web Analytics не віддає тривалість перебування, час на сторінці та сторінки виходу — тільки агрегати за переходами. «Переглядів на візит» на вкладці «Огляд» — найближчий показник глибини.</p>';
  }

  /* ---------- Час ---------- */
  function time(C) {
    const D = A.D();
    if (!D.hourly) return sec("Час доби", "", '<div class="an-empty">У цьому знімку немає погодинної деталізації — Cloudflare повернув лише дні.</div>');
    const mat = Array.from({ length: 7 }, () => new Array(24).fill(0));
    C.cur.forEach((r) => { mat[D.rw[r]][D.rh[r]] += D.views[r]; });
    let mx = 0;
    mat.forEach((row) => row.forEach((v) => { if (v > mx) mx = v; }));
    let h = '<div class="an-heat"><span></span>' + Array.from({ length: 24 }, (_, i) => `<span class="h">${i % 3 === 0 ? i : ""}</span>`).join("");
    mat.forEach((row, d) => {
      h += `<span class="r">${WD[d]}</span>`;
      row.forEach((v, i) => { h += `<span class="c" style="background:${v ? `rgba(61,90,74,${(0.12 + 0.88 * (v / mx)).toFixed(2)})` : ""}" data-tip="${esc(WD[d] + ", " + A.pad(i) + ":00–" + A.pad(i) + ":59\n" + num(v) + " переглядів")}"></span>`; });
    });
    h += "</div>";
    const wd = mat.map((r) => r.reduce((a, b) => a + b, 0)), hr = Array.from({ length: 24 }, (_, i) => mat.reduce((a, r) => a + r[i], 0));
    const wdN = new Array(7).fill(0);
    for (let d = C.r0; d <= C.r1; d++) wdN[(((d + 3) % 7) + 7) % 7]++;
    const avg = wd.map((v, i) => (wdN[i] ? Math.round(v / wdN[i]) : 0));
    const mon = series(C.cur, C.r0, C.r1, "month");
    return sec("Коли заходять", "Перегляди за днем тижня й годиною · київський час", h) + '<div style="height:20px"></div>' +
      `<div class="an-grid two">${sec("За днями тижня", "середнє переглядів на день", columnChart({ labels: WD, vals: avg, color: PAL[0], tips: WD.map((d, i) => d + ": " + num(wd[i]) + " разом") }))}` +
      sec("За годинами", "усього переглядів", columnChart({ labels: hr.map((_, i) => A.pad(i)), vals: hr, color: PAL[1], every: 3 })) + "</div>" +
      '<div style="height:20px"></div>' + sec("За місяцями", "перегляди й візити", lineChart({ labels: mon.b.list.map((x) => x.label), tips: mon.b.list.map((x) => x.tip), series: [{ name: "Перегляди", color: PAL[0], vals: mon.v, area: true }, { name: "Візити", color: PAL[1], vals: mon.vi }], h: 200 }));
  }

  /* ---------- Швидкість (Core Web Vitals) ---------- */
  const VIT = [
    [/largestcontentful|lcp/i, "LCP · найбільший елемент", 2500, 4000, (v) => dec(v / 1000, 2) + " с"],
    [/interactiontonext|inp/i, "INP · відгук на дії", 200, 500, (v) => Math.round(v) + " мс"],
    [/cumulativelayout|cls/i, "CLS · стрибки макета", 0.1, 0.25, (v) => dec(v, 3)],
    [/firstcontentful|fcp/i, "FCP · перша поява", 1800, 3000, (v) => dec(v / 1000, 2) + " с"],
    [/timetofirstbyte|ttfb/i, "TTFB · відповідь сервера", 800, 1800, (v) => Math.round(v) + " мс"],
    [/firstinput|fid/i, "FID · перша взаємодія", 100, 300, (v) => Math.round(v) + " мс"],
  ];
  function speed() {
    const v = A.D().raw.vitals;
    if (!v || !v.rows || !v.rows.length) return sec("Швидкість сайту", "", '<p class="an-note">Cloudflare не віддав дані Core Web Vitals для цього токена/сайту, або вимірювань ще мало. Вони з\'являються, коли в Web Analytics увімкнено збір Web Vitals.</p>');
    const defs = v.fields.map((f) => VIT.find((d) => d[0].test(f)) || [null, f, 0, 0, (x) => dec(x, 2)]);
    const cell = (d, x) => { if (x == null) return "—"; const col = !d[2] ? "" : x <= d[2] ? "up" : x <= d[3] ? "flat" : "down"; return `<span class="${col}"><b>${d[4](x)}</b></span>`; };
    const cols = [{ k: "p", label: "Сторінка", left: true, text: (r) => titleOf(r[0]), html: (r) => pageCell(r[0]), csv: (r) => r[0] }, { k: "n", label: "Замірів", num: (r) => r[1] }]
      .concat(defs.map((d, i) => ({ k: "f" + i, label: d[1].split(" · ")[0] + " p75", num: (r) => +r[2 + i] || 0, html: (r) => cell(d, r[2 + i]), csv: (r) => r[2 + i] })));
    return sec("Core Web Vitals", `75-й перцентиль за ${v.days} днів. Зелений — добре, сірий — потребує уваги, червоний — погано (пороги Google).`, table("vitals", cols, v.rows, { sort: "n", limit: 20 })) +
      `<p class="an-note" style="margin-top:12px">${defs.map((d) => esc(d[1])).join(" · ")}</p>`;
  }

  /* ---------- Дані ---------- */
  function data(C) {
    const D = A.D(), raw = D.raw;
    const dc = (col, r) => D.dict[col][D.c[col][r]];
    const cols = [
      { k: "t", label: "Година", left: true, text: (r) => dc("t", r).replace("T", " ").replace(/:00Z$/, "Z") },
      { k: "page", label: "Сторінка", left: true, text: (r) => dc("path", r) },
      { k: "from", label: "Звідки", left: true, text: (r) => (dc("refHost", r) || "прямий") + dc("refPath", r) },
      { k: "ctr", label: "Країна", left: true, text: (r) => dc("country", r) },
      { k: "dev", label: "Пристрій", left: true, text: (r) => dc("device", r) },
      { k: "br", label: "Браузер", left: true, text: (r) => dc("browser", r) },
      { k: "os", label: "ОС", left: true, text: (r) => dc("os", r) },
      { k: "v", label: "Перегляди", num: (r) => D.views[r] },
      { k: "vi", label: "Візити", num: (r) => D.visits[r] },
    ];
    const info = `<table class="an-tbl"><tbody>
      <tr><td class="l">Знімок створено</td><td class="l">${esc(raw.generatedAt || "—")}</td></tr>
      <tr><td class="l">Охоплений період</td><td class="l">${dstr(D.d0)} — ${dstr(D.d1)} (${raw.days || "?"} дн.)</td></tr>
      <tr><td class="l">Рядків у знімку</td><td class="l">${num(D.n)}</td></tr>
      <tr><td class="l">Вибірка Cloudflare</td><td class="l">${raw.sampleInterval ? "≈ 1 з " + dec(raw.sampleInterval, 1) + " (значення вже перераховані на повний трафік)" : "не вказана"}</td></tr>
      <tr><td class="l">Хост</td><td class="l">${esc(raw.host || "")}</td></tr>
      <tr><td class="l">Виміри</td><td class="l">${esc((raw.cols || []).join(", "))}</td></tr></tbody></table>`;
    return sec("Про знімок", "Дані оновлюються під час кожного деплою та щогодини", info) + '<div style="height:20px"></div>' +
      sec("Сирі дані", "Агреговані рядки Cloudflare з урахуванням усіх фільтрів · CSV вивантажує всю вибірку, не лише видимі рядки", table("raw", cols, C.cur, { sort: "t", limit: 25 }));
  }

  /* ---------- Сервер (без JavaScript) ----------
     Дані — журнал запитів Cloudflare (scripts/edge-visitors.js): бачить і тих, у кого блокується лічильник Web Analytics.
     Боти й павуки відсіяні за правилами scripts/bot-rules.js; «підозріло» показано окремо й у «людей» не входить. */
  const KYIV = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const hourText = (t) => KYIV.format(new Date(t));
  function demoEdge() {
    const now = Date.now(), H = 36e5, h = (k) => new Date(Math.floor((now - k * H) / H) * H).toISOString().replace(/\.\d+Z$/, "Z");
    const R = (k, p, c, d, br, os, v, kd, nm, w, n, js) => [h(k), p, c, d, br, os, v, kd, nm, w, n, js];
    return { v: 1, from: h(24 * 14), to: h(0), kinds: { ai: "AI-боти й асистенти", search: "Пошукові роботи", tool: "Скрипти й бібліотеки", scanner: "Сканери безпеки й мережі", burst: "Хвилі запитів з одного пристрою" },
      summary: {}, rows: [
        R(3, "/statti/", "DE", "mobile", "Safari", "iOS", "h", "", "", "", 1, 1), R(3, "/", "DE", "mobile", "Safari", "iOS", "h", "", "", "", 1, 1), R(3, "/kviz/", "DE", "mobile", "Safari", "iOS", "h", "", "", "", 1, 1),
        R(9, "/statti/okr/", "UA", "desktop", "Edge", "Windows", "h", "", "", "", 2, 1), R(15, "/blog/", "PL", "mobile", "Chrome", "Android", "h", "", "", "", 1, 0),
        R(5, "/statti/fobii/", "US", "desktop", "Chrome", "Linux", "s", "", "", "Linux-десктоп", 1, 0),
        R(6, "/", "BE", "mobile", "Chrome", "Android", "s", "", "", "обхід сайту? 20 різних сторінок за годину з одного пристрою", 20, 0),
        R(2, "/", "US", "desktop", "Інший", "Інша", "b", "ai", "GPTBot", "відомий ai-боти й асистенти", 4, 0), R(4, "/", "US", "desktop", "Інший", "Інша", "b", "search", "bingbot", "відомий пошукові роботи", 6, 0),
        R(7, "/", "US", "desktop", "Інший", "Інша", "b", "tool", "curl", "відомий скрипти й бібліотеки", 2, 0), R(11, "/", "NL", "desktop", "Інший", "Інша", "b", "scanner", "censys", "відомий сканери безпеки й мережі", 3, 0),
      ] };
  }
  function server() {
    const D = A.D(), E = (D.raw && D.raw.edge) || (D.demo ? demoEdge() : null);
    const head = (extra) => sec("Серверні візити (без JavaScript)", "Журнал запитів Cloudflare: бачить і тих, у кого лічильник блокується", extra);
    if (!E || !E.rows) {
      return head('<div class="an-note">Серверних даних у знімку немає. Імовірна причина: токен <code>CF_ANALYTICS_TOKEN</code> без права <b>Zone → Analytics → Read</b> для зони сайту, або перевищено ліміт запитів Cloudflare (спробує наступний щогодинний знімок). Подробиці — у «Попередженнях збірки» вгорі та в README, розділ «Статистика відвідувань».</div>');
    }
    const rows = E.rows.map((r) => ({ t: r[0], ts: Date.parse(r[0]), p: r[1], c: r[2], d: r[3], br: r[4], os: r[5], v: r[6], k: r[7], nm: r[8], w: r[9], n: r[10], js: r[11] }));
    const by = { h: 0, s: 0, b: 0 };
    rows.forEach((r) => { by[r.v] += r.n; });
    const vis = new Set(rows.filter((r) => r.v === "h").map((r) => [r.t, r.c, r.d, r.br, r.os].join("|"))).size;
    // Лічильник JS за той самий період
    const from = Date.parse(E.from), tp = D.dict.t.map((x) => (x ? Date.parse(x) : 0));
    let rum = 0;
    for (let i = 0; i < D.n; i++) if (tp[D.c.t[i]] >= from) rum += D.views[i];
    const days = Math.max(1, Math.round((Date.parse(E.to) - from) / 864e5));
    const kp = (k, v, hint) => `<div class="an-kpi"><div class="k">${k}</div><div class="v">${num(v)}</div><div class="d flat">${hint || "&nbsp;"}</div></div>`;
    const kpis = '<div class="an-kpis">' + kp("Схожі на людей, перегляди", by.h, "сервер, без ботів") + kp("Візити (оцінка)", vis, "година · країна · пристрій") +
      kp("Лічильник JS, перегляди", Math.round(rum), by.h ? "бачить " + pc(Math.min(rum, by.h), by.h) + " людей" : "") + kp("Підозрілі", by.s, "окремо, не входять у «людей»") + kp("Боти й павуки", by.b, "відсіяно") + "</div>";
    const note = `<p class="an-note">За ${days} дн. сервер бачить <b>${num(by.h)}</b> переглядів, схожих на людські (${num(vis)} візитів за оцінкою). Лічильник Web Analytics зафіксував <b>${num(Math.round(rum))}</b>. Різниця — це відвідувачі, у яких лічильник заблоковано (блокувальники, режими приватності, VPN, швидке закриття сторінки). «Скрипти: так» означає, що пристрій завантажив скрипти сайту, тобто це майже напевно браузер людини.</p>`;
    const mk = (v) => rows.filter((r) => r.v === v);
    const pageC = (r) => `<button class="lnk" data-page="${esc(r.p)}">${esc(titleOf(r.p))}</button><span class="p">${esc(r.p)}</span>`;
    const baseCols = [
      { k: "t", label: "Час (Київ)", left: true, num: (r) => r.ts, html: (r) => hourText(r.t), text: (r) => hourText(r.t), csv: (r) => r.t },
      { k: "p", label: "Сторінка", left: true, text: (r) => titleOf(r.p), html: pageC, csv: (r) => r.p },
      { k: "c", label: "Країна", left: true, text: (r) => cname(r.c), html: (r) => `${flag(r.c)} ${esc(cname(r.c))}`, csv: (r) => r.c },
      { k: "d", label: "Пристрій", left: true, text: (r) => DEV[r.d] || r.d || "—" },
      { k: "b", label: "Браузер · ОС", left: true, text: (r) => r.br + " · " + r.os },
    ];
    const human = table("edgeH", baseCols.concat([
      { k: "js", label: "Скрипти", left: true, text: (r) => (r.js ? "так" : "—") },
      { k: "n", label: "Перегляди", num: (r) => r.n },
    ]), mk("h"), { sort: "t", limit: 20, search: true, text: (r) => hourText(r.t) + " " + r.p + " " + cname(r.c) + " " + r.br + " " + r.os });
    const susp = table("edgeS", baseCols.concat([
      { k: "w", label: "Чому підозріло", left: true, text: (r) => r.w || "—" },
      { k: "n", label: "Запити", num: (r) => r.n },
    ]), mk("s"), { sort: "t", limit: 10 });
    const kinds = {}, names = {};
    mk("b").forEach((r) => { kinds[r.k] = (kinds[r.k] || 0) + r.n; if (r.nm) names[r.nm.toLowerCase()] = (names[r.nm.toLowerCase()] || 0) + r.n; });
    const kl = (E.kinds || {});
    const kindItems = Object.keys(kinds).sort((a, b) => kinds[b] - kinds[a]).map((k) => ({ label: kl[k] || k, n: kinds[k], alt: true }));
    const nameItems = Object.keys(names).sort((a, b) => names[b] - names[a]).slice(0, 12).map((k) => ({ label: k, n: names[k] }));
    const bots = `<div class="an-grid two"><div><div class="sub">За видами</div>${A.barList(kindItems, { total: by.b })}</div><div><div class="sub">Найчастіші назви</div>${A.barList(nameItems)}</div></div>`;
    return head(kpis + note) +
      sec("Схожі на людей", "Агреговано по годинах; вибірка без ботів і «підозрілих»", human) +
      `<details class="an-card"><summary style="cursor:pointer;font-weight:600">Підозрілі (${num(by.s)}) — не входять у «людей», але не відкинуті</summary><div class="sub" style="margin-top:8px">Linux-десктоп, дуже старі версії браузерів, скорочені User-Agent, обхід багатьох сторінок за годину.</div>${susp}</details>` +
      `<details class="an-card" style="margin-top:16px"><summary style="cursor:pointer;font-weight:600">Відсіяні боти й павуки (${num(by.b)})</summary><div style="margin-top:12px">${bots}</div></details>`;
  }

  A.tabs.push(
    { id: "overview", label: "Огляд", render: overview },
    { id: "pages", label: "Сторінки", render: pages },
    { id: "sources", label: "Джерела", render: sources },
    { id: "audience", label: "Аудиторія", render: audience },
    { id: "flows", label: "Шляхи", render: flows },
    { id: "time", label: "Час", render: time },
    { id: "server", label: "Сервер (без JS)", render: server },
    { id: "speed", label: "Швидкість", render: speed },
    { id: "data", label: "Дані", render: data }
  );

  /* ---------- Демо-дані (той самий формат, що й у знімку) ---------- */
  A.demo = function () {
    let seed = 20261021;
    const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pickW = (arr) => { let s = 0; arr.forEach((x) => (s += x[1])); let r = rnd() * s; for (const x of arr) { r -= x[1]; if (r <= 0) return x[0]; } return arr[0][0]; };
    let titles = {};
    try { titles = JSON.parse(document.getElementById("anTitles").textContent); } catch (e) { /* без заголовків */ }
    let paths = Object.keys(titles).filter((p) => !/^\/(secret|404|privacy|search)/.test(p) && p !== "/");
    if (paths.length < 6) paths = paths.concat(["/statti/tryvoga/", "/statti/vyhorannya/", "/blog/pro-praktyku/", "/kviz/tryvoga/", "/kviz/depresiya/", "/pro-mene/"]);
    paths.sort(() => rnd() - 0.5);
    const pw = [["/", 24]].concat(paths.map((p, i) => [p, 14 / Math.pow(i + 1, 0.85) + 0.15]));
    const host = "krzhv.com.ua", DAYS = 150, now = Date.now();
    const hourW = Array.from({ length: 24 }, (_, h) => [h, h < 6 ? 0.25 : h < 9 ? 1 : h < 12 ? 2.2 : h < 17 ? 1.8 : h < 20 ? 1.5 : 2.6]);
    const wdF = [1.1, 1.15, 1.1, 1.05, 0.9, 0.72, 0.85];
    const ctr = [["UA", 72], ["PL", 6], ["DE", 5], ["US", 4], ["CZ", 2], ["GB", 2], ["CA", 2], ["IL", 1.5], ["ES", 1.5], ["FR", 1], ["IT", 1], ["NL", 1], ["T1", 0.3]];
    const cols = ["t", "country", "device", "refHost", "refPath", "path", "browser", "os", "nav"];
    const dict = {}, idx = {};
    cols.forEach((c) => { dict[c] = [""]; idx[c] = new Map([["", 0]]); });
    const id = (c, v) => { let k = idx[c].get(v); if (k === undefined) { k = dict[c].length; dict[c].push(v); idx[c].set(v, k); } return k; };
    const agg = new Map();
    for (let i = DAYS - 1; i >= 0; i--) {
      const ms = now - i * 864e5, wd = (((Math.floor(ms / 864e5) + 3) % 7) + 7) % 7;
      const spike = i === 41 ? 3.6 : i === 40 ? 2.1 : 1;
      const n = Math.round((38 + (DAYS - i) * 0.32) * wdF[wd] * spike * (0.8 + 0.4 * rnd()));
      for (let j = 0; j < n; j++) {
        const h = pickW(hourW), d = new Date(ms), t = d.toISOString().slice(0, 11) + A.pad((h + 21) % 24) + ":00:00Z";
        const mobile = rnd(), device = mobile < 0.64 ? "mobile" : mobile < 0.95 ? "desktop" : "tablet";
        const browser = device === "desktop" ? pickW([["Chrome", 60], ["Edge", 14], ["Firefox", 10], ["Safari", 10], ["Opera", 4]]) : pickW([["Chrome", 55], ["Safari", 28], ["Samsung Internet", 8], ["Firefox", 3]]);
        const os = device === "desktop" ? pickW([["Windows", 62], ["macOS", 22], ["Linux", 6]]) : pickW([["Android", 62], ["iOS", 36]]);
        const r = rnd();
        let refHost = "", refPath = "", path = pickW(pw), nav = pickW([["navigate", 92], ["reload", 5], ["back_forward", 3]]);
        if (r < 0.34) { refHost = host; refPath = pickW(pw); if (refPath === path) refPath = "/"; nav = "navigate"; }
        else if (r < 0.56) refHost = "";
        else if (r < 0.82) { refHost = pickW([["www.google.com", 88], ["www.bing.com", 6], ["yandex.ru", 2], ["duckduckgo.com", 2], ["www.ecosia.org", 1]]); refPath = "/"; }
        else if (r < 0.94) { refHost = pickW([["t.me", i === 41 || i === 40 ? 80 : 30], ["l.facebook.com", 25], ["l.instagram.com", 20], ["www.linkedin.com", 7], ["www.youtube.com", 5]]); refPath = "/"; }
        else if (r < 0.97) { refHost = pickW([["chatgpt.com", 5], ["www.perplexity.ai", 2], ["claude.ai", 2]]); refPath = "/"; }
        else { refHost = pickW([["www.ukr.net", 3], ["mental.example", 1], ["blog.example", 1]]); refPath = "/post/"; }
        const k = [t, pickW(ctr), device, refHost, refPath, path, browser, os, nav].join("\u0001");
        const a = agg.get(k) || [0, 0];
        a[0]++; if (refHost !== host) a[1]++;
        agg.set(k, a);
      }
    }
    const rows = [];
    agg.forEach((a, k) => { const p = k.split("\u0001"); rows.push(cols.map((c, i) => id(c, p[i])).concat([a[0], a[1]])); });
    const vitals = { fields: ["largestContentfulPaintP75", "interactionToNextPaintP75", "cumulativeLayoutShiftP75", "firstContentfulPaintP75", "timeToFirstByteP75"], days: 30, rows: pw.slice(0, 8).map((p) => [p[0], Math.round(p[1] * 40), 1200 + rnd() * 2600, 60 + rnd() * 300, rnd() * 0.18, 800 + rnd() * 1400, 120 + rnd() * 900]) };
    return { v: 1, cols, dict, rows, sampleInterval: 9.7, generatedAt: new Date(now).toISOString(), host, siteTag: "demo", from: new Date(now - DAYS * 864e5).toISOString(), to: new Date(now).toISOString(), days: DAYS, vitals, warnings: [] };
  };
})();
