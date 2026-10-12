"""Перевірка відображення всіх сторінок сайту в Chromium на кількох ширинах.

Запуск: зібрати сайт, підняти сервер (python3 -m http.server 8080 -d _site), потім
    python3 docs/site-check.py [--base URL] [--shots DIR]
Перевіряє: горизонтальну прокрутку, хлібні крихти не біля краю, шапку не вищу за 90 px,
наявність підвалу й блоку контактів, помилки JavaScript, роботу мобільного меню.
"""
import glob, os, sys
from playwright.sync_api import sync_playwright

base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://localhost:8080"
shots = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
site = os.path.join(os.path.dirname(__file__), "..", "_site")
pages = sorted("/" + os.path.relpath(f, site).replace("index.html", "") for f in glob.glob(f"{site}/**/index.html", recursive=True))
pages = [p for p in pages if not p.startswith("/secret/files/")]
pages.append("/404.html")
standalone = ("/scales/", "/materialy/")
no_contact = ("/secret/",)
widths = [320, 360, 390, 768, 1024, 1440]
fails, total = [], 0

with sync_playwright() as p:
    b = p.chromium.launch()
    for w in widths:
        ctx = b.new_context(viewport={"width": w, "height": 800})
        ctx.route("**/*googletagmanager*/**", lambda r: r.abort())
        ctx.route("**/*cloudflareinsights*/**", lambda r: r.abort())
        for path in pages:
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(base + path, wait_until="load")
            over = pg.evaluate("""() => {
              if (!document.querySelector('.site-header')) return [];
              window.scrollTo({ top: 300, behavior: 'instant' });
              const bad = [];
              for (const x of [24, innerWidth / 2, innerWidth - 24]) for (const y of [8, 30]) {
                const e = document.elementFromPoint(x, y);
                if (e && !e.closest('.site-header')) bad.push(e.tagName + '.' + e.className);
              }
              const sticky = [...document.querySelectorAll('body *')].filter(e => ['sticky', 'fixed'].includes(getComputedStyle(e).position)
                && !e.matches('.site-header, .maintenance-overlay, .skip-link')).map(e => e.tagName + '.' + e.className);
              window.scrollTo({ top: 0, behavior: 'instant' });
              return bad.concat(sticky.map(x => 'sticky ' + x));
            }""")
            r = pg.evaluate("""() => {
              const vw = innerWidth, bc = document.querySelector('.breadcrumb'), h = document.querySelector('.site-header');
              let bcLeft = null;
              if (bc) { const t = bc.querySelector('a') || bc; bcLeft = t.getBoundingClientRect().left; }
              return { overflow: document.documentElement.scrollWidth > vw + 1, sw: document.documentElement.scrollWidth,
                bcLeft, headerH: h ? h.getBoundingClientRect().height : 0, footer: !!document.querySelector('footer .footer-grid'),
                contact: !!document.getElementById('contact') || !!document.querySelector('.cta-band') };
            }""")
            def check(ok, msg):
                global total
                total += 1
                if not ok: fails.append(f"{w}px {path}: {msg}")
            check(not r["overflow"], f"горизонтальна прокрутка ({r['sw']}px)")
            check(not errs, f"помилка JS {errs[:1]}")
            if not path.startswith(standalone):
                check(not over, f"щось перекриває шапку при прокрутці: {over[:2]}")
            if not path.startswith(standalone):
                check(r["bcLeft"] is None or r["bcLeft"] >= 16, f"хлібні крихти біля краю ({r['bcLeft']})")
                check(r["headerH"] <= 90, f"шапка {r['headerH']:.0f}px")
                check(r["footer"], "немає розширеного підвалу")
                if not path.startswith(no_contact):
                    check(r["contact"], "немає блоку контактів чи заклику")
            if shots and w in (360, 1440) and path in ("/", "/help/", "/privacy/", "/kviz/tryvoga/", "/statti/okr/", "/404.html"):
                name = path.strip("/").replace("/", "_") or "home"
                pg.screenshot(path=f"{shots}/{w}_{name}.png", full_page=(w == 360))
            pg.close()
        ctx.close()

    # Мобільне меню
    pg = b.new_page(viewport={"width": 390, "height": 800})
    pg.goto(base + "/privacy/")
    def menu_open(): return pg.evaluate("document.getElementById('navMobile').classList.contains('open')")
    pg.click("#navToggle"); total += 1
    if not menu_open() or pg.get_attribute("#navToggle", "aria-expanded") != "true": fails.append("меню: не відкривається")
    pg.keyboard.press("Escape"); total += 1
    if menu_open(): fails.append("меню: не закривається Esc")
    pg.click("#navToggle"); pg.mouse.click(200, 700); total += 1
    if menu_open(): fails.append("меню: не закривається кліком поза ним")
    pg.goto(base + "/"); pg.click("#navToggle"); pg.click("#navMobile a[href='/#about']"); pg.wait_for_timeout(300); total += 1
    if menu_open(): fails.append("меню: не закривається після переходу за якорем")
    # Шапка на низькому екрані ховається при прокрутці вниз
    pg = b.new_page(viewport={"width": 844, "height": 390})
    pg.goto(base + "/statti/okr/"); pg.mouse.wheel(0, 600); pg.wait_for_timeout(400); total += 1
    if "header-hidden" not in (pg.get_attribute(".site-header", "class") or ""): fails.append("шапка: не ховається на низькому екрані")
    pg.mouse.wheel(0, -200); pg.wait_for_timeout(400); total += 1
    if "header-hidden" in (pg.get_attribute(".site-header", "class") or ""): fails.append("шапка: не повертається при прокрутці вгору")
    # Посилання «Перейти до змісту»
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.goto(base + "/"); pg.keyboard.press("Tab"); total += 1
    if pg.evaluate("document.activeElement.className") != "skip-link": fails.append("перший Tab не на «Перейти до змісту»")
    b.close()

print("\n".join(fails) if fails else "")
print(f"{total - len(fails)}/{total} passed, {len(pages)} сторінок × {len(widths)} ширин")
sys.exit(1 if fails else 0)
