#!/usr/bin/env node

/**
 * Merge legacy answer modules into data-init/question-bank.json.
 *
 * This script is useful when answer choices are maintained in scripts/answers/*.mjs
 * and should hydrate the canonical bank pools.
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
const BANK_PATH = join(ROOT, "data-init", "question-bank.json");

const allAnswers = [...t1, ...t2, ...t3, ...t4, ...t5];
const answerMap = new Map(allAnswers.map((a) => [a.id, a]));

function dedupe(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const txt = String(value || "").trim();
    if (!txt) continue;
    const key = txt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(txt);
  }
  return out;
}

const bank = JSON.parse(readFileSync(BANK_PATH, "utf-8"));

let merged = 0;
for (const q of bank) {
  const answer = answerMap.get(q.id);
  if (!answer) continue;

  const correctChoice = answer.choices.find((c) => c.id === answer.correctAnswer);
  const distractors = answer.choices.filter((c) => c.id !== answer.correctAnswer).map((c) => c.text);

  q.answerPools = q.answerPools || { correct: [], distractors: [] };
  q.answerPools.correct = dedupe([...(q.answerPools.correct || []), correctChoice?.text || ""]);
  q.answerPools.distractors = dedupe([...(q.answerPools.distractors || []), ...distractors]);

  q.explanationByCorrect = q.explanationByCorrect || {};
  if (correctChoice?.text) {
    q.explanationByCorrect[correctChoice.text] = answer.explanation;
  }
  if (!q.explanationTemplate) q.explanationTemplate = answer.explanation;

  q.difficultyByExam = q.difficultyByExam || {};
  for (const exam of q.exams || []) {
    if (!q.difficultyByExam[exam]) q.difficultyByExam[exam] = answer.difficulty || "medium";
  }

  if ((q.exams || []).includes("CR")) {
    q.reviewStatus = "reviewed";
  }

  merged += 1;
}

writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2) + "\n", "utf-8");

console.log(`Merged answers into ${merged} question-bank entries`);
console.log(`Written ${BANK_PATH}`);
