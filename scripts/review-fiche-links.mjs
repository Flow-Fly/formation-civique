#!/usr/bin/env node

/**
 * LLM-assisted linking of question-bank entries to fiches.
 *
 * Usage: node scripts/review-fiche-links.mjs [--resume] [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const QUESTIONS_PATH = join(ROOT, "data-init", "question-bank.json");
const PROGRESS_PATH = join(ROOT, "data-init", "review-progress.json");
const TMP_PROMPT_PATH = join(ROOT, "data-init", ".gemini-prompt-tmp.txt");

const MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 5_000;
const DELAY_BETWEEN_CALLS_MS = 500;

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const DRY_RUN = args.includes("--dry-run");

function loadAllFiches() {
  const fichesDir = join(ROOT, "data-init", "fiches");
  const fiches = [];

  function walkDir(dir) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) walkDir(fullPath);
      else if (entry.endsWith(".json") && entry !== "index.json") {
        fiches.push(JSON.parse(readFileSync(fullPath, "utf-8")));
      }
    }
  }

  walkDir(fichesDir);
  return fiches;
}

function buildFicheCatalog(fiches) {
  return fiches.map((f) => `- ${f.id} | ${f.title}`).join("\n");
}

function buildPrompt(question, ficheCatalog) {
  const explanationText =
    question.explanationTemplate ||
    (question.explanationByCorrect ? Object.values(question.explanationByCorrect).find(Boolean) || "" : "");

  const explanationClean = explanationText
    .split("\n")
    .filter((line) => !line.startsWith("Pour en savoir plus, consultez la fiche"))
    .join("\n")
    .trim();

  const correctCandidates = question.answerPools?.correct || [];
  const distractors = (question.answerPools?.distractors || []).slice(0, 3);
  const fallbackChoices = [correctCandidates[0] || "", ...distractors]
    .filter(Boolean)
    .slice(0, 4);

  return `Tu es un expert en formation civique française. Tu dois associer une question de quiz à les fiches pédagogiques les plus pertinentes.

QUESTION (${question.id}):
${question.questionText}

CHOIX:
${fallbackChoices.map((c, i) => `${String.fromCharCode(97 + i)}) ${c}`).join("\n")}

BONNE RÉPONSE (candidate): ${correctCandidates[0] || "N/A"}

EXPLICATION:
${explanationClean}

CATALOGUE DES FICHES (ID | Titre):
${ficheCatalog}

CONSIGNE: Parmi ces fiches, lesquelles traitent directement du sujet de cette question et de sa réponse ? Une fiche est pertinente si elle couvre le thème de la question (pas simplement un mot en commun).

Renvoie UNIQUEMENT un tableau JSON des IDs pertinents, classés du plus au moins pertinent. Maximum 3 fiches. Si aucune n'est pertinente, renvoie [].

Exemple: ["id-fiche-1", "id-fiche-2"]

Ta réponse ne doit contenir QUE le tableau JSON, rien d'autre.`;
}

function sleep(ms) {
  execSync(`sleep ${ms / 1000}`);
}

function callGemini(prompt) {
  writeFileSync(TMP_PROMPT_PATH, prompt, "utf-8");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = execSync(
        `cat "${TMP_PROMPT_PATH}" | gemini -m ${MODEL} -o json "Lis les instructions dans stdin et réponds."`,
        {
          encoding: "utf-8",
          timeout: 90_000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      const parsed = JSON.parse(result);
      if (parsed.error) throw new Error(parsed.error.message || JSON.stringify(parsed.error));

      const response = parsed.response.trim();
      const match = response.match(/\[[\s\S]*?\]/);
      if (!match) return null;
      return JSON.parse(match[0]);
    } catch (err) {
      const message = String(err?.message || err);
      const is429 = message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("capacity");
      const isRetryable = is429 || message.includes("timeout") || message.includes("ECONNRESET");

      if (isRetryable && attempt < MAX_RETRIES) {
        const delayMs = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        console.warn(`  Attempt ${attempt} failed, retrying in ${delayMs / 1000}s...`);
        sleep(delayMs);
        continue;
      }

      console.error(`  Gemini error (attempt ${attempt}/${MAX_RETRIES}): ${message.slice(0, 200)}`);
      return null;
    }
  }

  return null;
}

function main() {
  const allFiches = loadAllFiches();
  const ficheMap = new Map(allFiches.map((f) => [f.id, f]));
  const allFicheIds = new Set(allFiches.map((f) => f.id));

  const ficheCatalog = buildFicheCatalog(allFiches);
  const questions = JSON.parse(readFileSync(QUESTIONS_PATH, "utf-8"));

  let progress = {};
  if (RESUME && existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8"));
  }

  if (DRY_RUN) {
    const prompt = buildPrompt(questions[0], ficheCatalog);
    console.log(prompt);
    return;
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (RESUME && progress[q.id]) continue;

    const result = callGemini(buildPrompt(q, ficheCatalog));

    if (!result) {
      progress[q.id] = { result: (q.relatedFicheIds || []).slice(0, 3), fallback: true };
    } else {
      const validatedIds = result.filter((id) => allFicheIds.has(id));
      progress[q.id] = {
        result: validatedIds.length > 0 ? validatedIds : (q.relatedFicheIds || []).slice(0, 1),
        fallback: validatedIds.length === 0,
      };
    }

    writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2) + "\n", "utf-8");
    if (i < questions.length - 1) sleep(DELAY_BETWEEN_CALLS_MS);
  }

  for (const q of questions) {
    const entry = progress[q.id];
    if (!entry) continue;

    q.relatedFicheIds = entry.result;

    const primaryFiche = ficheMap.get(entry.result[0]);
    if (primaryFiche) {
      const learnMore = `Pour en savoir plus, consultez la fiche : ${primaryFiche.title}`;
      const baseExplanation =
        q.explanationTemplate ||
        (q.explanationByCorrect ? Object.values(q.explanationByCorrect).find(Boolean) || "" : "");
      const lines = baseExplanation.split("\n");
      const filtered = lines.filter((line) => !line.startsWith("Pour en savoir plus, consultez la fiche"));
      q.explanationTemplate = filtered.join("\n").trimEnd() + "\n" + learnMore;
    }
  }

  writeFileSync(QUESTIONS_PATH, JSON.stringify(questions, null, 2) + "\n", "utf-8");
  try {
    writeFileSync(TMP_PROMPT_PATH, "", "utf-8");
  } catch {
    // noop
  }

  console.log(`Updated ${questions.length} entries in question-bank.`);
}

main();
