# Рендер прев'ю для соцмереж: python3 scripts/og/render.py
import pathlib, io
from playwright.sync_api import sync_playwright
from PIL import Image
here = pathlib.Path(__file__).resolve().parent
out = here.parent.parent / "src/assets/images/og-image.jpg"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1200, "height": 630})
    pg.goto((here / "og-image.html").as_uri()); pg.wait_for_timeout(300)
    png = pg.screenshot(); b.close()
Image.open(io.BytesIO(png)).convert("RGB").save(out, quality=86, optimize=True, progressive=True)
print(out, out.stat().st_size // 1024, "KB")
