"""Перевірка поведінки /dopomoha/ у Chromium (Playwright).

Запуск: зібрати сайт (npm run build), підняти сервер на http://localhost:8080
(наприклад, `python3 -m http.server 8080 -d _site`), потім:
    python3 docs/dopomoha/check.py [--shots DIR]
Скрипт нічого не змінює в сайті; запити до Google Analytics у тестовому браузері блокуються.
"""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080"
STATES = ["tryvoha", "nemaie-syl", "naviazlyvosti", "panika"]
results = []
shots = None
if "--shots" in sys.argv:
    shots = sys.argv[sys.argv.index("--shots") + 1]


def check(name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail and not ok else ""))


def visible_ids(page):
    return page.evaluate("""() => {
      const vis = el => !!el && el.offsetParent !== null;
      const out = {chooser: vis(document.getElementById('vybir')), states: [], parts: []};
      document.querySelectorAll('.dh-state').forEach(s => { if (vis(s)) out.states.push(s.id); });
      document.querySelectorAll('.dh-ex, .dh-done').forEach(e => { if (vis(e)) out.parts.push(e.id); });
      out.urgentTop = vis(document.querySelector('.dh-urgent a[href="/help/"]'));
      out.focus = document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null;
      return out;
    }""")


def no_overflow(page):
    return page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


