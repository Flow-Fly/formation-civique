#!/usr/bin/env node

/**
 * Parse liste-questions.md into structured JSON.
 *
 * Handles the irregular numbering:
 *   - Theme 1: questions 1-38 (numbered 1-38)
 *   - Theme 2: questions 39-94 (numbered 1-56)
 *   - Theme 3: questions 95-131 (numbered 95-131, note: only 56 in theme 2 so 38+56=94, theme 3 starts at 95)
 *   - Theme 4: questions 132-214 (numbered 1-83)
 *   - Theme 5: questions 215-258 (numbered 215-258)
 *
 * Output: data/questions-review.json
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const THEMES = [
  {
    id: "principes-et-valeurs",
    name: "Principes et valeurs de la République",
    header: "1. Principes et Valeurs de la République",
  },
  {
    id: "systeme-institutionnel",
    name: "Système institutionnel et politique",
    header: "2. Système Institutionnel et Politique",
  },
  {
    id: "droits-et-devoirs",
    name: "Droits et devoirs",
    header: "3. Droits et Devoirs",
  },
  {
    id: "histoire-geographie-culture",
    name: "Histoire, géographie et culture",
    header: "4. Histoire, Géographie et Culture",
  },
  {
    id: "vivre-societe-francaise",
    name: "Vivre dans la société française",
    header: "5. Vivre dans la Société Française",
  },
];

function parseQuestions() {
  const md = readFileSync(join(ROOT, "liste-questions.md"), "utf-8");
  const lines = md.split("\n");

  const questions = [];
  let currentTheme = null;
  let globalIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect theme headers
    if (trimmed.startsWith("## ")) {
      const themeMatch = THEMES.find((t) => trimmed.includes(t.header.split(". ")[1]));
      if (themeMatch) {
        currentTheme = themeMatch;
        continue;
      }
    }

    // Skip subheaders
    if (trimmed.startsWith("### ")) continue;
    if (trimmed === "") continue;

    // Detect question lines (start with a number followed by period)
    const qMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (qMatch && currentTheme) {
      globalIndex++;
      const localNum = parseInt(qMatch[1], 10);
      const questionText = qMatch[2].trim();

      const qId = `q${String(globalIndex).padStart(3, "0")}`;

      questions.push({
        id: qId,
        localNumber: localNum,
        globalNumber: globalIndex,
        themeId: currentTheme.id,
        themeName: currentTheme.name,
        questionText,
        choices: [],
        correctAnswer: "",
        explanation: "",
        relatedFicheIds: [],
        difficulty: "medium",
        reviewStatus: "pending",
      });
    }
  }

  return questions;
}

const questions = parseQuestions();
console.log(`Parsed ${questions.length} questions`);

// Show per-theme breakdown
const byTheme = {};
for (const q of questions) {
  byTheme[q.themeId] = (byTheme[q.themeId] || 0) + 1;
}
for (const [theme, count] of Object.entries(byTheme)) {
  console.log(`  ${theme}: ${count}`);
}

writeFileSync(
  join(ROOT, "data", "questions-review.json"),
  JSON.stringify(questions, null, 2),
  "utf-8"
);
console.log("\nWritten to data/questions-review.json");
