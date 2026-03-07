import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import { dirname, join, relative } from "path"

import { classifyQuestionProfile, dedupe, hasPlaceholderInOptions } from "./qcm-workflow.mjs"

export const DEFAULT_STATE_REL_PATH = "data-init/suggestions/qcm-workflow-state.json"

export const SOURCE_CONFIGS = {
  cr: {
    key: "cr",
    examCode: "CR",
    questionSourcePath: "data-init/questions/cr.md",
  },
  csp: {
    key: "csp",
    examCode: "CSP",
    questionSourcePath: "data-init/questions/csp.md",
  },
  naturalisation: {
    key: "naturalisation",
    examCode: "NAT",
    questionSourcePath: "data-init/questions/naturalisation.md",
  },
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toRepoRelative(rootDir, targetPath) {
  return relative(rootDir, targetPath).replace(/\\/g, "/")
}

function parseJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf-8"))
}

function scanJsonFiles(dirPath) {
  if (!existsSync(dirPath)) return []
  return readdirSync(dirPath)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => join(dirPath, entry))
    .filter((fullPath) => statSync(fullPath).isFile())
}

function inferLinkStatus(entry) {
  if (asArray(entry.relatedFicheIds).length > 0) return "linked"
  if (asArray(entry.candidateFicheIds).length > 0) return "needs_review"
  return "not_started"
}

function inferBaseQcmStatus(question, linkStatus) {
  if (hasAppliedAnswer(question)) return "applied"
  if (linkStatus === "linked") return "ready_for_qcm"
  return "not_ready"
}

function hasAppliedAnswer(question) {
  const correct = asArray(question?.answerPools?.correct)
  const distractors = asArray(question?.answerPools?.distractors)
  if (correct.length !== 1 || distractors.length !== 3) return false
  return !hasPlaceholderInOptions(correct, distractors)
}

function buildQuestionEntry(question, previousEntry = {}) {
  const relatedFicheIds = dedupe([
    ...asArray(previousEntry.relatedFicheIds),
    ...asArray(question.relatedFicheIds),
  ])
  const candidateFicheIds = dedupe([
    ...asArray(previousEntry.candidateFicheIds),
    ...relatedFicheIds,
  ])
  const linkStatus = inferLinkStatus({ relatedFicheIds, candidateFicheIds })
  const baseQcmStatus = inferBaseQcmStatus(question, linkStatus)
  const preservedDraftState =
    previousEntry.qcmStatus === "drafted" || previousEntry.qcmStatus === "blocked"
      ? previousEntry.qcmStatus
      : null

  return {
    questionText: question.questionText,
    questionProfile:
      previousEntry.questionProfile ||
      question.questionProfile ||
      classifyQuestionProfile(question.questionText),
    linkStatus,
    candidateFicheIds,
    relatedFicheIds,
    lastLinkOutput: previousEntry.lastLinkOutput || null,
    qcmStatus: hasAppliedAnswer(question) ? "applied" : preservedDraftState || baseQcmStatus,
    batchId: previousEntry.batchId || null,
    lastAnswerOutput: previousEntry.lastAnswerOutput || null,
    notes: dedupe(asArray(previousEntry.notes)),
  }
}

export function resolveSourceKey(value) {
  const normalized = String(value || "").trim().toLowerCase()
  if (!normalized) return null
  if (normalized in SOURCE_CONFIGS) return normalized
  if (normalized === "nat") return "naturalisation"
  if (normalized === "cr" || normalized === "csp" || normalized === "naturalisation") return normalized

  for (const config of Object.values(SOURCE_CONFIGS)) {
    if (normalized === config.examCode.toLowerCase()) return config.key
  }

  return null
}

export function loadQuestionBank(bankPath) {
  return parseJsonFile(bankPath)
}

