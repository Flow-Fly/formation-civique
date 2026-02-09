#!/usr/bin/env node

/**
 * LLM-based linking of questions to fiches.
 *
 * Instead of reviewing keyword-based candidates, sends each question + ALL 226
 * fiche titles to Gemini Flash and lets the LLM pick the genuinely relevant ones.
 * This avoids false negatives from keyword matching entirely.
 *
 * Writes results back to questions-review.json and updates "Pour en savoir plus".
 *
 * Usage: node scripts/review-fiche-links.mjs [--resume] [--dry-run]
 *   --resume   Skip already-reviewed questions (from data/review-progress.json)
 *   --dry-run  Print first prompt without calling Gemini
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const QUESTIONS_PATH = join(ROOT, "data", "questions-review.json");
const PROGRESS_PATH = join(ROOT, "data", "review-progress.json");
const TMP_PROMPT_PATH = join(ROOT, "data", ".gemini-prompt-tmp.txt");

const MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 5_000; // 5s, 10s, 20s exponential backoff
const DELAY_BETWEEN_CALLS_MS = 500; // gentle pacing

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const DRY_RUN = args.includes("--dry-run");

// --- Load all fiches ---

function loadAllFiches() {
  const fichesDir = join(ROOT, "data", "fiches");
  const fiches = [];

  function walkDir(dir) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.endsWith(".json") && entry !== "index.json") {
        fiches.push(JSON.parse(readFileSync(fullPath, "utf-8")));
      }
    }
  }

  walkDir(fichesDir);
  return fiches;
}

// --- Build the fiche catalog (all titles, sent once per prompt) ---

function buildFicheCatalog(fiches) {
  return fiches
    .map((f) => `- ${f.id} | ${f.title}`)
    .join("\n");
}

// --- Build prompt for a single question ---

function buildPrompt(question, ficheCatalog) {
  // Strip existing "Pour en savoir plus" line from explanation
  const explanationClean = question.explanation
    .split("\n")
    .filter((line) => !line.startsWith("Pour en savoir plus, consultez la fiche"))
    .join("\n")
    .trim();

  const correctChoice = question.choices.find((c) => c.id === question.correctAnswer);

  return `Tu es un expert en formation civique française. Tu dois associer une question de quiz à les fiches pédagogiques les plus pertinentes.

QUESTION (${question.id}):
${question.questionText}

CHOIX:
${question.choices.map((c) => `${c.id}) ${c.text}`).join("\n")}

BONNE RÉPONSE: ${correctChoice?.id}) ${correctChoice?.text}

EXPLICATION:
${explanationClean}

CATALOGUE DES FICHES (ID | Titre):
${ficheCatalog}

CONSIGNE: Parmi ces fiches, lesquelles traitent directement du sujet de cette question et de sa réponse ? Une fiche est pertinente si elle couvre le thème de la question (pas simplement un mot en commun).

Renvoie UNIQUEMENT un tableau JSON des IDs pertinents, classés du plus au moins pertinent. Maximum 3 fiches. Si aucune n'est pertinente, renvoie [].

Exemple: ["id-fiche-1", "id-fiche-2"]

Ta réponse ne doit contenir QUE le tableau JSON, rien d'autre.`;
}

// --- Call Gemini with retries ---

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
        }
      );

      // Parse the JSON wrapper
      const parsed = JSON.parse(result);

      // Check for error in response
      if (parsed.error) {
        throw new Error(parsed.error.message || JSON.stringify(parsed.error));
      }

      const response = parsed.response.trim();

      // Extract JSON array from response (handle possible markdown wrapping)
      const match = response.match(/\[[\s\S]*?\]/);
      if (!match) {
        console.warn(`  Warning: No JSON array in response: ${response.slice(0, 200)}`);
        return null;
      }

      return JSON.parse(match[0]);
    } catch (err) {
      const is429 = err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("capacity");
      const isRetryable = is429 || err.message.includes("timeout") || err.message.includes("ECONNRESET");

      if (isRetryable && attempt < MAX_RETRIES) {
        const delayMs = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        console.warn(`  Attempt ${attempt} failed (${is429 ? "rate limit" : "transient"}), retrying in ${delayMs / 1000}s...`);
        sleep(delayMs);
        continue;
      }

      console.error(`  Error calling Gemini (attempt ${attempt}/${MAX_RETRIES}): ${err.message.slice(0, 200)}`);
      return null;
    }
  }

  return null;
}

// --- Main ---

function main() {
  console.log("Loading fiches...");
  const allFiches = loadAllFiches();
  const ficheMap = new Map(allFiches.map((f) => [f.id, f]));
  const allFicheIds = new Set(allFiches.map((f) => f.id));
  console.log(`  ${allFiches.length} fiches loaded`);

  const ficheCatalog = buildFicheCatalog(allFiches);
  console.log(`  Fiche catalog: ${ficheCatalog.length} chars`);

  console.log("Loading questions...");
  const questions = JSON.parse(readFileSync(QUESTIONS_PATH, "utf-8"));
  console.log(`  ${questions.length} questions loaded`);

  // Load progress if resuming
  let progress = {};
  if (RESUME && existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8"));
    console.log(`  Resuming: ${Object.keys(progress).length} already reviewed`);
  }

  if (DRY_RUN) {
    const q = questions[0];
    const prompt = buildPrompt(q, ficheCatalog);
    console.log(`\n=== Sample prompt for ${q.id} ===`);
    console.log(prompt);
    console.log(`\n--- Prompt length: ${prompt.length} chars ---`);
    console.log(`\nDry run complete. Would review ${questions.length} questions.`);
    return;
  }

  let reviewed = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // Skip if already reviewed
    if (RESUME && progress[q.id]) {
      skipped++;
      continue;
    }

    const prompt = buildPrompt(q, ficheCatalog);

    // Call Gemini
    const result = callGemini(prompt);

    if (result === null) {
      console.error(`  ${q.id}: Gemini call failed, keeping original links`);
      progress[q.id] = { result: q.relatedFicheIds.slice(0, 3), fallback: true };
      errors++;
    } else {
      // Validate that returned IDs actually exist in our fiche catalog
      const validatedIds = result.filter((id) => allFicheIds.has(id));

      if (validatedIds.length === 0) {
        // Fallback: keep top-1 from existing keyword match
        console.warn(`  ${q.id}: LLM returned no valid IDs, keeping top-1 keyword match`);
        progress[q.id] = { result: [q.relatedFicheIds[0]], fallback: true };
      } else {
        progress[q.id] = { result: validatedIds, fallback: false };
      }
    }

    reviewed++;

    // Progress logging every 10 questions
    if (reviewed % 10 === 0 || i === questions.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const remaining = questions.length - skipped - reviewed;
      console.log(`  [${elapsed}s] ${reviewed + skipped}/${questions.length} (${reviewed} reviewed, ${skipped} resumed, ${errors} errors, ${remaining} remaining)`);
    }

    // Save progress after each question
    writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2) + "\n", "utf-8");

    // Gentle pacing between calls
    if (i < questions.length - 1) {
      sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  // --- Apply results to questions ---
  console.log("\nApplying LLM-reviewed links...");

  let updated = 0;
  for (const q of questions) {
    const entry = progress[q.id];
    if (!entry) continue;

    const newIds = entry.result;
    q.relatedFicheIds = newIds;

    // Update "Pour en savoir plus" line
    const primaryFiche = ficheMap.get(newIds[0]);
    if (primaryFiche) {
      const learnMore = `Pour en savoir plus, consultez la fiche : ${primaryFiche.title}`;

      // Remove old "Pour en savoir plus" line and add new one
      const lines = q.explanation.split("\n");
      const filtered = lines.filter(
        (line) => !line.startsWith("Pour en savoir plus, consultez la fiche")
      );
      q.explanation = filtered.join("\n").trimEnd() + "\n" + learnMore;
    }

    updated++;
  }

  // Write updated questions
  writeFileSync(QUESTIONS_PATH, JSON.stringify(questions, null, 2) + "\n", "utf-8");
  console.log(`  Updated ${updated}/${questions.length} questions`);

  // Cleanup temp file
  try { writeFileSync(TMP_PROMPT_PATH, "", "utf-8"); } catch {}

  // Report
  console.log("\n--- Summary ---");
  console.log(`Reviewed: ${reviewed}`);
  console.log(`Resumed: ${skipped}`);
  console.log(`Errors/fallbacks: ${errors}`);

  const zeroCount = questions.filter((q) => q.relatedFicheIds.length === 0).length;
  if (zeroCount > 0) {
    console.warn(`WARNING: ${zeroCount} questions have 0 relatedFicheIds!`);
  } else {
    console.log("All questions have at least 1 related fiche.");
  }

  // Spot checks
  console.log("\n--- Spot checks ---");
  const checks = [
    { id: "q001", expect: "hymne", notExpect: "enfants" },
    { id: "q003", expect: "impot", notExpect: "laicite" },
  ];
  for (const { id, expect, notExpect } of checks) {
    const q = questions.find((qq) => qq.id === id);
    if (q) {
      const ids = q.relatedFicheIds.join(", ");
      const hasExpected = q.relatedFicheIds.some((fid) => fid.includes(expect));
      const hasUnexpected = q.relatedFicheIds.some((fid) => fid.includes(notExpect));
      console.log(`  ${id}: [${q.relatedFicheIds.length}] ${ids}`);
      console.log(`    ${hasExpected ? "OK" : "MISS"}: contains "${expect}" | ${hasUnexpected ? "BAD: still has" : "OK: no"} "${notExpect}"`);
    }
  }

  // Fiche coverage stats
  const linkedFiches = new Set(questions.flatMap((q) => q.relatedFicheIds));
  const unlinkedFiches = allFiches.filter((f) => !linkedFiches.has(f.id));
  console.log(`\n--- Fiche coverage ---`);
  console.log(`  Linked: ${linkedFiches.size}/${allFiches.length} fiches`);
  if (unlinkedFiches.length > 0 && unlinkedFiches.length <= 20) {
    console.log(`  Unlinked fiches:`);
    for (const f of unlinkedFiches) {
      console.log(`    - ${f.id} (${f.title})`);
    }
  } else if (unlinkedFiches.length > 20) {
    console.log(`  ${unlinkedFiches.length} fiches have no questions linked to them`);
  }
}

main();
