#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  buildFicheLinkIndex,
  loadAllFiches,
  normalize,
  scoreQuestionToFicheCandidates,
  scoreSectionsForQuestion,
} from "./lib/qcm-workflow.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const SECTION_INDEX_PATH = join(ROOT, "data-init", "fiches-section-index.json");

const bank = JSON.parse(readFileSync(BANK_PATH, "utf-8"));
const sectionIndex = JSON.parse(readFileSync(SECTION_INDEX_PATH, "utf-8"));

function runNode(args, cwd = ROOT) {
  return spawnSync("node", args, {
    cwd,
    encoding: "utf-8",
  });
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function assertStatusOk(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "formation-civique-qcm-"));
}

function testLinkingForCrx005() {
  const fiches = loadAllFiches(ROOT);
  const ficheIndex = buildFicheLinkIndex(fiches);
  const question = bank.find((item) => item.id === "crx005");
  assert.ok(question, "crx005 should exist");

  const candidates = scoreQuestionToFicheCandidates(question, ficheIndex, 3);
  assert.equal(candidates.length, 3, "crx005 should return three fiche candidates");
  assert.ok(
    candidates.every((candidate) =>
      candidate.ficheId.startsWith("principes-et-valeurs--les-symboles-de-la-republique--"),
    ),
    `crx005 should rank symboles de la Republique fiches first: ${JSON.stringify(candidates, null, 2)}`,
  );
  assert.ok(
    candidates.every((candidate) => !candidate.ficheId.includes("formation")),
    "crx005 should exclude formation fiches from top candidates",
  );
}

function testSectionsStayInsideValidatedShortlist() {
  const question = bank.find(
    (item) => item.reviewStatus === "pending" && Array.isArray(item.relatedFicheIds) && item.relatedFicheIds.length > 0,
  );
  assert.ok(question, "Need a pending linked question to test section shortlist");

  const allowed = new Set(question.relatedFicheIds);
  const sections = scoreSectionsForQuestion(question, sectionIndex, question.relatedFicheIds, 8);
  assert.ok(sections.length > 0, "Expected shortlisted sections for linked question");
  for (const section of sections) {
    assert.ok(
      (section.originalFicheIds || []).some((ficheId) => allowed.has(ficheId)),
      `Section ${section.contentPath}#${section.sectionId} escaped validated fiche shortlist`,
    );
  }
}

function testValidatorMarksLengthCueForWebsiteProfile() {
  const tempDir = makeTempDir();
  const inputPath = join(tempDir, "length-cue.json");
  const outputPath = join(tempDir, "length-cue.validated.json");
  const ficheId = "principes-et-valeurs--les-symboles-de-la-republique--le-coq";
  const quote =
    "Le coq n’est pas reconnu de manière officielle comme un symbole de la République française, contrairement au drapeau tricolore, à Marianne ou à la devise nationale.";

  writeJson(inputPath, {
    items: [
      {
        kind: "answer_pool",
        questionId: "length-cue",
        questionText: "Sur quel site internet peut-on retrouver le symbole de la République française ?",
        reviewStatusBefore: "pending",
        questionProfile: "website",
        candidateFicheIds: [ficheId],
        suggestion: {
          questionProfile: "website",
          candidateFicheIds: [ficheId],
          correct: ["Le site internet de France VAE avec le logo officiel de la République française"],
          distractors: ["elysee.fr", "service-public.fr", "gouvernement.fr"],
          explanationByCorrect: {
            "Le site internet de France VAE avec le logo officiel de la République française":
              "Exemple volontairement trop long pour tester le bucket de revue.",
          },
          answerEvidence: [
            {
              answerText: "Le site internet de France VAE avec le logo officiel de la République française",
              normalizedAnswer: normalize("Le site internet de France VAE avec le logo officiel de la République française"),
              evidence: [
                {
                  ficheId,
                  contentPath: "principes-et-valeurs/les-symboles-de-la-republique/le-coq.md",
                  sectionId: "un-symbole-non-officiel",
                  sectionTitle: "Un symbole non officiel",
                  quote,
                },
              ],
            },
          ],
          questionEvidence: [
            {
              ficheId,
              contentPath: "principes-et-valeurs/les-symboles-de-la-republique/le-coq.md",
              sectionId: "un-symbole-non-officiel",
              sectionTitle: "Un symbole non officiel",
              quote,
            },
          ],
          relatedFicheIds: [ficheId],
          qualityFlags: [],
        },
      },
    ],
  });

  const result = runNode([
    "scripts/validate-answer-pool-suggestions.mjs",
    "--input",
    inputPath,
    "--output",
    outputPath,
  ]);
  assertStatusOk(result, "validate-answer-pool-suggestions length-cue");

  const validated = loadJson(outputPath);
  const item = validated.items[0];
  assert.equal(item.validation.valid, true, "Length cue case should stay valid but require manual review");
  assert.equal(item.suggestion.reviewBucket, "manual_review_required");
  assert.ok(
    item.suggestion.reviewReasons.includes("obvious_length_cue") ||
      item.suggestion.reviewReasons.includes("visible_type_mismatch"),
    `Expected obvious length cue or visible type mismatch, got ${JSON.stringify(item.suggestion.reviewReasons)}`,
  );
}

