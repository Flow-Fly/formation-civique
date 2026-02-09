#!/usr/bin/env node

/**
 * Formation Civique Scraper
 *
 * Crawls formation-civique.interieur.gouv.fr in 3 levels:
 *   1. Theme pages → subcategory links
 *   2. Subcategory listing pages (with pagination) → article links
 *   3. Article pages → structured fiche content
 *
 * Output:
 *   data/fiches/{theme}/{subcategory}/{article}.json
 *   data/fiches/index.json
 *   data/site-map.json
 */

import { load } from "cheerio";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const FICHES_DIR = join(DATA_DIR, "fiches");
const CACHE_DIR = join(ROOT, ".cache", "html");

const BASE_URL = "https://formation-civique.interieur.gouv.fr";
const THEME_PATH = "/fiches-par-thematiques";

const THEMES = [
  {
    slug: "principes-et-valeurs-de-la-republique",
    name: "Principes et valeurs de la République",
    id: "principes-et-valeurs",
  },
  {
    slug: "systeme-institutionnel-et-politique",
    name: "Système institutionnel et politique",
    id: "systeme-institutionnel",
  },
  {
    slug: "droits-et-devoirs",
    name: "Droits et devoirs",
    id: "droits-et-devoirs",
  },
  {
    slug: "histoire-geographie-et-culture",
    name: "Histoire, géographie et culture",
    id: "histoire-geographie-culture",
  },
  {
    slug: "vivre-dans-la-societe-fran%C3%A7aise",
    name: "Vivre dans la société française",
    id: "vivre-societe-francaise",
  },
];

const DELAY_MS = 1500;
const siteMap = { themes: [] };

// ─── Utilities ───────────────────────────────────────────────────────

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cacheKeyFromUrl(url) {
  return url
    .replace(BASE_URL, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 200);
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

async function fetchPage(url) {
  const key = cacheKeyFromUrl(url);
  const cachePath = join(CACHE_DIR, key + ".html");

  if (existsSync(cachePath)) {
    console.log(`  [cache] ${url}`);
    return readFileSync(cachePath, "utf-8");
  }

  console.log(`  [fetch] ${url}`);
  await sleep(DELAY_MS);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();

  ensureDir(CACHE_DIR);
  writeFileSync(cachePath, html, "utf-8");
  return html;
}

function resolveUrl(href) {
  if (href.startsWith("http")) return href;
  return BASE_URL + (href.startsWith("/") ? href : "/" + href);
}

function extractSlugFromPath(urlPath) {
  const parts = urlPath.replace(/\/$/, "").split("/").filter(Boolean);
  return parts[parts.length - 1];
}

// ─── Level 2: Discover subcategories from a theme page ──────────────

async function discoverSubcategories(theme) {
  const url = `${BASE_URL}${THEME_PATH}/${theme.slug}/`;
  const html = await fetchPage(url);
  const $ = load(html);

  const subcategories = [];
  const basePath = `${THEME_PATH}/${theme.slug}/`;

  // Find all links that are direct children of the theme listing
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();

    // Links pointing to subcategory pages under this theme
    if (
      href.startsWith(basePath) &&
      href !== basePath &&
      href.endsWith("/") &&
      text.length > 2
    ) {
      const slug = extractSlugFromPath(href);
      // Avoid duplicates
      if (!subcategories.find((s) => s.slug === slug)) {
        subcategories.push({
          slug,
          name: text,
          id: slugify(text),
          url: resolveUrl(href),
          path: href,
        });
      }
    }
  });

  return subcategories;
}

// ─── Level 2b: Discover articles from a subcategory page (with pagination) ─

async function discoverArticles(subcategory, theme) {
  const articles = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const pageUrl =
      page === 1 ? subcategory.url : `${subcategory.url}?page=${page}`;
    const html = await fetchPage(pageUrl);
    const $ = load(html);

    const basePath = subcategory.path;
    let foundOnPage = 0;

    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();

      if (
        href.startsWith(basePath) &&
        href !== basePath &&
        href.endsWith("/") &&
        text.length > 2
      ) {
        const slug = extractSlugFromPath(href);
        // Skip pagination links and avoid duplicates
        if (
          !href.includes("?page=") &&
          !articles.find((a) => a.slug === slug)
        ) {
          articles.push({
            slug,
            title: text,
            url: resolveUrl(href),
            themeId: theme.id,
            themeName: theme.name,
            subcategoryId: subcategory.id,
            subcategoryName: subcategory.name,
          });
          foundOnPage++;
        }
      }
    });

    // Check for next page
    const pageText = $("body").text();
    const pageMatch = pageText.match(
      /Page\s+\d+\s*\/\s*(\d+)/i
    );
    if (pageMatch) {
      const totalPages = parseInt(pageMatch[1], 10);
      hasMore = page < totalPages;
    } else {
      // Also check for explicit next page links
      const hasNextPage = $(`a[href*="?page=${page + 1}"]`).length > 0;
      hasMore = hasNextPage;
    }

    page++;
  }

  return articles;
}

// ─── Level 3: Extract article content ────────────────────────────────

