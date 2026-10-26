/**
 * krzhv-mailer — МОДУЛЬ для наявного проєкту Apps Script (разом із Telegram-ботом).
 * Нічого в боті не змінює: використовує лише імена з префіксом krzhv і власні властивості скрипту.
 *
 * Підключення до наявного doPost: додати ПЕРШИМИ рядками всередині doPost(e)
 *     const krzhvRes = krzhvMailRoute_(e);
 *     if (krzhvRes) return krzhvRes;
 * Якщо запит не від krzhv-агента, функція повертає null, і бот працює як раніше.
 *
 * Script properties: KRZHV_TOKEN, KRZHV_GH_TOKEN, KRZHV_GH_REPO (наприклад hypnoser/krzhv).
 * Без емодзі в темах і тексті: Gmail їх псує.
 */
const KRZHV_TAG = '[krzhv]';
const KRZHV_L_DRAFT = 'krzhv-draft';
const KRZHV_L_DONE = 'krzhv-done';
const KRZHV_L_EDIT = 'krzhv-edit';
const KRZHV_TICK = 'krzhvMailTick';

function krzhvMailRoute_(e) {
  let req;
  try {
    if (!e || !e.postData || !e.postData.contents) return null;
    req = JSON.parse(e.postData.contents);
  } catch (x) { return null; }
  if (!req || req.krzhv !== 1) return null;
  try {
    const token = PropertiesService.getScriptProperties().getProperty('KRZHV_TOKEN');
    if (!token || req.token !== token) return krzhvOut_({ ok: false, error: 'forbidden' });
    krzhvEnsureTrigger_(); // самовідновлення: тригер існує, поки агент звертається до скрипта
    if (req.action === 'send') return krzhvOut_(krzhvSend_(req));
    if (req.action === 'poll') return krzhvOut_(krzhvPoll_(req));
    if (req.action === 'done') return krzhvOut_(krzhvDone_(req));
    if (req.action === 'status') return krzhvOut_(krzhvStatus_(req));
    return krzhvOut_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return krzhvOut_({ ok: false, error: String(err) });
  }
}

function krzhvOut_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function krzhvMe_() { return Session.getEffectiveUser().getEmail(); }
function krzhvLabel_(n) { return GmailApp.getUserLabelByName(n) || GmailApp.createLabel(n); }
function krzhvBlob_(a) { return Utilities.newBlob(Utilities.base64Decode(a.b64), a.mime, a.name); }
function krzhvProps_() { return PropertiesService.getScriptProperties(); }

function krzhvSend_(req) {
  let subject = String(req.subject || '').trim();
  if (subject.indexOf(KRZHV_TAG) !== 0) subject = KRZHV_TAG + ' ' + subject;
  // Унікальна тема: нова версія чернетки не повинна потрапити в стару (done) гілку Gmail.
  if (req.kind === 'draft') subject += ' · ' + Utilities.formatDate(new Date(), 'Europe/Kyiv', 'dd.MM HH:mm');
  const opts = { htmlBody: req.html, name: 'krzhv · агент контенту' };
  if (req.attachments && req.attachments.length) opts.attachments = req.attachments.map(krzhvBlob_);
  if (req.inline && req.inline.length) {
    opts.inlineImages = {};
    req.inline.forEach(function (a) { opts.inlineImages[a.cid] = krzhvBlob_(a); });
  }
  GmailApp.sendEmail(krzhvMe_(), subject, req.text || 'Лист потрібно відкрити в HTML-режимі.', opts);
  let threadId = null;
  if (req.kind === 'draft') {
    const q = 'in:anywhere from:me to:me newer_than:1d subject:"' + subject.replace(/"/g, '') + '"';
    let t = null;
    for (let i = 0; i < 4 && !t; i++) { Utilities.sleep(3000); t = GmailApp.search(q, 0, 1)[0]; }
    if (!t) return { ok: false, error: 'лист надіслано, але гілку не знайдено: НЕ надсилай вдруге, перевір mail.py status', subject: subject };
    t.addLabel(krzhvLabel_(KRZHV_L_DRAFT));
    threadId = t.getId();
    krzhvProps_().setProperty('krzhv_meta_' + threadId, JSON.stringify({
      publishAt: req.publishAt || null, urls: req.publishUrls || [], title: req.title || subject,
    }));
  }
  return { ok: true, threadId: threadId, subject: subject };
}

function krzhvStrip_(text) {
  const keep = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^(--|__)\s*$|^[*_~\s]*(з повагою|з пошаною|best regards|regards|sent from|надіслано з)/i.test(l.trim())) break; // підпис (також у markdown: *З повагою,*)
    if (/^>/.test(l) || /^(On .+wrote:|.+пише:|.+написав.*:|-{3,}\s*Original|(пише|wrote):?$|(пн|вт|ср|чт|пт|сб|нд|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[.,]?\s+\d{1,2}\s+\S+\.?\s+\d{4})/i.test(l.trim())) break; // Gmail UA переносить «пише:» на окремий рядок
    keep.push(l);
  }
  return keep.join('\n').trim().slice(0, 4000);
}

