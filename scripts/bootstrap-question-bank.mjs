#!/usr/bin/env node

/**
 * Build data-init/question-bank.json from:
 * - data-init/questions-parsed.json (multi-exam source lists)
 * - data-init/questions-review.json (legacy enriched CR dataset)
 *
 * Keeps existing CR IDs when matched and creates exam-specific IDs for unmatched entries.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const PARSED_PATH = join(ROOT, "data-init", "questions-parsed.json");
const LEGACY_PATH = join(ROOT, "data-init", "questions-review.json");
const OVERRIDES_PATH = join(ROOT, "data-init", "questions", "canonical-overrides.json");
const OUTPUT_PATH = join(ROOT, "data-init", "question-bank.json");

const EXAM_ORDER = ["CSP", "CR", "NAT"];

const PLACEHOLDER_DISTRACTORS = {
  "principes-et-valeurs": [
    "Une proposition incorrecte liée aux valeurs républicaines",
    "Une proposition incorrecte liée aux symboles officiels",
    "Une proposition incorrecte liée aux libertés publiques",
  ],
  "systeme-institutionnel": [
    "Une proposition incorrecte liée aux institutions françaises",
    "Une proposition incorrecte liée au fonctionnement électoral",
    "Une proposition incorrecte liée aux collectivités territoriales",
  ],
  "droits-et-devoirs": [
    "Une proposition incorrecte liée aux droits fondamentaux",
    "Une proposition incorrecte liée aux obligations légales",
    "Une proposition incorrecte liée à la citoyenneté",
  ],
  "histoire-geographie-culture": [
    "Une proposition incorrecte liée à l'histoire de France",
    "Une proposition incorrecte liée à la géographie française",
    "Une proposition incorrecte liée au patrimoine culturel",
  ],
  "vivre-societe-francaise": [
    "Une proposition incorrecte liée à la vie quotidienne en France",
    "Une proposition incorrecte liée aux démarches administratives",
    "Une proposition incorrecte liée à la scolarité et au travail",
  ],
};

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

function dedupeStrings(values) {
  const seen = new Set();
  const out = [];
  for (const v of values || []) {
    const txt = String(v || "").trim();
    if (!txt) continue;
    const key = normalize(txt);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(txt);
  }
  return out;
}

function getPlaceholderDistractors(themeId) {
  return PLACEHOLDER_DISTRACTORS[themeId] || [
    "Une proposition incorrecte A",
    "Une proposition incorrecte B",
    "Une proposition incorrecte C",
  ];
}

function makeFallbackEntry(src, id) {
  return {
    id,
    themeId: src.themeId,
    themeName: src.themeName,
    questionText: src.questionText,
    exams: [src.exam],
    sourceMetaByExam: {
      [src.exam]: {
        localNumber: src.localNumber,
        globalNumber: src.globalNumber,
      },
    },
    answerPools: {
      correct: ["Réponse à compléter (source officielle non enrichie)"],
      distractors: getPlaceholderDistractors(src.themeId),
    },
    explanationTemplate:
      "Explication à compléter. La réponse correcte affichée est : {{correct}}.",
    explanationByCorrect: {},
    relatedFicheIds: [],
    difficultyByExam: {
      [src.exam]: "medium",
    },
    reviewStatus: "pending",
  };
}

function sortExams(exams) {
  return [...new Set(exams)].sort((a, b) => EXAM_ORDER.indexOf(a) - EXAM_ORDER.indexOf(b));
}

function main() {
  if (!existsSync(PARSED_PATH)) {
    throw new Error(`Missing parsed input: ${PARSED_PATH}. Run parse-questions.mjs first.`);
  }

  const parsed = JSON.parse(readFileSync(PARSED_PATH, "utf-8")).questions;
  const legacy = JSON.parse(readFileSync(LEGACY_PATH, "utf-8"));
  const overrides = existsSync(OVERRIDES_PATH)
    ? JSON.parse(readFileSync(OVERRIDES_PATH, "utf-8"))
    : { merge: {}, split: {} };

  const legacyByKey = new Map();
  let maxLegacyId = 0;

  for (const q of legacy) {
    const key = `${q.themeId}|${normalize(q.questionText)}`;
    legacyByKey.set(key, q);
    const n = Number((q.id || "").replace(/^q/, ""));
    if (Number.isFinite(n)) maxLegacyId = Math.max(maxLegacyId, n);
  }

  const counters = { CR: 0, CSP: 0, NAT: 0 };
  const byCanonical = new Map();

  function nextId(exam) {
    counters[exam] += 1;
    const suffix = String(counters[exam]).padStart(3, "0");
    if (exam === "CR") return `crx${suffix}`;
    if (exam === "CSP") return `cspx${suffix}`;
    return `natx${suffix}`;
  }

  for (const src of parsed) {
    const rawKey = `${src.themeId}|${normalize(src.questionText)}`;
    const canonicalKey = overrides.merge?.[rawKey] || rawKey;

    let entry = byCanonical.get(canonicalKey);
    if (!entry) {
      const legacyMatch = legacyByKey.get(canonicalKey);

      if (legacyMatch) {
        const correctChoice = (legacyMatch.choices || []).find((c) => c.id === legacyMatch.correctAnswer);
        const distractors = (legacyMatch.choices || [])
          .filter((c) => c.id !== legacyMatch.correctAnswer)
          .map((c) => c.text);

        entry = {
          id: legacyMatch.id,
          themeId: legacyMatch.themeId,
          themeName: legacyMatch.themeName,
          questionText: legacyMatch.questionText,
          exams: [],
          sourceMetaByExam: {},
          answerPools: {
            correct: dedupeStrings([correctChoice?.text || ""]),
            distractors: dedupeStrings(distractors),
          },
          explanationTemplate: legacyMatch.explanation || "La bonne réponse est : {{correct}}.",
          explanationByCorrect: correctChoice?.text
            ? { [correctChoice.text]: legacyMatch.explanation || "" }
            : {},
          relatedFicheIds: legacyMatch.relatedFicheIds || [],
          difficultyByExam: {},
          reviewStatus: "pending",
          _hasLegacyCR: true,
        };
      } else {
        entry = makeFallbackEntry(src, nextId(src.exam));
        entry._hasLegacyCR = false;
      }

      byCanonical.set(canonicalKey, entry);
    }

    // Merge source metadata and exam membership
    entry.exams = sortExams([...(entry.exams || []), src.exam]);
    entry.sourceMetaByExam = entry.sourceMetaByExam || {};
    entry.sourceMetaByExam[src.exam] = {
      localNumber: src.localNumber,
      globalNumber: src.globalNumber,
    };

    entry.difficultyByExam = entry.difficultyByExam || {};
    if (!entry.difficultyByExam[src.exam]) {
      entry.difficultyByExam[src.exam] = src.exam === "CSP" ? "easy" : src.exam === "NAT" ? "hard" : "medium";
    }
  }

  const questionBank = [...byCanonical.values()]
    .map((item) => {
      // Ensure minimum pool structure
      item.answerPools.correct = dedupeStrings(item.answerPools.correct);
      item.answerPools.distractors = dedupeStrings(item.answerPools.distractors);

      if (item.answerPools.correct.length === 0) {
        item.answerPools.correct = ["Réponse à compléter (source officielle non enrichie)"];
      }
      while (item.answerPools.distractors.length < 3) {
        const fallback = getPlaceholderDistractors(item.themeId)[item.answerPools.distractors.length];
        item.answerPools.distractors.push(fallback || `Distracteur ${item.answerPools.distractors.length + 1}`);
      }

      const hasCR = item.exams.includes("CR");
      item.reviewStatus = hasCR && item._hasLegacyCR ? "reviewed" : "pending";
      delete item._hasLegacyCR;
      return item;
    })
    .sort((a, b) => {
      const aNum = Number((a.id || "").replace(/^q/, ""));
      const bNum = Number((b.id || "").replace(/^q/, ""));
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
      return String(a.id).localeCompare(String(b.id));
    });

  writeFileSync(OUTPUT_PATH, JSON.stringify(questionBank, null, 2) + "\n", "utf-8");

  const counts = { CR: 0, CSP: 0, NAT: 0 };
  for (const q of questionBank) {
    for (const exam of q.exams) counts[exam] += 1;
  }

  const pending = questionBank.filter((q) => q.reviewStatus !== "reviewed").length;

  console.log(`Question bank built: ${questionBank.length} canonical entries`);
  console.log(`By exam: CR=${counts.CR}, CSP=${counts.CSP}, NAT=${counts.NAT}`);
  console.log(`Pending review: ${pending}`);
  console.log(`Written ${OUTPUT_PATH}`);
}

main();
