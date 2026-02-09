#!/usr/bin/env node

/**
 * Merge parsed questions with answer data and output questions-review.json
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { answers as t1 } from "./answers/theme1-principes-valeurs.mjs";
import { answers as t2 } from "./answers/theme2-systeme-institutionnel.mjs";
import { answers as t3 } from "./answers/theme3-droits-devoirs.mjs";
import { answers as t4 } from "./answers/theme4-histoire-geo.mjs";
import { answers as t5 } from "./answers/theme5-vivre-societe.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const allAnswers = [...t1, ...t2, ...t3, ...t4, ...t5];
const answerMap = new Map(allAnswers.map((a) => [a.id, a]));

const questions = JSON.parse(
  readFileSync(join(ROOT, "data", "questions-review.json"), "utf-8")
);

let merged = 0;
let missing = 0;

for (const q of questions) {
  const answer = answerMap.get(q.id);
  if (answer) {
    q.choices = answer.choices;
    q.correctAnswer = answer.correctAnswer;
    q.explanation = answer.explanation;
    q.difficulty = answer.difficulty;
    q.reviewStatus = "reviewed";
    merged++;
  } else {
    console.warn(`Missing answer for ${q.id}: ${q.questionText}`);
    missing++;
  }
}

writeFileSync(
  join(ROOT, "data", "questions-review.json"),
  JSON.stringify(questions, null, 2),
  "utf-8"
);

console.log(`Merged ${merged} answers, ${missing} missing`);
console.log(`Total answers provided: ${allAnswers.length}`);
console.log("Written to data/questions-review.json");