export function listSourceQuestions(bank, sourceKey) {
  const config = SOURCE_CONFIGS[sourceKey]
  if (!config) throw new Error(`Unknown source key "${sourceKey}"`)

  return bank
    .filter((question) => asArray(question.exams).includes(config.examCode))
    .sort((left, right) => {
      const leftMeta = left?.sourceMetaByExam?.[config.examCode] || {}
      const rightMeta = right?.sourceMetaByExam?.[config.examCode] || {}
      const leftGlobal = Number.isFinite(leftMeta.globalNumber) ? leftMeta.globalNumber : Number.MAX_SAFE_INTEGER
      const rightGlobal = Number.isFinite(rightMeta.globalNumber) ? rightMeta.globalNumber : Number.MAX_SAFE_INTEGER
      if (leftGlobal !== rightGlobal) return leftGlobal - rightGlobal
      const leftLocal = Number.isFinite(leftMeta.localNumber) ? leftMeta.localNumber : Number.MAX_SAFE_INTEGER
      const rightLocal = Number.isFinite(rightMeta.localNumber) ? rightMeta.localNumber : Number.MAX_SAFE_INTEGER
      if (leftLocal !== rightLocal) return leftLocal - rightLocal
      return String(left.id || "").localeCompare(String(right.id || ""))
    })
}

function compareWorkflowFiles(left, right) {
  const leftGeneratedAt = left.generatedAt ? Date.parse(left.generatedAt) : 0
  const rightGeneratedAt = right.generatedAt ? Date.parse(right.generatedAt) : 0
  if (leftGeneratedAt !== rightGeneratedAt) return leftGeneratedAt - rightGeneratedAt
  return left.mtimeMs - right.mtimeMs
}

function normalizeLinkItem(item = {}) {
  return {
    questionId: String(item.questionId || "").trim(),
    questionText: String(item.questionText || "").trim(),
    questionProfile: String(item.questionProfile || "").trim(),
    candidateFicheIds: dedupe(
      asArray(item.candidateFicheIds).concat(asArray(item?.suggestion?.candidateFicheIds)),
    ),
    relatedFicheIds: dedupe(
      asArray(item.relatedFicheIds).concat(asArray(item?.suggestion?.relatedFicheIds)),
    ),
    reasons: dedupe(asArray(item.reasons)),
  }
}

function normalizeAnswerItem(item = {}) {
  return {
    questionId: String(item.questionId || "").trim(),
    questionText: String(item.questionText || "").trim(),
    questionProfile:
      String(item?.suggestion?.questionProfile || item.questionProfile || "").trim(),
    candidateFicheIds: dedupe(
      asArray(item.candidateFicheIds).concat(asArray(item?.suggestion?.candidateFicheIds)),
    ),
    relatedFicheIds: dedupe(
      asArray(item.relatedFicheIds).concat(asArray(item?.suggestion?.relatedFicheIds)),
    ),
    notes: dedupe(asArray(item.notes)),
  }
}

function normalizeSkippedItem(item = {}) {
  return {
    questionId: String(item.questionId || "").trim(),
    questionText: String(item.questionText || "").trim(),
    questionProfile: String(item.questionProfile || "").trim(),
    relatedFicheIds: dedupe(asArray(item.relatedFicheIds)),
    notes: dedupe(
      asArray(item.notes).concat(item.blockReason ? [String(item.blockReason)] : []),
    ),
  }
}

function findQuestionEntry(state, questionId, preferredSourceKey = null) {
  if (preferredSourceKey && state.sources?.[preferredSourceKey]?.questions?.[questionId]) {
    return {
      sourceKey: preferredSourceKey,
      entry: state.sources[preferredSourceKey].questions[questionId],
    }
  }

  for (const [sourceKey, source] of Object.entries(state.sources || {})) {
    if (source?.questions?.[questionId]) {
      return {
        sourceKey,
        entry: source.questions[questionId],
      }
    }
  }

  return null
}

function collectLinkPayloads(rootDir, suggestionsDir) {
  return scanJsonFiles(suggestionsDir)
    .map((filePath) => {
      const payload = parseJsonFile(filePath)
      if (payload?.kind !== "qcm_fiche_link_batch" || payload?.workflowStatus === "scaffold") return null
      return {
        path: filePath,
        relPath: toRepoRelative(rootDir, filePath),
        mtimeMs: statSync(filePath).mtimeMs,
        generatedAt: payload.generatedAt || "",
        payload,
      }
    })
    .filter(Boolean)
    .sort(compareWorkflowFiles)
}

function collectAnswerPayloads(rootDir, suggestionsDir) {
  return scanJsonFiles(suggestionsDir)
    .map((filePath) => {
      const payload = parseJsonFile(filePath)
      if (payload?.kind !== "qcm_answer_batch" || payload?.workflowStatus === "scaffold") return null
      return {
        path: filePath,
        relPath: toRepoRelative(rootDir, filePath),
        mtimeMs: statSync(filePath).mtimeMs,
        generatedAt: payload.generatedAt || "",
        payload,
      }
    })
    .filter(Boolean)
    .sort(compareWorkflowFiles)
}

