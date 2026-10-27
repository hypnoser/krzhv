// Правила відсіювання ботів для серверних запитів Cloudflare (без JavaScript-лічильника).
//
// Вхід: рядки {t, p, c, d, ua, n}: година, шлях, країна, тип пристрою, User-Agent, кількість запитів.
// Вихід: той самий рядок із вердиктом v: "h" — схоже на людину, "s" — підозріло, "b" — бот,
// а також браузер, ОС, вид бота (k) і назвою (nm). Сам User-Agent у результат не потрапляє.
//
// Розрізняємо ТРИ рівні, щоб не втратити живих відвідувачів: «бот» (явна ознака) відсіюється завжди,
// «підозріло» (Linux-десктоп без браузерних ознак, дуже старий Chrome, хвиля запитів з одного пристрою)
// показується окремо й за замовчуванням не рахується людьми.
"use strict";

const KINDS = {
  ai: "AI-боти й асистенти",
  search: "Пошукові роботи",
  seo: "SEO-сервіси",
  social: "Прев'ю посилань (месенджери, соцмережі)",
  monitor: "Моніторинг доступності",
  scanner: "Сканери безпеки й мережі",
  tool: "Скрипти й бібліотеки",
  headless: "Автоматизовані браузери, тести швидкості",
  other: "Інші роботи",
  burst: "Хвилі запитів з одного пристрою",
  empty: "Без User-Agent",
};

// [вид, регулярний вираз]. Порядок важливий: перший збіг визначає вид.
const RULES = [
  ["ai", /xai-|kimibot|reflectionbot|meta-webindexer|gptbot|chatgpt|oai-searchbot|claudebot|claude-(?:user|searchbot|web)|anthropic|perplexity|bytespider|ccbot|amazonbot|duckassistbot|mistralai|cohere-|meta-external|keenable|diffbot|youbot|timpibot|omgili|imagesiftbot|ai2bot|openai|google-extended|gemini/i],
  ["search", /kgbsearch|searchbot|googlebot|google-inspectiontool|googleother|adsbot|mediapartners|apis-google|feedfetcher|google-read-aloud|storebot|bingbot|bingpreview|msnbot|slurp|duckduckbot|baiduspider|yandex(?:bot|images|metrika|direct|market)|sogou|seznambot|applebot|petalbot|qwantify|mojeek|naverbot|yeti\/|coccoc|ia_archiver|archive\.org_bot/i],
  ["seo", /ahrefs|semrush|mj12bot|dotbot|blexbot|barkrowler|dataforseo|serpstat|screaming frog|sistrix|majestic|seokicks|linkdex|rogerbot|exabot|zoominfo|spyfu/i],
  ["social", /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|whatsapp\/|skypeuripreview|pinterestbot|redditbot|tumblr|vkshare|mastodon|embedly|bitlybot|flipboard/i],
  ["monitor", /health ?check|uptimerobot|pingdom|statuscake|site24x7|betteruptime|better stack|datadog|newrelic|checkly|freshping|uptime-kuma|nodeping|hetrixtools|zabbix|nagios|prometheus|blackbox|healthcheck/i],
  ["scanner", /palo alto|cortex|xpanse|censys|shodan|zgrab|masscan|nmap|nuclei|nessus|acunetix|sqlmap|nikto|l9scan|l9explore|l9tcpid|leakix|binaryedge|internet-measurement|researchscan|netcraft|expanse|qualys|openvas|wpscan|gobuster|dirbuster|ffuf|\bzap\b|\bburp|scanner|[\s\/\-_]scan\b|cmsscan|sniffer|fingerprint|modat|builtwith|checker|validator|snapshot|inventory|indexer/i],
  ["headless", /headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|lighthouse|ptst|gtmetrix|webpagetest|pagespeed|jsdom|cypress|nightmare/i],
  ["tool", /curl|wget|python|aiohttp|httpx|go-http|java\/|okhttp|axios|node-fetch|undici|libwww|scrapy|quic-go|google-apps-script|postman|insomnia|httpie|apache-httpclient|\bruby\b|php\/|\bperl\b|guzzle|restsharp|dart:io|superagent/i],
];
// Загальні ознаки робота: слово bot/crawler/spider, або контактна адреса в User-Agent («+https://…»).
// Виняток: телефони бренду Cubot (CUBOT_X30), у яких «bot» — частина назви моделі.
const GENERIC = /(?:^|[^a-z])(?:bot|crawler|spider|crawl|scraper|fetcher)(?:[^a-z]|$)|bot[\/;)]|\+https?:\/\//i;
// «(compatible; Назва/1.0)» без MSIE — так підписуються роботи, браузери так не пишуть.
const COMPAT = /\(compatible;\s*(?!MSIE)[^;)\/]*\/[\d.]+/i;
const NOT_BOT = /cubot/i;

