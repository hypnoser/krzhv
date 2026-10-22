#!/usr/bin/env python3
"""Збирає HTML-лист із чернеткою (.md з frontmatter) у палітрі сайту.
  build_email.py --md draft.md --publish "нд 08.11.2026" --out email.html [--report report.md]
                 [--png cid=path.png ...]   # зображення, які показати всередині листа (cid:...)
Без емодзі. Стилі inline, таблична верстка (для Gmail/Outlook)."""
import argparse, html, pathlib, re, yaml, markdown

G, T, BG, CARD, INK = "#3D5A4A", "#C77A4F", "#EEF2EF", "#FDFDFB", "#221F1B"
ap = argparse.ArgumentParser()
ap.add_argument("--md", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--publish", required=True); ap.add_argument("--report")
ap.add_argument("--png", nargs="*", default=[])
a = ap.parse_args()

raw = pathlib.Path(a.md).read_text(encoding="utf-8")
_, fm, body = raw.split("---", 2)
meta = yaml.safe_load(fm)
png = dict(x.split("=", 1) for x in a.png)

def style(h):
    rules = {
        r"<h2>": f'<h2 style="font:700 22px Georgia,serif;color:{G};margin:30px 0 10px;">',
        r"<h3>": f'<h3 style="font:700 17px Arial,sans-serif;color:{INK};margin:22px 0 6px;">',
        r"<p>": f'<p style="font:16px/1.65 Arial,sans-serif;color:{INK};margin:0 0 14px;">',
        r"<ul>": '<ul style="margin:0 0 14px;padding-left:22px;">',
        r"<ol>": '<ol style="margin:0 0 14px;padding-left:22px;">',
        r"<li>": f'<li style="font:16px/1.6 Arial,sans-serif;color:{INK};margin:0 0 6px;">',
        r"<blockquote>": f'<blockquote style="margin:0 0 14px;padding:10px 16px;border-left:4px solid {T};background:{CARD};font-style:italic;">',
        r"<a ": f'<a style="color:{T};font-weight:bold;" ',
    }
    for k, v in rules.items():
        h = re.sub(k, v, h)
    def img(m):
        tag = m.group(0); src = re.search(r'src="([^"]+)"', tag).group(1)
        alt = re.search(r'alt="([^"]*)"', tag); alt = alt.group(1) if alt else ""
        stem = pathlib.Path(src).stem
        if stem in png:
            return f'<img src="cid:{stem}" alt="{alt}" width="536" style="max-width:100%;height:auto;border-radius:10px;margin:6px 0 14px;display:block;">'
        return f'<p style="font:italic 14px Arial,sans-serif;color:#94897E;">[Схема: {alt}]</p>'
    return re.sub(r"<img [^>]+>", img, h)

content = style(markdown.markdown(body.strip(), extensions=["tables", "sane_lists"]))
kind = "Пост блогу" if str(meta.get("layout", "")).startswith("blog") else "Стаття"
tag = {"colleagues": "Для колег", "journal": "Журнал"}.get(meta.get("audience"), meta.get("category", ""))

def card(color, title, inner):
    return (f'<tr><td style="padding:0 28px 18px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:{CARD};'
            f'border:2px solid {color};border-radius:14px;"><tr><td style="padding:16px 20px;">'
            f'<div style="font:700 13px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:{color};margin-bottom:8px;">{title}</div>{inner}</td></tr></table></td></tr>')

tldr = card(T, "Коротко", f'<p style="font:16px/1.6 Arial,sans-serif;margin:0;color:{INK};">{html.escape(meta["tldr"])}</p>') if meta.get("tldr") else ""
src_items = "".join(
    f'<li style="font:14px/1.5 Arial,sans-serif;margin:0 0 6px;"><a style="color:{G};" href="{html.escape(s["url"])}">{html.escape(s["title"])}</a></li>'
    for s in meta.get("sources", []) if isinstance(s, dict))
sources = card(G, "Джерела (відкрийте кілька перед ОК)", f'<ol style="margin:0;padding-left:20px;">{src_items}</ol>') if src_items else ""
report = card("#94897E", "Звіт перевірки за чекліст", style(markdown.markdown(pathlib.Path(a.report).read_text(encoding="utf-8")))) if a.report else ""
reply = card(T, "Як відповісти",
    f'<p style="font:16px/1.6 Arial,sans-serif;margin:0 0 8px;"><b style="color:{G};">ОК</b> (одне слово) = публікую {html.escape(a.publish)}.</p>'
    f'<p style="font:16px/1.6 Arial,sans-serif;margin:0;">Будь-який інший текст = правки: напишіть, що змінити, і я надішлю нову версію. '
    f'Реальний випадок із практики позначте словами «реальний випадок».</p>')

doc = f'''<!doctype html><html lang="uk"><meta charset="utf-8"><body style="margin:0;background:{BG};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:{BG};"><tr><td align="center" style="padding:20px 8px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:{CARD};border-radius:18px;overflow:hidden;">
<tr><td style="background:{G};padding:26px 28px;">
<div style="font:700 12px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#E8C9B2;">{kind} · {html.escape(tag)} · публікація {html.escape(a.publish)}</div>
<div style="font:700 26px/1.25 Georgia,serif;color:#fff;margin-top:10px;">{html.escape(meta["title"])}</div></td></tr>
<tr><td style="height:5px;background:{T};font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:22px 28px 8px;font:14px Arial,sans-serif;color:#94897E;">Опис для пошуку: {html.escape(meta.get("description",""))}</td></tr>
{tldr}
<tr><td style="padding:6px 28px 12px;">{content}</td></tr>
{sources}{report}{reply}
<tr><td style="background:{G};padding:14px 28px;font:12px Arial,sans-serif;color:#cfdcd4;">krzhv.com.ua · агент контенту · чернетка не опублікована, доки ви не напишете ОК</td></tr>
</table></td></tr></table></body></html>'''
pathlib.Path(a.out).write_text(doc, encoding="utf-8")
print(a.out, len(doc) // 1024, "KB")