// «ОК» будь-якою розкладкою (кирилиця/латиниця, будь-який регістр, змішано), також «окей/okay»; після слова дозволені лише розділові знаки, пробіли, емодзі.
function krzhvIsOk_(txt) { return /^[\s​-‍﻿]*[oOоО][kKкК](?:[eEеЕ][yYйЙ]|[aAаА][yYуУ])?[^\p{L}\p{N}]*$/u.test(String(txt)); }

function krzhvEnsureTrigger_() {
  const has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === KRZHV_TICK; });
  if (!has) ScriptApp.newTrigger(KRZHV_TICK).timeBased().everyMinutes(5).create();
}
function krzhvRemoveTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === KRZHV_TICK) ScriptApp.deleteTrigger(t);
  });
}

// Обробник (тригер раз на 5 хвилин, постійний: створюється/відновлюється на кожен запит агента й не видаляється).
function krzhvMailTick() {
  const props = krzhvProps_();
  const busy = Number(props.getProperty('krzhv_busy') || 0);
  if (Date.now() - busy < 90000) return;
  props.setProperty('krzhv_busy', String(Date.now()));
  try {
    // Без -label:edit: пізніша відповідь «ОК» у гілці, яку раніше помилково/справді позначили правками, теж публікує.
    GmailApp.search('label:' + KRZHV_L_DRAFT + ' -label:' + KRZHV_L_DONE, 0, 20)
      .forEach(function (t) {
        const msgs = t.getMessages().filter(function (m) { return !m.isDraft(); }); // автозбережений чернетковий «ОК» не рахується
        if (msgs.length < 2) return;
        const last = msgs[msgs.length - 1];
        if (props.getProperty('krzhv_seen_' + t.getId()) === last.getId()) return; // цей лист уже опрацьовано
        const meta = JSON.parse(props.getProperty('krzhv_meta_' + t.getId()) || '{}');
        const txt = krzhvStrip_(last.getPlainBody()).trim();
        if (krzhvIsOk_(txt)) {
          if (meta.publishAt && new Date(meta.publishAt) > new Date()) return;
          props.setProperty('krzhv_seen_' + t.getId(), last.getId());
          krzhvPublish_(t, msgs[0], meta);
        } else {
          props.setProperty('krzhv_seen_' + t.getId(), last.getId());
          t.addLabel(krzhvLabel_(KRZHV_L_EDIT)); // правки: їх підхоплює агент
          // Мовчазної помилки бути не може: власник одразу бачить, як розпізнано відповідь.
          GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' Відповідь сприйнято як ПРАВКИ, не як ОК: ' + t.getFirstMessageSubject(),
            'Розпізнаний текст відповіді: «' + txt.slice(0, 300) + '».\n\nЦе не публікація. Агент внесе правки й надішле нову чернетку ' +
            '(перевірка правок щодня близько 15:23 за Києвом). Якщо це мало бути «ОК», надішліть у цій же гілці ще одну відповідь з єдиним словом ОК, без підпису.',
            { name: 'krzhv · агент контенту' });
        }
      });
    const verify = JSON.parse(props.getProperty('krzhv_verify') || '[]');
    const left = [];
    verify.forEach(function (v) {
      if (Date.now() < v.after) { left.push(v); return; }
      const code = UrlFetchApp.fetch(v.url + '?v=' + Date.now(), { muteHttpExceptions: true }).getResponseCode();
      if (code === 200) {
        GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' Сторінка відкривається: ' + v.title,
          'Сторінка відкривається: ' + v.url, { name: 'krzhv · агент контенту' });
      } else if (v.tries < 6) {
        v.tries++; v.after = Date.now() + 240000; left.push(v);
      } else {
        GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' УВАГА: сторінка не відкривається: ' + v.title,
          v.url + ' повертає ' + code + '. Перевірте вкладку Actions на GitHub.', { name: 'krzhv · агент контенту' });
      }
    });
    props.setProperty('krzhv_verify', JSON.stringify(left));
  } finally {
    props.deleteProperty('krzhv_busy');
  }
}

