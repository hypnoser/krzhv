#!/usr/bin/env python3
"""Клієнт krzhv-mailer (Apps Script Web App). Секрети лише зі змінних середовища:
KRZHV_MAIL_URL (адреса веб-застосунку) і KRZHV_MAIL_TOKEN. У репозиторії їх немає.

  mail.py send --subject "Чернетка: ..." --html email.html [--text t.txt] [--kind draft|info]
               [--attach f1 f2] [--inline cid=path.png]
  mail.py poll [--attachments DIR]     # відповіді власника на чернетки + вкладення першого листа
  mail.py done --thread ID             # позначити чернетку опрацьованою
"""
import argparse, base64, json, mimetypes, os, pathlib, sys, urllib.request

def call(payload):
    url, token = os.environ.get("KRZHV_MAIL_URL"), os.environ.get("KRZHV_MAIL_TOKEN")
    if not url or not token:
        sys.exit("Не задано KRZHV_MAIL_URL / KRZHV_MAIL_TOKEN")
    payload["token"] = token
    req = urllib.request.Request(url, json.dumps(payload).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:  # 302 → GET на результат, дія вже виконана
        return json.loads(r.read().decode())

def blob(path, name=None):
    p = pathlib.Path(path)
    mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    return {"name": name or p.name, "mime": mime, "b64": base64.b64encode(p.read_bytes()).decode()}

ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
s = sub.add_parser("send"); s.add_argument("--subject", required=True); s.add_argument("--html", required=True)
s.add_argument("--text"); s.add_argument("--kind", default="info", choices=["draft", "info"])
s.add_argument("--attach", nargs="*", default=[]); s.add_argument("--inline", nargs="*", default=[])
p = sub.add_parser("poll"); p.add_argument("--attachments")
d = sub.add_parser("done"); d.add_argument("--thread", required=True)
a = ap.parse_args()

if a.cmd == "send":
    inline = []
    for x in a.inline:
        cid, path = x.split("=", 1); b = blob(path); b["cid"] = cid; inline.append(b)
    r = call({"action": "send", "subject": a.subject, "html": pathlib.Path(a.html).read_text(encoding="utf-8"),
              "text": pathlib.Path(a.text).read_text(encoding="utf-8") if a.text else None,
              "kind": a.kind, "attachments": [blob(x) for x in a.attach], "inline": inline})
elif a.cmd == "poll":
    r = call({"action": "poll", "withAttachments": bool(a.attachments)})
    if a.attachments and r.get("ok"):
        for t in r["threads"]:
            d_ = pathlib.Path(a.attachments) / t["threadId"]; d_.mkdir(parents=True, exist_ok=True)
            for f in t.pop("attachments", []):
                (d_ / f["name"]).write_bytes(base64.b64decode(f["b64"]))
            t["savedTo"] = str(d_)
else:
    r = call({"action": "done", "threadId": a.thread})
print(json.dumps(r, ensure_ascii=False, indent=2))
