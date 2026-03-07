#!/usr/bin/env node

import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  buildWorkflowScaffold,
  getQueueEntries,
  loadWorkflowState,
  markSuggestionFileApplied,
  markWorkflowBundled,
  syncWorkflowState,
} from "./lib/qcm-workflow-state.mjs"

const ROOT = process.cwd()

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf-8")
}

function makeTempWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), "formation-civique-qcm-state-"))
  const suggestionsDir = join(dir, "suggestions")
  mkdirSync(suggestionsDir, { recursive: true })
  return {
    dir,
    bankPath: join(dir, "question-bank.json"),
    statePath: join(dir, "qcm-workflow-state.json"),
    suggestionsDir,
  }
}

function makeMiniBank() {
  return [
    {
      id: "crx001",
      themeId: "principes-et-valeurs",
      themeName: "Principes et valeurs de la République",
      questionText: "Parmi les propositions suivantes, laquelle constitue une participation citoyenne ?",
      exams: ["CR"],
      sourceMetaByExam: {
        CR: {
          localNumber: 1,
          globalNumber: 1,
        },
      },
      answerPools: {
        correct: ["Réponse à compléter (source officielle non enrichie)"],
        distractors: [
          "Une proposition incorrecte liée aux valeurs républicaines",
          "Une proposition incorrecte liée aux symboles officiels",
          "Une proposition incorrecte liée aux libertés publiques",
        ],
      },
      relatedFicheIds: [],
      reviewStatus: "pending",
    },
    {
      id: "crx002",
      themeId: "principes-et-valeurs",
      themeName: "Principes et valeurs de la République",
      questionText: "Que garantit la liberté d’expression ?",
      exams: ["CR"],
      sourceMetaByExam: {
        CR: {
          localNumber: 2,
          globalNumber: 2,
        },
      },
      answerPools: {
        correct: ["Réponse à compléter (source officielle non enrichie)"],
        distractors: [
          "Une proposition incorrecte liée aux valeurs républicaines",
          "Une proposition incorrecte liée aux symboles officiels",
          "Une proposition incorrecte liée aux libertés publiques",
        ],
      },
      relatedFicheIds: ["fiche-liberte-expression"],
      reviewStatus: "pending",
    },
    {
      id: "natx001",
      themeId: "droits-et-devoirs",
      themeName: "Droits et devoirs",
      questionText: "Que contient la Constitution ?",
      exams: ["NAT"],
      sourceMetaByExam: {
        NAT: {
          localNumber: 1,
          globalNumber: 1,
        },
      },
      answerPools: {
        correct: ["Les règles d’organisation des pouvoirs publics et les droits fondamentaux."],
        distractors: [
          "La liste complète des prénoms autorisés en France.",
          "Le programme détaillé de chaque école publique.",
          "Le tarif annuel unique de tous les impôts locaux.",
        ],
      },
      relatedFicheIds: ["fiche-constitution"],
      reviewStatus: "reviewed",
    },
  ]
}

function testInitialSyncAndQueues() {
  const temp = makeTempWorkspace()
  writeJson(temp.bankPath, makeMiniBank())

  const { state, bank } = syncWorkflowState({
    rootDir: ROOT,
    statePath: temp.statePath,
    bankPath: temp.bankPath,
    suggestionsDir: temp.suggestionsDir,
  })

  assert.equal(state.workflow.currentPhase, "linking")
  assert.equal(state.workflow.counts.totalQuestions, 3)
  assert.equal(state.workflow.counts.linkedQuestions, 2)
  assert.equal(state.workflow.counts.draftedQuestions, 1)
  assert.equal(state.workflow.counts.appliedQuestions, 1)

  const linkingQueue = getQueueEntries(state, bank, {
    sourceKey: "cr",
    phase: "linking",
    limit: 5,
  })
  assert.deepEqual(linkingQueue.map((item) => item.questionId), ["crx001"])

  const answerQueue = getQueueEntries(state, bank, {
    sourceKey: "cr",
    phase: "answers",
    limit: 5,
  })
  assert.deepEqual(answerQueue.map((item) => item.questionId), ["crx002"])
}

