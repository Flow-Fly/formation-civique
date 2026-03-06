#!/usr/bin/env node

/**
 * Link each question to 1-5 relevant fiches using keyword-based scoring,
 * and enrich explanations with a "learn more" reference to the primary fiche.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// --- Text normalization ---

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/['']/g, " ")           // typographic apostrophes
    .replace(/[^\w\s]/g, " ")        // remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// --- French stop words ---

const STOP_WORDS = new Set([
  // Articles & determiners
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d",
  "au", "aux", "ce", "cet", "cette", "ces", "mon", "ma", "mes",
  "ton", "ta", "tes", "son", "sa", "ses", "notre", "nos", "votre",
  "vos", "leur", "leurs",
  // Pronouns
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "me", "te", "se", "lui", "y", "en", "qui", "que", "qu", "quoi",
  "dont", "ou",
  // Prepositions & conjunctions
  "a", "dans", "par", "pour", "sur", "avec", "sans", "sous", "entre",
  "vers", "chez", "apres", "avant", "depuis", "pendant", "contre",
  "et", "mais", "ou", "donc", "car", "ni", "si",
  // Verbs (common forms)
  "est", "sont", "a", "ont", "fait", "peut", "doit", "etre", "avoir",
  "faire", "aller", "dire", "voir", "pouvoir", "vouloir",
  // Common adverbs & misc
  "ne", "pas", "plus", "moins", "tres", "bien", "aussi", "tout",
  "tous", "toute", "toutes", "meme", "autre", "autres",
  "c", "n", "s", "qu", "j", "m", "t",
  // Corpus noise — appear in nearly every fiche
  "france", "francais", "francaise", "francaises", "francais",
  "republique", "etat", "pays", "exemple", "notamment",
]);

// --- Keyword extraction ---

function extractKeywords(text) {
  const tokens = normalize(text).split(" ");
  return [...new Set(tokens.filter((t) => t.length > 2 && !STOP_WORDS.has(t)))];
}

function extractBigrams(text) {
  const tokens = normalize(text).split(" ").filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(tokens[i] + " " + tokens[i + 1]);
  }
  return [...new Set(bigrams)];
}

// --- Fiche indexing ---

function buildFicheIndex(fiche) {
  const titleKw = new Set(extractKeywords(fiche.title));
  const objectivesKw = new Set(extractKeywords((fiche.objectives || []).join(" ")));
  const headingKw = new Set();
  const contentKw = new Set();

  for (const section of fiche.sections || []) {
    for (const kw of extractKeywords(section.heading || "")) headingKw.add(kw);
    for (const kw of extractKeywords(section.content || "")) contentKw.add(kw);
  }

  // Full text for bigram matching
  const fullText = [
    fiche.title,
    (fiche.objectives || []).join(" "),
    ...(fiche.sections || []).map((s) => `${s.heading || ""} ${s.content || ""}`),
  ].join(" ");

  return {
    id: fiche.id,
    title: fiche.title,
    themeId: fiche.themeId,
    titleKw,
    objectivesKw,
    headingKw,
    contentKw,
    fullText: normalize(fullText),
  };
}

// --- Scoring ---

function scoreFiche(questionKeywords, questionBigrams, questionThemeId, ficheIdx) {
  let score = 0;

  for (const kw of questionKeywords) {
    if (ficheIdx.titleKw.has(kw)) score += 10;
    if (ficheIdx.objectivesKw.has(kw)) score += 6;
    if (ficheIdx.headingKw.has(kw)) score += 5;
    if (ficheIdx.contentKw.has(kw)) score += 2;
  }

  // Bigram bonus
  for (const bg of questionBigrams) {
    if (ficheIdx.fullText.includes(bg)) score += 8;
  }

  // Same theme bonus
  if (questionThemeId === ficheIdx.themeId) score += 5;

  return score;
}

// --- Load all fiches ---

function loadAllFiches() {
  const fichesDir = join(ROOT, "data-init", "fiches");
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

// --- Main ---

function main() {
  console.log("Loading fiches...");
  const fiches = loadAllFiches();
  console.log(`  ${fiches.length} fiches loaded`);

  console.log("Building fiche index...");
  const ficheIndexes = fiches.map(buildFicheIndex);

  console.log("Loading questions...");
  const questionsPath = join(ROOT, "data-init", "question-bank.json");
  const questions = JSON.parse(readFileSync(questionsPath, "utf-8"));
  console.log(`  ${questions.length} questions loaded`);

  let linked = 0;
  let enriched = 0;
  const scoreStats = { min: Infinity, max: 0, total: 0 };

  for (const q of questions) {
    // Build keywords from question text + primary correct candidate + explanation
    const primaryCorrect = (q.answerPools?.correct || [])[0] || "";
    const explanation =
      q.explanationTemplate ||
      (q.explanationByCorrect ? Object.values(q.explanationByCorrect)[0] || "" : "");
    const questionText = [
      q.questionText,
      primaryCorrect,
      explanation,
    ].join(" ");

    const keywords = extractKeywords(questionText);
    const bigrams = extractBigrams(questionText);

    // Score all fiches
    const scored = ficheIndexes.map((idx) => ({
      id: idx.id,
      title: idx.title,
      score: scoreFiche(keywords, bigrams, q.themeId, idx),
    }));

    // Sort descending by score, then by id for determinism
    scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    // Take top matches: score >= 15, capped at 5, at least 1 if any > 0
    const MIN_SCORE = 15;
    const MAX_FICHES = 5;

    let matches = scored.filter((s) => s.score >= MIN_SCORE).slice(0, MAX_FICHES);
    if (matches.length === 0 && scored[0].score > 0) {
      matches = [scored[0]];
    }

    q.relatedFicheIds = matches.map((m) => m.id);

    if (matches.length > 0) {
      linked++;
      const topScore = matches[0].score;
      scoreStats.min = Math.min(scoreStats.min, topScore);
      scoreStats.max = Math.max(scoreStats.max, topScore);
      scoreStats.total += topScore;

      // Enrich explanation template with primary fiche reference
      const primaryTitle = matches[0].title;
      const learnMore = `Pour en savoir plus, consultez la fiche : ${primaryTitle}`;
      if (
        !q.explanationTemplate ||
        !q.explanationTemplate.includes("Pour en savoir plus, consultez la fiche")
      ) {
        const base = q.explanationTemplate || "La bonne réponse est : {{correct}}.";
        q.explanationTemplate = base.trimEnd() + "\n" + learnMore;
        enriched++;
      }
    }
  }

  // Write updated questions
  writeFileSync(questionsPath, JSON.stringify(questions, null, 2) + "\n", "utf-8");

  // Report
  console.log("\n--- Results ---");
  console.log(`Linked: ${linked}/${questions.length} questions`);
  console.log(`Enriched: ${enriched}/${questions.length} explanations`);
  console.log(`Top-fiche score: min=${scoreStats.min}, max=${scoreStats.max}, avg=${(scoreStats.total / linked).toFixed(1)}`);

  // Distribution of match counts
  const dist = {};
  for (const q of questions) {
    const n = q.relatedFicheIds.length;
    dist[n] = (dist[n] || 0) + 1;
  }
  console.log("Match count distribution:", dist);

  // Spot-check
  console.log("\n--- Spot checks ---");
  const checks = [
    { id: "q001", expect: "hymne" },
    { id: "q007", expect: "marianne" },
  ];
  for (const { id, expect } of checks) {
    const q = questions.find((qq) => qq.id === id);
    if (q) {
      console.log(`  ${id}: [${q.relatedFicheIds.length} fiches] ${q.relatedFicheIds[0] || "NONE"} (expected to contain "${expect}")`);
    }
  }
}

main();
