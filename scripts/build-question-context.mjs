#!/usr/bin/env node

/**
 * Build a compact context packet/prompt for one question.
 *
 * Usage examples:
 *   node scripts/build-question-context.mjs --id q203 --out /tmp/q203.prompt.md
 *   node scripts/build-question-context.mjs --status pending --pending-index 1 --format json
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const SECTION_INDEX_PATH = join(ROOT, "data-init", "fiches-section-index.json");

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

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 2);
}

function parseArgs(argv) {
  const args = {
    id: "",
    status: "pending",
    pendingIndex: 1,
    sections: 10,
    format: "prompt",
    out: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--id" && next) {
      args.id = next;
      i += 1;
      continue;
    }
    if (a === "--status" && next) {
      args.status = next;
      i += 1;
      continue;
    }
    if (a === "--pending-index" && next) {
      args.pendingIndex = Math.max(1, parseInt(next, 10) || 1);
      i += 1;
      continue;
    }
    if (a === "--sections" && next) {
      args.sections = Math.max(1, parseInt(next, 10) || 10);
      i += 1;
      continue;
    }
    if (a === "--format" && next) {
      args.format = next;
      i += 1;
      continue;
    }
    if (a === "--out" && next) {
      args.out = next;
      i += 1;
      continue;
    }
  }

  return args;
}

function pickQuestion(bank, args) {
  if (args.id) {
    const byId = bank.find((q) => q.id === args.id);
    if (!byId) throw new Error(`Question id not found: ${args.id}`);
    return byId;
  }

  const filtered = bank.filter((q) =>
    args.status === "all" ? true : String(q.reviewStatus || "") === args.status,
  );
  if (filtered.length === 0) throw new Error(`No question found for status=${args.status}`);
  const idx = Math.min(filtered.length, args.pendingIndex) - 1;
  return filtered[idx];
}

function scoreSections(question, sectionIndex, limit) {
  const tokens = tokenize([
    question.questionText,
    ...(question.answerPools?.correct || []),
  ].join(" "));
  const tokenSet = [...new Set(tokens)];
  const related = new Set(question.relatedFicheIds || []);

  const docCount = sectionIndex.index?.docCount || sectionIndex.sections.length || 1;
  const df = sectionIndex.index?.docFreq || {};

  const scored = [];
  for (const section of sectionIndex.sections || []) {
    let score = 0;
    if (section.themeId === question.themeId) score += 8;
    if ((section.originalFicheIds || []).some((id) => related.has(id))) score += 12;

    const terms = new Set(section.terms || []);
    for (const token of tokenSet) {
      if (!terms.has(token)) continue;
      const termDf = Number(df[token] || 1);
      const idf = Math.log((docCount + 1) / (termDf + 1)) + 1;
      score += 2 * idf;
    }
    if (score > 0) scored.push({ section, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.section);
}

function buildPayload(question, sections) {
  return {
    question: {
      id: question.id,
      themeId: question.themeId,
      themeName: question.themeName,
      exams: question.exams || [],
      questionText: question.questionText,
      reviewStatus: question.reviewStatus,
      relatedFicheIds: question.relatedFicheIds || [],
      currentAnswerPools: question.answerPools || { correct: [], distractors: [] },
    },
    sections: sections.map((s) => ({
      contentPath: s.contentPath,
      themeId: s.themeId,
      originalFicheIds: s.originalFicheIds || [],
      sectionId: s.sectionId,
      sectionTitle: s.sectionTitle,
      sectionText: String(s.sectionText || "").slice(0, 900),
    })),
  };
}

function buildPrompt(payload) {
  return [
    "Tu es un expert QCM civique. Travaille uniquement avec les sections fournies.",
    "",
    "Objectif:",
    "- proposer `correct` (1..n réponses possibles vraies)",
    "- proposer `distractors` (>=3 réponses plausibles mais fausses)",
    "- lier chaque réponse correcte à des preuves section-level",
    "",
    "Contraintes qualité distractors:",
    "- mêmes catégories sémantiques que la bonne réponse",
    "- pas de distracteur ridicule ou hors-sujet",
    "- longueur comparable à la/aux bonne(s) réponse(s)",
    "- pas de placeholders (`proposition incorrecte`, `distracteur`, etc.)",
    "",
    "Format JSON strict attendu:",
    JSON.stringify({
      correct: ["string"],
      distractors: ["string", "string", "string"],
      explanationByCorrect: { "<correct-answer>": "explication concise" },
      answerEvidence: [
        {
          answerText: "string",
          normalizedAnswer: "string-normalise",
          evidence: [
            {
              ficheId: "string",
              contentPath: "theme/subcategory/page.md",
              sectionId: "section-id",
              sectionTitle: "Titre section",
              quote: "extrait exact",
            },
          ],
        },
      ],
      questionEvidence: [
        {
          ficheId: "string",
          contentPath: "theme/subcategory/page.md",
          sectionId: "section-id",
          sectionTitle: "Titre section",
          quote: "extrait exact",
        },
      ],
      relatedFicheIds: ["fiche-id"],
      qualityFlags: [],
    }, null, 2),
    "",
    "Contexte question + sections:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const bank = JSON.parse(readFileSync(BANK_PATH, "utf-8"));
  const sectionIndex = JSON.parse(readFileSync(SECTION_INDEX_PATH, "utf-8"));

  const q = pickQuestion(bank, args);
  const sections = scoreSections(q, sectionIndex, args.sections);
  const payload = buildPayload(q, sections);
  const outText = args.format === "json"
    ? JSON.stringify(payload, null, 2) + "\n"
    : buildPrompt(payload) + "\n";

  if (args.out) {
    writeFileSync(args.out, outText, "utf-8");
    console.log(`Written ${args.out}`);
    return;
  }

  process.stdout.write(outText);
}

main();