function testScaffoldIgnoredUntilCompleted() {
  const temp = makeTempWorkspace()
  writeJson(temp.bankPath, makeMiniBank())

  let synced = syncWorkflowState({
    rootDir: ROOT,
    statePath: temp.statePath,
    bankPath: temp.bankPath,
    suggestionsDir: temp.suggestionsDir,
  })

  const scaffold = buildWorkflowScaffold(synced.state, synced.bank, {
    sourceKey: "cr",
    phase: "answers",
    limit: 20,
  })
  const scaffoldPath = join(temp.suggestionsDir, `answer-pools.pending.${scaffold.recommendedId}.json`)
  writeJson(scaffoldPath, scaffold.payload)

  synced = syncWorkflowState({
    rootDir: ROOT,
    statePath: temp.statePath,
    bankPath: temp.bankPath,
    suggestionsDir: temp.suggestionsDir,
  })
  assert.equal(synced.state.sources.cr.questions.crx002.qcmStatus, "ready_for_qcm")
  assert.equal(synced.state.batches.length, 0)

  const completedPayload = JSON.parse(readFileSync(scaffoldPath, "utf-8"))
  completedPayload.workflowStatus = "completed"
  writeJson(scaffoldPath, completedPayload)

  synced = syncWorkflowState({
    rootDir: ROOT,
    statePath: temp.statePath,
    bankPath: temp.bankPath,
    suggestionsDir: temp.suggestionsDir,
  })
  assert.equal(synced.state.sources.cr.questions.crx002.qcmStatus, "drafted")
  assert.equal(synced.state.batches.length, 1)
  assert.equal(synced.state.batches[0].batchId, scaffold.recommendedId)
}

function testLinkingThenApplyThenBundle() {
  const temp = makeTempWorkspace()
  writeJson(temp.bankPath, makeMiniBank())

  let synced = syncWorkflowState({
    rootDir: ROOT,
    statePath: temp.statePath,
    bankPath: temp.bankPath,
    suggestionsDir: temp.suggestionsDir,
  })

  const answerScaffold = buildWorkflowScaffold(synced.state, synced.bank, {
    sourceKey: "cr",
    phase: "answers",
    limit: 20,
  })
  const answerPath = join(temp.suggestionsDir, `answer-pools.pending.${answerScaffold.recommendedId}.json`)
  answerScaffold.payload.workflowStatus = "completed"
  writeJson(answerPath, answerScaffold.payload)

  writeJson(join(temp.suggestionsDir, "question-fiche-links.cr.r001.json"), {
    kind: "qcm_fiche_link_batch",
    workflowStatus: "completed",
    sourceKey: "cr",
    runId: "r001",
    generatedAt: "2026-03-07T00:00:00.000Z",
    source: {
      questionSourcePath: "data-init/questions/cr.md",
    },
    items: [
      {
        questionId: "crx001",
        questionText: "Parmi les propositions suivantes, laquelle constitue une participation citoyenne ?",
        questionProfile: "definition",
        candidateFicheIds: ["fiche-citoyennete"],
        relatedFicheIds: ["fiche-citoyennete"],
        reasons: ["La fiche couvre la participation citoyenne."],
      },
    ],
  })

  synced = syncWorkflowState({
    rootDir: ROOT,
    statePath: temp.statePath,
    bankPath: temp.bankPath,
    suggestionsDir: temp.suggestionsDir,
  })

  assert.equal(synced.state.sources.cr.questions.crx001.linkStatus, "linked")
  assert.equal(synced.state.sources.cr.questions.crx001.qcmStatus, "ready_for_qcm")
  assert.equal(synced.state.workflow.currentPhase, "answer_generation")
  assert.equal(synced.state.workflow.nextAction, "continue_answer_generation")

  markSuggestionFileApplied(temp.statePath, answerPath, ROOT, ["crx001", "crx002"])
  let state = loadWorkflowState(temp.statePath)
  assert.ok(state, "state should exist after apply mark")
  assert.equal(state.workflow.currentPhase, "review_apply_bundle")
  assert.equal(state.workflow.nextAction, "bundle_frontend")
  assert.equal(state.workflow.frontendStatus, "bank_ready")

  markWorkflowBundled(temp.statePath)
  state = loadWorkflowState(temp.statePath)
  assert.ok(state, "state should exist after bundle mark")
  assert.equal(state.workflow.currentPhase, "done")
  assert.equal(state.workflow.nextAction, "done")
  assert.equal(state.workflow.frontendStatus, "bundled")
}

testInitialSyncAndQueues()
testScaffoldIgnoredUntilCompleted()
testLinkingThenApplyThenBundle()

console.log("qcm workflow state tests passed")
