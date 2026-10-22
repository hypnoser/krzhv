/**
 * krzhv-mailer — окремий проєкт Google Apps Script (Web App).
 * Надсилає листи ТІЛЬКИ власнику акаунта і читає його відповіді на чернетки.
 * Секрет: Project Settings → Script properties → TOKEN (у репозиторії його немає).
 * Без емодзі в темі й тексті: Gmail їх псує.
 */
const TAG = '[krzhv]';
const L_DRAFT = 'krzhv-draft';
const L_DONE = 'krzhv-done';

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token || req.token !== token) return out_({ ok: false, error: 'forbidden' });
    if (req.action === 'send') return out_(send_(req));
    if (req.action === 'poll') return out_(poll_(req));
    if (req.action === 'done') return out_(done_(req));
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function me_() { return Session.getEffectiveUser().getEmail(); }
function label_(name) { return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name); }
function blob_(a) { return Utilities.newBlob(Utilities.base64Decode(a.b64), a.mime, a.name); }

function send_(req) {
  let subject = String(req.subject || '').trim();
  if (subject.indexOf(TAG) !== 0) subject = TAG + ' ' + subject;
  const opts = { htmlBody: req.html, name: 'krzhv · агент контенту' };
  if (req.attachments && req.attachments.length) opts.attachments = req.attachments.map(blob_);
  if (req.inline && req.inline.length) {
    opts.inlineImages = {};
    req.inline.forEach(function (a) { opts.inlineImages[a.cid] = blob_(a); });
  }
  GmailApp.sendEmail(me_(), subject, req.text || 'Лист потрібно відкрити в HTML-режимі.', opts);
  let threadId = null;
  if (req.kind === 'draft') {
    Utilities.sleep(3000);
    const q = 'in:anywhere from:me to:me newer_than:1d subject:"' + subject.replace(/"/g, '') + '"';
    const t = GmailApp.search(q, 0, 1)[0];
    if (t) { t.addLabel(label_(L_DRAFT)); threadId = t.getId(); }
  }
  return { ok: true, threadId: threadId };
}

function stripQuote_(text) {
  const keep = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^>/.test(l) || /^(On .+wrote:|.+пише:|.+написав.*:|-{3,}\s*Original)/i.test(l.trim())) break;
    keep.push(l);
  }
  return keep.join('\n').trim().slice(0, 4000);
}

function poll_(req) {
  const threads = GmailApp.search('label:' + L_DRAFT + ' -label:' + L_DONE + ' newer_than:30d', 0, 20);
  const res = threads.map(function (t) {
    const msgs = t.getMessages();
    const item = {
      threadId: t.getId(),
      subject: t.getFirstMessageSubject(),
      replies: msgs.slice(1).map(function (m) {
        return { date: m.getDate().toISOString(), text: stripQuote_(m.getPlainBody()) };
      }),
    };
    if (req.withAttachments) {
      item.attachments = msgs[0].getAttachments().map(function (a) {
        return { name: a.getName(), mime: a.getContentType(), b64: Utilities.base64Encode(a.getBytes()) };
      });
    }
    return item;
  });
  return { ok: true, threads: res };
}

function done_(req) {
  const t = GmailApp.getThreadById(req.threadId);
  if (!t) return { ok: false, error: 'thread not found' };
  t.addLabel(label_(L_DONE));
  return { ok: true };
}
