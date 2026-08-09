# ІНСТРУКЦІЯ: GitHub + Cloudflare

## 1. Файли для завантаження в репозиторій

Завантажте ці файли в корінь репозиторію (гілка `main` або `master`):

```
├── index.html
├── styles.css
├── robots.txt
├── sitemap.xml
├── llms.txt
├── manifest.json
├── sergiy-photo.jpg          ← ваше фото
├── favicon.svg               ← favicon
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png
├── icon-192x192.png
├── icon-512x512.png
└── og-image.jpg              ← 1200×630px для соцмереж
```

## 2. Налаштування GitHub Pages

1. Перейдіть у Settings → Pages
2. Source: Deploy from a branch → `main` / `root`
3. Збережіть — сайт буде доступний через `https://krzhv.pp.ua`

## 3. Cloudflare налаштування (критично для SEO)

### SSL/TLS
- Перейдіть у Cloudflare Dashboard → SSL/TLS → Overview
- Виберіть режим: **Full (strict)**
- Перейдіть у SSL/TLS → Edge Certificates
- Увімкніть: **Always Use HTTPS**
- Увімкніть: **Automatic HTTPS Rewrites**

### HSTS (HTTP Strict Transport Security)
- SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS)
- Увімкніть HSTS з налаштуваннями:
  - Max Age: 12 months
  - Include subdomains: ON
  - Preload: ON

### Speed → Optimization
- **Auto Minify**: увімкніть для HTML, CSS, JS
- **Brotli**: ON (стиснення краще за gzip)
- **Early Hints**: ON

### Caching → Configuration
- **Caching Level**: Standard
- **Browser Cache TTL**: 1 year (для статики)
- **Edge Cache TTL**: 1 month

### Caching → Cache Rules (створіть правило)
Для файлів з розширеннями: `css`, `js`, `png`, `jpg`, `jpeg`, `webp`, `svg`, `ico`, `woff2`
- Edge Cache TTL: 1 year
- Browser Cache TTL: 1 year

### Security → Headers
Cloudflare не дозволяє додавати кастомні headers на GitHub Pages напряму.
Альтернативи:
1. Використовуйте Cloudflare Workers для додавання security headers
2. Або перейдіть на Cloudflare Pages (тоді використовуйте `_headers` файл)

### Page Rules (для редиректів)
Створіть правило: `krzhv.pp.ua/*`
- Always Use HTTPS: ON
- (опціонально) www → non-www редирект, якщо потрібно

## 4. Реєстрація в пошукових системах

### Google Search Console
1. https://search.google.com/search-console
2. Додайте ресурс: `https://krzhv.pp.ua/`
3. Підтвердіть власність через DNS-запис (рекомендовано) або HTML-файл
4. Перейдіть у Sitemaps → додайте: `sitemap.xml`
5. Запитайте індексацію головної сторінки (URL Inspection)

### Bing Webmaster Tools
1. https://www.bing.com/webmasters
2. Додайте сайт
3. Імпортуйте налаштування з Google Search Console (швидший спосіб)
4. Надішліть sitemap.xml

### Yandex Webmaster
1. https://webmaster.yandex.ru
2. Додайте сайт `https://krzhv.pp.ua/`
3. Підтвердіть власність
4. Надішліть sitemap.xml

## 5. Що потрібно додати самостійно

| Файл | Розмір | Призначення |
|------|--------|-------------|
| `sergiy-photo.jpg` | ~100-300KB | Ваше фото, рекомендовано 920×1226px |
| `og-image.jpg` | ~50-100KB | Для соцмереж, 1200×630px |
| `favicon.svg` | ~2-5KB | Векторна іконка |
| `favicon-16x16.png` | ~1KB | Іконка вкладки |
| `favicon-32x32.png` | ~2KB | Іконка вкладки retina |
| `apple-touch-icon.png` | ~5KB | 180×180px для iOS |
| `icon-192x192.png` | ~10KB | PWA іконка |
| `icon-512x512.png` | ~30KB | PWA іконка |

## 6. Регулярні дії для підтримки позицій

1. **Блог** — створіть папку `/blog/` і додавайте статті (1–2 на місяць):
   - Як впоратись з тривогою: 5 технік КПТ
   - Панічна атака: що робити прямо зараз
   - Депресія: коли звертатись до психолога
   - КПТ vs інші підходи: чому обирають когнітивно-поведінкову терапію

2. **Зворотні посилання** — реєструйтесь у каталогах:
   - Психологічні асоціації України
   - Каталоги психологів (психологи.com.ua, psyjournal.com.ua)
   - Профілі на професійних платформах

3. **Відгуки** — просіть клієнтів залишати відгуки на Google Maps (якщо створите Google Business Profile)

4. **Аналітика** — встановіть Google Analytics 4:
   ```html
   <!-- Додайте перед </head> в index.html -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'G-XXXXXXXXXX');
   </script>
   ```

## 7. Перевірка після запуску

- [ ] https://krzhv.pp.ua/ відкривається з HTTPS
- [ ] https://www.krzhv.pp.ua/ редиректить на non-www
- [ ] PageSpeed Insights: https://pagespeed.web.dev/ (ціль: 90+)
- [ ] Mobile-Friendly Test: https://search.google.com/test/mobile-friendly
- [ ] Schema Validator: https://validator.schema.org/
- [ ] Robots.txt доступний: https://krzhv.pp.ua/robots.txt
- [ ] Sitemap доступний: https://krzhv.pp.ua/sitemap.xml
- [ ] LLMs.txt доступний: https://krzhv.pp.ua/llms.txt
