// Перевірка scripts/gsc.js на імітованих серверах Google (без мережі й без справжнього ключа).
"use strict";
const http = require("http");
const crypto = require("crypto");
const assert = require("assert");

(async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const seen = { jwt: null, bodies: [] };
  const srv = http.createServer((req, res) => {
    let b = ""; req.on("data", (d) => (b += d));
    req.on("end", () => {
      const send = (code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
      if (req.url === "/token") {
        seen.jwt = new URLSearchParams(b).get("assertion");
        return send(200, { access_token: "tok123" });
      }
      assert.strictEqual(req.headers.authorization, "Bearer tok123");
      assert.ok(req.url.startsWith("/sites/sc-domain%3Akrzhv.com.ua/searchAnalytics/query"), req.url);
      const body = JSON.parse(b); seen.bodies.push(body);
      if (!body.dimensions) return send(200, { rows: [{ clicks: 10, impressions: 200, ctr: 0.05, position: 8.44 }] });
      if (body.dimensions[0] === "date") return send(200, { rows: [{ keys: ["2026-10-02"], clicks: 4, impressions: 90 }, { keys: ["2026-10-01"], clicks: 6, impressions: 110 }] });
      return send(200, { rows: [{ keys: ["що таке агорафобія", "https://krzhv.com.ua/statti/ahorafobiia/"], clicks: 7, impressions: 120, ctr: 0.058, position: 5.26 }] });
    });
  }).listen(0);
  await new Promise((r) => srv.on("listening", r));
  const port = srv.address().port;
  process.env.GSC_API_URL = `http://127.0.0.1:${port}`;
  const { fetchGsc, parseKey } = require("./gsc");
  const key = { client_email: "bot@x.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: `http://127.0.0.1:${port}/token` };

  const g = await fetchGsc({ key: JSON.stringify(key), site: "sc-domain:krzhv.com.ua", days: 30 });
  assert.deepStrictEqual(g.totals, { clicks: 10, impressions: 200, ctr: 0.05, position: 8.4 });
  assert.deepStrictEqual(g.daily.map((d) => d[0]), ["2026-10-01", "2026-10-02"]);
  assert.deepStrictEqual(g.rows[0], ["що таке агорафобія", "/statti/ahorafobiia/", 7, 120, 5.3]);
  assert.strictEqual(g.days, 30);
  // підпис JWT перевіряється відкритим ключем, права — лише читання
  const [h, p, s] = seen.jwt.split(".");
  assert.ok(crypto.createVerify("RSA-SHA256").update(h + "." + p).verify(publicKey, Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")));
  const claim = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.strictEqual(claim.scope, "https://www.googleapis.com/auth/webmasters.readonly");
  assert.strictEqual(claim.iss, key.client_email);
  assert.ok(seen.bodies.every((b) => b.dataState === "final"));
  // ключ у base64 теж приймається, зіпсований ключ дає зрозумілу помилку
  assert.strictEqual(parseKey(Buffer.from(JSON.stringify(key)).toString("base64")).client_email, key.client_email);
  assert.throws(() => parseKey('{"a":1}'), /client_email/);
  await assert.rejects(fetchGsc({ key: JSON.stringify(key), site: "" }), /GSC_SITE/);
  srv.close();
  console.log("gsc: усі перевірки пройдено");
})().catch((e) => { console.error(e); process.exit(1); });