function krzhvToday_() { return Utilities.formatDate(new Date(), 'Europe/Kyiv', 'yyyy-MM-dd'); }
// Дати публікації = день фактичної публікації (власник міг відповісти «ОК» пізніше запланованого дня).
function krzhvStampDates_(text) {
  const d = krzhvToday_();
  return text.replace(/^(date|updated|reviewed):[ \t]*\d{4}-\d{2}-\d{2}[ \t]*$/gm, '$1: ' + d)
    .replace(/("datePublished":\s*")\d{4}-\d{2}-\d{2}(")/g, '$1' + d + '$2');
}

function krzhvPublish_(thread, first, meta) {
  const props = krzhvProps_();
  const gh = props.getProperty('KRZHV_GH_TOKEN'), repo = props.getProperty('KRZHV_GH_REPO');
  const files = first.getAttachments().filter(function (a) { return a.getName().indexOf('src__') === 0; });
  const title = meta.title || thread.getFirstMessageSubject();
  if (!gh || !repo || !files.length) {
    thread.addLabel(krzhvLabel_(KRZHV_L_EDIT));
    GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' УВАГА: публікація не виконана: ' + title,
      'Немає токена GitHub, репозиторію або файлів src__* у першому листі гілки.', { name: 'krzhv · агент контенту' });
    return;
  }
  const headers = { Authorization: 'Bearer ' + gh, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const commits = [];
  for (let i = 0; i < files.length; i++) {
    const path = files[i].getName().replace(/__/g, '/');
    const api = 'https://api.github.com/repos/' + repo + '/contents/' + encodeURI(path);
    const cur = UrlFetchApp.fetch(api + '?ref=main', { headers: headers, muteHttpExceptions: true });
    let content;
    if (/^src\/(statti|blog)\/[^\/]+\.md$/.test(path)) content = Utilities.base64Encode(krzhvStampDates_(files[i].getDataAsString('UTF-8')), Utilities.Charset.UTF_8);
    else content = Utilities.base64Encode(files[i].getBytes());
    const body = { message: 'Публікація: ' + title, branch: 'main', content: content };
    if (cur.getResponseCode() === 200) body.sha = JSON.parse(cur.getContentText()).sha;
    const r = UrlFetchApp.fetch(api, { method: 'put', headers: headers, contentType: 'application/json',
      payload: JSON.stringify(body), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200 && r.getResponseCode() !== 201) {
      thread.addLabel(krzhvLabel_(KRZHV_L_EDIT));
      GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' УВАГА: GitHub відхилив ' + path,
        'HTTP ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 500), { name: 'krzhv · агент контенту' });
      return;
    }
    try { commits.push(JSON.parse(r.getContentText()).commit.html_url); } catch (x) { /* не критично */ }
  }
  thread.addLabel(krzhvLabel_(KRZHV_L_DONE));
  props.deleteProperty('krzhv_meta_' + thread.getId());
  // Негайне підтвердження (не залежить від URL і від перевірки сторінки).
  GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' Опубліковано в main: ' + title,
    'Файли записано в main: ' + files.length + '.\n' + commits.join('\n') +
    '\nЗбірка на GitHub Actions триває 1-2 хвилини.' + ((meta.urls || []).length ? ' Сторінку перевірю самостійно (лист «Сторінка відкривається» або «УВАГА»).' : ''),
    { name: 'krzhv · агент контенту' });
  const verify = JSON.parse(props.getProperty('krzhv_verify') || '[]');
  (meta.urls || []).forEach(function (u) { verify.push({ url: u, title: title, after: Date.now() + 240000, tries: 0 }); });
  props.setProperty('krzhv_verify', JSON.stringify(verify));
}

