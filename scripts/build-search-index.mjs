#!/usr/bin/env node

/**
 * Build a search index from all markdown content files.
 *
 * Reads every .md in app-react/public/content/, strips YAML frontmatter,
 * converts markdown to plain text, extracts sections with heading IDs,
 * and outputs search-index.json.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "app-react", "public", "content");
const OUTPUT = join(ROOT, "app-react", "public", "data", "search-index.json");

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { fm: {}, body: content };
  const fm = {};
  const lines = match[1].split("\n");
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    const kvMatch = line.match(/^(\w+):\s*(.+)?$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = (kvMatch[2] || "").trim();
      if (val) {
        fm[currentKey] = val.replace(/^"(.*)"$/, "$1");
      }
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
  return { fm, body: match[2] };
}

/** Must match generateHeadingId() in use-fiche-content.ts */
function generateHeadingId(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*\*/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Strip markdown syntax to produce searchable plain text. */
function markdownToPlainText(md) {
  return (
    md
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
      .trim()
  );
}

/** Split markdown body into sections based on ## and ### headings. */
function extractSections(body) {
  const lines = body.split("\n");
  const sections = [];
  let currentTitle = null;
  let currentId = null;
  let currentLines = [];

  function flush() {
    if (currentTitle !== null) {
      const content = markdownToPlainText(currentLines.join("\n"));
      if (content) {
        sections.push({ id: currentId, title: currentTitle, content });
      }
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      flush();
      const rawTitle = headingMatch[2];
      currentTitle = rawTitle.replace(/\*\*/g, "").trim();
      currentId = generateHeadingId(rawTitle);
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections;
}

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

const mdFiles = walkDir(CONTENT_DIR);
const index = [];

for (const filePath of mdFiles) {
  const raw = readFileSync(filePath, "utf-8");
  const { fm, body } = parseFrontmatter(raw);
  const slug = basename(filePath, ".md");
  const relPath = filePath.slice(CONTENT_DIR.length + 1);
  // Use path (without .md) as unique id — slugs can collide across subcategories
  const id = relPath.replace(/\.md$/, "");

  const plainText = markdownToPlainText(body);
  const sections = extractSections(body);

  index.push({
    id,
    title: fm.title || slug,
    path: relPath,
    themeName: fm.themeName || "",
    subcategoryName: fm.subcategoryName || "",
    content: plainText,
    sections,
  });
}

writeFileSync(OUTPUT, JSON.stringify(index), "utf-8");

const sizeKB = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(0);
console.log(
  `Built search index: ${index.length} pages → search-index.json (${sizeKB}KB)`,
);
