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

  eleventyConfig.addGlobalData("inlineCss", () => {
    return fs.readFileSync(path.join(__dirname, "src/assets/css/style.css"), "utf-8");
  });

  eleventyConfig.addFilter("autoSlug", autoSlug);

  eleventyConfig.addCollection("statti", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/statti/*.md").sort((a, b) => b.date - a.date);
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
