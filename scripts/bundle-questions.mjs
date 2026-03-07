#!/usr/bin/env node

/**
 * Bundle canonical question data to runtime targets.
 *
 * Inputs:
 * - data-init/question-bank.json
 * - data-init/exam-config.json
 *
 * Outputs:
 * - app-react/public/data/question-bank.json
 * - app-react/public/data/exam-config.json
 */

import { readFileSync, writeFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  DEFAULT_STATE_REL_PATH,
  markWorkflowBundled,
  syncWorkflowState,
} from "./lib/qcm-workflow-state.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function parseArgs(argv) {
  const args = {
    bank: join(ROOT, "data-init", "question-bank.json"),
    examConfig: join(ROOT, "data-init", "exam-config.json"),
    runtimeDir: join(ROOT, "app-react", "public", "data"),
    state: join(ROOT, DEFAULT_STATE_REL_PATH),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--bank" && next) {
      args.bank = next;
      i += 1;
      continue;
    }
    if (arg === "--exam-config" && next) {
      args.examConfig = next;
      i += 1;
      continue;
    }
    if (arg === "--runtime-dir" && next) {
      args.runtimeDir = next;
      i += 1;
      continue;
    }
    if (arg === "--state" && next) {
      args.state = next;
      i += 1;
      continue;
    }
  }

  return args;
}

function writeTargets(runtimeDir, relPath, json) {
  const targets = [
    join(runtimeDir, relPath),
  ];

  for (const target of targets) {
    writeFileSync(target, json, "utf-8");
    const size = (statSync(target).size / 1024).toFixed(0);
    console.log(`Written ${target} (${size}KB)`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const bank = JSON.parse(readFileSync(args.bank, "utf-8"));
  const examConfig = JSON.parse(readFileSync(args.examConfig, "utf-8"));

  const bankJson = JSON.stringify(bank);
  const configJson = JSON.stringify(examConfig);

  writeTargets(args.runtimeDir, "question-bank.json", bankJson);
  writeTargets(args.runtimeDir, "exam-config.json", configJson);
  syncWorkflowState({
    rootDir: ROOT,
    statePath: args.state,
    bankPath: args.bank,
    suggestionsDir: join(ROOT, "data-init", "suggestions"),
  });
  markWorkflowBundled(args.state);

  console.log(`\nBundled ${bank.length} canonical questions`);
  console.log(`Updated ${args.state}`);
}

main();
