// Перевірка зібраного сайту (_site): внутрішні посилання, якорі, ресурси, базові вимоги до сторінок.
// Запуск: npm run build && npm test
const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "..", "_site");
const errors = [];
const warn = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}

const files = walk(SITE);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const ids = new Map();

function urlOf(file) {
  return "/" + path.relative(SITE, file).replace(/\\/g, "/").replace(/index\.html$/, "");
}

for (const f of htmlFiles) {
  const html = fs.readFileSync(f, "utf8");
  ids.set(urlOf(f), new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}

function resolve(target) {
  const clean = decodeURIComponent(target.split("#")[0].split("?")[0]);
  const p = path.join(SITE, clean);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return urlOf(p);
  if (fs.existsSync(path.join(p, "index.html"))) return urlOf(path.join(p, "index.html"));
  if (fs.existsSync(p + ".html")) return urlOf(p + ".html");
  return null;
}

// Сторінки, які навмисно не відповідають загальному шаблону сайту
const standalone = /^\/(scales|materialy|secret\/files)\//;

for (const f of htmlFiles) {
  const url = urlOf(f);
  const html = fs.readFileSync(f, "utf8");
  // HTML всередині прикладів коду не перевіряємо
  const body = html.replace(/<(script|style|pre|code)\b[\s\S]*?<\/\1>/gi, "");

  for (const m of body.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const t = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(t) || t.startsWith("//")) continue;
    if (t.startsWith("#")) {
      const id = t.slice(1);
      if (id && !ids.get(url).has(decodeURIComponent(id))) errors.push(`${url}: якір ${t} не знайдено`);
      continue;
    }
    if (!t.startsWith("/")) { warn.push(`${url}: відносне посилання ${t}`); continue; }
    const target = resolve(t);
    if (!target) { errors.push(`${url}: бите посилання ${t}`); continue; }
    const hash = t.split("#")[1];
    // Якорі /dopomoha/#стан-крок обробляє скрипт сторінки
    if (hash && ids.has(target) && !ids.get(target).has(decodeURIComponent(hash)) && !target.startsWith("/dopomoha/")) {
      errors.push(`${url}: якір ${t} не знайдено на ${target}`);
    }
  }

  if (standalone.test(url) || url === "/404.html") continue;
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) errors.push(`${url}: заголовків h1 — ${h1}, має бути 1`);
  if (!/<meta name="viewport"/.test(html)) errors.push(`${url}: немає meta viewport`);
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${url}: немає title`);
  if (!/rel="canonical"/.test(html) && !/noindex/.test(html)) errors.push(`${url}: немає canonical`);
}

for (const f of files.filter((x) => x.endsWith(".html") && /\/scales\//.test(x))) {
  if (!/noindex/.test(fs.readFileSync(f, "utf8"))) errors.push(`${urlOf(f)}: службова сторінка без noindex`);
}

warn.forEach((w) => console.warn("попередження: " + w));
if (errors.length) {
  errors.forEach((e) => console.error("ПОМИЛКА: " + e));
  console.error(`\n${errors.length} помилок у ${htmlFiles.length} сторінках`);
  process.exit(1);
}
console.log(`OK: ${htmlFiles.length} сторінок, внутрішні посилання й якорі на місці`);
