#!/usr/bin/env node

/**
 * Validate generated answer-pool suggestions with strict evidence checks.
 *
 * Default input:
 * - data-init/suggestions/answer-pools.pending.json
 *
 * Outputs:
 * - data-init/suggestions/answer-pools.pending.validated.json
 * - data-init/suggestions/answer-pools.pending.validated.md
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DEFAULT_INPUT = join(ROOT, "data-init", "suggestions", "answer-pools.pending.json");
const SECTION_INDEX_PATH = join(ROOT, "data-init", "fiches-section-index.json");

const VALID_QUALITY_FLAGS = new Set([
  "missing_correct_evidence",
  "weak_distractors",
  "placeholder_answer",
  "manual_review_required",
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fuzzy quote matching: checks if a quote is grounded in section text.
 * 1. Exact normalized substring match → score 1.0
 * 2. Word-overlap ratio (quote words found in section) → score 0..1
 *
 * @param {string} quote - The LLM-provided quote
 * @param {string} sectionText - The full section text to match against
 * @param {number} threshold - Minimum word overlap ratio to accept (default 0.6)
 * @returns {{ matched: boolean, score: number, exactMatch: boolean }}
 */
function fuzzyQuoteMatch(quote, sectionText, threshold = 0.6) {
  const quoteNorm = normalize(quote);
  const sectionNorm = normalize(sectionText || "");

  // 1. Exact normalized substring match
  if (sectionNorm.includes(quoteNorm)) {
    return { matched: true, score: 1.0, exactMatch: true };
  }

  // 2. Word-overlap: what fraction of quote words appear in the section?
  const quoteWords = quoteNorm.split(/\s+/).filter(Boolean);
  if (quoteWords.length < 3) {
    return { matched: false, score: 0, exactMatch: false };
  }

  const sectionWords = new Set(sectionNorm.split(/\s+/).filter(Boolean));
  const matchCount = quoteWords.filter((w) => sectionWords.has(w)).length;
  const score = matchCount / quoteWords.length;

  return { matched: score >= threshold, score, exactMatch: false };
}

function dedupe(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const txt = String(value || "").trim();
    if (!txt) continue;
    const key = normalize(txt);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(txt);
  }
  return out;
}

function countTokens(text) {
  return normalize(text).split(" ").filter(Boolean).length;
}

function hasWeakDistractorPattern(text) {
  const n = normalize(text);
  return (
    n.includes("proposition incorrecte") ||
    n.includes("distracteur") ||
    n.includes("reponse a completer") ||
    n.includes("aucune de ces reponses")
  );
}

function hasNationalityMarker(text) {
  const n = normalize(text);
  const markers = [
    "francais", "francaise", "italien", "italienne", "americain", "americaine",
    "marocain", "marocaine", "espagnol", "espagnole", "allemand", "allemande",
    "anglais", "anglaise", "turc", "turque", "chinois", "chinoise",
  ];
  return markers.some((m) => n.includes(m));
}

function evaluateDistractorQuality(questionText, correct, distractors) {
  const issues = [];
  const warnings = [];

  if (distractors.some((d) => hasWeakDistractorPattern(d))) {
    issues.push("placeholder-like distractor detected");
  }

  const correctLens = correct.map((c) => c.length).filter(Boolean);
  const distLens = distractors.map((d) => d.length).filter(Boolean);
  const avgCorrectLen =
    correctLens.length > 0 ? correctLens.reduce((a, b) => a + b, 0) / correctLens.length : 1;
  const avgDistLen =
    distLens.length > 0 ? distLens.reduce((a, b) => a + b, 0) / distLens.length : 1;
  const ratio = avgDistLen > 0 ? avgCorrectLen / avgDistLen : 999;
  if (ratio > 1.7 || ratio < 0.6) warnings.push(`length imbalance ratio=${ratio.toFixed(2)}`);

  const avgCorrectTok =
    correct.length > 0 ? correct.map(countTokens).reduce((a, b) => a + b, 0) / correct.length : 1;
  const avgDistTok =
    distractors.length > 0 ? distractors.map(countTokens).reduce((a, b) => a + b, 0) / distractors.length : 1;
  if (avgDistTok > 0 && (avgCorrectTok / avgDistTok > 1.8 || avgCorrectTok / avgDistTok < 0.55)) {
    warnings.push("token-length imbalance");
  }

  const qHasFrenchCue = normalize(questionText).includes("francais") || normalize(questionText).includes("francaise");
  if (qHasFrenchCue) {
    const withFrenchCue = [...correct, ...distractors].filter((c) => normalize(c).includes("franc")).length;
    if (withFrenchCue === 1) warnings.push("single french cue among options");
  }

  const correctHasNationality = correct.some((c) => hasNationalityMarker(c));
  const distractorsNationalityCount = distractors.filter((d) => hasNationalityMarker(d)).length;
  if (!correctHasNationality && distractorsNationalityCount >= 2) {
    warnings.push("distractors rely heavily on nationality markers");
  }

  return { issues, warnings };
}

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--input" && next) {
      args.input = next;
      i += 1;
      continue;
    }
    if (a === "--output" && next) {
      args.output = next;
      i += 1;
      continue;
    }
  }

  return args;
}

