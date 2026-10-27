// Симуляція ситуацій для відсіювання ботів у серверній статистиці (scripts/bot-rules.js, edge-visitors.js).
// Запуск: node scripts/test-bot-rules.js (входить у npm test). Усі User-Agent — публічні рядки реальних браузерів і ботів.
"use strict";
const assert = require("assert");
const { classifyUA, classifyRows, parseUA } = require("./bot-rules");
const { buildEdge, fetchEdgeRows, fetchEdgeScripts } = require("./edge-visitors");

let n = 0, failed = 0;
const t = (name, fn) => { n++; try { const r = fn(); if (r && r.then) throw new Error("async test"); } catch (e) { failed++; console.error(`✗ ${name}\n  ${e.message}`); } };
const ta = async (name, fn) => { n++; try { await fn(); } catch (e) { failed++; console.error(`✗ ${name}\n  ${e.message}`); } };

// ---------- 1. Живі відвідувачі: ніколи не відсіюються ----------
const HUMANS = {
  "iPhone Safari (напр. клієнт з-за кордону)": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1",
  "iPad Safari": "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  "Chrome Android (скорочений UA)": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
  "Edge Windows": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0",
  "Edge Android": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36 EdgA/155.0.0.0",
  "Firefox Windows": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
  "Safari macOS": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Samsung Internet": "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
  "Яндекс Браузер": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 YaBrowser/24.7.0.0 Safari/537.36",
  "Opera": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/120.0.0.0",
  "Facebook у застосунку": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.0]",
  "Instagram у застосунку": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0",
  "Телефон Cubot (у назві є bot)": "Mozilla/5.0 (Linux; Android 12; CUBOT_X50) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36",
  "Windows 7 з останнім Chrome 109": "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
  "Chrome iOS": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.0.0 Mobile/15E148 Safari/604.1",
};
for (const [name, ua] of Object.entries(HUMANS)) t(`людина: ${name}`, () => assert.strictEqual(classifyUA(ua, 116).v, "h", JSON.stringify(classifyUA(ua, 116))));

