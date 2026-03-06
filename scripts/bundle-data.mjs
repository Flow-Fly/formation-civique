#!/usr/bin/env node

/**
 * Bundle all data for the web apps:
 * - Merge all fiches into fiches.json
 * - Copy canonical question bank + exam config
 * - Generate content-index.json from markdown file tree
 *
 * Outputs to:
 * - app-react/public/data/
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REACT_DATA = join(ROOT, "app-react", "public", "data");
const CONTENT_DIR = join(ROOT, "app-react", "public", "content");

mkdirSync(REACT_DATA, { recursive: true });

function writeRuntime(filename, payload) {
  writeFileSync(join(REACT_DATA, filename), payload, "utf-8");
}

// --- Bundle fiches ---
const fichesDir = join(ROOT, "data-init", "fiches");
const index = JSON.parse(readFileSync(join(fichesDir, "index.json"), "utf-8"));

const allFiches = [];

function walkDir(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.endsWith(".json") && entry !== "index.json") {
      const fiche = JSON.parse(readFileSync(fullPath, "utf-8"));
      allFiches.push(fiche);
    }
  }
}

walkDir(fichesDir);

const fichesBundle = { index, fiches: allFiches };
const fichesJson = JSON.stringify(fichesBundle);
writeRuntime("fiches.json", fichesJson);
console.log(`Bundled ${allFiches.length} fiches → app-react/public/data/`);

// --- Bundle canonical questions + exam config ---
const questionBank = JSON.parse(readFileSync(join(ROOT, "data-init", "question-bank.json"), "utf-8"));
const examConfig = JSON.parse(readFileSync(join(ROOT, "data-init", "exam-config.json"), "utf-8"));

const questionBankJson = JSON.stringify(questionBank);
const examConfigJson = JSON.stringify(examConfig);
writeRuntime("question-bank.json", questionBankJson);
writeRuntime("exam-config.json", examConfigJson);
console.log(`Bundled ${questionBank.length} canonical questions → app-react/public/data/`);

// --- Generate content-index.json ---
console.log("\nGenerating content-index.json from markdown files...");

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  const lines = match[1].split("\n");
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    const kvMatch = line.match(/^(\w+):\s*(.+)?$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = (kvMatch[2] || "").trim();
      if (val) fm[currentKey] = val.replace(/^"(.*)"$/, "$1");
      currentArray = null;
      continue;
    }
    const arrayMatch = line.match(/^\s+-\s*(.+)$/);
    if (arrayMatch && currentKey) {
      if (!currentArray) {
        currentArray = [];
        fm[currentKey] = currentArray;
      }
      currentArray.push(arrayMatch[1].replace(/^"(.*)"$/, "$1"));
    }
  }
  return fm;
}

const contentIndex = { themes: [] };

for (const theme of index.themes) {
  const themeEntry = {
    id: theme.id,
    name: theme.name,
    subcategories: [],
  };

  for (const subcat of theme.subcategories) {
    const subcatDir = join(CONTENT_DIR, theme.id, subcat.id);
    if (!existsSync(subcatDir)) continue;

    const mdFiles = readdirSync(subcatDir).filter((f) => f.endsWith(".md"));
    const pagesBySlug = new Map();

    for (const mdFile of mdFiles) {
      const mdPath = join(subcatDir, mdFile);
      const content = readFileSync(mdPath, "utf-8");
      const fm = parseFrontmatter(content);
      const slug = basename(mdFile, ".md");
      const relPath = `${theme.id}/${subcat.id}/${slug}.md`;

      const originalIds = Array.isArray(fm.originalFicheIds)
        ? fm.originalFicheIds
        : fm.originalFicheIds
          ? [fm.originalFicheIds]
          : [];

      pagesBySlug.set(slug, {
        id: slug,
        title: fm.title || slug,
        path: relPath,
        originalFicheIds: originalIds,
      });
    }

    const subcatEntry = {
      id: subcat.id,
      name: subcat.name,
      pages: [],
      groups: [],
    };

    const groupedSlugs = new Set();
    for (const [slug, page] of pagesBySlug) {
      if (page.originalFicheIds.length > 1) groupedSlugs.add(slug);
    }

    const ficheOrder = new Map();
    subcat.fiches.forEach((f, idx) => ficheOrder.set(f.slug, idx));

    const ungrouped = [];
    for (const [slug, page] of pagesBySlug) {
      if (!groupedSlugs.has(slug)) {
        const orderIdx = ficheOrder.get(slug) ?? ficheOrder.get(encodeURIComponent(slug)) ?? 999;
        ungrouped.push({ ...page, _order: orderIdx });
      }
    }
    ungrouped.sort((a, b) => a._order - b._order);
    subcatEntry.pages = ungrouped.map(({ _order, ...p }) => p);

    for (const [slug, page] of pagesBySlug) {
      if (!groupedSlugs.has(slug)) continue;
      const firstFicheId = page.originalFicheIds[0] || "";
      const firstSlug = subcat.fiches.find((f) => f.id === firstFicheId)?.slug;
      const orderIdx = firstSlug ? (ficheOrder.get(firstSlug) ?? 999) : 999;
      subcatEntry.groups.push({
        id: slug,
        name: page.title || slug,
        pages: [page],
        _order: orderIdx,
      });
    }

    subcatEntry.groups.sort((a, b) => a._order - b._order);
    subcatEntry.groups = subcatEntry.groups.map(({ _order, ...g }) => g);

    if (subcatEntry.groups.length === 0) delete subcatEntry.groups;
    if (subcatEntry.pages.length === 0) delete subcatEntry.pages;

    themeEntry.subcategories.push(subcatEntry);
  }

  contentIndex.themes.push(themeEntry);
}

const contentIndexJson = JSON.stringify(contentIndex, null, 2);
writeFileSync(join(REACT_DATA, "content-index.json"), contentIndexJson, "utf-8");

let totalPages = 0;
let totalGroups = 0;
for (const theme of contentIndex.themes) {
  for (const subcat of theme.subcategories) {
    totalPages += (subcat.pages || []).length;
    if (subcat.groups) {
      totalGroups += subcat.groups.length;
      for (const group of subcat.groups) {
        totalPages += group.pages.length;
      }
    }
  }
}
console.log(`Generated content-index.json: ${totalPages} pages, ${totalGroups} groups`);

const fichesSize = (statSync(join(REACT_DATA, "fiches.json")).size / 1024).toFixed(0);
const qBankSize = (statSync(join(REACT_DATA, "question-bank.json")).size / 1024).toFixed(0);
const examCfgSize = (statSync(join(REACT_DATA, "exam-config.json")).size / 1024).toFixed(0);
const contentIndexSize = (statSync(join(REACT_DATA, "content-index.json")).size / 1024).toFixed(0);
console.log(
  `\nSizes: fiches.json=${fichesSize}KB, question-bank.json=${qBankSize}KB, exam-config.json=${examCfgSize}KB, content-index.json=${contentIndexSize}KB`,
);