function parseUA(ua) {
  const u = String(ua || "");
  let os = "Інша";
  if (/iPhone|iPad|iPod/.test(u)) os = "iOS";
  else if (/Android/.test(u)) os = "Android";
  else if (/Windows NT/.test(u)) os = "Windows";
  else if (/Macintosh|Mac OS X/.test(u)) os = "macOS";
  else if (/CrOS/.test(u)) os = "ChromeOS";
  else if (/Linux|X11/.test(u)) os = "Linux";
  let br = "Інший";
  if (/FBAN|FBAV/.test(u)) br = "Facebook (у застосунку)";
  else if (/Instagram/.test(u)) br = "Instagram (у застосунку)";
  else if (/EdgA|EdgiOS|Edg\//.test(u)) br = "Edge";
  else if (/OPR\/|Opera/.test(u)) br = "Opera";
  else if (/SamsungBrowser/.test(u)) br = "Samsung Internet";
  else if (/YaBrowser/.test(u)) br = "Яндекс Браузер";
  else if (/FxiOS|Firefox\//.test(u)) br = "Firefox";
  else if (/CriOS|Chrome\//.test(u)) br = "Chrome";
  else if (/Safari\//.test(u) && /Version\//.test(u)) br = "Safari";
  else if (/MSIE|Trident/.test(u)) br = "Internet Explorer";
  const m = /Chrome\/(\d+)/.exec(u);
  const f = /Firefox\/(\d+)/.exec(u), v = /Version\/(\d+)/.exec(u), i = /iPhone OS (\d+)_|CPU OS (\d+)_/.exec(u);
  return { br, os, ff: f ? parseInt(f[1], 10) : 0, safari: v ? parseInt(v[1], 10) : 0, ios: i ? parseInt(i[1] || i[2], 10) : 0, chrome: m ? parseInt(m[1], 10) : 0, winOld: /Windows NT 6\.[0-3]/.test(u), linuxDesk: /X11; Linux|X11; Ubuntu/.test(u) && !/Android/.test(u) };
}

// Вердикт лише за User-Agent. floors = {chrome, firefox}: версії, нижче яких браузер вважається підозріло старим.
const WEBKIT = /AppleWebKit\/\d+\.\d+(?:\.\d+)? \(KHTML, like Gecko\)/;
const GECKO = /Gecko\/20100101 Firefox\/\d+\.\d+/;
const ANCIENT = /OS\/2|Symbian|Minimo|Windows (?:95|98|NT [2345]\.)|Mac OS X 10[._](?:\d|1[0-4])(?!\d)/i;
function classifyUA(ua, floors) {
  floors = typeof floors === "number" ? { chrome: floors } : floors || {};
  const u = String(ua || "").trim();
  const p = parseUA(u);
  const out = { v: "h", k: "", nm: "", w: "", br: p.br, os: p.os };
  const sus = (w) => { out.v = "s"; out.w = w; return out; };
  if (u.length < 8) { out.v = "b"; out.k = "empty"; out.w = "порожній User-Agent"; return out; }
  if (!NOT_BOT.test(u)) {
    for (const [kind, re] of RULES) {
      const m = re.exec(u);
      if (m) { out.v = "b"; out.k = kind; out.nm = m[0].replace(/^[\s\/\-_]+|[\/;]+$/g, "").slice(0, 40); out.w = "відомий " + (KINDS[kind] || kind).toLowerCase(); return out; }
    }
    if (GENERIC.test(u) || COMPAT.test(u)) { out.v = "b"; out.k = "other"; out.nm = "робот"; out.w = "ознака робота в User-Agent"; return out; }
  }
  if (!/^(?:Mozilla|Opera)\//.test(u)) return sus("User-Agent не схожий на браузер");
  if (/MSIE|Trident/.test(u)) return sus("Internet Explorer");
  // Справжні браузери пишуть User-Agent повністю; скорочені або «склеєні» рядки роблять скрипти
  if (!WEBKIT.test(u) && !GECKO.test(u) && !/Gecko\/\d+ Firefox\/\d+\.\d+/.test(u)) return sus("схоже на підроблений або скорочений User-Agent");
  if (/Chrome\/\d+/.test(u) && !/Chrome\/\d+\.\d+\.\d+\.\d+/.test(u)) return sus("неповна версія Chrome в User-Agent");
  if (/Firefox\/\d+(?![\d.])/.test(u)) return sus("неповна версія Firefox в User-Agent");
  if (/\bEdge\/\d+/.test(u)) return sus("застарілий Edge у поєднанні з новим Chrome");
  if (ANCIENT.test(u)) return sus("дуже старий пристрій або ОС");
  if (p.ios && p.safari && ((p.safari >= 26 && p.ios !== 18) || (p.safari <= 18 && p.ios !== p.safari))) return sus("версії iOS і Safari в User-Agent суперечать одна одній");
  if (p.safari && p.safari < 15 && !p.chrome) return sus("дуже стара версія Safari");
  if (p.linuxDesk) return sus("Linux-десктоп");
  if (floors.chrome && p.chrome && p.chrome < floors.chrome && !(p.winOld && p.chrome >= 100 && p.chrome <= 109)) return sus("дуже стара версія Chrome " + p.chrome);
  if (floors.firefox && p.ff && p.ff < floors.firefox && !(p.winOld && p.ff >= 102 && p.ff <= 115)) return sus("дуже стара версія Firefox " + p.ff);
  return out;
}

const worse = (a, b) => (a === "b" || b === "b" ? "b" : a === "s" || b === "s" ? "s" : "h");

// Класифікація пакета рядків: правила за User-Agent + «хвилі» запитів з одного пристрою за годину.
// opts.maxBurstPaths — скільки різних сторінок за годину ще схоже на людину (за замовчуванням 5): понад це — «підозріло»,
// від 5× цієї кількості (або 16× запитів) — бот. Багато запитів на одну сторінку ботом не вважається.
function classifyRows(rows, opts) {
  opts = opts || {};
  const human = opts.maxBurstPaths || 5;
  // Орієнтир «свіжості»: найвища версія, що трапляється щонайменше двічі серед не-ботів (одинична версія — найчастіше підробка).
  const maj = { chrome: new Map(), ff: new Map() };
  rows.forEach((r) => {
    const u = r.ua || "";
    if (RULES.some(([, re]) => re.test(u)) || GENERIC.test(u) || COMPAT.test(u)) return;
    const p = parseUA(u);
    if (p.chrome) maj.chrome.set(p.chrome, (maj.chrome.get(p.chrome) || 0) + r.n);
    if (p.ff) maj.ff.set(p.ff, (maj.ff.get(p.ff) || 0) + r.n);
  });
  const newest = (m) => { const all = [...m.keys()].sort((a, b) => b - a); return all.find((k) => m.get(k) >= 2) || all[0] || 0; };
  const nc = newest(maj.chrome), nf = newest(maj.ff);
  const floors = { chrome: nc ? Math.max(100, nc - 25) : 0, firefox: nf ? Math.max(100, nf - 25) : 0 };
  // Хвилі: той самий пристрій (країна + User-Agent) за годину відкриває забагато різних сторінок
  const grp = new Map();
  rows.forEach((r) => {
    const k = r.t + "|" + r.c + "|" + r.ua;
    const g = grp.get(k) || { n: 0, paths: new Set() };
    g.n += r.n; g.paths.add(r.p); grp.set(k, g);
  });
  return rows.map((r) => {
    const c = classifyUA(r.ua, floors);
    const g = grp.get(r.t + "|" + r.c + "|" + r.ua);
    let v = c.v, w = c.w;
    if (v !== "b" && g) {
      // Той самий User-Agent у одній країні можуть мати багато різних людей (скорочений UA Chrome Android, iOS Safari),
      // тому багато запитів на ОДНУ сторінку — не ознака робота. Ознака обходу сайту — багато РІЗНИХ сторінок за годину.
      if (g.paths.size >= human * 5 || g.n >= human * 16) { v = "b"; w = `хвиля: ${g.n} запитів / ${g.paths.size} сторінок за годину з одного пристрою`; }
      else if (g.paths.size > human) { v = "s"; w = `обхід сайту? ${g.paths.size} різних сторінок за годину з одного пристрою`; }
    }
    return { t: r.t, p: r.p, c: r.c, d: r.d, br: c.br, os: c.os, v, k: v === "b" ? (c.k || "burst") : "", nm: c.nm, w, n: r.n };
  });
}

// Шляхи, які не є відвідуванням сайту (службові/закриті): не рахуємо взагалі.
const IGNORE_PATH = /^\/(?:secret|cdn-cgi|\.well-known)(?:\/|$)|^\/(?:robots\.txt|sitemap\.xml|llms\.txt|feed\.xml|favicon\.ico)$/i;

module.exports = { KINDS, RULES, parseUA, classifyUA, classifyRows, IGNORE_PATH };