async function extractFiche(article) {
  const html = await fetchPage(article.url);
  const $ = load(html);

  // Get the main content — try common content selectors
  const content = $("main").length ? $("main") : $("article").length ? $("article") : $("#content").length ? $("#content") : $("body");

  // Title: first h1 in the content
  const title =
    content.find("h1").first().text().trim() || article.title;

  // Extract objectives
  const objectives = [];
  const fullText = content.text();
  const objMatch = fullText.match(
    /Objectifs?\s+de\s+la\s+fiche\s*:?\s*([\s\S]*?)(?=\n\s*\n|\*\s*\*\s*\*|---|___)/i
  );
  if (objMatch) {
    const objBlock = objMatch[1];
    const lines = objBlock
      .split(/\n/)
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter((l) => l.length > 5);
    objectives.push(...lines);
  }

  // Extract sections by headings
  const sections = [];
  const headings = content.find("h2, h3");

  headings.each((i, el) => {
    const heading = $(el).text().trim();
    if (
      !heading ||
      heading.toLowerCase().includes("fil d'ariane") ||
      heading.toLowerCase().includes("objectifs de la fiche")
    ) {
      return;
    }

    // Collect content until the next heading of same or higher level
    let contentParts = [];
    let next = $(el).next();
    while (
      next.length &&
      !next.is("h1, h2, h3")
    ) {
      const tagName = next.prop("tagName")?.toLowerCase();
      if (tagName === "ul" || tagName === "ol") {
        const items = [];
        next.find("li").each((_, li) => {
          items.push($(li).text().trim());
        });
        contentParts.push(items.join("\n- "));
      } else if (tagName === "hr") {
        // skip dividers
      } else {
        const text = next.text().trim();
        if (text.length > 0) {
          contentParts.push(text);
        }
      }
      next = next.next();
    }

    const sectionContent = contentParts.join("\n\n");
    if (sectionContent.length > 0 || heading.length > 0) {
      sections.push({
        heading,
        content: sectionContent,
        type: "text",
      });
    }
  });

  // If no sections found via headings, try grabbing all paragraph text
  if (sections.length === 0) {
    const paragraphs = [];
    content.find("p").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) {
        paragraphs.push(text);
      }
    });
    if (paragraphs.length > 0) {
      sections.push({
        heading: title,
        content: paragraphs.join("\n\n"),
        type: "text",
      });
    }
  }

  // Extract references ("Pour aller plus loin")
  const references = [];
  let inReferences = false;
  content.find("h2, h3, h4, p, a").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (
      text.includes("pour aller plus loin") ||
      text.includes("en savoir plus")
    ) {
      inReferences = true;
      return;
    }
    if (inReferences && $(el).is("a")) {
      const href = $(el).attr("href");
      const label = $(el).text().trim();
      if (href && label && href.startsWith("http")) {
        references.push({ label, url: href });
      }
    }
    // Stop collecting at next heading
    if (inReferences && $(el).is("h2, h3") && !text.includes("pour aller")) {
      inReferences = false;
    }
  });

  const ficheId = `${article.themeId}--${article.subcategoryId}--${article.slug}`;

  return {
    id: ficheId,
    title,
    themeId: article.themeId,
    themeName: article.themeName,
    subcategoryId: article.subcategoryId,
    subcategoryName: article.subcategoryName,
    url: article.url,
    objectives,
    sections,
    references,
  };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("Formation Civique Scraper\n");
  ensureDir(DATA_DIR);
  ensureDir(FICHES_DIR);

  const allFiches = [];
  const index = { themes: [] };

  for (const theme of THEMES) {
    console.log(`\nTheme: ${theme.name}`);
    const themeEntry = {
      id: theme.id,
      name: theme.name,
      subcategories: [],
    };

    const siteTheme = {
      id: theme.id,
      name: theme.name,
      url: `${BASE_URL}${THEME_PATH}/${theme.slug}/`,
      subcategories: [],
    };

    const subcategories = await discoverSubcategories(theme);
    console.log(`  Found ${subcategories.length} subcategories`);

    for (const subcat of subcategories) {
      console.log(`\n  Subcategory: ${subcat.name}`);
      const subcatEntry = {
        id: subcat.id,
        name: subcat.name,
        fiches: [],
      };

      const siteSubcat = {
        id: subcat.id,
        name: subcat.name,
        url: subcat.url,
        articles: [],
      };

      const articles = await discoverArticles(subcat, theme);
      console.log(`    Found ${articles.length} articles`);

      // Ensure output directory
      const ficheDir = join(FICHES_DIR, theme.id, subcat.id);
      ensureDir(ficheDir);

      for (const article of articles) {
        try {
          const fiche = await extractFiche(article);
          const outPath = join(ficheDir, `${article.slug}.json`);
          writeFileSync(outPath, JSON.stringify(fiche, null, 2), "utf-8");

          allFiches.push(fiche);
          subcatEntry.fiches.push({
            id: fiche.id,
            title: fiche.title,
            slug: article.slug,
          });
          siteSubcat.articles.push({
            title: article.title,
            url: article.url,
          });

          console.log(`    ✓ ${fiche.title}`);
        } catch (err) {
          console.error(`    ✗ Error on ${article.url}: ${err.message}`);
        }
      }

      themeEntry.subcategories.push(subcatEntry);
      siteTheme.subcategories.push(siteSubcat);
    }

    index.themes.push(themeEntry);
    siteMap.themes.push(siteTheme);
  }

  // Write index
  const indexPath = join(FICHES_DIR, "index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
  console.log(`\nIndex written: ${indexPath}`);

  // Write site map
  const siteMapPath = join(DATA_DIR, "site-map.json");
  writeFileSync(siteMapPath, JSON.stringify(siteMap, null, 2), "utf-8");
  console.log(`Site map written: ${siteMapPath}`);

  // Summary
  const totalFiches = allFiches.length;
  const totalThemes = index.themes.length;
  const totalSubcats = index.themes.reduce(
    (acc, t) => acc + t.subcategories.length,
    0
  );
  console.log(
    `\nDone! ${totalFiches} fiches across ${totalSubcats} subcategories in ${totalThemes} themes.`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