// Для агента: гілки з правками (мітка krzhv-edit) і вкладення першого листа.
function krzhvPoll_(req) {
  const threads = GmailApp.search('label:' + KRZHV_L_EDIT + ' -label:' + KRZHV_L_DONE + ' newer_than:30d', 0, 20);
  return { ok: true, threads: threads.map(function (t) {
    const msgs = t.getMessages().filter(function (m) { return !m.isDraft(); });
    const item = { threadId: t.getId(), subject: t.getFirstMessageSubject(),
      replies: msgs.slice(1).map(function (m) { return { date: m.getDate().toISOString(), text: krzhvStrip_(m.getPlainBody()) }; }) };
    // isOk=true означає, що публікація на «ОК» не вдалась (лист УВАГА): правок немає, не переписуй чернетку.
    item.isOk = item.replies.length > 0 && krzhvIsOk_(item.replies[item.replies.length - 1].text);
    if (req.withAttachments) {
      item.attachments = msgs[0].getAttachments().map(function (a) {
        return { name: a.getName(), mime: a.getContentType(), b64: Utilities.base64Encode(a.getBytes()) };
      });
    }
    return item;
  }) };
}

// Стан усіх гілок krzhv за 14 днів (для агента й діагностики).
function krzhvStatus_(req) {
  const props = krzhvProps_();
  const threads = GmailApp.search('label:' + KRZHV_L_DRAFT + ' newer_than:14d in:anywhere', 0, 40);
  return { ok: true, today: krzhvToday_(), threads: threads.map(function (t) {
    const msgs = t.getMessages().filter(function (m) { return !m.isDraft(); });
    const last = msgs.length > 1 ? krzhvStrip_(msgs[msgs.length - 1].getPlainBody()).slice(0, 200) : '';
    const meta = JSON.parse(props.getProperty('krzhv_meta_' + t.getId()) || '{}');
    return { threadId: t.getId(), subject: t.getFirstMessageSubject(), date: msgs[0].getDate().toISOString(),
      labels: t.getLabels().map(function (l) { return l.getName(); }), inTrash: t.isInTrash(),
      replies: msgs.length - 1, lastReply: last, publishAt: meta.publishAt || null };
  }) };
}

function krzhvDone_(req) {
  const t = GmailApp.getThreadById(req.threadId);
  if (!t) return { ok: false, error: 'thread not found' };
  t.addLabel(krzhvLabel_(KRZHV_L_DONE));
  return { ok: true };
}

// Запустити ОДИН РАЗ вручну з редактора: надає дозволи й надсилає тестовий лист.
function krzhvMailSetup() {
  const p = krzhvProps_();
  ['KRZHV_TOKEN', 'KRZHV_GH_TOKEN', 'KRZHV_GH_REPO'].forEach(function (k) {
    if (!p.getProperty(k)) throw new Error('Немає властивості скрипту ' + k);
  });
  UrlFetchApp.fetch('https://api.github.com/repos/' + p.getProperty('KRZHV_GH_REPO'),
    { headers: { Authorization: 'Bearer ' + p.getProperty('KRZHV_GH_TOKEN') } });
  krzhvEnsureTrigger_();
  GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' Тест: модуль підключено', 'Дозволи надано, токен GitHub працює.', { name: 'krzhv · агент контенту' });
}
