"""Перевірка поведінки /dopomoha/ (покроковий майстер) у Chromium (Playwright).

Запуск: зібрати сайт (npm run build), підняти сервер на http://localhost:8080
(наприклад, `python3 -m http.server 8080 -d _site`), потім:
    python3 docs/dopomoha/check.py [--base URL] [--shots DIR] [--json]
Скрипт нічого не змінює в сайті; запити до аналітики в тестовому браузері блокуються.
"""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://localhost:8080"
shots = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
START = {"tryvoha": "dumka", "nemaie-syl": "vybir-dii", "naviazlyvosti": "shcho", "panika": "znaiome"}
SIMPLEST = {"tryvoha": "prosto", "nemaie-syl": "menshe", "naviazlyvosti": "pauza", "panika": "odne"}
EXTRA = {"tryvoha": "piznishe", "nemaie-syl": "dlia-sebe", "naviazlyvosti": "zapys", "panika": "kartka"}
results = []


def check(name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail and not ok else ""))


def state(page):
    return page.evaluate("""() => {
      const vis = el => !!el && el.offsetParent !== null;
      const out = {chooser: vis(document.getElementById('vybir')), states: [], steps: []};
      document.querySelectorAll('.dh-state').forEach(s => { if (vis(s)) out.states.push(s.id); });
      document.querySelectorAll('.dh-step').forEach(e => { if (vis(e)) out.steps.push(e.id); });
      out.urgentTop = vis(document.querySelector('.dh-urgent a[href="/help/"]'));
      out.focus = document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null;
      return out;
    }""")


def wait(page, ms=150):
    page.wait_for_timeout(ms)


