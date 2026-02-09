#!/usr/bin/env node

/**
 * Validate questions data:
 * - All 258 present
 * - 4 choices each
 * - Valid correctAnswer (a-d)
 * - Non-empty explanations
 * - Valid themeId
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const VALID_THEMES = [
  "principes-et-valeurs",
  "systeme-institutionnel",
  "droits-et-devoirs",
  "histoire-geographie-culture",
  "vivre-societe-francaise",
];

const questions = JSON.parse(
  readFileSync(join(ROOT, "data", "questions-review.json"), "utf-8")
);

let errors = 0;

function err(msg) {
  console.error(`  ERROR: ${msg}`);
  errors++;
}

console.log(`Validating ${questions.length} questions...\n`);

// Check count
if (questions.length !== 258) {
  err(`Expected 258 questions, found ${questions.length}`);
}

// Check each question
const ids = new Set();
for (const q of questions) {
  const prefix = `[${q.id}]`;

  // Unique ID
  if (ids.has(q.id)) err(`${prefix} Duplicate ID`);
  ids.add(q.id);

  // Theme
  if (!VALID_THEMES.includes(q.themeId)) {
    err(`${prefix} Invalid themeId: ${q.themeId}`);
  }

  // Question text
  if (!q.questionText || q.questionText.length < 5) {
    err(`${prefix} Missing or short questionText`);
  }

  // Choices
  if (!q.choices || q.choices.length !== 4) {
    err(`${prefix} Expected 4 choices, found ${q.choices?.length || 0}`);
  } else {
    const choiceIds = q.choices.map((c) => c.id);
    if (JSON.stringify(choiceIds) !== '["a","b","c","d"]') {
      err(`${prefix} Choice IDs should be a,b,c,d — got ${choiceIds.join(",")}`);
    }
    for (const c of q.choices) {
      if (!c.text || c.text.length < 2) {
        err(`${prefix} Empty choice text for ${c.id}`);
      }
    }
  }

  // Correct answer
  if (!["a", "b", "c", "d"].includes(q.correctAnswer)) {
    err(`${prefix} Invalid correctAnswer: ${q.correctAnswer}`);
  }

  // Explanation
  if (!q.explanation || q.explanation.length < 10) {
    err(`${prefix} Missing or short explanation`);
  }

  // Difficulty
  if (!["easy", "medium", "hard"].includes(q.difficulty)) {
    err(`${prefix} Invalid difficulty: ${q.difficulty}`);
  }
}

// Per-theme counts
const byTheme = {};
for (const q of questions) {
  byTheme[q.themeId] = (byTheme[q.themeId] || 0) + 1;
}
console.log("Per-theme counts:");
for (const [theme, count] of Object.entries(byTheme)) {
  console.log(`  ${theme}: ${count}`);
}

console.log(`\nDifficulty distribution:`);
const byDiff = {};
for (const q of questions) {
  byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
}
for (const [diff, count] of Object.entries(byDiff)) {
  console.log(`  ${diff}: ${count}`);
}

if (errors === 0) {
  console.log("\nAll validations passed!");
} else {
  console.error(`\n${errors} error(s) found.`);
  process.exit(1);
}
