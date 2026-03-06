import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, "..", "data-init", "question-bank.json");
const questions = JSON.parse(readFileSync(dataPath, "utf-8"));

const RATIO_THRESHOLD = 1.5;

const analysis = questions.map((q) => {
  const correct = (q.answerPools?.correct || [])[0] || "";
  const distractors = q.answerPools?.distractors || [];

  const correctLen = correct.length;
  const distractorLens = distractors.map((d) => d.length);
  const avgDistractorLen =
    distractorLens.length > 0
      ? distractorLens.reduce((a, b) => a + b, 0) / distractorLens.length
      : 0;
  const ratio = avgDistractorLen > 0 ? correctLen / avgDistractorLen : Infinity;

  return {
    id: q.id,
    questionText: q.questionText,
    correctLen,
    avgDistractorLen: Math.round(avgDistractorLen),
    ratio: Math.round(ratio * 100) / 100,
    correct,
    distractors,
  };
});

const imbalanced = analysis
  .filter((a) => a.ratio >= RATIO_THRESHOLD)
  .sort((a, b) => b.ratio - a.ratio);

console.log(`\n=== Answer Length Analysis ===`);
console.log(`Total questions: ${questions.length}`);
console.log(`Imbalanced (ratio >= ${RATIO_THRESHOLD}): ${imbalanced.length}`);
console.log(`Balanced (ratio < ${RATIO_THRESHOLD}): ${questions.length - imbalanced.length}\n`);

const allCorrectLens = analysis.map((a) => a.correctLen);
const allDistractorLens = analysis.map((a) => a.avgDistractorLen);
const avgCorrect = Math.round(allCorrectLens.reduce((a, b) => a + b, 0) / allCorrectLens.length);
const avgDistractor = Math.round(allDistractorLens.reduce((a, b) => a + b, 0) / allDistractorLens.length);
console.log(`Avg correct answer length: ${avgCorrect} chars`);
console.log(`Avg distractor length: ${avgDistractor} chars`);
console.log(`Overall ratio: ${(avgCorrect / avgDistractor).toFixed(2)}x\n`);

console.log(`--- Imbalanced Questions (sorted worst-first) ---\n`);
for (const q of imbalanced) {
  console.log(`${q.id} | ratio: ${q.ratio}x | correct: ${q.correctLen} chars | avg distractor: ${q.avgDistractorLen} chars`);
  console.log(`  Q: ${q.questionText}`);
  console.log(`  Correct (${q.correct.length}): ${q.correct}`);
  q.distractors.forEach((d, idx) => {
    console.log(`  d${idx + 1} (${d.length}): ${d}`);
  });
  console.log();
}
