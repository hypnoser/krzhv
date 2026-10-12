// Дані збірки.
// time — версія офлайн-кешу /dopomoha/sw.js.
// version — короткий хеш файлів /assets/css і /assets/js: додається до їхніх адрес (?v=…),
// щоб після оновлення браузери не брали стару версію з кешу.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function assetsHash() {
  const h = crypto.createHash("sha1");
  for (const dir of ["src/assets/css", "src/assets/js"]) {
    const abs = path.join(__dirname, "..", "..", dir);
    for (const f of fs.readdirSync(abs).sort()) h.update(f).update(fs.readFileSync(path.join(abs, f)));
  }
  return h.digest("hex").slice(0, 10);
}

module.exports = { time: Date.now(), version: assetsHash() };
