#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

import {
  DEFAULT_STATE_REL_PATH,
  SOURCE_CONFIGS,
  buildWorkflowScaffold,
  getQueueEntries,
  syncWorkflowState,
} from "./lib/qcm-workflow-state.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

function parseArgs(argv) {
  const args = {
    state: join(ROOT, DEFAULT_STATE_REL_PATH),
    bank: join(ROOT, "data-init", "question-bank.json"),
    suggestionsDir: join(ROOT, "data-init", "suggestions"),
    source: "",
    phase: "",
    limit: 20,
    json: false,
    scaffold: false,
    output: "",
    force: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === "--state" && next) {
      args.state = next
      i += 1
      continue
    }
    if (arg === "--bank" && next) {
      args.bank = next
      i += 1
      continue
    }
    if (arg === "--suggestions-dir" && next) {
      args.suggestionsDir = next
      i += 1
      continue
    }
    if (arg === "--source" && next) {
      args.source = next
      i += 1
      continue
    }
    if (arg === "--phase" && next) {
      args.phase = next
      i += 1
      continue
    }
    if (arg === "--limit" && next) {
      args.limit = Math.max(1, parseInt(next, 10) || 20)
      i += 1
      continue
    }
    if (arg === "--output" && next) {
      args.output = next
      i += 1
      continue
    }
    if (arg === "--json") {
      args.json = true
      continue
    }
    if (arg === "--scaffold") {
      args.scaffold = true
      continue
    }
    if (arg === "--force") {
      args.force = true
    }
  }

  return args
}

function printSummary(state, statePath) {
  console.log(`State: ${statePath}`)
  console.log(`Updated: ${state.updatedAt}`)
  console.log(`Phase: ${state.workflow.currentPhase}`)
  console.log(`Next action: ${state.workflow.nextAction}`)
  console.log(`Frontend: ${state.workflow.frontendStatus}`)
  console.log(
    `Counts: total=${state.workflow.counts.totalQuestions}, linked=${state.workflow.counts.linkedQuestions}, drafted=${state.workflow.counts.draftedQuestions}, applied=${state.workflow.counts.appliedQuestions}`,
  )

  for (const [sourceKey, source] of Object.entries(state.sources || {})) {
    const questions = Object.values(source.questions || {})
    const linked = questions.filter((entry) => entry.linkStatus === "linked").length
    const ready = questions.filter((entry) => entry.qcmStatus === "ready_for_qcm").length
    const drafted = questions.filter((entry) => entry.qcmStatus === "drafted").length
    const applied = questions.filter((entry) => entry.qcmStatus === "applied").length
    console.log(
      `- ${sourceKey}: linking=${source.linkingStatus}, questions=${questions.length}, linked=${linked}, ready=${ready}, drafted=${drafted}, applied=${applied}`,
    )
  }
}

function writeScaffold(outputPath, payload, force) {
  if (existsSync(outputPath) && !force) {
    throw new Error(`Refusing to overwrite existing scaffold: ${outputPath}. Use --force to replace it.`)
  }
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf-8")
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if ((args.source && !args.phase) || (!args.source && args.phase)) {
    throw new Error("Use --source and --phase together.")
  }

  const { state, bank, statePath } = syncWorkflowState({
    rootDir: ROOT,
    statePath: args.state,
    bankPath: args.bank,
    suggestionsDir: args.suggestionsDir,
  })

  let response = {
    statePath,
    workflow: state.workflow,
  }

  if (args.source && args.phase) {
    const queue = getQueueEntries(state, bank, {
      sourceKey: args.source,
      phase: args.phase,
      limit: args.limit,
    })
    const scaffold = buildWorkflowScaffold(state, bank, {
      sourceKey: args.source,
      phase: args.phase,
      limit: args.limit,
    })

    response = {
      ...response,
      sourceKey: args.source,
      phase: args.phase,
      availableSources: Object.keys(SOURCE_CONFIGS),
      recommendedId: scaffold.recommendedId,
      recommendedOutputPath: scaffold.recommendedOutputPath,
      queueLength: queue.length,
      queue,
    }

    if (args.scaffold) {
      const outputPath = args.output || join(ROOT, scaffold.recommendedOutputPath)
      writeScaffold(outputPath, scaffold.payload, args.force)
      response.scaffoldPath = outputPath
    }
  }

  if (args.json) {
    console.log(JSON.stringify(response, null, 2))
    return
  }

  printSummary(state, statePath)

  if (args.source && args.phase) {
    console.log(`Selection: source=${args.source}, phase=${args.phase}, count=${response.queueLength}`)
    console.log(`Recommended output: ${response.recommendedOutputPath}`)
    if (response.queueLength === 0) {
      console.log(`No queued questions for ${args.source}/${args.phase}.`)
    } else {
      for (const item of response.queue) {
        console.log(`  - ${item.questionId} (#${item.globalNumber ?? "?"}) ${item.questionText}`)
      }
    }
    if (response.scaffoldPath) {
      console.log(`Scaffold written: ${response.scaffoldPath}`)
    }
  }
}

try {
  main()
} catch (error) {
  console.error(String(error?.message || error))
  process.exit(1)
}
