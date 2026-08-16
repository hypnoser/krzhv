const { DateTime } = require("luxon");
const fs = require("fs");
const path = require("path");

module.exports = function (eleventyConfig) {
  // Copy static assets as-is
  eleventyConfig.addPassthroughCopy("src/assets/css");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/icons");
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy({ "src/static": "/" }); // for favicon.ico, CNAME, etc.

  // Inline critical CSS: read style.css at build time so it can be embedded
  // directly in <head> instead of a render-blocking <link> request.
  eleventyConfig.addGlobalData("inlineCss", () => {
    return fs.readFileSync(path.join(__dirname, "src/assets/css/style.css"), "utf-8");
  });

  // Collections: articles (statti) and blog posts, newest first
  eleventyConfig.addCollection("statti", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/statti/*.md").sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("blog", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/blog/*.md").sort((a, b) => b.date - a.date);
  });
  
  eleventyConfig.addCollection("kviz", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/kviz/*.md");
  });

  // Date formatting filter for Ukrainian locale
  eleventyConfig.addFilter("ukDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" })
      .setLocale("uk")
      .toFormat("d MMMM yyyy");
  });

  // ISO date filter for sitemap.xml (YYYY-MM-DD, required format)
  eleventyConfig.addFilter("isoDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-MM-dd");
  });

  // Reading time estimate filter (words / 180 wpm, rounded up)
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