// ---------- 2. Боти й павуки: відсіюються з правильним видом ----------
const BOTS = [
  ["ai", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot) Chrome/119.0.6045.214 Safari/537.36"],
  ["ai", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; KeenableBot/1.0; +https://keenable.ai/bot)"],
  ["ai", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot"],
  ["ai", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot"],
  ["ai", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)"],
  ["ai", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"],
  ["ai", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)"],
  ["search", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36"],
  ["search", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["search", "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)"],
  ["search", "Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)"],
  ["seo", "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"],
  ["seo", "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)"],
  ["social", "Mozilla/5.0 (compatible; TelegramBot like TwitterBot)"],
  ["social", "TelegramBot (like TwitterBot)"],
  ["social", "WhatsApp/2.23.20.0"],
  ["social", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"],
  ["social", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
  ["monitor", "Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)"],
  ["scanner", "Hello from Palo Alto Networks, find out more about our scans in https://docs-cortex.paloaltonetworks.com/r/1/Cortex-Xpanse/Scanning-activity"],
  ["scanner", "Mozilla/5.0 (compatible; CensysInspect/1.1; +https://about.censys.io/)"],
  ["tool", "curl/8.5.0"],
  ["tool", "python-requests/2.31.0"],
  ["tool", "Go-http-client/2.0"],
  ["tool", "Wget/1.21.4"],
  ["headless", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36"],
  ["headless", "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse"],
  ["other", "SomeNewCrawler/1.0 (+https://example.org/about)"],
  ["empty", ""],
];
for (const [kind, ua] of BOTS) t(`бот (${kind}): ${ua.slice(0, 48) || "(порожній)"}`, () => {
  const r = classifyUA(ua, 116);
  assert.strictEqual(r.v, "b", JSON.stringify(r));
  assert.strictEqual(r.k, kind, `вид ${r.k} замість ${kind}`);
});

// ---------- 3. Підозрілі: не люди, але й не явні боти ----------
t("підозрілий: Linux-десктоп без ознак браузера користувача", () => assert.strictEqual(classifyUA("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", 116).v, "s"));
t("підозрілий: дуже старий Chrome 89 на Windows 10", () => assert.strictEqual(classifyUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36", 116).v, "s"));
t("підозрілий: Chrome 107 на Windows 10 (хвиля з Китаю)", () => assert.strictEqual(classifyUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36", 116).v, "s"));
t("підозрілий: не браузерний User-Agent", () => assert.strictEqual(classifyUA("MyApp/1.0 (compatible)", 116).v, "s"));
t("підозрілий: Internet Explorer", () => assert.strictEqual(classifyUA("Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)", 116).v, "s"));


// ---------- 3б. Реальні випадки з журналу запитів сайту (жовтень 2026) ----------
const REAL_BOTS = [
  ["scanner", "Mozilla/5.0 (compatible; WP-Safe-Scanner/1.0)"],
  ["scanner", "Mozilla/5.0 (compatible; CT-WP-Scanner/1.0; +https://example.com/bot)"],
  ["scanner", "Mozilla/5.0 (l9scan/2.0.23266633a353138363a3a333330333a303037343a363036323; +https://leakix.net)"],
  ["scanner", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 ModatScanner/1.2 (+https://modat.io/)"],
  ["scanner", "visionheight.com/scan Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36"],
  ["scanner", "ctdomain-cmsscan/0.1 (+passive CMS fingerprinting; max 5 requests/site)"],
  ["scanner", "nameserver-checker-http-validator/1.0"],
  ["scanner", "domainbox-domain-snapshot/0.1"],
  ["scanner", "Mozilla/5.0 (compatible; rust_sniffer/0.1; +https://github.com/)"],
  ["scanner", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko; compatible; BuiltWith/1.4; rb.gy/xprgqj) Chrome/124.0.0.0 Safari/537.36"],
  ["search", "Mozilla/5.0 (compatible; KGBSEARCH/1.0)"],
  ["monitor", "Mozilla/5.0 (compatible; GitHub Pages Health Check/1.19.2; +https://github.com/github/pages-health-check)"],
  ["tool", "Mozilla/5.0 (compatible; Google-Apps-Script; beanserver; +https://script.google.com; id: UAEmdDd_JlvJWChXd6h-IxDbeImzM_sAFxjw)"],
  ["tool", "quic-go-HTTP/3"],
  ["tool", "Python/3.14 aiohttp/3.14.1"],
  ["tool", "Scrapy/2.17.0 (+https://scrapy.org)"],
  ["ai", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +claude-user@anthropic.com)"],
  ["ai", "Mozilla/5.0 (compatible; KimiBot/1.0; +https://kimi.ai/)"],
  ["ai", "Mozilla/5.0 (compatible; xAI-SearchBot/1.0; +https://x.ai)"],
  ["ai", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Reflectionbot/1.0; +https://reflection.ai/bot) Chrome/151.0.0.0 Safari/537.36"],
  ["ai", "Mozilla/5.0 (compatible; Meta-ExternalAgent/1.0; +https://developers.facebook.com/docs/sharing/webmasters/crawler)"],
  ["other", "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0; 360Spider"],
  ["scanner", "RecordedFuture Global Inventory Crawler"],
  ["other", "OI-Crawler/Nutch (https://openintel.nl/webcrawl/)"],
  ["other", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 ForestEngine/1.0 (+https://forestengine.net/#opt-out)"],
];
for (const [kind, ua] of REAL_BOTS) t(`реальний бот (${kind}): ${ua.slice(0, 50)}`, () => { const r = classifyUA(ua, { chrome: 130, firefox: 128 }); assert.strictEqual(r.v, "b", JSON.stringify(r)); assert.strictEqual(r.k, kind); });
const REAL_FAKES = [
  "Mozilla/5.0", "Mozilla/5.0 (compatible)", "Mozilla/5.0 Chrome/120", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/601.6.17 (KHTML, like Gecko) Version/9.1.1 Safari/601.6.17",
  "Mozilla/5.0 (OS/2; Warp 4.5; rv:31.0) Gecko/20100101 Firefox/31.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.60 Safari/537.36 Edge/12.246",
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0",
];
for (const ua of REAL_FAKES) t(`підроблений/скорочений UA не вважається людиною: ${ua.slice(0, 55)}`, () => assert.notStrictEqual(classifyUA(ua, { chrome: 130, firefox: 128 }).v, "h"));
t("Windows 7 з Firefox ESR 115 і Chrome 109 залишаються людьми", () => {
  assert.strictEqual(classifyUA("Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0", { chrome: 130, firefox: 128 }).v, "h");
  assert.strictEqual(classifyUA(HUMANS["Windows 7 з останнім Chrome 109"], { chrome: 130, firefox: 128 }).v, "h");
});
t("орієнтир свіжості: поодинока «майбутня» версія Chrome не робить усіх інших старими", () => {
  const rows = [{ t: "2026-10-26T21:00:00Z", p: "/", c: "UA", d: "desktop", ua: HUMANS["Edge Windows"], n: 5 }, { t: "2026-10-26T21:00:00Z", p: "/a/", c: "UA", d: "desktop", ua: HUMANS["Opera"], n: 1 },
    { t: "2026-10-26T21:00:00Z", p: "/b/", c: "PL", d: "desktop", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36", n: 1 }];
  assert.strictEqual(classifyRows(rows)[1].v, "h", "Opera (Chrome 140) не має ставати підозрілою через вигадану версію 999");
});

// ---------- 4. Хвилі запитів з одного пристрою ----------
const IPH = HUMANS["iPhone Safari (напр. клієнт з-за кордону)"], AND = HUMANS["Chrome Android (скорочений UA)"], WIN107 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36";
const H = "2026-10-26T21:00:00Z";
const mk = (ua, c, t, paths, d) => paths.map((p) => ({ t, p, c, d: d || "mobile", ua, n: 1 }));
const pages = (k) => Array.from({ length: k }, (_, i) => `/statti/tema-${i}/`);
t("клієнт з Німеччини: 3 сторінки за годину залишається людиною (випадок 26.10)", () => {
  const r = classifyRows(mk(IPH, "DE", H, ["/statti/", "/", "/kviz/"]).concat(mk(AND, "BE", "2026-10-26T06:00:00Z", pages(2))));
  assert.deepStrictEqual(r.slice(0, 3).map((x) => x.v), ["h", "h", "h"]);
});
t("сканер з Бельгії: 36 запитів / 20 сторінок за годину → не людина (випадок 26.10)", () => {
  const rows = mk(AND, "BE", "2026-10-26T06:00:00Z", pages(20)).concat(mk(AND, "BE", "2026-10-26T06:00:00Z", pages(16)));
  const r = classifyRows(rows);
  assert.ok(r.every((x) => x.v !== "h"), "хвиля не має рахуватись людьми");
  assert.ok(r.every((x) => /обхід|хвиля/.test(x.w)), "є пояснення для власника");
});
t("явна хвиля: 30 різних сторінок за годину → бот", () => {
  assert.ok(classifyRows(mk(AND, "BE", H, pages(30))).every((x) => x.v === "b" && x.k === "burst"));
});
t("скрапер з Китаю: Chrome 107, 18 сторінок за годину → не людина (випадок 27.10)", () => {
  const rows = mk(WIN107, "CN", "2026-10-27T06:00:00Z", pages(18), "desktop").concat(mk(HUMANS["Edge Windows"], "UA", "2026-10-27T05:00:00Z", ["/"], "desktop"));
  const r = classifyRows(rows);
  assert.ok(r.slice(0, 18).every((x) => x.v !== "h"), "скрапер не має рахуватись людьми");
  assert.strictEqual(r[18].v, "h", "справжній Edge залишається людиною");
});
t("вірусний сплеск: 30 різних людей з ОДНАКОВИМ UA читають 2 сторінки — усі залишаються людьми", () => {
  // скорочений UA Chrome Android однаковий у мільйонів пристроїв; 60 запитів на 2 сторінки — не обхід сайту
  const rows = [{ t: H, p: "/blog/hit/", c: "UA", d: "mobile", ua: AND, n: 30 }, { t: H, p: "/statti/hit/", c: "UA", d: "mobile", ua: AND, n: 30 }];
  assert.ok(classifyRows(rows).every((x) => x.v === "h"));
});
t("100 запитів на одну сторінку з одного пристрою за годину — бот (цикл оновлення)", () => {
  assert.ok(classifyRows([{ t: H, p: "/", c: "US", d: "desktop", ua: HUMANS["Edge Windows"], n: 100 }]).every((x) => x.v === "b"));
});
t("той самий пристрій у різні години — не хвиля", () => {
  const rows = ["2026-10-26T08:00:00Z", "2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z"].flatMap((h) => mk(IPH, "UA", h, ["/statti/a/", "/statti/b/", "/blog/c/", "/kviz/"]));
  assert.ok(classifyRows(rows).every((x) => x.v === "h"));
});
t("уважний читач: 5 сторінок за годину ще людина, 8 — підозріло", () => {
  assert.ok(classifyRows(mk(IPH, "UA", H, pages(5))).every((x) => x.v === "h"));
  assert.ok(classifyRows(mk(IPH, "UA", H, pages(8))).every((x) => x.v === "s"));
});
// ---------- 5. Служебні шляхи і приватність ----------
t("/secret/, /cdn-cgi/, robots.txt не рахуються взагалі", () => {
  const e = buildEdge([
    { t: H, p: "/secret/analytics/", c: "UA", d: "mobile", ua: IPH, n: 1 },
    { t: H, p: "/cdn-cgi/rum", c: "UA", d: "mobile", ua: IPH, n: 1 },
    { t: H, p: "/robots.txt", c: "US", d: "desktop", ua: "Mozilla/5.0 (compatible; bingbot/2.0)", n: 1 },
    { t: H, p: "/statti/", c: "DE", d: "mobile", ua: IPH, n: 1 },
  ], Date.parse(H), Date.parse(H) + 36e5);
  assert.strictEqual(e.rows.length, 1);
  assert.strictEqual(e.summary.h, 1);
});
t("прапорець «завантажив скрипти сайту» ставиться за годину, країну і пристрій", () => {
  const e = buildEdge([{ t: H, p: "/", c: "DE", d: "mobile", ua: IPH, n: 1 }, { t: H, p: "/", c: "US", d: "desktop", ua: HUMANS["Edge Windows"], n: 1 }], 0, 1, new Set([`${H}|DE|${IPH}`]));
  assert.deepStrictEqual(e.rows.map((r) => r[11]), [1, 0]);
});
t("у знімок не потрапляє сирий User-Agent", () => {
  const e = buildEdge([{ t: H, p: "/", c: "DE", d: "mobile", ua: IPH, n: 1 }, { t: H, p: "/", c: "US", d: "desktop", ua: "curl/8.5.0", n: 1 }], 0, 1);
  const s = JSON.stringify(e);
  assert.ok(!/AppleWebKit|iPhone OS|8\.5\.0/.test(s), "знайдено фрагмент User-Agent: " + s.slice(0, 200));
});
t("підсумок: люди, підозрілі й боти за видами; кількість запитів зберігається", () => {
  const e = buildEdge([
    { t: H, p: "/", c: "DE", d: "mobile", ua: IPH, n: 2 },
    { t: H, p: "/", c: "US", d: "desktop", ua: "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)", n: 3 },
    { t: H, p: "/", c: "US", d: "desktop", ua: "curl/8.5.0", n: 1 },
  ], 0, 1);
  assert.strictEqual(e.summary.total, 6); assert.strictEqual(e.summary.h, 2); assert.strictEqual(e.summary.b, 4);
  assert.strictEqual(e.summary.kinds.ai, 3); assert.strictEqual(e.summary.kinds.tool, 1);
});
t("parseUA: iOS Safari / Edge / Android", () => {
  assert.deepStrictEqual([parseUA(IPH).br, parseUA(IPH).os], ["Safari", "iOS"]);
  assert.deepStrictEqual([parseUA(HUMANS["Edge Windows"]).br, parseUA(HUMANS["Edge Windows"]).os], ["Edge", "Windows"]);
  assert.strictEqual(parseUA(AND).os, "Android");
});

// ---------- 6. Збої Cloudflare API: не валять деплой, дають зрозумілу підказку ----------
const okResp = (rows) => ({ data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: rows }] } } });
const row = (p) => ({ count: 1, dimensions: { datetimeHour: H, clientRequestPath: p, clientCountryName: "de", userAgent: IPH, clientDeviceType: "mobile" } });
(async () => {
  await ta("API: звичайна відповідь розбирається, країна у верхньому регістрі", async () => {
    const r = await fetchEdgeRows(async () => okResp([row("/a/"), row("/b/")]), "zone", Date.parse(H), Date.parse(H) + 36e5);
    assert.strictEqual(r.length, 2); assert.strictEqual(r[0].c, "DE");
  });
  await ta("API: запити до скриптів → множина ключів година|країна|UA", async () => {
    const set = await fetchEdgeScripts(async () => ({ data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: [{ count: 1, dimensions: { datetimeHour: H, clientCountryName: "de", userAgent: IPH } }] }] } } }), "z", Date.parse(H), Date.parse(H) + 36e5);
    assert.ok(set.has(`${H}|DE|${IPH}`));
  });
  await ta("API: немає права Zone Analytics → зрозуміла підказка", async () => {
    await assert.rejects(fetchEdgeRows(async () => ({ errors: [{ message: "zone 'x' does not have access to the path" }] }), "z", 0, 1000), /Zone → Analytics → Read/);
  });
  await ta("API: ліміт запитів (Rate limiter) → помилка з текстом, а не тиша", async () => {
    await assert.rejects(fetchEdgeRows(async () => ({ errors: [{ message: "Rate limiter budget depleted. Please try again after 5 minutes." }] }), "z", 0, 1000), /Rate limiter/);
  });
  await ta("API: невідоме поле методу → повторний запит без фільтра за методом", async () => {
    let calls = 0;
    const r = await fetchEdgeRows(async (q) => { calls++; return /clientRequestHTTPMethodName/.test(q) ? { errors: [{ message: 'unknown field "clientRequestHTTPMethodName"' }] } : okResp([row("/a/")]); }, "z", 0, 1000);
    assert.strictEqual(r.length, 1); assert.strictEqual(calls, 2);
  });
  await ta("API: порожня відповідь без зони → зрозуміла помилка", async () => {
    await assert.rejects(fetchEdgeRows(async () => ({ data: { viewer: { zones: [] } } }), "z", 0, 1000), /ID зони/);
  });
  console.log(`bot-rules: ${n - failed}/${n} перевірок пройдено`);
  if (failed) process.exit(1);
})();
