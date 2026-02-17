#!/usr/bin/env node

/**
 * Download images referenced in generated markdown files.
 *
 * Strategy:
 * 1. Scan markdown files for /images/fiches/{filename} references
 * 2. For each unique image, fetch the LIVE fiche page (using URLs from fiche JSONs)
 *    to get a fresh signed S3 URL
 * 3. Download the image to app-react/public/images/fiches/{filename}
 * 4. Rate-limited: 1.5s between page fetches
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { load } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "app-react", "public", "content");
const IMAGES_DIR = join(ROOT, "app-react", "public", "images", "fiches");
const FICHES_DIR = join(ROOT, "data-init", "fiches");

const S3_HOST = "s3.eu-west-par.io.cloud.ovh.net";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function walkFiles(dir, ext) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkFiles(fullPath, ext));
    } else if (entry.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Step 1: Collect unique image filenames from markdown ───────────

console.log("Scanning markdown files for image references...");

const neededImages = new Set();
const mdFiles = walkFiles(CONTENT_DIR, ".md");

for (const mdPath of mdFiles) {
  const content = readFileSync(mdPath, "utf-8");
  const matches = content.matchAll(/!\[.*?\]\(\/images\/fiches\/([^)]+)\)/g);
  for (const m of matches) {
    neededImages.add(m[1]);
  }
}

console.log(`Found ${neededImages.size} unique images referenced.`);

// Check which ones we already have
mkdirSync(IMAGES_DIR, { recursive: true });
const alreadyHave = new Set();
for (const img of neededImages) {
  if (existsSync(join(IMAGES_DIR, img))) {
    alreadyHave.add(img);
  }
}
console.log(`Already downloaded: ${alreadyHave.size}`);

const toDownload = [...neededImages].filter((f) => !alreadyHave.has(f));
if (toDownload.length === 0) {
  console.log("All images already downloaded!");
  process.exit(0);
}
console.log(`Need to download: ${toDownload.length}`);

// ─── Step 2: Map images to fiche URLs ───────────────────────────────

// Read all fiche JSON files to get their original URLs
console.log("\nLoading fiche URLs...");
const ficheUrls = [];
const ficheJsonFiles = walkFiles(FICHES_DIR, ".json").filter(
  (f) => !f.endsWith("index.json"),
);
for (const jsonPath of ficheJsonFiles) {
  const fiche = JSON.parse(readFileSync(jsonPath, "utf-8"));
  if (fiche.url) {
    ficheUrls.push(fiche.url);
  }
}
console.log(`Loaded ${ficheUrls.length} fiche URLs.`);

// ─── Step 3: Fetch live pages and download images ───────────────────

const downloaded = new Set();
let failCount = 0;

// We'll fetch pages one at a time and extract all images from each
// Build a map of which images we still need
const remaining = new Set(toDownload);

for (const ficheUrl of ficheUrls) {
  if (remaining.size === 0) break;

  try {
    console.log(`\n[fetch] ${ficheUrl}`);
    await sleep(1500);
    const res = await fetch(ficheUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FormationCiviqueBot/1.0)",
      },
    });
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} — skipping`);
      continue;
    }

    const html = await res.text();
    const $ = load(html);

    // Extract all S3 image URLs from this page
    const pageImages = new Map(); // filename -> s3Url
    $("img").each((_i, el) => {
      const src = $(el).attr("src") || "";
      if (!src.includes(S3_HOST)) return;
      const match = src.match(/\/images\/([^?]+)/);
      if (!match) return;
      const filename = match[1];
      if (remaining.has(filename)) {
        pageImages.set(filename, src.replace(/&amp;/g, "&"));
      }
    });

    if (pageImages.size === 0) continue;
    console.log(`  Found ${pageImages.size} needed image(s)`);

    // Download each image
    for (const [filename, s3Url] of pageImages) {
      const outPath = join(IMAGES_DIR, filename);
      mkdirSync(dirname(outPath), { recursive: true });

      try {
        const imgRes = await fetch(s3Url);
        if (!imgRes.ok) {
          console.warn(`  [fail] ${filename} — HTTP ${imgRes.status}`);
          failCount++;
          continue;
        }
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        writeFileSync(outPath, buffer);
        downloaded.add(filename);
        remaining.delete(filename);
        console.log(`  [ok]   ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
      } catch (err) {
        console.warn(`  [fail] ${filename} — ${err.message}`);
        failCount++;
      }
    }
  } catch (err) {
    console.warn(`  [error] ${err.message}`);
  }
}

console.log(
  `\nDone: ${downloaded.size} downloaded, ${alreadyHave.size} already existed, ${remaining.size} still missing, ${failCount} failed`,
);

if (remaining.size > 0) {
  console.log("\nMissing images:");
  for (const f of remaining) {
    console.log(`  - ${f}`);
  }
}