function validationOutputPath(inputPath, explicitOutput) {
  if (explicitOutput) return explicitOutput;
  const ext = extname(inputPath);
  const base = basename(inputPath, ext);
  return join(dirname(inputPath), `${base}.validated${ext || ".json"}`);
}

function reportPathFromJson(jsonPath) {
  const ext = extname(jsonPath);
  const base = basename(jsonPath, ext);
  return join(dirname(jsonPath), `${base}.md`);
}

function buildReport(payload) {
  const lines = [];
  lines.push("# Validation suggestions");
  lines.push("");
  lines.push(`- Checked at: ${payload.validatedAt}`);
  lines.push(`- Total: ${payload.validationSummary.total}`);
  lines.push(`- Valid: ${payload.validationSummary.valid}`);
  lines.push(`- Invalid: ${payload.validationSummary.invalid}`);
  lines.push(`- Errors: ${payload.validationSummary.errorCount}`);
  lines.push(`- Warnings: ${payload.validationSummary.warningCount}`);
  lines.push("");

  for (const item of payload.items || []) {
    const v = item.validation || {};
    lines.push(`## ${item.questionId}`);
    lines.push("");
    lines.push(`- Valid: ${v.valid ? "yes" : "no"}`);
    lines.push(`- Errors: ${(v.errors || []).length}`);
    lines.push(`- Warnings: ${(v.warnings || []).length}`);
    if ((v.errors || []).length > 0) {
      for (const err of v.errors) lines.push(`- ERROR: ${err}`);
    }
    if ((v.warnings || []).length > 0) {
      for (const warning of v.warnings) lines.push(`- WARN: ${warning}`);
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPayload = JSON.parse(readFileSync(args.input, "utf-8"));
  const sectionIndex = JSON.parse(readFileSync(SECTION_INDEX_PATH, "utf-8"));

  const outputJsonPath = validationOutputPath(args.input, args.output);
  const outputMdPath = reportPathFromJson(outputJsonPath);

  const sectionMap = new Map();
  for (const section of sectionIndex.sections || []) {
    sectionMap.set(`${section.contentPath}#${section.sectionId}`, section);
  }

  const summary = {
    total: 0,
    valid: 0,
    invalid: 0,
    errorCount: 0,
    warningCount: 0,
  };

  for (const item of inputPayload.items || []) {
    summary.total += 1;
    const errors = [];
    const warnings = [];
    const suggestion = item.suggestion || {};

    const correct = dedupe(suggestion.correct || []);
    const distractors = dedupe(suggestion.distractors || []);
    const correctSet = new Set(correct.map((v) => normalize(v)));

    if (correct.length < 1) errors.push("must include at least one correct answer");
    if (distractors.length < 3) errors.push("must include at least three distractors");

    for (const d of distractors) {
      if (correctSet.has(normalize(d))) {
        errors.push(`correct/distractor overlap: "${d}"`);
      }
    }

    const answerEvidence = Array.isArray(suggestion.answerEvidence) ? suggestion.answerEvidence : [];
    const evidenceByAnswer = new Map();
    for (const row of answerEvidence) {
      const key = normalize(row?.normalizedAnswer || row?.answerText || "");
      if (!key) continue;
      evidenceByAnswer.set(key, row);
    }

    for (const answer of correct) {
      const key = normalize(answer);
      const row = evidenceByAnswer.get(key);
      if (!row) {
        errors.push(`missing answerEvidence row for correct answer "${answer}"`);
        continue;
      }

      const evidenceList = Array.isArray(row.evidence) ? row.evidence : [];
      if (evidenceList.length === 0) {
        errors.push(`missing evidence pointer for correct answer "${answer}"`);
        continue;
      }

      for (const ev of evidenceList) {
        const contentPath = String(ev?.contentPath || "").trim();
        const sectionId = String(ev?.sectionId || "").trim();
        const quote = String(ev?.quote || "").trim();

        if (!contentPath || !sectionId) {
          errors.push(`evidence pointer incomplete for "${answer}"`);
          continue;
        }

        const sectionKey = `${contentPath}#${sectionId}`;
        const section = sectionMap.get(sectionKey);
        if (!section) {
          errors.push(`unknown evidence section "${sectionKey}" for "${answer}"`);
          continue;
        }

        if (!quote) {
          errors.push(`empty quote for "${answer}" in "${sectionKey}"`);
          continue;
        }

        const quoteMatch = fuzzyQuoteMatch(quote, section.sectionText || "");
        if (!quoteMatch.matched) {
          errors.push(`quote not found in section for "${answer}" (${sectionKey}) [score=${quoteMatch.score.toFixed(2)}]`);
        } else if (!quoteMatch.exactMatch) {
          warnings.push(`fuzzy quote match for "${answer}" in "${sectionKey}" (score=${quoteMatch.score.toFixed(2)})`);
        }
      }
    }

    const questionEvidence = Array.isArray(suggestion.questionEvidence) ? suggestion.questionEvidence : [];
    if (questionEvidence.length === 0) {
      warnings.push("questionEvidence is empty");
      suggestion.qualityFlags = dedupe([...(suggestion.qualityFlags || []), "manual_review_required"]);
    }

    const distractorQuality = evaluateDistractorQuality(item.questionText || "", correct, distractors);
    for (const issue of distractorQuality.issues) errors.push(issue);
    for (const w of distractorQuality.warnings) warnings.push(w);
    if ((distractorQuality.issues.length > 0 || distractorQuality.warnings.length > 0) &&
      !suggestion.qualityFlags?.includes("weak_distractors")) {
      suggestion.qualityFlags = dedupe([...(suggestion.qualityFlags || []), "weak_distractors"]);
    }

    suggestion.qualityFlags = dedupe(suggestion.qualityFlags || []);
    for (const flag of suggestion.qualityFlags) {
      if (!VALID_QUALITY_FLAGS.has(flag)) {
        warnings.push(`unknown quality flag "${flag}"`);
      }
    }

    if ((suggestion.qualityFlags || []).includes("placeholder_answer")) {
      warnings.push("placeholder_answer flag present");
    }

    if (errors.length > 0 && !suggestion.qualityFlags?.includes("manual_review_required")) {
      suggestion.qualityFlags = dedupe([...(suggestion.qualityFlags || []), "manual_review_required"]);
    }
    if (warnings.length > 0 && !suggestion.qualityFlags?.includes("weak_distractors")) {
      suggestion.qualityFlags = dedupe([...(suggestion.qualityFlags || []), "weak_distractors"]);
    }

    const valid = errors.length === 0;
    item.validation = {
      valid,
      checkedAt: new Date().toISOString(),
      errors,
      warnings,
    };

    summary.errorCount += errors.length;
    summary.warningCount += warnings.length;
    if (valid) summary.valid += 1;
    else summary.invalid += 1;
  }

  inputPayload.validatedAt = new Date().toISOString();
  inputPayload.validationSummary = summary;

  writeFileSync(outputJsonPath, JSON.stringify(inputPayload, null, 2) + "\n", "utf-8");
  writeFileSync(outputMdPath, buildReport(inputPayload), "utf-8");

  console.log(`Validated ${summary.total} suggestion items`);
  console.log(`Valid=${summary.valid}, Invalid=${summary.invalid}, Errors=${summary.errorCount}, Warnings=${summary.warningCount}`);
  console.log(`Written ${outputJsonPath}`);
  console.log(`Written ${outputMdPath}`);

  if (summary.invalid > 0) process.exit(1);
}

main();
