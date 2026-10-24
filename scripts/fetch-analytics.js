// Знімок статистики Cloudflare Web Analytics для закритої сторінки /secret/analytics/.
//
// Запуск у CI після збірки сайту (див. .github/workflows/deploy.yml):
//   node scripts/fetch-analytics.js            → _site/secret/analytics/data.json
//
// Змінні середовища (GitHub → Settings → Secrets and variables → Actions):
//   CF_ANALYTICS_TOKEN  — токен API: Account → Account Analytics → Read
//   CF_ACCOUNT_ID       — ID акаунта Cloudflare
//   SECRET_PASSWORD     — пароль розділу /secret/ (з нього виводиться ключ шифрування)
// Необов'язково: CF_SITE_TAG (за замовчуванням визначається за доменом SITE_HOST; токен маяка в HTML — не siteTag), DAYS (за замовчуванням 180),
//   CF_GRAPHQL_URL (для тестів), PREV_URL (звідки взяти попередній знімок, якщо Cloudflare недоступний).
//
// Дані — лише агреговані (кількість переглядів/візитів за годину в розрізі країни, сторінки, джерела,
// пристрою), окремих відвідувачів Cloudflare не віддає. Знімок шифрується AES-GCM тим самим ключем, що й
// файли /secret/ (PBKDF2 з SALT/ITER із src/assets/js/secret.js), стискається gzip. Без пароля прочитати його неможливо.
//
// Скрипт ніколи не валить деплой: за відсутності секретів або помилки API він пише попередження
// й, якщо може, лишає попередній знімок.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const https = require("https");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const OUT = process.argv[2] || path.join(ROOT, "_site", "secret", "analytics", "data.json");
let TAG = process.env.CF_SITE_TAG || "";
let SITE_FILTER = "";
const HOST = process.env.SITE_HOST || "krzhv.com.ua";
const DAYS = Math.max(1, Math.min(365, parseInt(process.env.DAYS || "180", 10) || 180));
const GQL = process.env.CF_GRAPHQL_URL || "https://api.cloudflare.com/client/v4/graphql";
const PREV_URL = process.env.PREV_URL || `https://${HOST}/secret/analytics/data.json`;
const LIMIT = 10000;

const warnings = [];
const warn = (m) => { warnings.push(m); console.warn(`::warning::[analytics] ${m}`); };
const log = (m) => console.log(`[analytics] ${m}`);

// ---------- Шифрування (сумісне з src/assets/js/secret.js) ----------
function cryptoParams() {
  const src = fs.readFileSync(process.env.SECRET_JS || path.join(ROOT, "src/assets/js/secret.js"), "utf8");
  const salt = /var SALT = "([^"]+)"/.exec(src)[1];
  const iter = parseInt(/var ITER = (\d+)/.exec(src)[1], 10);
  const ver = /var VERIFIER = \{ iv: "([^"]+)", ct: "([^"]+)" \}/.exec(src);
  return { salt, iter, verifier: { iv: ver[1], ct: ver[2] } };
}
function deriveKey(password, p) {
  return crypto.pbkdf2Sync(password, Buffer.from(p.salt, "base64"), p.iter, 32, "sha256");
}
function gcmDecrypt(key, blob) {
  const buf = Buffer.from(blob.ct, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  d.setAuthTag(buf.subarray(buf.length - 16));
  return Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]);
}
function gcmEncrypt(key, data) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(data), c.final(), c.getAuthTag()]);
  return { iv: iv.toString("base64"), ct: ct.toString("base64") };
}

