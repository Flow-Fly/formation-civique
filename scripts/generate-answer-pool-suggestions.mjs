#!/usr/bin/env node

/**
 * Generate answer-pool suggestions from validated fiche links only.
 *
 * Inputs:
 * - data-init/question-bank.json
 * - data-init/fiches-section-index.json
 *
 * Outputs:
 * - data-init/suggestions/answer-pools.<status>.<run-id>.json
 * - data-init/suggestions/answer-pools.<status>.<run-id>.md
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

import {
  buildAnswerSuggestionPrompt,
  classifyQuestionProfile,
  dedupe,
  normalize,
  scoreSectionsForQuestion,
  selectReviewedStyleExamples,
} from "./lib/qcm-workflow.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const QUESTION_BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const SECTION_INDEX_PATH = join(ROOT, "data-init", "fiches-section-index.json");
const SUGGESTIONS_DIR = join(ROOT, "data-init", "suggestions");

const PROVIDER_CONFIGS = {
  copilot: {
    defaultModel: "gpt-5",
    fastModel: "gpt-5",
    supportedModels: ["gpt-5", "claude-sonnet-4.5", "claude-sonnet-4", "claude-haiku-4.5"],
  },
  claude: {
    defaultModel: "sonnet",
    fastModel: "haiku",
    supportedModels: ["sonnet", "haiku", "opus"],
  },
  gemini: {
    defaultModel: "gemini-2.5-pro",
    fastModel: "gemini-2.5-flash",
    supportedModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
};

function parseArgs(argv) {
  const args = {
    provider: process.env.FC_QCM_PROVIDER || "copilot",
    model: process.env.FC_QCM_MODEL || "",
    status: "pending",
    runId: "",
    limit: 0,
    resume: false,
    dryRun: false,
    verbose: false,
    concurrency: 1,
    fast: false,
    sections: 10,
    examples: 3,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--provider" && next) {
      args.provider = next;
      i += 1;
      continue;
    }
    if (arg === "--model" && next) {
      args.model = next;
      i += 1;
      continue;
    }
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
    if (arg === "--concurrency" && next) {
      args.concurrency = Math.max(1, parseInt(next, 10) || 1);
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
    if (arg === "--resume") {
      args.resume = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--verbose") {
      args.verbose = true;
      continue;
    }
    if (arg === "--fast") {
      args.fast = true;
    }
  }

  return args;
}

function resolveProviderConfig(args) {
  if (args.provider === "all" || args.provider === "auto") {
    throw new Error("Multi-provider modes are disabled. Pick one explicit provider.");
  }

  const config = PROVIDER_CONFIGS[args.provider];
  if (!config) {
    throw new Error(`Unsupported provider "${args.provider}". Supported: ${Object.keys(PROVIDER_CONFIGS).join(", ")}`);
  }

  const model = args.model || (args.fast ? config.fastModel : config.defaultModel);
  if (!config.supportedModels.includes(model)) {
    throw new Error(
      `Unsupported model "${model}" for provider "${args.provider}". Supported: ${config.supportedModels.join(", ")}`,
    );
  }

  return {
    provider: args.provider,
    model,
  };
}

function outBaseName(args) {
  return `answer-pools.${args.status || "pending"}${args.runId ? `.${args.runId}` : ""}`;
}

function extractBalancedJsonObject(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return null;
}

function parseProviderJson(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.response === "string") return parseProviderJson(parsed.response);
    if (typeof parsed?.result === "string") return parseProviderJson(parsed.result);
    if (typeof parsed === "object" && parsed) return parsed;
  } catch {
    // Fallback to extracting a JSON object from text output.
  }

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // noop
    }
  }

  const extracted = extractBalancedJsonObject(text);
  if (!extracted) return null;

  try {
    return JSON.parse(extracted);
  } catch {
    return null;
  }
}

function runProvider(provider, model, prompt, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    let cmd = "";
    let args = [];
    let useStdin = false;

    if (provider === "copilot") {
      cmd = "copilot";
      args = ["-p", prompt, "--model", model, "-s"];
    } else if (provider === "claude") {
      cmd = "claude";
      args = [
        "-p",
        "--print",
        "--output-format",
        "json",
        "--model",
        model,
        "Lis les instructions dans stdin et réponds par un JSON strict.",
      ];
      useStdin = true;
    } else if (provider === "gemini") {
      cmd = "gemini";
      args = ["-m", model, "-o", "json", "-p", "Réponds avec un JSON strict.", "--yolo"];
      useStdin = true;
    } else {
      resolve({
        status: 1,
        stdout: "",
        stderr: `Unsupported provider: ${provider}`,
        durationMs: 0,
      });
      return;
    }

    const startedAt = Date.now();
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1000);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        status: 1,
        stdout,
        stderr: `${stderr}\n${String(error?.message || error)}`.trim(),
        durationMs: Date.now() - startedAt,
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        status: timedOut ? 124 : code ?? 1,
        stdout,
        stderr: timedOut ? `${stderr}\nTimed out after ${timeoutMs}ms`.trim() : stderr.trim(),
        durationMs: Date.now() - startedAt,
      });
    });

    if (useStdin) child.stdin.write(prompt);
    child.stdin.end();
  });
}

function sanitizeEvidencePointer(pointer) {
  return {
    ficheId: String(pointer?.ficheId || "").trim(),
    contentPath: String(pointer?.contentPath || "").trim(),
    sectionId: String(pointer?.sectionId || "").trim(),
    sectionTitle: String(pointer?.sectionTitle || "").trim(),
    quote: String(pointer?.quote || "").trim(),
  };
}

function sanitizeSuggestion(raw, questionProfile, candidateFicheIds) {
  const clean = {
    questionProfile: String(raw?.questionProfile || questionProfile || "").trim() || questionProfile,
    candidateFicheIds: dedupe(
      Array.isArray(raw?.candidateFicheIds) ? raw.candidateFicheIds : candidateFicheIds || [],
    ),
    correct: dedupe(Array.isArray(raw?.correct) ? raw.correct : []),
    distractors: dedupe(Array.isArray(raw?.distractors) ? raw.distractors : []),
    explanationByCorrect:
      raw && typeof raw.explanationByCorrect === "object" ? raw.explanationByCorrect : {},
    answerEvidence: Array.isArray(raw?.answerEvidence)
      ? raw.answerEvidence.map((entry) => ({
          answerText: String(entry?.answerText || "").trim(),
          normalizedAnswer: normalize(entry?.normalizedAnswer || entry?.answerText || ""),
          evidence: Array.isArray(entry?.evidence)
            ? entry.evidence.map((pointer) => sanitizeEvidencePointer(pointer))
            : [],
        }))
      : [],
    questionEvidence: Array.isArray(raw?.questionEvidence)
      ? raw.questionEvidence.map((pointer) => sanitizeEvidencePointer(pointer))
      : [],
    relatedFicheIds: dedupe(Array.isArray(raw?.relatedFicheIds) ? raw.relatedFicheIds : candidateFicheIds || []),
    qualityFlags: dedupe(Array.isArray(raw?.qualityFlags) ? raw.qualityFlags : []),
  };

  const normalizedCorrect = new Set(clean.correct.map((value) => normalize(value)));
  clean.answerEvidence = clean.answerEvidence
    .filter((entry) => entry.answerText)
    .map((entry) => ({
      ...entry,
      evidence: (entry.evidence || []).filter((pointer) => pointer.contentPath && pointer.sectionId),
    }));

  clean.questionEvidence = clean.questionEvidence.filter((pointer) => pointer.contentPath && pointer.sectionId);
  clean.distractors = clean.distractors.filter((value) => !normalizedCorrect.has(normalize(value)));
  clean.candidateFicheIds = dedupe(clean.candidateFicheIds);
  clean.relatedFicheIds = dedupe(clean.relatedFicheIds);

  return clean;
}

function buildMarkdownReport(payload) {
  const lines = [];
  lines.push("# Suggestions de pools QCM");
  lines.push("");
  lines.push(`- Généré le: ${payload.generatedAt}`);
  lines.push(`- Provider: ${payload.provider}`);
  lines.push(`- Modèle: ${payload.model}`);
  lines.push(`- Filtre status: ${payload.statusFilter}`);
  lines.push(`- Questions éligibles: ${payload.stats.totalEligible}`);
  lines.push(`- Questions générées: ${payload.stats.generated}`);
  lines.push(`- Questions ignorées (sans fiche validée): ${payload.stats.skippedMissingLinks}`);
  lines.push(`- Erreurs: ${payload.stats.failed}`);
  lines.push("");

  for (const item of payload.items || []) {
    lines.push(`## ${item.questionId} — ${item.questionText}`);
    lines.push("");
    lines.push(`- Profil: ${item.questionProfile}`);
    lines.push(`- Provider: ${item.providerUsed}`);
    lines.push(`- Modèle: ${item.modelUsed}`);
    lines.push(`- Fiches candidates: ${(item.candidateFicheIds || []).join(", ")}`);
    if ((item.validation?.errors || []).length > 0) {
      lines.push(`- Errors: ${item.validation.errors.join("; ")}`);
    }
    if ((item.validation?.warnings || []).length > 0) {
      lines.push(`- Warnings: ${item.validation.warnings.join("; ")}`);
    }
    lines.push("");
    lines.push("### Correct");
    for (const value of item.suggestion?.correct || []) lines.push(`- ${value}`);
    lines.push("");
    lines.push("### Distractors");
    for (const value of item.suggestion?.distractors || []) lines.push(`- ${value}`);
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function loadExistingPayload(jsonPath) {
  if (!existsSync(jsonPath)) return null;

  try {
    return JSON.parse(readFileSync(jsonPath, "utf-8"));
  } catch {
    return null;
  }
}

async function processQuestion({
  question,
  questionBank,
  sectionIndex,
  providerConfig,
  args,
}) {
  const questionProfile = classifyQuestionProfile(question.questionText);
  const candidateFicheIds = dedupe(question.relatedFicheIds || []);

  if (candidateFicheIds.length === 0) {
    return {
      skipped: true,
      reason: "missing_validated_related_fiche_ids",
      questionId: question.id,
    };
  }

  const sections = scoreSectionsForQuestion(question, sectionIndex, candidateFicheIds, args.sections);
  if (sections.length === 0) {
    return {
      skipped: false,
      item: {
        kind: "answer_pool",
        questionId: question.id,
        questionText: question.questionText,
        exams: question.exams || [],
        reviewStatusBefore: question.reviewStatus || "pending",
        createdAt: new Date().toISOString(),
        accepted: false,
        questionProfile,
        candidateFicheIds,
        providerUsed: providerConfig.provider,
        modelUsed: providerConfig.model,
        suggestion: sanitizeSuggestion({}, questionProfile, candidateFicheIds),
        validation: {
          valid: false,
          errors: ["no_section_found_within_shortlist"],
          warnings: [],
        },
      },
    };
  }

  const styleExamples = selectReviewedStyleExamples(question, questionBank, args.examples);
  const prompt = buildAnswerSuggestionPrompt({
    question,
    questionProfile,
    sections,
    candidateFicheIds,
    styleExamples,
  });

  if (args.dryRun) {
    console.log(prompt);
    return { skipped: true, reason: "dry_run", questionId: question.id };
  }

  const result = await runProvider(providerConfig.provider, providerConfig.model, prompt);
  const validationErrors = [];
  const warnings = [];
  let parsed = null;

  if (result.status !== 0) {
    validationErrors.push(`provider_exit_${result.status}`);
    if (result.stderr) warnings.push(result.stderr.slice(0, 400));
  } else {
    parsed = parseProviderJson(result.stdout);
    if (!parsed) validationErrors.push("invalid_json_output");
  }

  const suggestion = sanitizeSuggestion(parsed || {}, questionProfile, candidateFicheIds);
  if (suggestion.correct.length !== 1) validationErrors.push("model_did_not_return_exactly_one_correct");
  if (suggestion.distractors.length !== 3) validationErrors.push("model_did_not_return_exactly_three_distractors");
  if (!suggestion.answerEvidence.length) validationErrors.push("missing_answer_evidence");
  if (!suggestion.questionEvidence.length) validationErrors.push("missing_question_evidence");

  if (args.verbose && validationErrors.length > 0) {
    console.error(`[${question.id}] ${validationErrors.join(", ")}`);
  }

  return {
    skipped: false,
    item: {
      kind: "answer_pool",
      questionId: question.id,
      questionText: question.questionText,
      exams: question.exams || [],
      reviewStatusBefore: question.reviewStatus || "pending",
      createdAt: new Date().toISOString(),
      accepted: false,
      questionProfile,
      candidateFicheIds,
      providerUsed: providerConfig.provider,
      modelUsed: providerConfig.model,
      providerRun: {
        status: result.status,
        durationMs: result.durationMs,
      },
      suggestion,
      validation: {
        valid: validationErrors.length === 0,
        errors: validationErrors,
        warnings: dedupe(warnings),
      },
    },
  };
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function runWorker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const providerConfig = resolveProviderConfig(args);
  const questionBank = JSON.parse(readFileSync(QUESTION_BANK_PATH, "utf-8"));
  const sectionIndex = JSON.parse(readFileSync(SECTION_INDEX_PATH, "utf-8"));

  const eligible = questionBank.filter((question) => {
    if (args.status !== "all" && String(question.reviewStatus || "") !== args.status) return false;
    return Array.isArray(question.relatedFicheIds) && question.relatedFicheIds.length > 0;
  });
  const missingLinks = questionBank.filter((question) => {
    if (args.status !== "all" && String(question.reviewStatus || "") !== args.status) return false;
    return !Array.isArray(question.relatedFicheIds) || question.relatedFicheIds.length === 0;
  });
  const limited = args.limit > 0 ? eligible.slice(0, args.limit) : eligible;

  const jsonPath = join(SUGGESTIONS_DIR, `${outBaseName(args)}.json`);
  const mdPath = join(SUGGESTIONS_DIR, `${outBaseName(args)}.md`);
  const existingPayload = args.resume ? loadExistingPayload(jsonPath) : null;
  const existingItems = Array.isArray(existingPayload?.items) ? existingPayload.items : [];
  const processedIds = new Set(existingItems.map((item) => item.questionId));
  const pendingQuestions = limited.filter((question) => !processedIds.has(question.id));

  const generatedItems = await runWithConcurrency(pendingQuestions, args.concurrency, async (question) =>
    processQuestion({
      question,
      questionBank,
      sectionIndex,
      providerConfig,
      args,
    }),
  );

  const appendedItems = [];
  let skippedMissingLinks = missingLinks.length;
  let failed = 0;

  for (const result of generatedItems) {
    if (!result) continue;
    if (result.skipped) continue;
    appendedItems.push(result.item);
    if (result.item.validation?.valid === false) failed += 1;
  }

  const payload = {
    kind: "answer_pool",
    generatedAt: new Date().toISOString(),
    provider: providerConfig.provider,
    model: providerConfig.model,
    statusFilter: args.status,
    source: {
      questionBankPath: "data-init/question-bank.json",
      sectionIndexPath: "data-init/fiches-section-index.json",
    },
    stats: {
      totalEligible: eligible.length,
      generated: existingItems.length + appendedItems.length,
      failed:
        existingItems.filter((item) => item.validation?.valid === false).length + failed,
      skippedMissingLinks,
      resumedItems: existingItems.length,
    },
    items: [...existingItems, ...appendedItems],
  };

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  writeFileSync(mdPath, buildMarkdownReport(payload), "utf-8");

  console.log(`Generated suggestions for ${appendedItems.length} questions`);
  console.log(`Eligible linked questions: ${eligible.length}`);
  console.log(`Skipped without validated fiches: ${skippedMissingLinks}`);
  console.log(`Written ${jsonPath}`);
  console.log(`Written ${mdPath}`);
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
