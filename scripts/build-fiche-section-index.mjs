#!/usr/bin/env node

/**
 * Build a section-level index from markdown fiches.
 *
 * Input:
 * - app-react/public/content markdown files
 *
 * Output:
 * - data-init/fiches-section-index.json
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "app-react", "public", "content");
const OUTPUT_PATH = join(ROOT, "data-init", "fiches-section-index.json");

const STOP_WORDS = new Set([
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d",
  "au", "aux", "ce", "cet", "cette", "ces", "dans", "sur", "avec",
  "sans", "pour", "par", "et", "ou", "donc", "car", "mais", "ni",
  "est", "sont", "etre", "avoir", "fait", "plus", "moins", "tres",
  "qui", "que", "quoi", "dont", "ou", "se", "sa", "son", "ses",
  "nous", "vous", "ils", "elles", "notre", "votre", "leur", "leurs",
  "france", "francais", "francaise", "francaises", "republique",
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function generateHeadingId(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*\*/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return {
      fm: {
        title: "",
        themeId: "",
        themeName: "",
        subcategoryId: "",
        subcategoryName: "",
        originalFicheIds: [],
      },
      body: content,
    };
  }

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

  return {
    fm: {
      title: fm.title || "",
      themeId: fm.themeId || "",
      themeName: fm.themeName || "",
      subcategoryId: fm.subcategoryId || "",
      subcategoryName: fm.subcategoryName || "",
      originalFicheIds: Array.isArray(fm.originalFicheIds)
        ? fm.originalFicheIds
        : fm.originalFicheIds
          ? [String(fm.originalFicheIds)]
          : [],
    },
    body: match[2],
  };
}

function markdownToPlainText(md) {
  return String(md || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/^[\s-:]+$/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extractSections(body) {
  const lines = body.split("\n");
  const sections = [];

  let currentTitle = null;
  let currentId = null;
  let currentLines = [];

  function flush() {
    if (!currentTitle) return;
    const sectionText = markdownToPlainText(currentLines.join("\n"));
    if (!sectionText) return;
    sections.push({
      sectionId: currentId,
      sectionTitle: currentTitle,
      sectionText,
    });
  }

  for (const line of lines) {
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flush();
      const rawTitle = heading[2].replace(/\*\*/g, "").trim();
      currentTitle = rawTitle;
      currentId = generateHeadingId(rawTitle);
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return sections;
}

function walkDir(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      out.push(...walkDir(fullPath));
      continue;
    }
    if (entry.endsWith(".md")) out.push(fullPath);
  }
  return out;
}

function main() {
  const mdFiles = walkDir(CONTENT_DIR);
  const sections = [];
  const byTheme = {};

  for (const filePath of mdFiles) {
    const raw = readFileSync(filePath, "utf-8");
    const { fm, body } = parseFrontmatter(raw);
    const contentPath = filePath.slice(CONTENT_DIR.length + 1);
    const parsedSections = extractSections(body);

    for (const section of parsedSections) {
      const mergedText = `${fm.title}\n${section.sectionTitle}\n${section.sectionText}`;
      const terms = [...new Set(tokenize(mergedText))];

      sections.push({
        contentPath,
        themeId: fm.themeId || "",
        themeName: fm.themeName || "",
        subcategoryId: fm.subcategoryId || "",
        subcategoryName: fm.subcategoryName || "",
        originalFicheIds: fm.originalFicheIds || [],
        sectionId: section.sectionId,
        sectionTitle: section.sectionTitle,
        sectionText: section.sectionText,
        terms,
      });

      if (fm.themeId) byTheme[fm.themeId] = (byTheme[fm.themeId] || 0) + 1;
    }
  }

  const invertedIndex = {};
  const docFreq = {};
  sections.forEach((section, idx) => {
    for (const term of section.terms) {
      if (!invertedIndex[term]) invertedIndex[term] = [];
      invertedIndex[term].push(idx);
      docFreq[term] = (docFreq[term] || 0) + 1;
    }
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceDir: "app-react/public/content",
    sectionCount: sections.length,
    byTheme,
    sections,
    index: {
      docCount: sections.length,
      docFreq,
      invertedIndex,
    },
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf-8");

  console.log(`Indexed ${sections.length} sections from ${mdFiles.length} markdown files`);
  console.log(`Written ${OUTPUT_PATH}`);
}

main();
