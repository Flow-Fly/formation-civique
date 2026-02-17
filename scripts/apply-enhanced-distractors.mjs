import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const questionsPath = resolve(__dirname, '..', 'data-init', 'questions-review.json');
const enhancementsPath = resolve(__dirname, 'enhanced-distractors.json');

const questions = JSON.parse(readFileSync(questionsPath, 'utf-8'));
const enhancements = JSON.parse(readFileSync(enhancementsPath, 'utf-8'));

let updated = 0;
let choicesUpdated = 0;

for (const [qId, distractors] of Object.entries(enhancements)) {
  const question = questions.find((q) => q.id === qId);
  if (!question) {
    console.warn(`Question ${qId} not found, skipping`);
    continue;
  }

  for (const [choiceId, newText] of Object.entries(distractors)) {
    const choice = question.choices.find((c) => c.id === choiceId);
    if (!choice) {
      console.warn(`Choice ${choiceId} not found in ${qId}, skipping`);
      continue;
    }
    if (choice.id === question.correctAnswer) {
      console.error(`ERROR: Attempting to modify correct answer ${choiceId} in ${qId}!`);
      process.exit(1);
    }
    choice.text = newText;
    choicesUpdated++;
  }
  updated++;
}

writeFileSync(questionsPath, JSON.stringify(questions, null, 2) + '\n', 'utf-8');
console.log(`Updated ${choicesUpdated} distractors across ${updated} questions`);
console.log(`Written to ${questionsPath}`);
