#!/usr/bin/env node

/**
 * Bundle all data for the web app:
 * - Merge all fiches into app/data/fiches.json
 * - Copy questions to app/data/questions.json (strip review fields)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APP_DATA = join(ROOT, "app", "data");

mkdirSync(APP_DATA, { recursive: true });

// --- Bundle fiches ---
const fichesDir = join(ROOT, "data", "fiches");
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
writeFileSync(join(APP_DATA, "fiches.json"), JSON.stringify(fichesBundle), "utf-8");
console.log(`Bundled ${allFiches.length} fiches → app/data/fiches.json`);

// --- Bundle questions ---
const questions = JSON.parse(
  readFileSync(join(ROOT, "data", "questions-review.json"), "utf-8")
);

// Strip review-only fields
const cleanQuestions = questions.map((q) => ({
  id: q.id,
  themeId: q.themeId,
  themeName: q.themeName,
  questionText: q.questionText,
  choices: q.choices,
  correctAnswer: q.correctAnswer,
  explanation: q.explanation,
  relatedFicheIds: q.relatedFicheIds,
  difficulty: q.difficulty,
}));

writeFileSync(join(APP_DATA, "questions.json"), JSON.stringify(cleanQuestions), "utf-8");
console.log(`Bundled ${cleanQuestions.length} questions → app/data/questions.json`);

// Size report
const fichesSize = (statSync(join(APP_DATA, "fiches.json")).size / 1024).toFixed(0);
const questionsSize = (statSync(join(APP_DATA, "questions.json")).size / 1024).toFixed(0);
console.log(`\nSizes: fiches.json=${fichesSize}KB, questions.json=${questionsSize}KB`);
