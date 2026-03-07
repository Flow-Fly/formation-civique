#!/usr/bin/env node

/**
 * Full multi-exam pipeline orchestrator.
 *
 * Default flow:
 * 1) parse-questions
 * 2) bootstrap-question-bank
 * 3) build-fiche-section-index
 * 4) suggest-question-fiche-links (for pending questions without fiche link)
 * 5) generate-answer-pool-suggestions (linked questions only)
 * 6) validate-answer-pool-suggestions
 *
 * Optional apply flow:
 * 7) apply-answer-pool-suggestions --accept-all (if requested)
 * 8) validate-question-bank
 * 9) bundle-data
 */

import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function parseArgs(argv) {
  const args = {
    status: "pending",
    runId: "",
    limit: 0,
    provider: process.env.FC_QCM_PROVIDER || "copilot",
    model: "",
    concurrency: 1,
    fast: false,
    resume: false,
    apply: false,
    acceptAll: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--status" && next) {
      args.status = next;
      i += 1;
      continue;
    }
    if (a === "--run-id" && next) {
      args.runId = next.replace(/[^a-zA-Z0-9_-]/g, "");
      i += 1;
      continue;
    }
    if (a === "--limit" && next) {
      args.limit = Math.max(0, parseInt(next, 10) || 0);
      i += 1;
      continue;
    }
    if (a === "--provider" && next) {
      args.provider = next;
      i += 1;
      continue;
    }
    if (a === "--model" && next) {
      args.model = next;
      i += 1;
      continue;
    }
    if (a === "--concurrency" && next) {
      args.concurrency = Math.max(1, parseInt(next, 10) || 1);
      i += 1;
      continue;
    }
    if (a === "--fast") {
      args.fast = true;
      continue;
    }
    if (a === "--resume") {
      args.resume = true;
      continue;
    }
    if (a === "--apply") {
      args.apply = true;
      continue;
    }
    if (a === "--accept-all") {
      args.acceptAll = true;
      continue;
    }
  }

  return args;
}

function runStep(label, cmd, cmdArgs, opts = {}) {
  console.log(`\n=== ${label} ===`);
  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
  });
  if (res.status !== 0 && !opts.allowFailure) {
    throw new Error(`Step failed: ${label} (exit ${res.status ?? 1})`);
  }
  return res.status ?? 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const suggestionsBase =
    `data-init/suggestions/answer-pools.${args.status}${args.runId ? `.${args.runId}` : ""}`;
  const suggestionsJson = `${suggestionsBase}.json`;
  const validatedJson = `${suggestionsBase}.validated.json`;
  const linkSuggestionsBase =
    `data-init/suggestions/question-fiche-links.${args.status}${args.runId ? `.${args.runId}` : ""}.json`;

  runStep("Parse questions", "node", ["scripts/parse-questions.mjs"]);
  runStep("Bootstrap question-bank", "node", ["scripts/bootstrap-question-bank.mjs"]);
  runStep("Build section index", "node", ["scripts/build-fiche-section-index.mjs"]);

  const linkArgs = [
    "scripts/suggest-question-fiche-links.mjs",
    "--status",
    args.status,
  ];
  if (args.runId) linkArgs.push("--run-id", args.runId);
  if (args.limit > 0) linkArgs.push("--limit", String(args.limit));
  runStep("Suggest fiche links", "node", linkArgs);

  const generateArgs = [
    "scripts/generate-answer-pool-suggestions.mjs",
    "--status",
    args.status,
    "--provider",
    args.provider,
    "--concurrency",
    String(args.concurrency),
  ];
  if (args.runId) generateArgs.push("--run-id", args.runId);
  if (args.limit > 0) generateArgs.push("--limit", String(args.limit));
  if (args.model) generateArgs.push("--model", args.model);
  if (args.fast) generateArgs.push("--fast");
  if (args.resume) generateArgs.push("--resume");
  runStep("Generate suggestions", "node", generateArgs);

  const validateStatus = runStep("Validate suggestions", "node", [
    "scripts/validate-answer-pool-suggestions.mjs",
    "--input",
    suggestionsJson,
    "--output",
    validatedJson,
  ], { allowFailure: true });
  if (validateStatus !== 0) {
    console.log("\nValidation found blocking issues. Review artifacts were still generated.");
  }

  if (!args.apply) {
    console.log("\nPipeline stopped before apply step (review mode).");
    console.log(`Fiche-link review JSON: ${linkSuggestionsBase}`);
    console.log(`Review JSON: ${validatedJson}`);
    console.log(`Review Markdown: ${validatedJson.replace(/\.json$/, ".md")}`);
    console.log("Rerun with --apply to merge accepted suggestions.");
    return;
  }

  const applyArgs = [
    "scripts/apply-answer-pool-suggestions.mjs",
    "--input",
    validatedJson,
  ];
  if (args.acceptAll) applyArgs.push("--accept-all");
  runStep("Apply suggestions", "node", applyArgs);
  runStep("Validate question-bank", "node", ["scripts/validate-question-bank.mjs"]);
  runStep("Bundle runtime data", "node", ["scripts/bundle-data.mjs"]);

  console.log("\nPipeline complete.");
}

try {
  main();
} catch (err) {
  console.error(String(err?.message || err));
  process.exit(1);
}