function buildEmptyState(previousState = {}) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    workflow: {
      currentPhase: "linking",
      nextAction: "continue_linking",
      frontendStatus: "not_ready",
      counts: {
        totalQuestions: 0,
        linkedQuestions: 0,
        draftedQuestions: 0,
        appliedQuestions: 0,
      },
    },
    sources: {},
    batches: [],
    integration: {
      readySuggestionFiles: [],
      appliedSuggestionFiles: dedupe(asArray(previousState?.integration?.appliedSuggestionFiles)),
      bankAppliedAt: previousState?.integration?.bankAppliedAt || null,
      frontendBundledAt: previousState?.integration?.frontendBundledAt || null,
    },
  }
}

function computeSourceLinkingStatus(source) {
  const entries = Object.values(source.questions || {})
  if (entries.length === 0) return "not_started"
  if (entries.every((entry) => entry.linkStatus === "linked")) return "completed"
  if (entries.every((entry) => entry.linkStatus === "not_started")) return "not_started"
  return "in_progress"
}

function recomputeWorkflow(state) {
  let totalQuestions = 0
  let linkedQuestions = 0
  let draftedQuestions = 0
  let appliedQuestions = 0
  let hasReadyForQcm = false
  let hasBlocked = false
  let unresolvedLinks = false

  for (const source of Object.values(state.sources || {})) {
    source.linkingStatus = computeSourceLinkingStatus(source)
    for (const entry of Object.values(source.questions || {})) {
      totalQuestions += 1
      if (entry.linkStatus === "linked") linkedQuestions += 1
      if (entry.qcmStatus === "drafted" || entry.qcmStatus === "applied") draftedQuestions += 1
      if (entry.qcmStatus === "applied") appliedQuestions += 1
      if (entry.qcmStatus === "ready_for_qcm") hasReadyForQcm = true
      if (entry.qcmStatus === "blocked") hasBlocked = true
      if (entry.linkStatus !== "linked") unresolvedLinks = true
    }
  }

  state.integration.readySuggestionFiles = dedupe(
    state.batches
      .filter((batch) => batch.status !== "applied")
      .map((batch) => batch.answerOutput)
      .filter(Boolean),
  )

  const allApplied = totalQuestions > 0 && appliedQuestions === totalQuestions
  const allLinked = totalQuestions > 0 && linkedQuestions === totalQuestions
  const allDrafted = totalQuestions > 0 && draftedQuestions === totalQuestions

  state.workflow.counts = {
    totalQuestions,
    linkedQuestions,
    draftedQuestions,
    appliedQuestions,
  }

  if (state.integration.frontendBundledAt && allApplied) {
    state.workflow.currentPhase = "done"
    state.workflow.nextAction = "done"
    state.workflow.frontendStatus = "bundled"
    return state
  }

  state.workflow.frontendStatus = allApplied ? "bank_ready" : "not_ready"

  if (unresolvedLinks) {
    state.workflow.currentPhase = "linking"
    state.workflow.nextAction = "continue_linking"
    return state
  }

  if (allLinked && hasReadyForQcm) {
    state.workflow.currentPhase = "answer_generation"
    state.workflow.nextAction = draftedQuestions > 0 ? "continue_answer_generation" : "start_answer_generation"
    return state
  }

  if (hasBlocked || state.integration.readySuggestionFiles.length > 0) {
    state.workflow.currentPhase = "review_apply_bundle"
    state.workflow.nextAction = allApplied ? "bundle_frontend" : "review_and_apply"
    return state
  }

  if (allApplied) {
    state.workflow.currentPhase = "review_apply_bundle"
    state.workflow.nextAction = state.integration.frontendBundledAt ? "done" : "bundle_frontend"
    return state
  }

  state.workflow.currentPhase = allLinked ? "answer_generation" : "linking"
  state.workflow.nextAction = allLinked ? "continue_answer_generation" : "continue_linking"
  return state
}

