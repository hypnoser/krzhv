// Google Search Console → пошукові запити для панелі /secret/analytics/.
//
// Секрети (GitHub → Settings → Secrets and variables → Actions):
//   GSC_KEY   — JSON-ключ сервісного акаунта Google (весь файл; можна й у base64)
//   GSC_SITE  — ресурс у Search Console: "sc-domain:krzhv.com.ua" (доменний) або "https://krzhv.com.ua/" (префікс URL)
// Необов'язково: GSC_DAYS (за замовчуванням 90), GSC_API_URL (для тестів).
//
// Search Console не віддає окремих відвідувачів, лише агрегати «день + запит + сторінка». Рідкісні (анонімізовані)
// запити Google з вибірки прибирає, тому сума за запитами менша за загальну за день (daily): це видно в панелі.
"use strict";
const crypto = require("crypto");

const API = process.env.GSC_API_URL || "https://www.googleapis.com/webmasters/v3";
const b64u = (b) => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

function parseKey(raw) {
  let s = String(raw || "").trim();
  if (!s) throw new Error("GSC_KEY порожній");
  if (s[0] !== "{") s = Buffer.from(s, "base64").toString("utf8");
  const k = JSON.parse(s);
  if (!k.client_email || !k.private_key) throw new Error("у GSC_KEY немає client_email або private_key");
  return k;
}

async function accessToken(key) {
  const uri = key.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: key.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: uri, iat: now, exp: now + 3600 }));
  const sig = b64u(crypto.createSign("RSA-SHA256").update(head + "." + body).sign(key.private_key));
  const r = await fetch(uri, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + head + "." + body + "." + sig,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("токен Google: " + (j.error_description || j.error || r.status));
  return j.access_token;
}

const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const pathOf = (u) => { try { const x = new URL(u); return x.pathname + x.search; } catch (e) { return u; } };

async function fetchGsc(opts) {
  opts = opts || {};
  const key = parseKey(opts.key || process.env.GSC_KEY);
  const site = opts.site || process.env.GSC_SITE;
  if (!site) throw new Error("не задано GSC_SITE");
  const days = Math.max(7, Math.min(480, parseInt(opts.days || process.env.GSC_DAYS || "90", 10) || 90));
  const end = Date.now(), start = end - (days - 1) * 864e5;
  const token = await accessToken(key);
  const url = `${API}/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  // dataState "all": разом із фінальними беруться й свіжі, ще неповні дані (найновіші 1–2 дні)
  const q = async (extra) => {
    const r = await fetch(url, {
      method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify(Object.assign({ startDate: day(start), endDate: day(end), dataState: "all" }, extra)),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("Search Console API: " + ((j.error && j.error.message) || r.status));
    return j.rows || [];
  };
  const daily = await q({ dimensions: ["date"], rowLimit: 1000 });
  const rows = [];
  const PAGE = 25000, MAX = 100000;
  for (let startRow = 0; startRow < MAX; startRow += PAGE) {
    const part = await q({ dimensions: ["date", "query", "page"], rowLimit: PAGE, startRow });
    part.forEach((r) => rows.push([r.keys[0], r.keys[1], pathOf(r.keys[2]), r.clicks, r.impressions, Math.round(r.position * 10) / 10]));
    if (part.length < PAGE) break;
  }
  return {
    site, from: day(start), to: day(end), days,
    daily: daily.map((r) => [r.keys[0], r.clicks, r.impressions, Math.round(r.position * 10) / 10]).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    rows,
  };
}

module.exports = { fetchGsc, parseKey };
