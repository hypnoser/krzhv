from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright

repo=Path(__file__).resolve().parents[2]
site=repo/'_site'
review=Path('/tmp/krzhv-self-help-review'); review.mkdir(exist_ok=True)
shots=review/'screenshots'; shots.mkdir(exist_ok=True)
base='http://127.0.0.1:8080'
guides=['/statti/postiina-tryvoha/','/statti/depresiya/','/statti/panichni-ataky/']
pages=guides+['/statti/','/']
count=0
expect_launch='--expect-launch' in sys.argv
def check(condition, detail):
    global count
    if not condition: raise AssertionError(detail)
    count+=1

class Document(HTMLParser):
    def __init__(self,html):
        super().__init__(); self.tags=[]; self.ids=set(); self.links=[]
        self.feed(html)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); self.tags.append((tag,a))
        if a.get('id'): self.ids.add(a['id'])
        if tag=='a' and a.get('href'): self.links.append(a['href'])

def file_for(path):
    dest=site/unquote(path).lstrip('/')
    return dest/'index.html' if dest.is_dir() else dest

for route in pages:
    html=file_for(route).read_text(); doc=Document(html)
    for tag,attr in doc.tags:
        value=attr.get('src') if tag in ('img','script') else None
        if tag=='source' and attr.get('srcset'):
            value=attr['srcset'].split(',')[0].split()[0]
        if tag=='link' and attr.get('rel') in ('icon','apple-touch-icon','manifest','preload'):
            value=attr.get('href')
        if value and value.startswith('/'):
            check(file_for(urlsplit(value).path).is_file(),route+' missing resource '+value)
    for href in doc.links:
        parts=urlsplit(href)
        if parts.scheme or parts.netloc: continue
        path=parts.path or route
        check(path.startswith('/'),route+' unexpected relative internal URL '+href)
        target=file_for(path)
        check(target.is_file(),route+' missing link '+href)
        if parts.fragment:
            target_doc=Document(target.read_text())
            check(unquote(parts.fragment) in target_doc.ids,route+' missing anchor '+href)

tree=ET.parse(site/'sitemap.xml')
ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
urls=[e.text for e in tree.findall('.//s:loc',ns)]
check(len(urls)==len(set(urls)),'duplicate sitemap URLs')
for route in guides:
    check(urls.count('https://krzhv.com.ua'+route)==1,route+' sitemap presence')
    entry=next(u for u in tree.findall('s:url',ns) if u.find('s:loc',ns).text=='https://krzhv.com.ua'+route)
    check(entry.find('s:lastmod',ns).text=='2026-09-30',route+' sitemap lastmod')
for path in ['/materialy/pochatok/','/materialy/pochatok/blanky/']:
    check('https://krzhv.com.ua'+path not in urls,path+' indexed in sitemap')
    check('noindex' in file_for(path).read_text(),path+' noindex lost')
check(not (site/'samodopomoha').exists(),'unexpected standalone self-help page')
for title in ['Панічні атаки: що робити під час нападу та між нападами','Депресія: як допомогти собі, коли немає сил','Постійна тривога: що робити і як допомогти собі']:
    matching=[p for p in (site/'statti').rglob('*.html') if '<h1>'+title+'</h1>' in p.read_text()]
    check(len(matching)==1,'duplicate article publication '+title)