function applyLinkPayloadToState(state, payload, relPath) {
  const sourceKey = resolveSourceKey(payload.sourceKey || payload?.source?.key)
  for (const rawItem of asArray(payload.items)) {
    const item = normalizeLinkItem(rawItem)
    if (!item.questionId) continue
    const resolved = findQuestionEntry(state, item.questionId, sourceKey)
    if (!resolved) continue
    const { entry } = resolved

    entry.questionText = item.questionText || entry.questionText
    entry.questionProfile = item.questionProfile || entry.questionProfile
    entry.candidateFicheIds = item.candidateFicheIds
    entry.relatedFicheIds = item.relatedFicheIds
    entry.linkStatus = inferLinkStatus(entry)
    entry.lastLinkOutput = relPath
    entry.notes = dedupe([...entry.notes, ...item.reasons])
    if (entry.qcmStatus === "not_ready" && entry.linkStatus === "linked") {
      entry.qcmStatus = "ready_for_qcm"
    }
  }
}

function applyAnswerPayloadToState(state, payload, relPath) {
  const sourceKey = resolveSourceKey(payload.sourceKey)
  const batchId = String(payload.batchId || "").trim() || inferBatchIdFromPath(relPath)
  const questionIds = []
  const createdAt = payload.generatedAt || new Date().toISOString()

  for (const rawItem of asArray(payload.items)) {
    const item = normalizeAnswerItem(rawItem)
    if (!item.questionId) continue
    const resolved = findQuestionEntry(state, item.questionId, sourceKey)
    if (!resolved) continue
    const { entry } = resolved

    questionIds.push(item.questionId)
    entry.questionText = item.questionText || entry.questionText
    entry.questionProfile = item.questionProfile || entry.questionProfile
    entry.candidateFicheIds = dedupe([...entry.candidateFicheIds, ...item.candidateFicheIds])
    entry.relatedFicheIds = dedupe([...entry.relatedFicheIds, ...item.relatedFicheIds])
    entry.linkStatus = inferLinkStatus(entry)
    entry.batchId = batchId || entry.batchId
    entry.lastAnswerOutput = relPath
    entry.notes = dedupe([...entry.notes, ...item.notes])
    if (entry.qcmStatus !== "applied") entry.qcmStatus = "drafted"
  }

  for (const rawSkipped of asArray(payload.skipped)) {
    const skipped = normalizeSkippedItem(rawSkipped)
    if (!skipped.questionId) continue
    const resolved = findQuestionEntry(state, skipped.questionId, sourceKey)
    if (!resolved) continue
    const { entry } = resolved

    entry.questionText = skipped.questionText || entry.questionText
    entry.questionProfile = skipped.questionProfile || entry.questionProfile
    entry.relatedFicheIds = dedupe([...entry.relatedFicheIds, ...skipped.relatedFicheIds])
    entry.linkStatus = inferLinkStatus(entry)
    entry.batchId = batchId || entry.batchId
    entry.lastAnswerOutput = relPath
    entry.notes = dedupe([...entry.notes, ...skipped.notes])
    if (entry.qcmStatus !== "applied") entry.qcmStatus = "blocked"
    questionIds.push(skipped.questionId)
  }

  if (!batchId) return

  const existing = state.batches.find((batch) => batch.batchId === batchId)
  const nextBatch = {
    batchId,
    sourceKey: sourceKey || existing?.sourceKey || null,
    questionIds: dedupe(questionIds),
    status:
      state.integration.appliedSuggestionFiles.includes(relPath) || existing?.status === "applied"
        ? "applied"
        : "drafted",
    answerOutput: relPath,
    createdAt: existing?.createdAt || createdAt,
    updatedAt: payload.generatedAt || new Date().toISOString(),
  }

  if (existing) {
    Object.assign(existing, nextBatch)
  } else {
    state.batches.push(nextBatch)
  }
}

function overlayAppliedBankState(state, bank) {
  const appliedIds = new Set(bank.filter((question) => hasAppliedAnswer(question)).map((question) => question.id))
  for (const source of Object.values(state.sources || {})) {
    for (const [questionId, entry] of Object.entries(source.questions || {})) {
      if (appliedIds.has(questionId)) {
        entry.qcmStatus = "applied"
      } else if (entry.qcmStatus === "applied") {
        entry.qcmStatus = entry.linkStatus === "linked" ? "ready_for_qcm" : "not_ready"
      }
    }
  }

  for (const batch of state.batches) {
    const allQuestionsApplied =
      batch.questionIds.length > 0 &&
      batch.questionIds.every((questionId) => {
        const resolved = findQuestionEntry(state, questionId, batch.sourceKey)
        return resolved?.entry?.qcmStatus === "applied"
      })
    if (allQuestionsApplied) batch.status = "applied"
  }
}