// ---------- HTTP ----------
function request(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.request(u, { method, headers, timeout: 60000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function gql(query) {
  const r = await request(GQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_ANALYTICS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  let j;
  try { j = JSON.parse(r.body); } catch (e) { throw new Error(`HTTP ${r.status}: відповідь не JSON`); }
  if (r.status >= 400 && !j.errors) throw new Error(`HTTP ${r.status}`);
  return j;
}
const errText = (j) => (j.errors || []).map((e) => e.message).join("; ");

// ---------- Схема: які виміри реально доступні ----------
const WANT = [
  ["t", ["datetimeHour", "datetimeFifteenMinutes", "date"]],
  ["country", ["countryName"]],
  ["device", ["deviceType"]],
  ["refHost", ["refererHost"]],
  ["refPath", ["refererPath"]],
  ["path", ["requestPath"]],
  ["browser", ["userAgentBrowser"]],
  ["os", ["userAgentOS"]],
  ["nav", ["navigationType"]],
];

async function discoverFields(typeRe) {
  try {
    const s = await gql("{ __schema { types { name } } }");
    const names = (s.data && s.data.__schema && s.data.__schema.types || []).map((t) => t.name).filter((n) => typeRe.test(n));
    const out = {};
    for (const n of names) {
      const t = await gql(`{ __type(name: "${n}") { fields { name } } }`);
      out[n] = ((t.data && t.data.__type && t.data.__type.fields) || []).map((f) => f.name);
    }
    return out;
  } catch (e) { return {}; }
}

async function pickDimensions() {
  const found = await discoverFields(/^Account.*RumPageloadEventsAdaptiveGroups.*Dimensions$/i);
  const have = new Set([].concat(...Object.values(found)));
  const cols = [];
  for (const [key, cands] of WANT) {
    const name = have.size ? cands.find((c) => have.has(c)) : (key === "nav" ? null : cands[0]);
    if (name) cols.push({ key, name });
  }
  if (!cols.find((c) => c.key === "t")) cols.unshift({ key: "t", name: "date" });
  log(`виміри: ${cols.map((c) => c.name).join(", ")}${have.size ? "" : " (інтроспекція недоступна)"}`);
  return cols;
}

function pageloadQuery(acc, cols, start, end) {
  const dims = cols.map((c) => `${c.key}: ${c.name}`).join(" ");
  return `{ viewer { accounts(filter: {accountTag: "${acc}"}) {
    rumPageloadEventsAdaptiveGroups(
      filter: { AND: [ { datetime_geq: "${start}", datetime_leq: "${end}" }, ${SITE_FILTER} ] }
      limit: ${LIMIT}, orderBy: [count_DESC]
    ) { count sum { visits } avg { sampleInterval } dimensions { ${dims} } }
  } } }`;
}

// Один запит із автоматичним відкиданням вимірів, яких схема не знає
async function queryWindow(acc, cols, start, end) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const j = await gql(pageloadQuery(acc, cols, start, end));
    if (j.errors && j.errors.length) {
      const m = /unknown field "?(\w+)"?/i.exec(errText(j));
      const bad = m && cols.findIndex((c) => c.name === m[1]);
      if (m && bad >= 0 && cols[bad].key !== "t") { warn(`вимір ${m[1]} недоступний — пропускаю`); cols.splice(bad, 1); continue; }
      throw new Error(errText(j));
    }
    const acct = j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0];
    if (!acct) throw new Error("порожня відповідь: перевірте CF_ACCOUNT_ID і права токена");
    return acct.rumPageloadEventsAdaptiveGroups || [];
  }
  throw new Error("не вдалося підібрати набір вимірів");
}

// Який siteTag належить нашому домену: групуємо події за 30 днів за siteTag і requestHost
async function resolveSite(acc) {
  const hosts = [HOST, "www." + HOST];
  if (TAG) { SITE_FILTER = `{ siteTag: "${TAG}" }`; log(`siteTag із CF_SITE_TAG: ${TAG}`); return; }
  const to = Date.now(), from = to - 30 * 864e5;
  try {
    const j = await gql(`{ viewer { accounts(filter: {accountTag: "${acc}"}) {
      rumPageloadEventsAdaptiveGroups(filter: { datetime_geq: "${iso(from)}", datetime_leq: "${iso(to)}" }, limit: 100, orderBy: [count_DESC]) {
        count dimensions { siteTag requestHost }
      } } } }`);
    if (j.errors && j.errors.length) throw new Error(errText(j));
    const g = (j.data.viewer.accounts[0] || {}).rumPageloadEventsAdaptiveGroups || [];
    const seen = g.map((r) => `${r.dimensions.requestHost} (siteTag ${r.dimensions.siteTag}, ${r.count})`);
    const tags = [...new Set(g.filter((r) => hosts.includes(String(r.dimensions.requestHost).toLowerCase())).map((r) => r.dimensions.siteTag))];
    if (tags.length) {
      TAG = tags.join(",");
      SITE_FILTER = `{ OR: [ ${tags.map((t) => `{ siteTag: "${t}" }`).join(", ")} ] }`;
      log(`siteTag для ${HOST}: ${TAG}`);
      return;
    }
    warn(`у акаунті не знайдено подій для ${HOST} за 30 днів. Сайти в акаунті: ${seen.slice(0, 10).join("; ") || "жодного"}`);
  } catch (e) {
    log(`автовизначення siteTag не вдалося (${e.message}) — фільтрую за доменом`);
  }
  SITE_FILTER = `{ OR: [ ${hosts.map((h) => `{ requestHost: "${h}" }`).join(", ")} ] }`;
}

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

async function fetchRange(acc, cols, fromMs, toMs, depth = 0) {
  const rows = await queryWindow(acc, cols, iso(fromMs), iso(toMs));
  if (rows.length >= LIMIT && toMs - fromMs > 6 * 3600e3 && depth < 8) {
    const mid = Math.floor((fromMs + toMs) / 2);
    log(`вікно ${iso(fromMs)} — досягнуто ліміт ${LIMIT}, ділю навпіл`);
    return (await fetchRange(acc, cols, fromMs, mid, depth + 1)).concat(await fetchRange(acc, cols, mid + 1000, toMs, depth + 1));
  }
  if (rows.length >= LIMIT) warn(`вікно ${iso(fromMs)} обрізане лімітом ${LIMIT} рядків`);
  return rows;
}

// ---------- Core Web Vitals (за можливості) ----------
async function fetchVitals(acc) {
  const found = await discoverFields(/^Account.*RumWebVitalsEventsAdaptiveGroups.*(Quantiles|Dimensions)$/i);
  const qName = Object.keys(found).find((n) => /Quantiles$/i.test(n));
  const dName = Object.keys(found).find((n) => /Dimensions$/i.test(n));
  if (!qName || !dName || !found[dName].includes("requestPath")) return null;
  const fields = found[qName].filter((f) => /P75$/.test(f));
  if (!fields.length) return null;
  const to = Date.now(), from = to - 30 * 864e5;
  const q = `{ viewer { accounts(filter: {accountTag: "${acc}"}) {
    rumWebVitalsEventsAdaptiveGroups(
      filter: { AND: [ { datetime_geq: "${iso(from)}", datetime_leq: "${iso(to)}" }, ${SITE_FILTER} ] }
      limit: 100, orderBy: [count_DESC]
    ) { count quantiles { ${fields.join(" ")} } dimensions { p: requestPath } }
  } } }`;
  const j = await gql(q);
  if (j.errors && j.errors.length) throw new Error(errText(j));
  const g = j.data.viewer.accounts[0].rumWebVitalsEventsAdaptiveGroups || [];
  return { fields, days: 30, rows: g.map((r) => [r.dimensions.p, r.count].concat(fields.map((f) => r.quantiles[f]))) };
}

// ---------- Зведення у компактний вигляд ----------
function pack(cols, groups) {
  const dict = {}, idx = {};
  for (const c of cols) { dict[c.key] = [""]; idx[c.key] = new Map([["", 0]]); }
  const rows = [];
  let sampleSum = 0, sampleN = 0;
  for (const g of groups) {
    const row = [];
    cols.forEach((c) => {
      let v = g.dimensions[c.key];
      v = v == null ? "" : String(v);
      if (c.key === "t") v = v.length === 10 ? v + "T12:00:00Z" : v.replace(/\.\d+Z$/, "Z");
      let k = idx[c.key].get(v);
      if (k === undefined) { k = dict[c.key].length; dict[c.key].push(v); idx[c.key].set(v, k); }
      row.push(k);
    });
    row.push(g.count || 0, (g.sum && g.sum.visits) || 0);
    rows.push(row);
    if (g.avg && g.avg.sampleInterval) { sampleSum += g.avg.sampleInterval * (g.count || 1); sampleN += g.count || 1; }
  }
  return { cols: cols.map((c) => c.key), dict, rows, sampleInterval: sampleN ? +(sampleSum / sampleN).toFixed(2) : null };
}

function writeOut(blob) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(blob));
  log(`записано ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} КБ)`);
}