results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
    for width in [360,1280]:
        ctx=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=1)
        # Keep local rendering deterministic; production analytics code remains untouched.
        ctx.route('https://www.googletagmanager.com/**',lambda route: route.abort())
        ctx.route('https://www.google-analytics.com/**',lambda route: route.abort())
        page=ctx.new_page()
        errors=[]; page.on('pageerror',lambda error: errors.append(str(error)))
        for route in pages:
            response=page.goto(base+route,wait_until='networkidle')
            check(response.status==200,route+' HTTP response')
            page.evaluate('document.fonts.ready')
            overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
            check(not overflow,f'{width} {route} horizontal page overflow')
            schemas=[json.loads(s) for s in page.locator('script[type="application/ld+json"]').all_text_contents()]
            check(bool(schemas),route+' missing JSON-LD')
            check(page.locator('link[rel="canonical"]').get_attribute('href')=='https://krzhv.com.ua'+route,route+' canonical')
            check(bool(page.locator('meta[name="description"]').get_attribute('content')),route+' description')
            if route in guides:
                check(page.locator('h1').count()==1,route+' H1 count')
                title=page.locator('h1').inner_text()
                check(page.title().startswith(title),route+' title/H1')
                medical=next(s for s in schemas if s.get('@type')=='MedicalWebPage')
                check(medical['headline']==title and medical['name']==title,route+' schema name')
                check(medical['description']==page.locator('meta[name="description"]').get_attribute('content'),route+' schema description')
                check(medical['url']=='https://krzhv.com.ua'+route,route+' schema URL')
                check(medical['dateModified']=='2026-09-30',route+' schema modified date')
                check('datePublished' not in medical,route+' invented publication date')
                check(page.locator('time').get_attribute('datetime')==medical['dateModified'],route+' visible date')
                check('30 вересня 2026' in page.locator('time').inner_text(),route+' visible date locale')
                check(page.locator('.sources a').count()>=3,route+' clickable sources')
                toc=page.locator('.guide-toc a').first
                for _ in range(65):
                    page.keyboard.press('Tab')
                    if toc.evaluate('(e)=>e===document.activeElement'): break
                check(toc.evaluate('(e)=>e===document.activeElement'),route+' keyboard cannot reach TOC')
                check(toc.evaluate('(e)=>getComputedStyle(e).outlineStyle')=='solid',route+' missing focus outline')
                target=toc.get_attribute('href')
                page.keyboard.press('Enter')
                page.wait_for_timeout(500)
                check(page.evaluate('location.hash')==target,route+' keyboard anchor activation')
                if width==360 and page.locator('.guide-table').count():
                    table=page.locator('.guide-table').first
                    table.focus()
                    page.keyboard.press('ArrowRight')
                    page.wait_for_timeout(200)
                    check(table.evaluate('(e)=>e.scrollLeft')>0,route+' table not scrollable with keyboard')
                    check(not page.evaluate('document.documentElement.scrollWidth > innerWidth'),route+' table expands page')
            if route=='/statti/':
                card_links=page.locator('#samodopomoha .article-card h3 a')
                check(card_links.all_text_contents()==['Постійно тривожно','Немає сил і нічого не хочеться','Панічні атаки'],'catalog cards/order')
                check([a.get_attribute('href') for a in card_links.all()]==guides,'catalog destinations')
                for guide in guides:
                    check(page.locator(f'.article-card h3 a[href="{guide}"]').count()==1,'duplicate catalog card '+guide)
                check(page.locator('header a[href="/samodopomoha/"]').count()==0,'new nav item')
                for _ in range(50):
                    page.keyboard.press('Tab')
                    if card_links.first.evaluate('(e)=>e===document.activeElement'): break
                check(card_links.first.evaluate('(e)=>e===document.activeElement'),'catalog keyboard cards')
                check(card_links.first.evaluate('(e)=>getComputedStyle(e).outlineStyle')=='solid','catalog focus outline')
            if route=='/':
                check(page.locator('a[href="/statti/#samodopomoha"]').count()==1,'home self-help link count')
                if expect_launch:
                    check(page.locator('#maintenanceOverlay').count()==0,'launch overlay still present')
                    check(page.locator('h1').count()==1,'launch home H1 count')
            if route!='/':
                page.evaluate('scrollTo(0,0)')
                page.wait_for_timeout(350)
                slug=route.strip('/').replace('/','-')
                page.screenshot(path=str(shots/f'{slug}-{width}.png'),full_page=True)
                results.append({'route':route,'width':width,'overflow':overflow})
            check(not errors,f'{route} JavaScript errors: {errors}')
        if width==360:
            page.goto(base+'/statti/',wait_until='networkidle')
            toggle=page.locator('#navToggle')
            toggle.focus(); page.keyboard.press('Enter')
            check(toggle.get_attribute('aria-expanded')=='true','mobile menu keyboard open')
            check(page.locator('#navMobile').is_visible(),'mobile menu visibility')
            page.keyboard.press('Enter')
            check(toggle.get_attribute('aria-expanded')=='false','mobile menu keyboard close')
        ctx.close()
    browser.close()
(review/'validation-results.json').write_text(json.dumps({'assertions':count,'browser_pages':results},ensure_ascii=False,indent=2))
print(f'PASS {count} assertions; Chromium desktop/mobile; screenshots: {shots}')
