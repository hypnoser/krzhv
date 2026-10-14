const { DateTime } = require("luxon");
const fs = require("fs");
const path = require("path");
const slugify = require("slugify");

slugify.extend({
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia",
  А: "a", Б: "b", В: "v", Г: "h", Ґ: "g", Д: "d", Е: "e", Є: "ie", Ж: "zh",
  З: "z", И: "y", І: "i", Ї: "i", Й: "i", К: "k", Л: "l", М: "m", Н: "n",
  О: "o", П: "p", Р: "r", С: "s", Т: "t", У: "u", Ф: "f", Х: "kh", Ц: "ts",
  Ч: "ch", Ш: "sh", Щ: "shch", Ь: "", Ю: "iu", Я: "ia",
});

function autoSlug(input) {
  const words = slugify(input, { lower: true, strict: true }).split("-").filter(Boolean);
  return words.slice(0, 8).join("-");
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets/css");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/icons");
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy({ "src/static": "/" });

  // /secret/: файли вже зашифровані в браузері — копіюються як є, без обробки шаблонами.
  // Список для сторінки /secret/ — зашифровані метадані з кожного файлу.
  eleventyConfig.addPassthroughCopy("src/secret/files");
  eleventyConfig.ignores.add("src/secret/files/**");
  eleventyConfig.addGlobalData("secretFiles", () => {
    const dir = path.join(__dirname, "src/secret/files");
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".html"))
      .map((f) => {
        const html = fs.readFileSync(path.join(dir, f), "utf-8");
        const m = html.match(/<script type="application\/json" id="krzhv-meta">([^<]*)<\/script>/);
        if (!m) { console.warn(`[secret] ${f}: немає krzhv-meta — файл не зашифровано через /secret/?`); return null; }
        return { url: `/secret/files/${f}`, meta: JSON.parse(m[1]) };
      })
      .filter(Boolean);
  });

  // Стилі вбудовуються в кожну сторінку — у стиснутому вигляді (без коментарів і зайвих пробілів).
  eleventyConfig.addGlobalData("inlineCss", () => {
    return fs.readFileSync(path.join(__dirname, "src/assets/css/style.css"), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{};,])\s*/g, "$1")
      .replace(/;}/g, "}")
      .trim();
  });

  eleventyConfig.addFilter("autoSlug", autoSlug);

  // FAQPage для пошуковиків — з тих самих даних, що й блок «Часто запитують» (src/_data/faq.js).
  eleventyConfig.addFilter("faqSchema", (groups) => {
    const strip = (h) => String(h).replace(/<[^>]+>/g, "");
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: groups.flatMap((g) => g.items).map((i) => ({
        "@type": "Question",
        name: i.q,
        acceptedAnswer: { "@type": "Answer", text: strip(i.a) },
      })),
    }).replace(/</g, "\\u003c");
  });

  // Зображення нижче першого екрана: відкладене завантаження, якщо атрибут не задано вручну.
  // Не чіпаємо аватар у шапці статті та картинки з fetchpriority.
  // Таблиці з Markdown, де перша клітинка заголовка порожня: перша колонка — заголовки рядків.
  // Так програми зчитування з екрана зв'язують кожну клітинку з її рядком і колонкою.
  eleventyConfig.addTransform("tableHeaders", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    return content.replace(/<table>([\s\S]*?)<\/table>/g, (table, inner) => {
      if (!/<thead>\s*<tr>\s*<th>\s*<\/th>/.test(inner)) return table;
      const fixed = inner
        .replace(/<th>/g, '<th scope="col">')
        .replace(/(<tbody>[\s\S]*)/, (body) => body.replace(/<tr>\s*<td>([\s\S]*?)<\/td>/g, '<tr>\n<th scope="row">$1</th>'));
      return "<table>" + fixed + "</table>";
    });
  });

  eleventyConfig.addTransform("lazyImages", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    return content.replace(/<img\b(?![^>]*\bloading=)(?![^>]*\bfetchpriority=)(?![^>]*author-avatar)([^>]*)>/g,
      '<img loading="lazy" decoding="async"$1>');
  });

  // «Читайте також»: спершу вручну задані relatedUrls (будь-які статті/пости),
  // далі — матеріали з тим самим значенням preferKey, далі — решта fillPool.
  eleventyConfig.addFilter("pickRelated", (fillPool, allPool, currentUrl, pinned, preferKey, preferValue, limit = 3) => {
    const out = [];
    const seen = new Set([currentUrl]);
    const add = (p) => { if (p && !seen.has(p.url) && !p.data.noindex && out.length < limit) { out.push(p); seen.add(p.url); } };
    for (const url of pinned || []) {
      const p = allPool.find((x) => x.url === url);
      if (!p) console.warn(`[pickRelated] ${currentUrl}: relatedUrls не знайдено — ${url}`);
      add(p);
    }
    if (preferKey) fillPool.filter((p) => p.data[preferKey] === preferValue).forEach(add);
    fillPool.forEach(add);
    return out;
  });
  eleventyConfig.addFilter("selfHelpGuides", (posts) => {
    return posts.filter((post) => post.data.selfHelp && !post.data.noindex)
      .sort((a, b) => a.data.selfHelp.order - b.data.selfHelp.order);
  });

  // Новіші вгорі; за однакової дати — нещодавно оновлені, далі за назвою (стабільний порядок).
  const byNewest = (a, b) =>
    (b.date - a.date) ||
    (new Date(b.data.updated || b.date) - new Date(a.data.updated || a.date)) ||
    String(a.data.title).localeCompare(String(b.data.title), "uk");

  eleventyConfig.addCollection("statti", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/statti/*.md").sort(byNewest);
  });

  // Головна: N найновіших статей, без посібників самодопомоги (на них веде блок станів) і без noindex.
  eleventyConfig.addFilter("latestArticles", (posts, n = 3) => {
    return posts.filter((p) => !p.data.selfHelp && !p.data.noindex).slice().sort(byNewest).slice(0, n);
  });

  eleventyConfig.addCollection("blog", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/blog/*.md").sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("kviz", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/kviz/*.md");
  });

  eleventyConfig.addFilter("ukDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" })
      .setLocale("uk")
      .toFormat("d MMMM yyyy");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-MM-dd");
  });

  eleventyConfig.addFilter("readingTime", (content) => {
    if (!content) return 1;
    const words = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 180));
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_layouts",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