with sync_playwright() as p:
    browser = p.chromium.launch()
    analytics = []

    def new_page(width=1280, js=True, height=900):
        ctx = browser.new_context(viewport={"width": width, "height": height}, java_script_enabled=js)
        page = ctx.new_page()
        page.on("request", lambda r: analytics.append(r.url) if ("googletagmanager" in r.url or "google-analytics" in r.url) and "/dopomoha/" in (r.frame.url or "") else None)
        page.route("**/*googletagmanager*/**", lambda r: r.abort())
        page.route("**/*cloudflareinsights*/**", lambda r: r.abort())
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.errs = errs
        return ctx, page

    # 1. Вибір стану
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/")
    v = state(page)
    check("direct: chooser visible, no state", v["chooser"] and not v["states"], str(v))
    check("direct: 4 options", page.locator(".dh-option").count() == 4)
    check("direct: urgent help visible", v["urgentTop"])
    check("direct: canonical", page.locator('link[rel=canonical]').get_attribute("href") == "https://krzhv.com.ua/dopomoha/")
    check("direct: no analytics script", page.locator('script[src*="googletagmanager"]').count() == 0)
    check("direct: one h1", page.locator("h1").count() == 1)
    ctx.close()

    # 2. Кожен стан: старт, «надто складно», оновлення, «Назад», фінал, додаткова вправа, повернення до вибору
    for s in START:
        ctx, page = new_page()
        page.goto(f"{BASE}/dopomoha/#{s}")
        wait(page)
        v = state(page)
        check(f"#{s}: one step visible — start", v["states"] == [s] and v["steps"] == [f"{s}-{START[s]}"], str(v))
        check(f"#{s}: urgent help visible", v["urgentTop"] and page.locator(f"#{s} .dh-state-help a").is_visible())
        check(f"#{s}: back hidden on first step", page.locator(f"#{s}-{START[s]} [data-back]").is_hidden())
        hard = page.locator(f"#{s}-{START[s]} .dh-hard")
        if hard.count():
            hard.click(); wait(page)
            v = state(page)
            check(f"#{s}: too hard → simplest, focus", v["steps"] == [f"{s}-{SIMPLEST[s]}"] and v["focus"] == f"{s}-{SIMPLEST[s]}-title", str(v))
            page.reload(); wait(page)
            check(f"#{s}: reload keeps step", state(page)["steps"] == [f"{s}-{SIMPLEST[s]}"])
            page.go_back(); wait(page)
            check(f"#{s}: browser back → start", state(page)["steps"] == [f"{s}-{START[s]}"])
        page.goto(f"{BASE}/dopomoha/#{s}-end"); wait(page)
        v = state(page)
        check(f"#{s}: end screen", v["steps"] == [f"{s}-end"], str(v))
        page.click(f"#{s}-end a[href='#{s}-{EXTRA[s]}']"); wait(page)
        check(f"#{s}: extra exercise", state(page)["steps"] == [f"{s}-{EXTRA[s]}"])
        page.click(f"#{s}-{EXTRA[s]} [data-back]"); wait(page)
        check(f"#{s}: in-page back button → previous step", state(page)["steps"] == [f"{s}-end"])
        page.click(f"#{s} .dh-back"); wait(page)
        v = state(page)
        check(f"#{s}: «Обрати інше» → chooser, focus h1", v["chooser"] and not v["states"] and v["focus"] == "dh-title", str(v))
        check(f"#{s}: no JS errors", not page.errs, str(page.errs))
        ctx.close()

    # 3. Гілки
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/#tryvoha"); wait(page)
    page.click("#tryvoha-dumka .dh-btn-primary"); wait(page)
    check("tryvoha: Далі → question", state(page)["steps"] == ["tryvoha-mozhu"])
    page.click("#tryvoha-mozhu a[href='#tryvoha-krok']"); wait(page)
    check("tryvoha: «Так» → small step", state(page)["steps"] == ["tryvoha-krok"])
    page.go_back(); wait(page)
    page.click("#tryvoha-mozhu a[href='#tryvoha-araptom'] >> nth=0"); wait(page)
    check("tryvoha: «Ні» → «а раптом»", state(page)["steps"] == ["tryvoha-araptom"])
    page.click("#tryvoha-araptom .dh-btn-primary"); wait(page)
    check("tryvoha: → end", state(page)["steps"] == ["tryvoha-end"])

    page.goto(BASE + "/dopomoha/#nemaie-syl"); wait(page)
    check("nemaie-syl: 5 ready actions", page.locator("#nemaie-syl-vybir-dii .dh-tile").count() == 5)
    page.click("#nemaie-syl-vybir-dii a[href='#nemaie-syl-lyst']"); wait(page)
    check("nemaie-syl: tile → action", state(page)["steps"] == ["nemaie-syl-lyst"])
    page.click("#nemaie-syl-lyst a[href='#nemaie-syl-menshe']"); wait(page)
    check("nemaie-syl: «Не вийшло» → smaller", state(page)["steps"] == ["nemaie-syl-menshe"])

    page.goto(BASE + "/dopomoha/#naviazlyvosti"); wait(page)
    page.click("#naviazlyvosti-shcho a[href='#naviazlyvosti-vzhe']"); wait(page)
    page.click("#naviazlyvosti-vzhe a[href='#naviazlyvosti-odyn-raz']"); wait(page)
    check("ocd: not checked yet → check once", state(page)["steps"] == ["naviazlyvosti-odyn-raz"])
    page.go_back(); wait(page)
    page.click("#naviazlyvosti-vzhe a[href='#naviazlyvosti-kolo-pereviryty']"); wait(page)
    check("ocd: checked → cycle diagram", state(page)["steps"] == ["naviazlyvosti-kolo-pereviryty"] and page.locator("#naviazlyvosti-kolo-pereviryty svg[role=img]").is_visible())
    page.click("#naviazlyvosti-kolo-pereviryty .dh-btn-primary"); wait(page)
    check("ocd: → delay with timer", state(page)["steps"] == ["naviazlyvosti-vidklasty"])
    check("ocd: summary hidden before timer", page.locator("#naviazlyvosti-vidklasty .dh-after").is_hidden())
    page.evaluate("document.querySelector('#naviazlyvosti-vidklasty .dh-timer').setAttribute('data-timer','2')")
    page.click("#naviazlyvosti-vidklasty [data-timer-start]"); wait(page, 2600)
    check("ocd: timer finishes, summary shown", page.locator("#naviazlyvosti-vidklasty .dh-timer-done").is_visible() and page.locator("#naviazlyvosti-vidklasty .dh-after").is_visible())

    page.goto(BASE + "/dopomoha/#panika"); wait(page)
    page.click("#panika-znaiome .dh-choice-danger"); wait(page)
    v = state(page)
    check("panic: new symptoms → urgent screen with call buttons", v["steps"] == ["panika-terminovo"] and page.locator("#panika-terminovo a[href='tel:103']").is_visible() and page.locator("#panika-terminovo a[href='tel:112']").is_visible(), str(v))
    check("panic: urgent screen lists loss of consciousness", "втрата свідомості" in page.locator("#panika-terminovo").inner_text())
    page.click("#panika-terminovo .dh-btn-primary"); wait(page)
    for step in ["sisty", "opora", "try", "dykhannia"]:
        check(f"panic: guided step {step}", state(page)["steps"] == [f"panika-{step}"])
        if step == "dykhannia":
            page.click("#panika-dykhannia [data-breath-toggle]"); wait(page, 300)
            check("panic: breathing circle runs", "running" in (page.get_attribute("#panika-dykhannia .dh-breath", "class") or ""))
        page.click(f"#panika-{step} .dh-btn-primary"); wait(page)
    check("panic: breathing stops after leaving step", "running" not in (page.get_attribute("#panika-dykhannia .dh-breath", "class") or ""))
    check("panic: wave step", state(page)["steps"] == ["panika-khvylia"])
    ctx.close()

    # 4. Старі адреси, невідомий фрагмент, переходи з головної
    ctx, page = new_page()
    for old, new in [("tryvoha-simpler", "tryvoha-prosto"), ("tryvoha-main", "tryvoha-dumka"), ("panika-extra", "panika-kartka"), ("nemaie-syl-done", "nemaie-syl-end")]:
        page.goto(f"{BASE}/dopomoha/#{old}"); wait(page)
        check(f"alias #{old} → {new}", state(page)["steps"] == [new])
    page.goto(BASE + "/dopomoha/#nonexistent"); wait(page)
    v = state(page)
    check("unknown fragment → chooser", v["chooser"] and not v["states"], str(v))
    ctx.close()
    for s in START:
        ctx, page = new_page()
        page.goto(BASE + "/")
        page.click(f'#for-whom a[href="/dopomoha/#{s}"]')
        page.wait_for_load_state(); wait(page)
        check(f"home → #{s}", state(page)["steps"] == [f"{s}-{START[s]}"])
        ctx.close()

    # 5. Клавіатура
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/")
    reached = False
    for _ in range(30):
        page.keyboard.press("Tab")
        if page.evaluate("document.activeElement.getAttribute('href')") == "#tryvoha":
            reached = True
            break
    check("keyboard: Tab reaches first option", reached)
    if reached:
        check("keyboard: visible focus", page.evaluate("getComputedStyle(document.activeElement).outlineStyle") not in ("none", ""))
        page.keyboard.press("Enter"); wait(page, 250)
        v = state(page)
        check("keyboard: Enter opens state, focus on step heading", v["steps"] == ["tryvoha-dumka"] and v["focus"] == "tryvoha-dumka-title", str(v))
    ctx.close()

    # 6. Без JavaScript
    ctx, page = new_page(js=False)
    page.goto(BASE + "/dopomoha/#panika")
    v = state(page)
    total = page.locator(".dh-step").count()
    check("no-JS: all states and steps visible", len(v["states"]) == 4 and len(v["steps"]) == total and total > 30, f"{len(v['steps'])}/{total}")
    check("no-JS: JS-only buttons hidden", page.locator("[data-back]").first.is_hidden() and page.locator("[data-timer-start]").first.is_hidden())
    check("no-JS: urgent help visible", v["urgentTop"])
    check("no-JS: choice links are anchors", page.locator("#panika-znaiome a.dh-choice").count() == 2)
    ctx.close()

    # 7. Ширини
    for w in (320, 360, 1280):
        for h in ["", "#tryvoha-mozhu", "#nemaie-syl", "#naviazlyvosti-kolo-pytaty", "#naviazlyvosti-vidklasty", "#panika-terminovo", "#panika-dykhannia", "#panika-khvylia", "#tryvoha-end"]:
            ctx, page = new_page(width=w, height=800)
            page.goto(f"{BASE}/dopomoha/{h}"); wait(page, 200)
            check(f"no horizontal overflow {w}px {h or '/'}", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"))
            if shots and w == 360:
                page.screenshot(path=f"{shots}/{w}{(h or '#vybir').replace('#', '_')}.png", full_page=False)
            ctx.close()

    # 8. Друк картки паніки — лише вона
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/#panika-kartka"); wait(page)
    page.evaluate("window.print = () => {}")
    page.click("#panika-kartka [data-print]")
    page.emulate_media(media="print")
    vis = page.evaluate("""() => ({
      card: getComputedStyle(document.querySelector('#panika-kartka .dh-card')).display !== 'none',
      header: getComputedStyle(document.querySelector('.site-header')).display,
      other: getComputedStyle(document.querySelector('#panika-sisty')).display
    })""")
    check("print: card only", vis["card"] and vis["header"] == "none" and vis["other"] == "none", str(vis))
    if shots:
        page.pdf(path=f"{shots}/panic-card.pdf")
    ctx.close()

    # 9. Офлайн після першого відкриття (лише локально чи по https)
    ctx, page = new_page()
    page.goto(BASE + "/dopomoha/")
    try:
        page.wait_for_function("!document.querySelector('.dh-offline').hidden", timeout=10000)
        page.reload(); wait(page, 500)
        ctx.set_offline(True)
        page.goto(BASE + "/dopomoha/#tryvoha"); wait(page, 300)
        ok = page.locator("#tryvoha-dumka").is_visible()
    except Exception:
        ok = False
    check("offline: page opens from cache", ok)
    ctx.close()

    check("analytics: no requests from /dopomoha/", not analytics)
    browser.close()

failed = [r for r in results if not r["ok"]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
if "--json" in sys.argv:
    print(json.dumps(results, ensure_ascii=False, indent=1))
sys.exit(1 if failed else 0)
