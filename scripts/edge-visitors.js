// Серверні відвідування з журналу запитів Cloudflare (httpRequestsAdaptiveGroups) — без JavaScript-лічильника.
// Бачить і тих, у кого блокується Web Analytics (блокувальники, режими приватності iOS, VPN),
// тому доповнює панель /secret/analytics/. Боти й павуки відсіюються за правилами scripts/bot-rules.js.
//
// Потрібне право токена: Zone → Analytics → Read для зони сайту (на додачу до Account Analytics → Read).
// Дані агреговані по годинах: ні IP, ні сирого User-Agent у знімок не потрапляють.
"use strict";
const { classifyRows, IGNORE_PATH, KINDS } = require("./bot-rules");

const HOUR = 36e5;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

function query(zone, from, to, withMethod) {
  return `{ viewer { zones(filter: {zoneTag: "${zone}"}) {
    httpRequestsAdaptiveGroups(
      filter: { datetime_geq: "${iso(from)}", datetime_leq: "${iso(to)}", edgeResponseStatus: 200, edgeResponseContentTypeName: "html"${withMethod ? ', clientRequestHTTPMethodName: "GET"' : ""} },
      limit: 10000, orderBy: [datetimeHour_ASC]
    ) { count dimensions { datetimeHour clientRequestPath clientCountryName userAgent clientDeviceType } }
  } } }`;
}

// gql(query) → JSON-відповідь GraphQL. Повертає сирі рядки {t, p, c, d, ua, n}.
async function fetchEdgeRows(gql, zone, from, to) {
  const rows = [];
  let withMethod = true;
  for (let a = from; a < to; a += 7 * 864e5) {
    const b = Math.min(a + 7 * 864e5 - 1000, to);
    let j;
    for (let attempt = 0; attempt < 2; attempt++) {
      j = await gql(query(zone, a, b, withMethod));
      const err = (j.errors || []).map((e) => e.message).join("; ");
      if (err && withMethod && /clientrequesthttpmethodname/i.test(err)) { withMethod = false; continue; }
      if (err) {
        if (/authori|permission|access|does not have/i.test(err)) throw new Error(`немає права читати журнал запитів зони (${err}). Додайте токену CF_ANALYTICS_TOKEN право Zone → Analytics → Read`);
        throw new Error(err);
      }
      break;
    }
    const z = j.data && j.data.viewer && j.data.viewer.zones && j.data.viewer.zones[0];
    if (!z) throw new Error("порожня відповідь: перевірте ID зони (CF_ZONE_ID) і права токена");
    (z.httpRequestsAdaptiveGroups || []).forEach((g) => rows.push({
      t: g.dimensions.datetimeHour, p: g.dimensions.clientRequestPath || "/", c: (g.dimensions.clientCountryName || "").toUpperCase(),
      d: g.dimensions.clientDeviceType || "", ua: g.dimensions.userAgent || "", n: g.count || 1,
    }));
  }
  return rows;
}

// Запити до скриптів сайту (.js): браузер людини їх завантажує, найпростіші роботи — ні.
// Повертає множину ключів «година|країна|User-Agent». Відсутність скриптів ще не ознака робота
// (повторний візит бере їх із кешу браузера), а наявність — додаткове підтвердження.
async function fetchEdgeScripts(gql, zone, from, to) {
  const set = new Set();
  for (let a = from; a < to; a += 7 * 864e5) {
    const b = Math.min(a + 7 * 864e5 - 1000, to);
    const j = await gql(`{ viewer { zones(filter: {zoneTag: "${zone}"}) {
      httpRequestsAdaptiveGroups(filter: { datetime_geq: "${iso(a)}", datetime_leq: "${iso(b)}", edgeResponseStatus: 200, edgeResponseContentTypeName: "js" }, limit: 10000, orderBy: [datetimeHour_ASC]) {
        count dimensions { datetimeHour clientCountryName userAgent } }
    } } }`);
    if (j.errors && j.errors.length) throw new Error(j.errors.map((e) => e.message).join("; "));
    const z = j.data && j.data.viewer && j.data.viewer.zones && j.data.viewer.zones[0];
    ((z && z.httpRequestsAdaptiveGroups) || []).forEach((g) => set.add(`${g.dimensions.datetimeHour}|${(g.dimensions.clientCountryName || "").toUpperCase()}|${g.dimensions.userAgent || ""}`));
  }
  return set;
}

// Сирі рядки → компактний блок для знімка. scripts — множина з fetchEdgeScripts (необов'язково).
function buildEdge(rawRows, from, to, scripts) {
  const rows = rawRows.filter((r) => !IGNORE_PATH.test(r.p));
  const cls = classifyRows(rows);
  // classifyRows зберігає порядок рядків, тому прапорець беремо за тим самим індексом
  const js = rows.map((r) => (scripts && scripts.has(`${r.t}|${r.c}|${r.ua}`) ? 1 : 0));
  const sum = { total: 0, h: 0, s: 0, b: 0, kinds: {}, names: {} };
  cls.forEach((r) => {
    sum.total += r.n; sum[r.v] += r.n;
    if (r.v === "b") {
      sum.kinds[r.k] = (sum.kinds[r.k] || 0) + r.n;
      if (r.nm) { const k = r.nm.toLowerCase(); sum.names[k] = (sum.names[k] || 0) + r.n; }
    }
  });
  const names = Object.entries(sum.names).sort((a, b) => b[1] - a[1]).slice(0, 15);
  sum.names = Object.fromEntries(names);
  return {
    v: 1, from: iso(from), to: iso(to), kinds: KINDS, summary: sum,
    // [година, шлях, країна, пристрій, браузер, ОС, вердикт, вид, назва, пояснення, кількість, скрипти(1/0)]
    rows: cls.map((r, i) => [r.t, r.p, r.c, r.d, r.br, r.os, r.v, r.k, r.nm, r.w, r.n, js[i]]),
  };
}

module.exports = { fetchEdgeRows, fetchEdgeScripts, buildEdge, query, HOUR };