function testValidatorRejectsPlaceholderWithoutEvidence() {
  const tempDir = makeTempDir();
  const inputPath = join(tempDir, "placeholder.json");
  const outputPath = join(tempDir, "placeholder.validated.json");
  const ficheId = "principes-et-valeurs--les-symboles-de-la-republique--le-coq";
  const quote =
    "Le coq n’est pas reconnu de manière officielle comme un symbole de la République française, contrairement au drapeau tricolore, à Marianne ou à la devise nationale.";

  writeJson(inputPath, {
    items: [
      {
        kind: "answer_pool",
        questionId: "placeholder",
        questionText: "Sur quel site internet peut-on retrouver le symbole de la République française ?",
        reviewStatusBefore: "pending",
        questionProfile: "website",
        candidateFicheIds: [ficheId],
        suggestion: {
          questionProfile: "website",
          candidateFicheIds: [ficheId],
          correct: ["Réponse à compléter (source officielle non enrichie)"],
          distractors: ["elysee.fr", "service-public.fr", "gouvernement.fr"],
          answerEvidence: [],
          questionEvidence: [
            {
              ficheId,
              contentPath: "principes-et-valeurs/les-symboles-de-la-republique/le-coq.md",
              sectionId: "un-symbole-non-officiel",
              sectionTitle: "Un symbole non officiel",
              quote,
            },
          ],
          relatedFicheIds: [ficheId],
          qualityFlags: [],
        },
      },
    ],
  });

  const result = runNode([
    "scripts/validate-answer-pool-suggestions.mjs",
    "--input",
    inputPath,
    "--output",
    outputPath,
  ]);
  assert.notEqual(result.status, 0, "Placeholder suggestion should be invalid");

  const validated = loadJson(outputPath);
  const item = validated.items[0];
  assert.equal(item.validation.valid, false);
  assert.ok(
    item.validation.errors.some((error) => error.includes("placeholder") || error.includes("missing answerEvidence")),
    `Expected placeholder/evidence errors, got ${JSON.stringify(item.validation.errors)}`,
  );
}

function testApplyAndValidateTempBank() {
  const tempDir = makeTempDir();
  const bankPath = join(tempDir, "question-bank.json");
  const suggestionsPath = join(tempDir, "answer-pools.validated.json");
  const question = bank.find((item) => item.id === "crx003");
  const ficheId = "vivre-societe-francaise--demarches-administratives--les-demarches-relatives-au-sejour-en-france";
  const correct = "Tout étranger doit disposer d’un titre de séjour valide qui correspond à sa situation.";
  const quote = "Tout étranger doit disposer d’un titre de séjour valide qui correspond à sa situation.";

  assert.ok(question, "crx003 should exist for temp bank apply test");

  writeJson(bankPath, bank);
  writeJson(suggestionsPath, {
    items: [
      {
        kind: "answer_pool",
        questionId: "crx003",
        questionText: question.questionText,
        reviewStatusBefore: question.reviewStatus,
        accepted: true,
        validation: {
          valid: true,
          errors: [],
          warnings: [],
        },
        suggestion: {
          questionProfile: "definition",
          candidateFicheIds: [ficheId],
          correct: [correct],
          distractors: [
            "Un titre de séjour donne automatiquement la nationalité française.",
            "Un titre de séjour permet de voter à toutes les élections sans condition.",
            "Un titre de séjour n’est utile que pour voyager hors de France.",
          ],
          explanationByCorrect: {
            [correct]: "Suggestion temporaire de test ancrée sur la fiche du titre de séjour.",
          },
          answerEvidence: [
            {
              answerText: correct,
              normalizedAnswer: normalize(correct),
              evidence: [
                {
                  ficheId,
                  contentPath: "vivre-societe-francaise/demarches-administratives/etat-civil-et-nationalite.md",
                  sectionId: "les-demarches-relatives-au-sejour-en-france",
                  sectionTitle: "Les démarches relatives au séjour en France",
                  quote,
                },
              ],
            },
          ],
          questionEvidence: [
            {
              ficheId,
              contentPath: "vivre-societe-francaise/demarches-administratives/etat-civil-et-nationalite.md",
              sectionId: "les-demarches-relatives-au-sejour-en-france",
              sectionTitle: "Les démarches relatives au séjour en France",
              quote,
            },
          ],
          relatedFicheIds: [ficheId],
          qualityFlags: [],
          reviewBucket: "high_confidence",
          reviewReasons: [],
          styleMetrics: {
            questionProfile: "definition",
            correctCharLength: correct.length,
            distractorCharLengths: [63, 69, 59],
            correctTokenLength: 12,
            distractorTokenLengths: [9, 11, 12],
            charLengthRatio: 0.63,
            tokenLengthRatio: 1,
            obviousLengthCue: false,
            strictProfileCheck: false,
            profileMatchCount: 4,
            optionCount: 4,
            mismatchedOptions: [],
          },
        },
      },
    ],
  });

  const applyResult = runNode([
    "scripts/apply-answer-pool-suggestions.mjs",
    "--input",
    suggestionsPath,
    "--bank",
    bankPath,
    "--accept-all",
  ]);
  assertStatusOk(applyResult, "apply-answer-pool-suggestions temp bank");

  const validateBankResult = runNode([
    "scripts/validate-question-bank.mjs",
    "--bank",
    bankPath,
  ]);
  assertStatusOk(validateBankResult, "validate-question-bank temp bank");

  const updatedBank = loadJson(bankPath);
  const updatedQuestion = updatedBank.find((item) => item.id === "crx003");
  assert.ok(updatedQuestion, "Updated question should exist in temp bank");
  assert.deepEqual(updatedQuestion.answerPools.correct, [correct]);
  assert.deepEqual(updatedQuestion.relatedFicheIds, [ficheId]);
}

function main() {
  testLinkingForCrx005();
  testSectionsStayInsideValidatedShortlist();
  testValidatorMarksLengthCueForWebsiteProfile();
  testValidatorRejectsPlaceholderWithoutEvidence();
  testApplyAndValidateTempBank();
  console.log("QCM workflow tests passed");
}

main();