async function keepPrevious(reason) {
  warn(reason);
  if (fs.existsSync(OUT)) return;
  try {
    const r = await request(PREV_URL);
    const j = JSON.parse(r.body);
    if (r.status === 200 && j.iv && j.ct) { writeOut(j); log("залишено попередній знімок"); }
  } catch (e) { /* попереднього знімка немає — сторінка покаже підказку з налаштування */ }
}

(async () => {
  const need = ["CF_ANALYTICS_TOKEN", "CF_ACCOUNT_ID", "SECRET_PASSWORD"].filter((k) => !process.env[k]);
  if (need.length) { log(`пропускаю: немає ${need.join(", ")}`); return keepPrevious(`знімок статистики не оновлено: не задано ${need.join(", ")}`); }

  const p = cryptoParams();
  const key = deriveKey(process.env.SECRET_PASSWORD, p);
  try {
    if (gcmDecrypt(key, p.verifier).toString() !== "krzhv-secret-ok") throw new Error("x");
  } catch (e) {
    return keepPrevious("SECRET_PASSWORD не збігається з паролем розділу /secret/ — знімок не оновлено");
  }

  try {
    const acc = process.env.CF_ACCOUNT_ID;
    await resolveSite(acc);
    const cols = await pickDimensions();
    const now = Date.now();
    const start = now - DAYS * 864e5;
    let groups = [];
    for (let from = start; from < now; from += 7 * 864e5) {
      const to = Math.min(from + 7 * 864e5 - 1000, now);
      try { groups = groups.concat(await fetchRange(acc, cols, from, to)); }
      catch (e) { warn(`${iso(from)}: ${e.message}`); if (from === start && groups.length === 0 && /authori|permission|token/i.test(e.message)) throw e; }
    }
    if (!groups.length) log("Cloudflare не повернув жодного рядка (сайт ще не зібрав даних або неправильний siteTag)");

    let vitals = null;
    try { vitals = await fetchVitals(acc); } catch (e) { log(`Web Vitals недоступні: ${e.message}`); }

    const data = Object.assign(pack(cols, groups), {
      v: 1, generatedAt: new Date().toISOString(), host: HOST, siteTag: TAG,
      from: iso(start), to: iso(now), days: DAYS, vitals, warnings, gateSince: process.env.GATE_SINCE || "2026-10-24",
    });
    const plain = zlib.gzipSync(Buffer.from(JSON.stringify(data)));
    const enc = gcmEncrypt(key, plain);
    // Самоперевірка: розшифровка через WebCrypto — так само, як у браузері
    const b = (s) => Uint8Array.from(Buffer.from(s, "base64"));
    const k2 = await crypto.webcrypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
    const back = await crypto.webcrypto.subtle.decrypt({ name: "AES-GCM", iv: b(enc.iv) }, k2, b(enc.ct));
    if (zlib.gunzipSync(Buffer.from(back)).toString() !== JSON.stringify(data)) throw new Error("самоперевірка шифрування не пройшла");
    writeOut({ v: 1, z: "gzip", iv: enc.iv, ct: enc.ct });
    log(`рядків: ${groups.length}, вимірів: ${cols.length}, період: ${DAYS} днів`);
  } catch (e) {
    await keepPrevious(`Cloudflare API: ${e.message}`);
  }
})().catch((e) => { warn(e.stack || e.message); });
