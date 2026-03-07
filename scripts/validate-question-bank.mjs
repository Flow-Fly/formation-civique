#!/usr/bin/env node

/**
 * Validate canonical question-bank quality and integrity.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DEFAULT_BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const VALID_THEMES = new Set([
  "principes-et-valeurs",
  "systeme-institutionnel",
  "droits-et-devoirs",
  "histoire-geographie-culture",
  "vivre-societe-francaise",
]);
const VALID_EXAMS = new Set(["CSP", "CR", "NAT"]);
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const VALID_QUALITY_FLAGS = new Set([
  "missing_correct_evidence",
  "weak_distractors",
  "placeholder_answer",
  "manual_review_required",
]);

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  const argv = process.argv.slice(2);
  let bankPath = DEFAULT_BANK_PATH;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--bank" && argv[i + 1]) {
      bankPath = argv[i + 1];
      i += 1;
    }
  }

  const bank = JSON.parse(readFileSync(bankPath, "utf-8"));

  let errors = 0;

  function err(message) {
    errors += 1;
    console.error(`ERROR: ${message}`);
  }

  const ids = new Set();

  for (const q of bank) {
    const prefix = `[${q.id}]`;

    if (!q.id || typeof q.id !== "string") {
      err(`${prefix} Missing id`);
      continue;
    }

    if (ids.has(q.id)) err(`${prefix} Duplicate id`);
    ids.add(q.id);

    if (!VALID_THEMES.has(q.themeId)) err(`${prefix} Invalid themeId: ${q.themeId}`);
    if (!q.questionText || q.questionText.length < 5) err(`${prefix} Missing/short questionText`);

    if (!Array.isArray(q.exams) || q.exams.length === 0) {
      err(`${prefix} Missing exams`);
    } else {
      for (const exam of q.exams) {
        if (!VALID_EXAMS.has(exam)) err(`${prefix} Invalid exam: ${exam}`);
      }
    }

    const pools = q.answerPools || {};
    const correct = Array.isArray(pools.correct) ? pools.correct : [];
    const distractors = Array.isArray(pools.distractors) ? pools.distractors : [];

    if (correct.length !== 1) err(`${prefix} Must have exactly one correct candidate`);
    if (distractors.length !== 3) err(`${prefix} Must have exactly three distractors`);

    const correctSet = new Set(correct.map((c) => normalize(c)));
    for (const d of distractors) {
      if (correctSet.has(normalize(d))) {
        err(`${prefix} Correct/distractor overlap detected: "${d}"`);
      }
    }

    if (!q.explanationTemplate && (!q.explanationByCorrect || Object.keys(q.explanationByCorrect).length === 0)) {
      err(`${prefix} Missing explanationTemplate and explanationByCorrect`);
    }

    if (q.qualityFlags != null) {
      if (!Array.isArray(q.qualityFlags)) {
        err(`${prefix} qualityFlags must be an array`);
      } else {
        for (const flag of q.qualityFlags) {
          if (!VALID_QUALITY_FLAGS.has(flag)) err(`${prefix} Invalid qualityFlag: ${flag}`);
        }
      }
    }

    if (q.answerEvidence != null) {
      if (!Array.isArray(q.answerEvidence)) {
        err(`${prefix} answerEvidence must be an array`);
      } else {
        for (const row of q.answerEvidence) {
          const answerText = String(row?.answerText || "").trim();
          const normalizedAnswer = String(row?.normalizedAnswer || "").trim();
          if (!answerText) err(`${prefix} answerEvidence row missing answerText`);
          if (!normalizedAnswer) err(`${prefix} answerEvidence row missing normalizedAnswer`);
          if (answerText && normalizedAnswer && normalize(answerText) !== normalize(normalizedAnswer)) {
            err(`${prefix} answerEvidence normalizedAnswer mismatch for "${answerText}"`);
          }
          if (!Array.isArray(row?.evidence)) {
            err(`${prefix} answerEvidence.evidence must be an array`);
            continue;
          }
          for (const ev of row.evidence) {
            if (!String(ev?.contentPath || "").trim()) err(`${prefix} evidence pointer missing contentPath`);
            if (!String(ev?.sectionId || "").trim()) err(`${prefix} evidence pointer missing sectionId`);
            if (!String(ev?.sectionTitle || "").trim()) err(`${prefix} evidence pointer missing sectionTitle`);
            if (!String(ev?.quote || "").trim()) err(`${prefix} evidence pointer missing quote`);
          }
        }
      }
    }

    if (q.questionEvidence != null) {
      if (!Array.isArray(q.questionEvidence)) {
        err(`${prefix} questionEvidence must be an array`);
      } else {
        for (const ev of q.questionEvidence) {
          if (!String(ev?.contentPath || "").trim()) err(`${prefix} questionEvidence pointer missing contentPath`);
          if (!String(ev?.sectionId || "").trim()) err(`${prefix} questionEvidence pointer missing sectionId`);
          if (!String(ev?.sectionTitle || "").trim()) err(`${prefix} questionEvidence pointer missing sectionTitle`);
          if (!String(ev?.quote || "").trim()) err(`${prefix} questionEvidence pointer missing quote`);
        }
      }
    }

    if (q.difficultyByExam && typeof q.difficultyByExam === "object") {
      for (const [exam, diff] of Object.entries(q.difficultyByExam)) {
        if (!VALID_EXAMS.has(exam)) err(`${prefix} Invalid difficultyByExam key: ${exam}`);
        if (!VALID_DIFFICULTIES.has(diff)) err(`${prefix} Invalid difficulty "${diff}" for exam ${exam}`);
      }
    }

    if (q.questionProfile != null) {
      const validProfiles = new Set([
        "yes_no",
        "date_year",
        "number_unit",
        "website",
        "person",
        "place",
        "institution",
        "definition",
        "quote",
      ]);
      if (!validProfiles.has(q.questionProfile)) err(`${prefix} Invalid questionProfile: ${q.questionProfile}`);
    }

    if (q.reviewBucket != null && !["high_confidence", "manual_review_required"].includes(q.reviewBucket)) {
      err(`${prefix} Invalid reviewBucket: ${q.reviewBucket}`);
    }

    if (q.reviewReasons != null && !Array.isArray(q.reviewReasons)) {
      err(`${prefix} reviewReasons must be an array`);
    }
  }

  const byExam = { CSP: 0, CR: 0, NAT: 0 };
  for (const q of bank) {
    for (const exam of q.exams || []) byExam[exam] += 1;
  }

  console.log(`Validated ${bank.length} question-bank entries`);
  console.log(`By exam: CR=${byExam.CR}, CSP=${byExam.CSP}, NAT=${byExam.NAT}`);

  if (errors > 0) {
    console.error(`\n${errors} validation error(s).`);
    process.exit(1);
  }

  console.log("All checks passed.");
}

main();