function inferBatchIdFromPath(relPath) {
  const match = relPath.match(/answer-pools\.pending\.([^.]+)\.json$/)
  return match ? match[1] : ""
}

function nextSerial(existingIds, prefix, suffix) {
  let max = 0
  for (const id of existingIds) {
    const match = String(id || "").match(new RegExp(`^${prefix}(\\d{3})${suffix}$`))
    if (!match) continue
    max = Math.max(max, parseInt(match[1], 10) || 0)
  }
  return String(max + 1).padStart(3, "0")
}

export function nextLinkRunId(state, sourceKey) {
  const existing = scanQuestionOutputIds(state, sourceKey, "lastLinkOutput")
  return `r${nextSerial(existing, "r", "")}`
}

export function nextAnswerBatchId(state, sourceKey) {
  const existing = state.batches
    .filter((batch) => batch.sourceKey === sourceKey)
    .map((batch) => batch.batchId)
  return `${sourceKey}-b${nextSerial(existing, `${sourceKey}-b`, "")}`
}

function scanQuestionOutputIds(state, sourceKey, fieldName) {
  const out = []
  for (const entry of Object.values(state.sources?.[sourceKey]?.questions || {})) {
    const relPath = entry?.[fieldName]
    if (!relPath) continue
    const match = String(relPath).match(/\.([^.]+)\.json$/)
    if (match) out.push(match[1])
  }
  return out
}

export function syncWorkflowState({
  rootDir,
  statePath = join(rootDir, DEFAULT_STATE_REL_PATH),
  bankPath = join(rootDir, "data-init", "question-bank.json"),
  suggestionsDir = join(rootDir, "data-init", "suggestions"),
} = {}) {
  const previousState = existsSync(statePath) ? parseJsonFile(statePath) : null
  const bank = loadQuestionBank(bankPath)
  const state = buildEmptyState(previousState || {})

  for (const sourceKey of Object.keys(SOURCE_CONFIGS)) {
    const previousQuestions = previousState?.sources?.[sourceKey]?.questions || {}
    const sourceQuestions = listSourceQuestions(bank, sourceKey)
    state.sources[sourceKey] = {
      questionSourcePath: SOURCE_CONFIGS[sourceKey].questionSourcePath,
      linkingStatus: "not_started",
      questions: Object.fromEntries(
        sourceQuestions.map((question) => [question.id, buildQuestionEntry(question, previousQuestions[question.id])]),
      ),
    }
  }

  for (const file of collectLinkPayloads(rootDir, suggestionsDir)) {
    applyLinkPayloadToState(state, file.payload, file.relPath)
  }

  for (const file of collectAnswerPayloads(rootDir, suggestionsDir)) {
    applyAnswerPayloadToState(state, file.payload, file.relPath)
  }

  overlayAppliedBankState(state, bank)
  state.updatedAt = new Date().toISOString()
  recomputeWorkflow(state)

  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8")

  return {
    state,
    bank,
    statePath,
    suggestionsDir,
  }
}

export function loadWorkflowState(statePath) {
  return existsSync(statePath) ? parseJsonFile(statePath) : null
}

export function updateWorkflowStateFile(statePath, mutator) {
  const current = loadWorkflowState(statePath)
  if (!current) throw new Error(`Workflow state not found: ${statePath}`)
  const nextState = mutator(current) || current
  nextState.updatedAt = new Date().toISOString()
  recomputeWorkflow(nextState)
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, JSON.stringify(nextState, null, 2) + "\n", "utf-8")
  return nextState
}

export function markSuggestionFileApplied(statePath, inputPath, rootDir, appliedQuestionIds = []) {
  return updateWorkflowStateFile(statePath, (state) => {
    const relPath = toRepoRelative(rootDir, inputPath)
    state.integration.appliedSuggestionFiles = dedupe([
      ...asArray(state.integration.appliedSuggestionFiles),
      relPath,
    ])
    state.integration.bankAppliedAt = new Date().toISOString()
    state.integration.readySuggestionFiles = asArray(state.integration.readySuggestionFiles).filter(
      (path) => path !== relPath,
    )

    for (const source of Object.values(state.sources || {})) {
      for (const [questionId, entry] of Object.entries(source.questions || {})) {
        if (appliedQuestionIds.includes(questionId)) {
          entry.qcmStatus = "applied"
        }
      }
    }

    for (const batch of asArray(state.batches)) {
      if (batch.answerOutput === relPath) {
        batch.status = "applied"
        batch.updatedAt = new Date().toISOString()
      }
    }

    return state
  })
}

