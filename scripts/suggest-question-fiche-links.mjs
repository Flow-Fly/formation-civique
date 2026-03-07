#!/usr/bin/env node

/**
 * Suggest fiche links for questions without validated relatedFicheIds.
 *
 * Outputs:
 * - data-init/suggestions/question-fiche-links.<status>.<run-id>.json
 * - data-init/suggestions/question-fiche-links.<status>.<run-id>.md
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import {
  buildFicheLinkIndex,
  classifyQuestionProfile,
  loadAllFiches,
  scoreQuestionToFicheCandidates,
} from "./lib/qcm-workflow.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const QUESTION_BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const SUGGESTIONS_DIR = join(ROOT, "data-init", "suggestions");

function parseArgs(argv) {
  const args = {
    status: "pending",
    runId: "",
    limit: 0,
    includeLinked: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--status" && next) {
      args.status = next;
      i += 1;
      continue;
    }
    if (arg === "--run-id" && next) {
      args.runId = next.replace(/[^a-zA-Z0-9_-]/g, "");
      i += 1;
      continue;
    }
    if (arg === "--limit" && next) {
      args.limit = Math.max(0, parseInt(next, 10) || 0);
      i += 1;
      continue;
    }
    if (arg === "--include-linked") {
      args.includeLinked = true;
    }
  }

  return args;
}

function buildMarkdownReport(payload) {
  const lines = [];
  lines.push("# Suggestions de liaison question → fiche");
  lines.push("");
  lines.push(`- Généré le: ${payload.generatedAt}`);
  lines.push(`- Filtre status: ${payload.statusFilter}`);
  lines.push(`- Questions traitées: ${payload.items.length}`);
  lines.push("");

  for (const item of payload.items || []) {
    lines.push(`## ${item.questionId} — ${item.questionText}`);
    lines.push("");
    lines.push(`- Profil: ${item.questionProfile}`);
    lines.push(`- Candidats: ${(item.candidateFicheIds || []).join(", ") || "(aucun)"}`);
    if ((item.validation?.errors || []).length > 0) {
      lines.push(`- Errors: ${item.validation.errors.join("; ")}`);
    }
    lines.push("");
    for (const candidate of item.suggestion?.ficheCandidates || []) {
      lines.push(`- ${candidate.ficheId} (${candidate.score}) — ${candidate.title}`);
      for (const reason of candidate.reasons || []) {
        lines.push(`  - ${reason}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const questionBank = JSON.parse(readFileSync(QUESTION_BANK_PATH, "utf-8"));
  const fiches = loadAllFiches(ROOT);
  const ficheLinkIndex = buildFicheLinkIndex(fiches);

  const eligible = questionBank.filter((question) => {
    const statusMatches = args.status === "all" ? true : String(question.reviewStatus || "") === args.status;
    if (!statusMatches) return false;
    if (args.includeLinked) return true;
    return !Array.isArray(question.relatedFicheIds) || question.relatedFicheIds.length === 0;
  });

  const limited = args.limit > 0 ? eligible.slice(0, args.limit) : eligible;

  const payload = {
    kind: "fiche_link",
    generatedAt: new Date().toISOString(),
    statusFilter: args.status,
    source: {
      questionBankPath: "data-init/question-bank.json",
      fichesPath: "data-init/fiches",
    },
    items: limited.map((question) => {
      const questionProfile = classifyQuestionProfile(question.questionText);
      const ficheCandidates = scoreQuestionToFicheCandidates(question, ficheLinkIndex, 3);
      const candidateFicheIds = ficheCandidates.map((candidate) => candidate.ficheId);
      const errors = candidateFicheIds.length === 0 ? ["no_fiche_candidate"] : [];

      return {
        kind: "fiche_link",
        questionId: question.id,
        questionText: question.questionText,
        exams: question.exams || [],
        reviewStatusBefore: question.reviewStatus || "pending",
        createdAt: new Date().toISOString(),
        accepted: false,
        questionProfile,
        candidateFicheIds,
        suggestion: {
          relatedFicheIds: candidateFicheIds,
          candidateFicheIds,
          ficheCandidates,
        },
        validation: {
          valid: errors.length === 0,
          errors,
          warnings: [],
        },
      };
    }),
  };

  const baseName =
    `question-fiche-links.${args.status || "pending"}${args.runId ? `.${args.runId}` : ""}`;
  const jsonPath = join(SUGGESTIONS_DIR, `${baseName}.json`);
  const mdPath = join(SUGGESTIONS_DIR, `${baseName}.md`);

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  writeFileSync(mdPath, buildMarkdownReport(payload), "utf-8");

  console.log(`Suggested fiche links for ${payload.items.length} questions`);
  console.log(`Written ${jsonPath}`);
  console.log(`Written ${mdPath}`);
}

main();
