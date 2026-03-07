#!/usr/bin/env node

/**
 * Build a constrained context packet/prompt for one question.
 *
 * Usage examples:
 *   node scripts/build-question-context.mjs --id crx005 --candidate-fiche-ids fiche-a,fiche-b
 *   node scripts/build-question-context.mjs --status pending --pending-index 1 --out /tmp/q1.prompt.md
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  buildAnswerSuggestionPrompt,
  classifyQuestionProfile,
  pickQuestionFicheIds,
  scoreSectionsForQuestion,
  selectReviewedStyleExamples,
} from "./lib/qcm-workflow.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const SECTION_INDEX_PATH = join(ROOT, "data-init", "fiches-section-index.json");

function parseArgs(argv) {
  const args = {
    id: "",
    status: "pending",
    pendingIndex: 1,
    sections: 10,
    examples: 3,
    format: "prompt",
    out: "",
    candidateFicheIds: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--id" && next) {
      args.id = next;
      i += 1;
      continue;
    }
    if (arg === "--status" && next) {
      args.status = next;
      i += 1;
      continue;
    }
    if (arg === "--pending-index" && next) {
      args.pendingIndex = Math.max(1, parseInt(next, 10) || 1);
      i += 1;
      continue;
    }
    if (arg === "--sections" && next) {
      args.sections = Math.max(1, parseInt(next, 10) || 10);
      i += 1;
      continue;
    }
    if (arg === "--examples" && next) {
      args.examples = Math.max(0, parseInt(next, 10) || 0);
      i += 1;
      continue;
    }
    if (arg === "--format" && next) {
      args.format = next;
      i += 1;
      continue;
    }
    if (arg === "--out" && next) {
      args.out = next;
      i += 1;
      continue;
    }
    if (arg === "--candidate-fiche-ids" && next) {
      args.candidateFicheIds = next
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      i += 1;
    }
  }

  return args;
}

function pickQuestion(bank, args) {
  if (args.id) {
    const byId = bank.find((question) => question.id === args.id);
    if (!byId) throw new Error(`Question id not found: ${args.id}`);
    return byId;
  }

  const filtered = bank.filter((question) =>
    args.status === "all" ? true : String(question.reviewStatus || "") === args.status,
  );
  if (filtered.length === 0) throw new Error(`No question found for status=${args.status}`);

  const index = Math.min(filtered.length, args.pendingIndex) - 1;
  return filtered[index];
}

function buildPayload(question, questionProfile, candidateFicheIds, sections, styleExamples) {
  return {
    question: {
      id: question.id,
      themeId: question.themeId,
      themeName: question.themeName,
      exams: question.exams || [],
      questionText: question.questionText,
      reviewStatus: question.reviewStatus,
      questionProfile,
      relatedFicheIds: question.relatedFicheIds || [],
      candidateFicheIds,
      currentAnswerPools: question.answerPools || { correct: [], distractors: [] },
    },
    styleExamples,
    sections: sections.map((section) => ({
      contentPath: section.contentPath,
      themeId: section.themeId,
      originalFicheIds: section.originalFicheIds || [],
      sectionId: section.sectionId,
      sectionTitle: section.sectionTitle,
      score: section.score,
      sectionText: String(section.sectionText || "").slice(0, 1200),
    })),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const questionBank = JSON.parse(readFileSync(BANK_PATH, "utf-8"));
  const sectionIndex = JSON.parse(readFileSync(SECTION_INDEX_PATH, "utf-8"));
  const question = pickQuestion(questionBank, args);
  const questionProfile = classifyQuestionProfile(question.questionText);
  const candidateFicheIds = pickQuestionFicheIds(question, args.candidateFicheIds);

  if (candidateFicheIds.length === 0) {
    throw new Error(
      `Question ${question.id} has no validated relatedFicheIds. Pass --candidate-fiche-ids to inspect a link shortlist.`,
    );
  }

  const sections = scoreSectionsForQuestion(question, sectionIndex, candidateFicheIds, args.sections);
  if (sections.length === 0) {
    throw new Error(`No sections found for question ${question.id} within fiche shortlist.`);
  }

  const styleExamples = selectReviewedStyleExamples(question, questionBank, args.examples);
  const payload = buildPayload(question, questionProfile, candidateFicheIds, sections, styleExamples);
  const outputText =
    args.format === "json"
      ? JSON.stringify(payload, null, 2) + "\n"
      : buildAnswerSuggestionPrompt({
          question,
          questionProfile,
          sections,
          candidateFicheIds,
          styleExamples,
        }) + "\n";

  if (args.out) {
    writeFileSync(args.out, outputText, "utf-8");
    console.log(`Written ${args.out}`);
    return;
  }

  process.stdout.write(outputText);
}

main();
