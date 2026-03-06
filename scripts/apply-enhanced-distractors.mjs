import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bankPath = resolve(__dirname, "..", "data-init", "question-bank.json");
const enhancementsPath = resolve(__dirname, "enhanced-distractors.json");

const bank = JSON.parse(readFileSync(bankPath, "utf-8"));
const enhancements = JSON.parse(readFileSync(enhancementsPath, "utf-8"));

let updated = 0;
let distractorsUpdated = 0;

for (const [qId, distractorMap] of Object.entries(enhancements)) {
  const question = bank.find((q) => q.id === qId);
  if (!question) {
    console.warn(`Question ${qId} not found, skipping`);
    continue;
  }

  question.answerPools = question.answerPools || { correct: [], distractors: [] };
  const current = [...(question.answerPools.distractors || [])];
  const ordered = Object.entries(distractorMap).sort(([a], [b]) => a.localeCompare(b));

  ordered.forEach(([, newText], idx) => {
    current[idx] = newText;
    distractorsUpdated += 1;
  });

  question.answerPools.distractors = current;
  updated += 1;
}

writeFileSync(bankPath, JSON.stringify(bank, null, 2) + "\n", "utf-8");
console.log(`Updated ${distractorsUpdated} distractors across ${updated} questions`);
console.log(`Written to ${bankPath}`);
