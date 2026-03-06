#!/usr/bin/env node

/**
 * Apply validated answer-pool suggestions into data-init/question-bank.json.
 *
 * Defaults:
 * - input: data-init/suggestions/answer-pools.pending.validated.json
 * - bank: data-init/question-bank.json
 *
 * Behavior:
 * - Only applies entries with validation.valid === true
 * - By default applies only entries with accepted === true
 * - --accept-all applies all valid entries regardless of accepted flag
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DEFAULT_INPUT = join(ROOT, "data-init", "suggestions", "answer-pools.pending.validated.json");
const DEFAULT_BANK = join(ROOT, "data-init", "question-bank.json");

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

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    bank: DEFAULT_BANK,
    acceptAll: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--input" && next) {
      args.input = next;
      i += 1;
      continue;
    }
    if (a === "--bank" && next) {
      args.bank = next;
      i += 1;
      continue;
    }
    if (a === "--accept-all") {
      args.acceptAll = true;
      continue;
    }
  }

  return args;
}

function sanitizeSuggestion(suggestion) {
  const correct = dedupe(Array.isArray(suggestion?.correct) ? suggestion.correct : []);
  const correctSet = new Set(correct.map((v) => normalize(v)));
  const distractors = dedupe(Array.isArray(suggestion?.distractors) ? suggestion.distractors : [])
    .filter((d) => !correctSet.has(normalize(d)));

  const explanationByCorrectRaw =
    suggestion && typeof suggestion.explanationByCorrect === "object"
      ? suggestion.explanationByCorrect
      : {};
  const explanationByCorrect = {};
  for (const answer of correct) {
    const exact = explanationByCorrectRaw[answer];
    if (exact) {
      explanationByCorrect[answer] = String(exact);
      continue;
    }
    const byNormalizedKey = Object.entries(explanationByCorrectRaw).find(
      ([k]) => normalize(k) === normalize(answer),
    );
    if (byNormalizedKey) explanationByCorrect[answer] = String(byNormalizedKey[1]);
  }

  const answerEvidence = Array.isArray(suggestion?.answerEvidence)
    ? suggestion.answerEvidence.map((entry) => ({
        answerText: String(entry?.answerText || "").trim(),
        normalizedAnswer: normalize(entry?.normalizedAnswer || entry?.answerText || ""),
        evidence: Array.isArray(entry?.evidence)
          ? entry.evidence.map((ev) => ({
              ficheId: String(ev?.ficheId || "").trim(),
              contentPath: String(ev?.contentPath || "").trim(),
              sectionId: String(ev?.sectionId || "").trim(),
              sectionTitle: String(ev?.sectionTitle || "").trim(),
              quote: String(ev?.quote || "").trim(),
            }))
          : [],
      }))
    : [];

  const questionEvidence = Array.isArray(suggestion?.questionEvidence)
    ? suggestion.questionEvidence.map((ev) => ({
        ficheId: String(ev?.ficheId || "").trim(),
        contentPath: String(ev?.contentPath || "").trim(),
        sectionId: String(ev?.sectionId || "").trim(),
        sectionTitle: String(ev?.sectionTitle || "").trim(),
        quote: String(ev?.quote || "").trim(),
      }))
    : [];

  const relatedFromSuggestion = dedupe(Array.isArray(suggestion?.relatedFicheIds) ? suggestion.relatedFicheIds : []);
  const relatedFromEvidence = dedupe(
    [
      ...answerEvidence.flatMap((entry) => (entry.evidence || []).map((ev) => ev.ficheId)),
      ...questionEvidence.map((ev) => ev.ficheId),
    ].filter(Boolean),
  );

  const qualityFlags = dedupe(Array.isArray(suggestion?.qualityFlags) ? suggestion.qualityFlags : []);

  return {
    correct,
    distractors,
    explanationByCorrect,
    answerEvidence,
    questionEvidence,
    relatedFicheIds: dedupe([...relatedFromSuggestion, ...relatedFromEvidence]),
    qualityFlags,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const suggestionsPayload = JSON.parse(readFileSync(args.input, "utf-8"));
  const bank = JSON.parse(readFileSync(args.bank, "utf-8"));
  const byId = new Map(bank.map((q) => [q.id, q]));

  let applied = 0;
  let skipped = 0;
  let missing = 0;

  for (const item of suggestionsPayload.items || []) {
    const valid = item?.validation?.valid === true;
    const accepted = args.acceptAll ? true : item?.accepted === true;

    if (!valid || !accepted) {
      item.apply = {
        applied: false,
        reason: !valid ? "validation_failed" : "not_accepted",
        checkedAt: new Date().toISOString(),
      };
      skipped += 1;
      continue;
    }

    const q = byId.get(item.questionId);
    if (!q) {
      item.apply = {
        applied: false,
        reason: "question_not_found",
        checkedAt: new Date().toISOString(),
      };
      missing += 1;
      continue;
    }

    const clean = sanitizeSuggestion(item.suggestion || {});
    if (clean.correct.length < 1 || clean.distractors.length < 3) {
      item.apply = {
        applied: false,
        reason: "sanitized_pools_invalid",
        checkedAt: new Date().toISOString(),
      };
      skipped += 1;
      continue;
    }

    q.answerPools = {
      correct: clean.correct,
      distractors: clean.distractors,
    };

    if (Object.keys(clean.explanationByCorrect).length > 0) {
      q.explanationByCorrect = clean.explanationByCorrect;
    }

    q.relatedFicheIds = dedupe([...(q.relatedFicheIds || []), ...clean.relatedFicheIds]);
    q.answerEvidence = clean.answerEvidence;
    q.questionEvidence = clean.questionEvidence;
    q.qualityFlags = clean.qualityFlags;

    const hasStrictEvidence = clean.answerEvidence.every((entry) => (entry.evidence || []).length > 0);
    if (hasStrictEvidence) q.reviewStatus = "reviewed";

    item.apply = {
      applied: true,
      reason: "merged",
      checkedAt: new Date().toISOString(),
      reviewStatusAfter: q.reviewStatus,
    };
    applied += 1;
  }

  suggestionsPayload.appliedAt = new Date().toISOString();
  suggestionsPayload.applySummary = {
    applied,
    skipped,
    missing,
    acceptAll: args.acceptAll,
  };

  writeFileSync(args.bank, JSON.stringify(bank, null, 2) + "\n", "utf-8");
  writeFileSync(args.input, JSON.stringify(suggestionsPayload, null, 2) + "\n", "utf-8");

  console.log(`Applied ${applied} suggestion(s)`);
  console.log(`Skipped ${skipped}, missing questions ${missing}`);
  console.log(`Updated ${args.bank}`);
  console.log(`Updated ${args.input}`);
}

main();