export function markWorkflowBundled(statePath) {
  return updateWorkflowStateFile(statePath, (state) => {
    state.integration.frontendBundledAt = new Date().toISOString()
    return state
  })
}

export function getQueueEntries(state, bank, { sourceKey, phase, limit = 20 } = {}) {
  const resolvedSourceKey = resolveSourceKey(sourceKey)
  if (!resolvedSourceKey) throw new Error(`Unknown source key "${sourceKey}"`)
  const config = SOURCE_CONFIGS[resolvedSourceKey]
  const sourceQuestions = listSourceQuestions(bank, resolvedSourceKey)
  const queued = []

  for (const question of sourceQuestions) {
    const entry = state.sources?.[resolvedSourceKey]?.questions?.[question.id]
    if (!entry) continue

    if (phase === "linking" && entry.linkStatus === "linked") continue
    if (phase === "answers" && entry.qcmStatus !== "ready_for_qcm") continue

    queued.push({
      questionId: question.id,
      questionText: question.questionText,
      questionProfile: entry.questionProfile,
      candidateFicheIds: asArray(entry.candidateFicheIds),
      relatedFicheIds: asArray(entry.relatedFicheIds),
      linkStatus: entry.linkStatus,
      qcmStatus: entry.qcmStatus,
      sourceKey: resolvedSourceKey,
      questionSourcePath: config.questionSourcePath,
      localNumber: question?.sourceMetaByExam?.[config.examCode]?.localNumber ?? null,
      globalNumber: question?.sourceMetaByExam?.[config.examCode]?.globalNumber ?? null,
      batchId: entry.batchId || null,
      notes: asArray(entry.notes),
    })
    if (queued.length >= limit) break
  }

  return queued
}

export function buildWorkflowScaffold(state, bank, { sourceKey, phase, limit = 20 } = {}) {
  const resolvedSourceKey = resolveSourceKey(sourceKey)
  if (!resolvedSourceKey) throw new Error(`Unknown source key "${sourceKey}"`)
  const queue = getQueueEntries(state, bank, {
    sourceKey: resolvedSourceKey,
    phase,
    limit,
  })

  if (phase === "linking") {
    const runId = nextLinkRunId(state, resolvedSourceKey)
    const outputPath = `data-init/suggestions/question-fiche-links.${resolvedSourceKey}.${runId}.json`
    return {
      phase,
      sourceKey: resolvedSourceKey,
      recommendedId: runId,
      recommendedOutputPath: outputPath,
      payload: {
        kind: "qcm_fiche_link_batch",
        workflowStatus: "scaffold",
        sourceKey: resolvedSourceKey,
        runId,
        generatedAt: new Date().toISOString(),
        source: {
          questionSourcePath: SOURCE_CONFIGS[resolvedSourceKey].questionSourcePath,
        },
        items: queue.map((item) => ({
          questionId: item.questionId,
          questionText: item.questionText,
          questionProfile: item.questionProfile,
          candidateFicheIds: item.candidateFicheIds,
          relatedFicheIds: item.relatedFicheIds,
          reasons: item.notes,
        })),
      },
    }
  }

  if (phase === "answers") {
    const batchId = nextAnswerBatchId(state, resolvedSourceKey)
    const outputPath = `data-init/suggestions/answer-pools.pending.${batchId}.json`
    return {
      phase,
      sourceKey: resolvedSourceKey,
      recommendedId: batchId,
      recommendedOutputPath: outputPath,
      payload: {
        kind: "qcm_answer_batch",
        workflowStatus: "scaffold",
        sourceKey: resolvedSourceKey,
        batchId,
        generatedAt: new Date().toISOString(),
        items: queue.map((item) => ({
          kind: "answer_pool",
          questionId: item.questionId,
          questionText: item.questionText,
          questionProfile: item.questionProfile,
          candidateFicheIds: item.candidateFicheIds,
          relatedFicheIds: item.relatedFicheIds,
          accepted: false,
          suggestion: {
            questionProfile: item.questionProfile,
            candidateFicheIds: item.candidateFicheIds,
            relatedFicheIds: item.relatedFicheIds,
            correct: [],
            distractors: [],
            answerEvidence: [],
            questionEvidence: [],
            qualityFlags: [],
          },
        })),
        skipped: [],
      },
    }
  }

  throw new Error(`Unsupported phase "${phase}"`)
}
