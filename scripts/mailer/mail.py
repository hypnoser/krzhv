#!/usr/bin/env python3
"""Клієнт krzhv-mailer (Apps Script Web App). Секрети лише зі змінних середовища:
KRZHV_MAIL_URL (адреса веб-застосунку) і KRZHV_MAIL_TOKEN. У репозиторії їх немає.

  mail.py send --subject "Чернетка: ..." --html email.html [--text t.txt] [--kind draft|info]
               [--publish-file локальний_шлях=шлях/в/репо ...]   # файли, які скрипт сам закомітить після «ОК»
               [--publish-at 2026-11-11T08:00:00+02:00] [--publish-url https://krzhv.com.ua/... ...] [--title "..."]
               [--attach f1 f2] [--inline cid=path.png]
  mail.py poll [--attachments DIR]     # гілки з ПРАВКАМИ (мітка krzhv-edit) + вкладення першого листа
  mail.py done --thread ID             # позначити гілку опрацьованою
  mail.py status                       # усі гілки krzhv за 14 днів: мітки, відповіді, publishAt (діагностика, перевірка «чернетка надійшла?»)
--publish-at НЕОБОВ'ЯЗКОВИЙ: без нього публікація одразу після «ОК» власника. Тема чернетки отримує мітку часу автоматично.
Публікацію на «ОК» виконує сам Apps Script (тригер раз на 5 хвилин): див. README.
Якщо send/done повертає HTTP 404/помилку читання відповіді: дію МОГЛО бути виконано. Перш ніж слати вдруге, виконай mail.py status.
"""
import argparse, base64, json, mimetypes, os, pathlib, sys, urllib.error, urllib.request

def call(payload):
    # Читання (poll/status) безпечно повторювати: Apps Script інколи віддає 404 на редиректі.
    for i in range(3 if payload.get("action") in ("poll", "status") else 1):
        r = _call(payload, last=(i == 2 or payload.get("action") not in ("poll", "status")))
        if r is not None:
            return r

def _call(payload, last=True):
    url, token = os.environ.get("KRZHV_MAIL_URL"), os.environ.get("KRZHV_MAIL_TOKEN")
    if not url or not token:
        sys.exit("Не задано KRZHV_MAIL_URL / KRZHV_MAIL_TOKEN")
    payload["krzhv"] = 1; payload["token"] = token
    req = urllib.request.Request(url, json.dumps(payload).encode(), {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:  # 302 → GET на результат, дія вже виконана
            return json.loads(r.read().decode())
    except (urllib.error.HTTPError, json.JSONDecodeError) as e:
        if not last:
            return None
        print(json.dumps({"ok": None, "warning": f"відповідь не прочитано ({e}); дію могло бути виконано, перевір mail.py status перед повтором"}, ensure_ascii=False))
        sys.exit(3)

def blob(path, name=None):
    p = pathlib.Path(path)
    mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    return {"name": name or p.name, "mime": mime, "b64": base64.b64encode(p.read_bytes()).decode()}

ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
s = sub.add_parser("send"); s.add_argument("--subject", required=True); s.add_argument("--html", required=True)
s.add_argument("--text"); s.add_argument("--kind", default="info", choices=["draft", "info"])
s.add_argument("--attach", nargs="*", default=[]); s.add_argument("--inline", nargs="*", default=[])
s.add_argument("--publish-file", nargs="*", default=[]); s.add_argument("--publish-at"); s.add_argument("--publish-url", nargs="*", default=[]); s.add_argument("--title")
p = sub.add_parser("poll"); p.add_argument("--attachments")
d = sub.add_parser("done"); d.add_argument("--thread", required=True)
sub.add_parser("status")
a = ap.parse_args()

if a.cmd == "send":
    inline = []
    for x in a.inline:
        cid, path = x.split("=", 1); b = blob(path); b["cid"] = cid; inline.append(b)
    r = call({"action": "send", "subject": a.subject, "html": pathlib.Path(a.html).read_text(encoding="utf-8"),
              "text": pathlib.Path(a.text).read_text(encoding="utf-8") if a.text else None,
              "kind": a.kind, "inline": inline, "publishAt": a.publish_at, "publishUrls": a.publish_url, "title": a.title,
              "attachments": [blob(x) for x in a.attach] + [blob(l, r.replace("/", "__")) for l, r in (x.split("=", 1) for x in a.publish_file)]})
elif a.cmd == "poll":
    r = call({"action": "poll", "withAttachments": bool(a.attachments)})
    if a.attachments and r.get("ok"):
        for t in r["threads"]:
            d_ = pathlib.Path(a.attachments) / t["threadId"]; d_.mkdir(parents=True, exist_ok=True)
            for f in t.pop("attachments", []):
                (d_ / f["name"]).write_bytes(base64.b64decode(f["b64"]))
            t["savedTo"] = str(d_)
elif a.cmd == "status":
    r = call({"action": "status"})
else:
    r = call({"action": "done", "threadId": a.thread})
print(json.dumps(r, ensure_ascii=False, indent=2))
