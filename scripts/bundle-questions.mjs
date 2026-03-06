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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const bank = JSON.parse(readFileSync(join(ROOT, "data-init", "question-bank.json"), "utf-8"));
const examConfig = JSON.parse(readFileSync(join(ROOT, "data-init", "exam-config.json"), "utf-8"));

function writeTargets(relPath, json) {
  const targets = [
    join(ROOT, "app-react", "public", "data", relPath),
  ];

  for (const target of targets) {
    writeFileSync(target, json, "utf-8");
    const size = (statSync(target).size / 1024).toFixed(0);
    console.log(`Written ${target} (${size}KB)`);
  }
}

const bankJson = JSON.stringify(bank);
const configJson = JSON.stringify(examConfig);

writeTargets("question-bank.json", bankJson);
writeTargets("exam-config.json", configJson);

console.log(`\nBundled ${bank.length} canonical questions`);
