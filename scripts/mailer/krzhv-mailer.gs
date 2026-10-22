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
    if (req.action === 'send') return krzhvOut_(krzhvSend_(req));
    if (req.action === 'poll') return krzhvOut_(krzhvPoll_(req));
    if (req.action === 'done') return krzhvOut_(krzhvDone_(req));
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
  const opts = { htmlBody: req.html, name: 'krzhv · агент контенту' };
  if (req.attachments && req.attachments.length) opts.attachments = req.attachments.map(krzhvBlob_);
  if (req.inline && req.inline.length) {
    opts.inlineImages = {};
    req.inline.forEach(function (a) { opts.inlineImages[a.cid] = krzhvBlob_(a); });
  }
  GmailApp.sendEmail(krzhvMe_(), subject, req.text || 'Лист потрібно відкрити в HTML-режимі.', opts);
  let threadId = null;
  if (req.kind === 'draft') {
    Utilities.sleep(3000);
    const q = 'in:anywhere from:me to:me newer_than:1d subject:"' + subject.replace(/"/g, '') + '"';
    const t = GmailApp.search(q, 0, 1)[0];
    if (t) {
      t.addLabel(krzhvLabel_(KRZHV_L_DRAFT));
      threadId = t.getId();
      krzhvProps_().setProperty('krzhv_meta_' + threadId, JSON.stringify({
        publishAt: req.publishAt || null, urls: req.publishUrls || [], title: req.title || subject,
      }));
      krzhvEnsureTrigger_();
    }
  }
  return { ok: true, threadId: threadId };
}

function krzhvStrip_(text) {
  const keep = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^>/.test(l) || /^(On .+wrote:|.+пише:|.+написав.*:|-{3,}\s*Original|(пише|wrote):?$|(пн|вт|ср|чт|пт|сб|нд|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[.,]?\s+\d{1,2}\s+\S+\.?\s+\d{4})/i.test(l.trim())) break; // Gmail UA переносить «пише:» на окремий рядок
    keep.push(l);
  }
  return keep.join('\n').trim().slice(0, 4000);
}

function krzhvEnsureTrigger_() {
  const has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === KRZHV_TICK; });
  if (!has) ScriptApp.newTrigger(KRZHV_TICK).timeBased().everyMinutes(1).create();
}
function krzhvRemoveTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === KRZHV_TICK) ScriptApp.deleteTrigger(t);
  });
}

// Хвилинний обробник. Працює лише поки є чернетка без відповіді/публікації або перевірка після деплою.
function krzhvMailTick() {
  const props = krzhvProps_();
  const busy = Number(props.getProperty('krzhv_busy') || 0);
  if (Date.now() - busy < 90000) return;
  props.setProperty('krzhv_busy', String(Date.now()));
  try {
    let pending = 0;
    GmailApp.search('label:' + KRZHV_L_DRAFT + ' -label:' + KRZHV_L_DONE + ' -label:' + KRZHV_L_EDIT, 0, 20)
      .forEach(function (t) {
        const msgs = t.getMessages();
        if (msgs.length < 2) { pending++; return; }
        const meta = JSON.parse(props.getProperty('krzhv_meta_' + t.getId()) || '{}');
        const txt = krzhvStrip_(msgs[msgs.length - 1].getPlainBody()).trim();
        if (/^[oOоО][kKкК][.!\s]*$/.test(txt)) {
          if (meta.publishAt && new Date(meta.publishAt) > new Date()) { pending++; return; }
          krzhvPublish_(t, msgs[0], meta);
        } else {
          t.addLabel(krzhvLabel_(KRZHV_L_EDIT)); // правки: їх підхоплює агент
        }
      });
    const verify = JSON.parse(props.getProperty('krzhv_verify') || '[]');
    const left = [];
    verify.forEach(function (v) {
      if (Date.now() < v.after) { left.push(v); return; }
      const code = UrlFetchApp.fetch(v.url + '?v=' + Date.now(), { muteHttpExceptions: true }).getResponseCode();
      if (code === 200) {
        GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' Опубліковано: ' + v.title,
          'Сторінка відкривається: ' + v.url, { name: 'krzhv · агент контенту' });
      } else if (v.tries < 6) {
        v.tries++; v.after = Date.now() + 120000; left.push(v);
      } else {
        GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' УВАГА: сторінка не відкривається: ' + v.title,
          v.url + ' повертає ' + code + '. Перевірте вкладку Actions на GitHub.', { name: 'krzhv · агент контенту' });
      }
    });
    props.setProperty('krzhv_verify', JSON.stringify(left));
    if (!pending && !left.length) krzhvRemoveTrigger_();
  } finally {
    props.deleteProperty('krzhv_busy');
  }
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
  for (let i = 0; i < files.length; i++) {
    const path = files[i].getName().replace(/__/g, '/');
    const api = 'https://api.github.com/repos/' + repo + '/contents/' + encodeURI(path);
    const cur = UrlFetchApp.fetch(api + '?ref=main', { headers: headers, muteHttpExceptions: true });
    const body = { message: 'Публікація: ' + title, branch: 'main', content: Utilities.base64Encode(files[i].getBytes()) };
    if (cur.getResponseCode() === 200) body.sha = JSON.parse(cur.getContentText()).sha;
    const r = UrlFetchApp.fetch(api, { method: 'put', headers: headers, contentType: 'application/json',
      payload: JSON.stringify(body), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200 && r.getResponseCode() !== 201) {
      thread.addLabel(krzhvLabel_(KRZHV_L_EDIT));
      GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' УВАГА: GitHub відхилив ' + path,
        'HTTP ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 500), { name: 'krzhv · агент контенту' });
      return;
    }
  }
  thread.addLabel(krzhvLabel_(KRZHV_L_DONE));
  const verify = JSON.parse(props.getProperty('krzhv_verify') || '[]');
  (meta.urls || []).forEach(function (u) { verify.push({ url: u, title: title, after: Date.now() + 240000, tries: 0 }); });
  props.setProperty('krzhv_verify', JSON.stringify(verify));
  props.deleteProperty('krzhv_meta_' + thread.getId());
}

// Для агента: гілки з правками (мітка krzhv-edit) і вкладення першого листа.
function krzhvPoll_(req) {
  const threads = GmailApp.search('label:' + KRZHV_L_EDIT + ' -label:' + KRZHV_L_DONE + ' newer_than:30d', 0, 20);
  return { ok: true, threads: threads.map(function (t) {
    const msgs = t.getMessages();
    const item = { threadId: t.getId(), subject: t.getFirstMessageSubject(),
      replies: msgs.slice(1).map(function (m) { return { date: m.getDate().toISOString(), text: krzhvStrip_(m.getPlainBody()) }; }) };
    if (req.withAttachments) {
      item.attachments = msgs[0].getAttachments().map(function (a) {
        return { name: a.getName(), mime: a.getContentType(), b64: Utilities.base64Encode(a.getBytes()) };
      });
    }
    return item;
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
  ScriptApp.getProjectTriggers();
  GmailApp.sendEmail(krzhvMe_(), KRZHV_TAG + ' Тест: модуль підключено', 'Дозволи надано, токен GitHub працює.', { name: 'krzhv · агент контенту' });
}
