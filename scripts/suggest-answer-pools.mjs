#!/usr/bin/env node

/**
 * Deterministic enrichment pass for question answer pools.
 * Applies controlled facts and fills missing distractors while preserving
 * "one-correct-at-runtime" behavior in the app materializer.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const FACTS_PATH = join(ROOT, "data-init", "facts", "civique-facts.json");

const FALLBACK_BY_THEME = {
  "principes-et-valeurs": [
    "Cette proposition est incorrecte au regard des principes républicains",
    "Cette proposition est incorrecte au regard des symboles de la République",
    "Cette proposition est incorrecte au regard du principe de laïcité",
    "Cette proposition est incorrecte au regard des libertés publiques",
  ],
  "systeme-institutionnel": [
    "Cette proposition est incorrecte au regard des institutions françaises",
    "Cette proposition est incorrecte au regard de la séparation des pouvoirs",
    "Cette proposition est incorrecte au regard des règles électorales",
    "Cette proposition est incorrecte au regard des collectivités territoriales",
  ],
  "droits-et-devoirs": [
    "Cette proposition est incorrecte au regard des droits fondamentaux",
    "Cette proposition est incorrecte au regard des devoirs civiques",
    "Cette proposition est incorrecte au regard du droit pénal français",
    "Cette proposition est incorrecte au regard de la citoyenneté",
  ],
  "histoire-geographie-culture": [
    "Cette proposition est incorrecte au regard de l'histoire de France",
    "Cette proposition est incorrecte au regard de la géographie française",
    "Cette proposition est incorrecte au regard de la culture française",
    "Cette proposition est incorrecte au regard du patrimoine national",
  ],
  "vivre-societe-francaise": [
    "Cette proposition est incorrecte au regard des démarches administratives",
    "Cette proposition est incorrecte au regard de la vie quotidienne en France",
    "Cette proposition est incorrecte au regard du système scolaire français",
    "Cette proposition est incorrecte au regard du système de santé français",
  ],
};

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const txt = String(value || "").trim();
    if (!txt) continue;
    const key = normalize(txt);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(txt);
  }
  return out;
}

function applyOverride(item, override) {
  if (!override) return false;

  let changed = false;

  if (Array.isArray(override.correct) && override.correct.length > 0) {
    item.answerPools.correct = dedupe(override.correct);
    changed = true;
  }

  if (Array.isArray(override.distractors) && override.distractors.length > 0) {
    item.answerPools.distractors = dedupe(override.distractors);
    changed = true;
  }

  if (override.explanationTemplate) {
    item.explanationTemplate = override.explanationTemplate;
    changed = true;
  }

  if (override.explanationByCorrect && typeof override.explanationByCorrect === "object") {
    item.explanationByCorrect = {
      ...(item.explanationByCorrect || {}),
      ...override.explanationByCorrect,
    };
    changed = true;
  }

  return changed;
}

function ensurePools(item) {
  item.answerPools = item.answerPools || { correct: [], distractors: [] };
  item.answerPools.correct = dedupe(item.answerPools.correct);
  item.answerPools.distractors = dedupe(item.answerPools.distractors);

  if (item.answerPools.correct.length === 0) {
    item.answerPools.correct = ["Réponse à compléter (source officielle non enrichie)"];
  }

  const correctSet = new Set(item.answerPools.correct.map((v) => normalize(v)));
  item.answerPools.distractors = item.answerPools.distractors.filter(
    (d) => !correctSet.has(normalize(d)),
  );

  const fallback = FALLBACK_BY_THEME[item.themeId] || [
    "Distracteur incorrect A",
    "Distracteur incorrect B",
    "Distracteur incorrect C",
    "Distracteur incorrect D",
  ];

  let i = 0;
  while (item.answerPools.distractors.length < 3) {
    const candidate = fallback[i] || `Distracteur ${item.answerPools.distractors.length + 1}`;
    if (!correctSet.has(normalize(candidate)) && !item.answerPools.distractors.some((d) => normalize(d) === normalize(candidate))) {
      item.answerPools.distractors.push(candidate);
    }
    i += 1;
  }

  if (!item.explanationTemplate && (!item.explanationByCorrect || Object.keys(item.explanationByCorrect).length === 0)) {
    item.explanationTemplate = "La bonne réponse est : {{correct}}.";
  }
}

function main() {
  const bank = JSON.parse(readFileSync(BANK_PATH, "utf-8"));
  const facts = JSON.parse(readFileSync(FACTS_PATH, "utf-8"));

  const byTextOverride = new Map(
    Object.entries(facts.questionTextOverrides || {}).map(([k, v]) => [normalize(k), v]),
  );

  let overridesApplied = 0;

  for (const item of bank) {
    const idOverride = facts.idOverrides?.[item.id];
    const textOverride = byTextOverride.get(normalize(item.questionText));

    if (applyOverride(item, idOverride)) overridesApplied += 1;
    if (applyOverride(item, textOverride)) overridesApplied += 1;

    ensurePools(item);
  }

  writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2) + "\n", "utf-8");

  console.log(`Updated ${bank.length} question entries`);
  console.log(`Overrides applied: ${overridesApplied}`);
  console.log(`Written ${BANK_PATH}`);
}

main();
