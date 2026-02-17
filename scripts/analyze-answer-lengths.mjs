import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, '..', 'data-init', 'questions-review.json');
const questions = JSON.parse(readFileSync(dataPath, 'utf-8'));

const RATIO_THRESHOLD = 1.5;

const analysis = questions.map((q) => {
  const correctChoice = q.choices.find((c) => c.id === q.correctAnswer);
  const distractors = q.choices.filter((c) => c.id !== q.correctAnswer);

  const correctLen = correctChoice.text.length;
  const distractorLens = distractors.map((d) => d.text.length);
  const avgDistractorLen =
    distractorLens.reduce((a, b) => a + b, 0) / distractorLens.length;
  const ratio = avgDistractorLen > 0 ? correctLen / avgDistractorLen : Infinity;

  return {
    id: q.id,
    questionText: q.questionText,
    correctLen,
    avgDistractorLen: Math.round(avgDistractorLen),
    ratio: Math.round(ratio * 100) / 100,
    correctText: correctChoice.text,
    distractors: distractors.map((d) => ({ id: d.id, text: d.text, len: d.text.length })),
  };
});

// Sort by ratio descending (worst first)
const imbalanced = analysis
  .filter((a) => a.ratio >= RATIO_THRESHOLD)
  .sort((a, b) => b.ratio - a.ratio);

console.log(`\n=== Answer Length Analysis ===`);
console.log(`Total questions: ${questions.length}`);
console.log(`Imbalanced (ratio >= ${RATIO_THRESHOLD}): ${imbalanced.length}`);
console.log(`Balanced (ratio < ${RATIO_THRESHOLD}): ${questions.length - imbalanced.length}\n`);

// Summary stats
const allCorrectLens = analysis.map((a) => a.correctLen);
const allDistractorLens = analysis.map((a) => a.avgDistractorLen);
const avgCorrect = Math.round(allCorrectLens.reduce((a, b) => a + b, 0) / allCorrectLens.length);
const avgDistractor = Math.round(allDistractorLens.reduce((a, b) => a + b, 0) / allDistractorLens.length);
console.log(`Avg correct answer length: ${avgCorrect} chars`);
console.log(`Avg distractor length: ${avgDistractor} chars`);
console.log(`Overall ratio: ${(avgCorrect / avgDistractor).toFixed(2)}x\n`);

// Detail listing
console.log(`--- Imbalanced Questions (sorted worst-first) ---\n`);
for (const q of imbalanced) {
  console.log(`${q.id} | ratio: ${q.ratio}x | correct: ${q.correctLen} chars | avg distractor: ${q.avgDistractorLen} chars`);
  console.log(`  Q: ${q.questionText}`);
  console.log(`  Correct (${q.correctText.length}): ${q.correctText}`);
  for (const d of q.distractors) {
    console.log(`  ${d.id} (${d.len}): ${d.text}`);
  }
  console.log();
}
