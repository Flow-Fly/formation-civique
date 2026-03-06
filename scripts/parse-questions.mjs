#!/usr/bin/env node

/**
 * Parse multi-exam markdown question sources into a normalized intermediate file.
 *
 * Inputs:
 *   - data-init/questions/cr.md
 *   - data-init/questions/csp.md
 *   - data-init/questions/naturalisation.md
 *
 * Output:
 *   - data-init/questions-parsed.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SOURCE_DIR = join(ROOT, "data-init", "questions");
const OUTPUT_PATH = join(ROOT, "data-init", "questions-parsed.json");

const EXAM_SOURCES = [
  { exam: "CR", file: "cr.md" },
  { exam: "CSP", file: "csp.md" },
  { exam: "NAT", file: "naturalisation.md" },
];

const THEMES = [
  {
    id: "principes-et-valeurs",
    name: "Principes et valeurs de la République",
    aliases: ["principes et valeurs de la republique"],
  },
  {
    id: "systeme-institutionnel",
    name: "Système institutionnel et politique",
    aliases: ["systeme institutionnel et politique"],
  },
  {
    id: "droits-et-devoirs",
    name: "Droits et devoirs",
    aliases: ["droits et devoirs"],
  },
  {
    id: "histoire-geographie-culture",
    name: "Histoire, géographie et culture",
    aliases: ["histoire geographie et culture"],
  },
  {
    id: "vivre-societe-francaise",
    name: "Vivre dans la société française",
    aliases: ["vivre dans la societe francaise", "vivre dans la société française"],
  },
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveTheme(headerLine) {
  const h = normalize(headerLine);
  for (const t of THEMES) {
    for (const alias of t.aliases) {
      if (h.includes(alias)) return t;
    }
  }
  return null;
}

function parseExamFile({ exam, file }) {
  const path = join(SOURCE_DIR, file);
  if (!existsSync(path)) {
    throw new Error(`Missing source file for ${exam}: ${path}`);
  }

  const lines = readFileSync(path, "utf-8").split("\n");
  const parsed = [];

  let currentTheme = null;
  let globalNumber = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      currentTheme = resolveTheme(line.slice(3));
      continue;
    }

    const match = line.match(/^(\d+)\.\s+(.+)$/);
    if (!match || !currentTheme) continue;

    globalNumber += 1;
    parsed.push({
      exam,
      localNumber: parseInt(match[1], 10),
      globalNumber,
      themeId: currentTheme.id,
      themeName: currentTheme.name,
      questionText: match[2].trim(),
    });
  }

  return parsed;
}

function main() {
  const allSources = [];

  for (const source of EXAM_SOURCES) {
    const parsed = parseExamFile(source);
    allSources.push(...parsed);
    console.log(`${source.exam}: parsed ${parsed.length} questions`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    total: allSources.length,
    byExam: EXAM_SOURCES.reduce((acc, s) => {
      acc[s.exam] = allSources.filter((q) => q.exam === s.exam).length;
      return acc;
    }, {}),
    questions: allSources,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  console.log(`\nWritten ${OUTPUT_PATH}`);
}

main();