with sync_playwright() as p:
    browser = p.chromium.launch()
    analytics_hits = []

    def new_page(width=1280, js=True, block_ga=True):
        ctx = browser.new_context(viewport={"width": width, "height": 900}, java_script_enabled=js)
        page = ctx.new_page()
        page.on("request", lambda r: analytics_hits.append(r.url) if "googletagmanager" in r.url or "google-analytics" in r.url else None)
        if block_ga:
            page.route("**/*googletagmanager*/**", lambda r: r.abort())
        return ctx, page

    # 1. Прямий перехід: показ вибору
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/")
    v = visible_ids(page)
    check("direct: chooser visible, no state", v["chooser"] and not v["states"], str(v))
    check("direct: 4 options", page.locator(".dh-option").count() == 4)
    check("direct: urgent help link visible", v["urgentTop"])
    check("direct: title", page.title().startswith("Що робити, коли важко"), page.title())
    check("direct: canonical", page.locator('link[rel=canonical]').get_attribute("href") == "https://krzhv.com.ua/dopomoha/")
    check("direct: no analytics script", page.locator('script[src*="googletagmanager"]').count() == 0)
    check("direct: one h1", page.locator("h1").count() == 1)
    ctx.close()

    # 2. Прямі посилання на кожен стан + оновлення сторінки
    for s in STATES:
        ctx, page = new_page()
        page.goto(f"{BASE}/dopomoha/#{s}")
        page.wait_for_timeout(150)
        v = visible_ids(page)
        check(f"#{s}: only this state, main exercise", (not v["chooser"]) and v["states"] == [s] and v["parts"] == [f"{s}-main"], str(v))
        check(f"#{s}: urgent help visible", v["urgentTop"] and page.locator(f"#{s} .dh-state-help a").is_visible())
        # «надто складно» → простіший варіант, фокус на заголовку
        page.click(f"#{s}-main .dh-btn-secondary")
        page.wait_for_timeout(150)
        v = visible_ids(page)
        check(f"#{s}: too hard → simpler, focus", v["parts"] == [f"{s}-simpler"] and v["focus"] == f"{s}-simpler-title", str(v))
        page.reload()
        page.wait_for_timeout(150)
        v = visible_ids(page)
        check(f"#{s}: reload keeps simpler", v["parts"] == [f"{s}-simpler"], str(v))
        page.go_back()
        page.wait_for_timeout(150)
        v = visible_ids(page)
        check(f"#{s}: browser back → main", v["parts"] == [f"{s}-main"] and v["focus"] == f"{s}-title", str(v))
        page.click(f"#{s}-main .dh-btn-primary")
        page.wait_for_timeout(150)
        v = visible_ids(page)
        check(f"#{s}: done, focus", v["parts"] == [f"{s}-done"] and v["focus"] == f"{s}-done-title", str(v))
        check(f"#{s}: done offers extra exercise", page.locator(f"#{s}-done [data-done-extra]").is_visible())
        page.click(f"#{s}-done [data-done-extra] a")
        page.wait_for_timeout(150)
        check(f"#{s}: extra exercise shown", visible_ids(page)["parts"] == [f"{s}-extra"])
        page.click(f"#{s}-extra .dh-btn-primary")
        page.wait_for_timeout(150)
        check(f"#{s}: done after extra offers main", page.locator(f"#{s}-done [data-done-main]").is_visible() and not page.locator(f"#{s}-done [data-done-extra]").is_visible())
        page.click(f"#{s} .dh-back")
        page.wait_for_timeout(150)
        v = visible_ids(page)
        check(f"#{s}: back to choice, focus h1", v["chooser"] and not v["states"] and v["focus"] == "dh-title", str(v))
        ctx.close()

    # 3. Невідомий фрагмент
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/#nonexistent")
    page.wait_for_timeout(150)
    v = visible_ids(page)
    check("unknown fragment → chooser", v["chooser"] and not v["states"], str(v))
    ctx.close()

    # 4. Переходи з головної
    for s in STATES:
        ctx, page = new_page()
        page.goto(BASE + "/")
        page.click(f'#for-whom a[href="/dopomoha/#{s}"]')
        page.wait_for_load_state()
        page.wait_for_timeout(150)
        v = visible_ids(page)
        check(f"home → #{s}", v["states"] == [s] and not v["chooser"], str(v))
        ctx.close()
    ctx, page = new_page()
    page.goto(BASE + "/")
    check("home: quizzes still linked", all(page.locator(f'#for-whom a[href="/kviz/{q}/"]').count() == 1 for q in ["tryvoga", "depresiya", "panichni-ataky"]))
    ctx.close()

    # 5. Клавіатура
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/")
    reached = False
    for _ in range(25):
        page.keyboard.press("Tab")
        if page.evaluate("document.activeElement.getAttribute('href')") == "#tryvoha":
            reached = True
            break
    check("keyboard: Tab reaches first option", reached)
    if reached:
        outline = page.evaluate("getComputedStyle(document.activeElement).outlineStyle")
        check("keyboard: visible focus outline", outline not in ("none", ""), outline)
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        v = visible_ids(page)
        check("keyboard: Enter opens state, focus on heading", v["states"] == ["tryvoha"] and v["focus"] == "tryvoha-title", str(v))
    ctx.close()

    # 6. Без JavaScript
    ctx, page = new_page(js=False)
    page.goto(BASE + "/dopomoha/#panika")
    v = visible_ids(page)
    check("no-JS: all states and exercises visible", len(v["states"]) == 4 and len(v["parts"]) == 16, str(v))
    check("no-JS: JS-only buttons hidden", page.locator(".dh-actions").first.is_hidden() and page.locator("[data-print]").first.is_hidden())
    check("no-JS: urgent help visible", v["urgentTop"])
    check("no-JS: panic urgent signs visible", page.locator("#panika .dh-alert").is_visible())
    ctx.close()

    # 7. Ширини, переповнення, скриншоти
    for w in (360, 1280):
        for path in ["/dopomoha/", "/dopomoha/#panika", "/dopomoha/#naviazlyvosti-done", "/", "/statti/"]:
            ctx, page = new_page(width=w)
            page.goto(BASE + path)
            page.wait_for_timeout(200)
            check(f"no horizontal overflow {w}px {path}", no_overflow(page))
            if shots and path in ("/dopomoha/", "/dopomoha/#panika", "/"):
                name = {"/dopomoha/": "choose", "/dopomoha/#panika": "panic", "/": "home"}[path]
                if path == "/":
                    page.locator("#for-whom").screenshot(path=f"{shots}/{name}-{w}.png")
                else:
                    page.screenshot(path=f"{shots}/{name}-{w}.png", full_page=True)
            ctx.close()

    # 8. Друк: лише поточна вправа
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/#panika-extra")
    page.wait_for_timeout(150)
    page.evaluate("window.print = () => {}")
    page.click("#panika-extra [data-print]")
    page.emulate_media(media="print")
    vis = page.evaluate("""() => ({
      card: getComputedStyle(document.querySelector('#panika-extra .dh-card')).display !== 'none',
      header: getComputedStyle(document.querySelector('.site-header')).display,
      contact: getComputedStyle(document.querySelector('#contact')).display,
      actions: getComputedStyle(document.querySelector('#panika-extra .dh-actions')).display
    })""")
    check("print: card printed, chrome hidden", vis["card"] and vis["header"] == "none" and vis["contact"] == "none" and vis["actions"] == "none", str(vis))
    if shots:
        page.pdf(path=f"{shots}/panic-card.pdf")
    ctx.close()

    # 9. Офлайн після першого відкриття
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/")
    page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null || document.querySelector('.dh-offline') && !document.querySelector('.dh-offline').hidden", timeout=10000)
    page.reload()
    page.wait_for_timeout(500)
    ctx.set_offline(True)
    try:
        page.goto(BASE + "/dopomoha/#tryvoha")
        page.wait_for_timeout(300)
        ok = page.locator("#tryvoha-main").is_visible()
    except Exception as e:  # noqa
        ok = False
    check("offline: page opens from cache", ok)
    ctx.close()

    check("analytics: no requests from /dopomoha/ pages", not any("dopomoha" in h for h in analytics_hits))
    browser.close()

failed = [r for r in results if not r["ok"]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
if "--json" in sys.argv:
    print(json.dumps(results, ensure_ascii=False, indent=1))
sys.exit(1 if failed else 0)
