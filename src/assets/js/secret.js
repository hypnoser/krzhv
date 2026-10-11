/*
  secret.js — шифрування захищеного розділу /secret/.

  Схема: пароль → PBKDF2-SHA256 (600 000 ітерацій, сіль нижче) → ключ AES-GCM 256.
  Ключ (не пароль) зберігається в localStorage, тому пароль вводиться один раз на браузер.
  Файли в src/secret/files/ лежать у репозиторії ВЖЕ зашифрованими — відкритого тексту
  на GitHub немає. Шифрує сторінка /secret/ у браузері (блок «Додати файл»).

  Зміна пароля: згенерувати нові SALT і VERIFIER, перешифрувати всі файли.
*/
(function (root) {
  "use strict";

  var SALT = "vekAAlF2WOacVZ15k4CN7A==";
  var ITER = 600000;
  var STORE_KEY = "krzhv-secret-key-v1";
  // Зашифрований рядок "krzhv-secret-ok" — перевірка пароля без жодного файлу
  var VERIFIER = { iv: "Cc7GDrbf0JANYTEu", ct: "pzTG4bMLkktSNehI/Xj9+J0MW49375WPPe4DZINW9w==" };

  var subtle = root.crypto.subtle;

  function b64e(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }
  function b64d(str) {
    var bin = atob(str), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(password) {
    var base = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey(
      { name: "PBKDF2", salt: b64d(SALT), iterations: ITER, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
  }

  async function encrypt(key, text) {
    var iv = root.crypto.getRandomValues(new Uint8Array(12));
    var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(text));
    return { iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
  }

  async function decrypt(key, blob) {
    var pt = await subtle.decrypt({ name: "AES-GCM", iv: b64d(blob.iv) }, key, b64d(blob.ct));
    return new TextDecoder().decode(pt);
  }

  async function verify(key) {
    try { return (await decrypt(key, VERIFIER)) === "krzhv-secret-ok"; } catch (e) { return false; }
  }

  // Вхід паролем: повертає ключ і запам'ятовує його в браузері, або null
  async function login(password) {
    var key = await deriveKey(password);
    if (!(await verify(key))) return null;
    var raw = new Uint8Array(await subtle.exportKey("raw", key));
    try { root.localStorage.setItem(STORE_KEY, b64e(raw)); } catch (e) {}
    return key;
  }

  // Ключ із пам'яті браузера, або null
  async function savedKey() {
    var s = null;
    try { s = root.localStorage.getItem(STORE_KEY); } catch (e) {}
    if (!s) return null;
    try {
      var key = await subtle.importKey("raw", b64d(s), "AES-GCM", true, ["encrypt", "decrypt"]);
      if (await verify(key)) return key;
    } catch (e) {}
    logout();
    return null;
  }

  function logout() {
    try { root.localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  /*
    Завантажувач, що вбудовується в кожен зашифрований файл.
    Самодостатній: не залежить від цього скрипта, тож старі файли працюють
    і після змін у secret.js (поки не змінено пароль).
  */
  function krzhvLoader(cfg) {
    var subtle = crypto.subtle;
    function b64d(str) {
      var bin = atob(str), out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    function b64e(bytes) {
      var s = "";
      for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    }
    async function open(key) {
      var pt = await subtle.decrypt({ name: "AES-GCM", iv: b64d(cfg.data.iv) }, key, b64d(cfg.data.ct));
      var html = new TextDecoder().decode(pt);
      document.open();
      document.write(html);
      document.close();
    }
    var form = document.getElementById("f"), msg = document.getElementById("m"), btn = document.getElementById("b");
    (async function () {
      var s = null;
      try { s = localStorage.getItem(cfg.storeKey); } catch (e) {}
      if (s) {
        try { await open(await subtle.importKey("raw", b64d(s), "AES-GCM", false, ["decrypt"])); return; }
        catch (e) { try { localStorage.removeItem(cfg.storeKey); } catch (e2) {} }
      }
      document.getElementById("w").hidden = false;
      document.getElementById("p").focus();
    })();
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      btn.disabled = true; msg.textContent = "Перевіряю…";
      try {
        var base = await subtle.importKey("raw", new TextEncoder().encode(document.getElementById("p").value), "PBKDF2", false, ["deriveKey"]);
        var key = await subtle.deriveKey({ name: "PBKDF2", salt: b64d(cfg.salt), iterations: cfg.iter, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
        var raw = new Uint8Array(await subtle.exportKey("raw", key));
        await open(key);
        try { localStorage.setItem(cfg.storeKey, b64e(raw)); } catch (e) {}
      } catch (e) {
        msg.textContent = "Невірний пароль"; btn.disabled = false;
      }
    });
  }

  // Повний текст зашифрованого файлу для src/secret/files/
  async function buildFile(key, meta, html) {
    var data = await encrypt(key, html);
    var encMeta = await encrypt(key, JSON.stringify(meta));
    var cfg = { salt: SALT, iter: ITER, storeKey: STORE_KEY, data: data };
    return [
      "<!doctype html>",
      '<html lang="uk"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="robots" content="noindex, nofollow">',
      "<title>Захищений документ</title>",
      '<script type="application/json" id="krzhv-meta">' + JSON.stringify(encMeta) + "</script>",
      "<style>body{margin:0;font:16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#FCFAF6;color:#221F1B}",
      "#w{max-width:340px;margin:18vh auto 0;padding:0 16px}h1{font-size:20px;font-weight:600;margin:0 0 16px}",
      "input,button{width:100%;font:inherit;padding:12px;border-radius:6px;border:1px solid #E6E0D3;margin-bottom:10px}",
      "button{background:#3D5A4A;color:#fff;border:0;cursor:pointer}#m{min-height:1.5em;color:#A25E37;font-size:14px}</style>",
      "</head><body>",
      '<div id="w" hidden><h1>Захищений документ</h1><form id="f">',
      '<input id="p" type="password" placeholder="Пароль" autocomplete="current-password" required>',
      '<button id="b" type="submit">Відкрити</button><div id="m" role="status"></div></form></div>',
      "<noscript>Для перегляду потрібен JavaScript.</noscript>",
      "<script>(" + krzhvLoader.toString() + ")(" + JSON.stringify(cfg) + ");</script>",
      "</body></html>",
      ""
    ].join("\n");
  }

  root.KrzhvSecret = {
    login: login, savedKey: savedKey, logout: logout,
    encrypt: encrypt, decrypt: decrypt, buildFile: buildFile
  };
})(typeof window !== "undefined" ? window : globalThis);
