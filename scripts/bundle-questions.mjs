#!/usr/bin/env node

/**
 * Bundle questions from data-init/questions-review.json to:
 * - data/questions.json
 * - app-react/public/data/questions.json
 * Strips review-only fields.
 */

import { readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const questions = JSON.parse(
  readFileSync(join(ROOT, 'data-init', 'questions-review.json'), 'utf-8')
);

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

const output = JSON.stringify(cleanQuestions);

const targets = [
  join(ROOT, 'data', 'questions.json'),
  join(ROOT, 'app-react', 'public', 'data', 'questions.json'),
];

for (const target of targets) {
  writeFileSync(target, output, 'utf-8');
  const size = (statSync(target).size / 1024).toFixed(0);
  console.log(`Written ${target} (${size}KB)`);
}

console.log(`\nBundled ${cleanQuestions.length} questions`);
