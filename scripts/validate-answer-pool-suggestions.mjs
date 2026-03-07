#!/usr/bin/env node

/**
 * Validate generated answer-pool suggestions with strict fiche/evidence/style checks.
 */

import { readFileSync, writeFileSync } from "fs";
import { basename, dirname, extname, join } from "path";
import { fileURLToPath } from "url";

import {
  buildReviewBucket,
  buildStyleMetrics,
  classifyQuestionProfile,
  dedupe,
  hasPlaceholderInOptions,
  normalize,
  VALID_QUALITY_FLAGS,
} from "./lib/qcm-workflow.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DEFAULT_INPUT = join(ROOT, "data-init", "suggestions", "answer-pools.pending.json");
const SECTION_INDEX_PATH = join(ROOT, "data-init", "fiches-section-index.json");

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--input" && next) {
      args.input = next;
      i += 1;
      continue;
    }
    if (arg === "--output" && next) {
      args.output = next;
      i += 1;
    }
  }

  return args;
}

function validationOutputPath(inputPath, explicitOutput) {
  if (explicitOutput) return explicitOutput;
  const extension = extname(inputPath);
  const base = basename(inputPath, extension);
  return join(dirname(inputPath), `${base}.validated${extension || ".json"}`);
}

function reportPathFromJson(jsonPath) {
  const extension = extname(jsonPath);
  const base = basename(jsonPath, extension);
  return join(dirname(jsonPath), `${base}.md`);
}

function exactQuoteMatch(quote, sectionText) {
  const cleanQuote = normalize(quote);
  const cleanSection = normalize(sectionText || "");
  if (!cleanQuote || !cleanSection) return { exact: false, fuzzy: false };
  if (cleanSection.includes(cleanQuote)) return { exact: true, fuzzy: true };

  const quoteWords = cleanQuote.split(/\s+/).filter(Boolean);
  if (quoteWords.length < 3) return { exact: false, fuzzy: false };

  const sectionWords = new Set(cleanSection.split(/\s+/).filter(Boolean));
  const overlap = quoteWords.filter((word) => sectionWords.has(word)).length / quoteWords.length;
  return { exact: false, fuzzy: overlap >= 0.7 };
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
    lines.push(`## ${item.questionId}`);
    lines.push("");
    lines.push(`- Valid: ${item.validation?.valid ? "yes" : "no"}`);
    lines.push(`- Bucket: ${item.suggestion?.reviewBucket || "n/a"}`);
    if ((item.validation?.errors || []).length > 0) {
      for (const error of item.validation.errors) lines.push(`- ERROR: ${error}`);
    }
    if ((item.validation?.warnings || []).length > 0) {
      for (const warning of item.validation.warnings) lines.push(`- WARN: ${warning}`);
    }
    if ((item.suggestion?.reviewReasons || []).length > 0) {
      lines.push(`- Review reasons: ${item.suggestion.reviewReasons.join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function validateItem(item, sectionMap) {
  const suggestion = item.suggestion || {};
  const questionProfile =
    suggestion.questionProfile || item.questionProfile || classifyQuestionProfile(item.questionText || "");
  const candidateFicheIds = dedupe(
    Array.isArray(suggestion.candidateFicheIds)
      ? suggestion.candidateFicheIds
      : item.candidateFicheIds || [],
  );
  const correct = dedupe(Array.isArray(suggestion.correct) ? suggestion.correct : []);
  const distractors = dedupe(Array.isArray(suggestion.distractors) ? suggestion.distractors : []);
  const answerEvidence = Array.isArray(suggestion.answerEvidence) ? suggestion.answerEvidence : [];
  const questionEvidence = Array.isArray(suggestion.questionEvidence) ? suggestion.questionEvidence : [];
  const errors = [];
  const warnings = [];
  const relatedSet = new Set(candidateFicheIds);
  let exactQuotesOnly = true;

  if (correct.length !== 1) errors.push("must include exactly one correct answer");
  if (distractors.length !== 3) errors.push("must include exactly three distractors");

  const normalizedCorrect = new Set(correct.map((value) => normalize(value)));
  for (const distractor of distractors) {
    if (normalizedCorrect.has(normalize(distractor))) {
      errors.push(`correct/distractor overlap: "${distractor}"`);
    }
  }

  if (hasPlaceholderInOptions(correct, distractors)) errors.push("placeholder option detected");

  const evidenceByAnswer = new Map();
  for (const row of answerEvidence) {
    const key = normalize(row?.normalizedAnswer || row?.answerText || "");
    if (!key) continue;
    evidenceByAnswer.set(key, row);
  }

  for (const answer of correct) {
    const row = evidenceByAnswer.get(normalize(answer));
    if (!row) {
      errors.push(`missing answerEvidence row for "${answer}"`);
      continue;
    }
    if (!Array.isArray(row.evidence) || row.evidence.length === 0) {
      errors.push(`missing evidence pointers for "${answer}"`);
      continue;
    }

    for (const pointer of row.evidence) {
      const contentPath = String(pointer?.contentPath || "").trim();
      const sectionId = String(pointer?.sectionId || "").trim();
      const quote = String(pointer?.quote || "").trim();
      if (!contentPath || !sectionId) {
        errors.push(`incomplete evidence pointer for "${answer}"`);
        continue;
      }
      const section = sectionMap.get(`${contentPath}#${sectionId}`);
      if (!section) {
        errors.push(`unknown section for "${answer}": ${contentPath}#${sectionId}`);
        continue;
      }
      if (!quote) {
        errors.push(`empty quote for "${answer}"`);
        continue;
      }

      const match = exactQuoteMatch(quote, section.sectionText || "");
      if (!match.fuzzy) {
        errors.push(`quote not found in section for "${answer}"`);
      } else if (!match.exact) {
        exactQuotesOnly = false;
        warnings.push(`fuzzy quote match for "${answer}"`);
      }

      if (relatedSet.size > 0 && pointer.ficheId && !relatedSet.has(pointer.ficheId)) {
        warnings.push(`answer evidence references fiche outside shortlist: ${pointer.ficheId}`);
      }
    }
  }

  if (!Array.isArray(questionEvidence) || questionEvidence.length === 0) {
    errors.push("questionEvidence is required");
  } else {
    for (const pointer of questionEvidence) {
      const contentPath = String(pointer?.contentPath || "").trim();
      const sectionId = String(pointer?.sectionId || "").trim();
      const quote = String(pointer?.quote || "").trim();
      if (!contentPath || !sectionId) {
        errors.push("questionEvidence pointer incomplete");
        continue;
      }
      const section = sectionMap.get(`${contentPath}#${sectionId}`);
      if (!section) {
        errors.push(`unknown questionEvidence section: ${contentPath}#${sectionId}`);
        continue;
      }
      if (!quote) {
        errors.push("questionEvidence quote is empty");
        continue;
      }

      const match = exactQuoteMatch(quote, section.sectionText || "");
      if (!match.fuzzy) {
        errors.push("questionEvidence quote not found in section");
      } else if (!match.exact) {
        exactQuotesOnly = false;
        warnings.push("questionEvidence uses fuzzy quote match");
      }

      if (relatedSet.size > 0 && pointer.ficheId && !relatedSet.has(pointer.ficheId)) {
        warnings.push(`questionEvidence references fiche outside shortlist: ${pointer.ficheId}`);
      }
    }
  }

  const suggestedRelatedFicheIds = dedupe(
    Array.isArray(suggestion.relatedFicheIds) ? suggestion.relatedFicheIds : candidateFicheIds,
  );
  if (candidateFicheIds.length === 0) warnings.push("candidateFicheIds is empty");
  for (const ficheId of suggestedRelatedFicheIds) {
    if (candidateFicheIds.length > 0 && !relatedSet.has(ficheId)) {
      warnings.push(`relatedFicheIds contains fiche outside shortlist: ${ficheId}`);
      exactQuotesOnly = false;
    }
  }

  suggestion.qualityFlags = dedupe(Array.isArray(suggestion.qualityFlags) ? suggestion.qualityFlags : []);
  for (const flag of suggestion.qualityFlags) {
    if (!VALID_QUALITY_FLAGS.has(flag)) warnings.push(`unknown quality flag "${flag}"`);
  }

  const styleMetrics = buildStyleMetrics(questionProfile, correct, distractors);
  const review = buildReviewBucket({
    correct,
    distractors,
    qualityFlags: suggestion.qualityFlags,
    answerEvidence,
    questionEvidence,
    exactQuotesOnly,
    candidateFicheIds,
    relatedFicheIds: suggestedRelatedFicheIds,
    styleMetrics,
    extraReasons: [...errors],
  });

  if (styleMetrics.obviousLengthCue && !suggestion.qualityFlags.includes("weak_distractors")) {
    suggestion.qualityFlags = dedupe([...(suggestion.qualityFlags || []), "weak_distractors"]);
  }
  if (errors.some((error) => error.includes("evidence")) && !suggestion.qualityFlags.includes("missing_correct_evidence")) {
    suggestion.qualityFlags = dedupe([...(suggestion.qualityFlags || []), "missing_correct_evidence"]);
  }
  if (hasPlaceholderInOptions(correct, distractors) && !suggestion.qualityFlags.includes("placeholder_answer")) {
    suggestion.qualityFlags = dedupe([...(suggestion.qualityFlags || []), "placeholder_answer"]);
  }
  if (review.reviewBucket === "manual_review_required" && !suggestion.qualityFlags.includes("manual_review_required")) {
    suggestion.qualityFlags = dedupe([...(suggestion.qualityFlags || []), "manual_review_required"]);
  }

  suggestion.questionProfile = questionProfile;
  suggestion.candidateFicheIds = candidateFicheIds;
  suggestion.styleMetrics = styleMetrics;
  suggestion.reviewBucket = review.reviewBucket;
  suggestion.reviewReasons = review.reviewReasons;

  return {
    valid: errors.length === 0,
    errors,
    warnings: dedupe(warnings),
  };
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
    item.validation = validateItem(item, sectionMap);
    summary.errorCount += (item.validation.errors || []).length;
    summary.warningCount += (item.validation.warnings || []).length;

    if (item.validation.valid) summary.valid += 1;
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
