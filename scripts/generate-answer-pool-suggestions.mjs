#!/usr/bin/env node

/**
 * Generate answer-pool suggestions using constrained LLM prompts.
 *
 * Inputs:
 * - data-init/question-bank.json
 * - data-init/fiches-section-index.json
 *
 * Outputs:
 * - data-init/suggestions/answer-pools.<status>.json
 * - data-init/suggestions/answer-pools.<status>.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const QUESTION_BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const SECTION_INDEX_PATH = join(ROOT, "data-init", "fiches-section-index.json");
const SUGGESTIONS_DIR = join(ROOT, "data-init", "suggestions");

const DEFAULT_PROVIDER_ORDER = ["claude", "copilot", "gemini"];
const DEFAULT_MODELS = {
  claude: "sonnet",
  copilot: "gpt-5.3-codex",
  gemini: "gemini-2.5-pro",
};

const FAST_MODELS = {
  claude: "haiku",
  copilot: "gpt-5-mini",
  gemini: "gemini-2.5-flash",
};

const VALID_QUALITY_FLAGS = new Set([
  "missing_correct_evidence",
  "weak_distractors",
  "placeholder_answer",
  "manual_review_required",
]);

function normalize(text) {
  return String(text || "")
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

/**
 * Fuzzy quote matching: checks if a quote is grounded in section text.
 */
function fuzzyQuoteMatch(quote, sectionText, threshold = 0.6) {
  const quoteNorm = normalize(quote);
  const sectionNorm = normalize(sectionText || "");

  if (sectionNorm.includes(quoteNorm)) {
    return { matched: true, score: 1.0, exactMatch: true };
  }

  const quoteWords = quoteNorm.split(/\s+/).filter(Boolean);
  if (quoteWords.length < 3) {
    return { matched: false, score: 0, exactMatch: false };
  }

  const sectionWords = new Set(sectionNorm.split(/\s+/).filter(Boolean));
  const matchCount = quoteWords.filter((w) => sectionWords.has(w)).length;
  const score = matchCount / quoteWords.length;

  return { matched: score >= threshold, score, exactMatch: false };
}

/**
 * Find the best matching passage in section text for a given quote.
 * Tries single sentences, consecutive pairs, and triples (for long quotes).
 * Returns the original (non-normalized) text for use as a corrected quote.
 *
 * @param {string} quote - The LLM-provided quote
 * @param {string} sectionText - The full section text
 * @returns {{ text: string, score: number } | null}
 */
function findBestPassage(quote, sectionText) {
  const quoteNorm = normalize(quote);
  const quoteWords = quoteNorm.split(/\s+/).filter(Boolean);
  if (quoteWords.length < 3) return null;

  const quoteWordSet = new Set(quoteWords);

  // Split on sentence-ending punctuation or newlines, preserving original text
  const rawSentences = (sectionText || "")
    .split(/(?<=[.;!?:»])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  if (rawSentences.length === 0) return null;

  function scorePassage(text) {
    const words = normalize(text).split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;
    const wordSet = new Set(words);
    const recall = quoteWords.filter((w) => wordSet.has(w)).length / quoteWords.length;
    const precision = words.filter((w) => quoteWordSet.has(w)).length / words.length;
    return precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  }

  let bestScore = 0;
  let bestText = "";

  for (const sent of rawSentences) {
    const score = scorePassage(sent);
    if (score > bestScore) {
      bestScore = score;
      bestText = sent;
    }
  }

  for (let i = 0; i < rawSentences.length - 1; i++) {
    const pair = rawSentences[i] + " " + rawSentences[i + 1];
    const score = scorePassage(pair);
    if (score > bestScore) {
      bestScore = score;
      bestText = pair;
    }
  }

  if (quoteWords.length > 15) {
    for (let i = 0; i < rawSentences.length - 2; i++) {
      const triple = rawSentences[i] + " " + rawSentences[i + 1] + " " + rawSentences[i + 2];
      const score = scorePassage(triple);
      if (score > bestScore) {
        bestScore = score;
        bestText = triple;
      }
    }
  }

  if (bestScore < 0.4) return null;
  return { text: bestText.trim(), score: bestScore };
}

function parseArgs(argv) {
  const args = {
    provider: "auto",
    model: "",
    status: "pending",
    runId: "",
    limit: 0,
    resume: false,
    dryRun: false,
    verbose: false,
    concurrency: 1,
    fast: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
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
    if (a === "--resume") {
      args.resume = true;
      continue;
    }
    if (a === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (a === "--verbose") {
      args.verbose = true;
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
  }

  return args;
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 2);
}

function chooseProviders(mode) {
  if (mode === "auto") return DEFAULT_PROVIDER_ORDER;
  if (mode === "all") return DEFAULT_PROVIDER_ORDER;
  if (!["claude", "copilot", "gemini"].includes(mode)) {
    throw new Error(`Unsupported provider "${mode}". Expected: auto|all|claude|copilot|gemini`);
  }
  return [mode];
}

function modelFor(provider, cliModel, fastMode) {
  return cliModel || (fastMode ? FAST_MODELS[provider] : DEFAULT_MODELS[provider]);
}

function scoreSections(question, sectionIndex) {
  const tokens = tokenize([
    question.questionText,
    ...(question.answerPools?.correct || []),
  ].join(" "));
  const tokenSet = [...new Set(tokens)];

  const relatedSet = new Set(question.relatedFicheIds || []);
  const themeId = question.themeId;

  const docCount = sectionIndex.index?.docCount || sectionIndex.sections.length || 1;
  const docFreq = sectionIndex.index?.docFreq || {};

  const scores = [];
  for (let i = 0; i < sectionIndex.sections.length; i += 1) {
    const section = sectionIndex.sections[i];
    let score = 0;

    if (section.themeId === themeId) score += 8;

    if (relatedSet.size > 0) {
      const overlap = (section.originalFicheIds || []).some((id) => relatedSet.has(id));
      if (overlap) score += 12;
    }

    const terms = new Set(section.terms || []);
    for (const token of tokenSet) {
      if (!terms.has(token)) continue;
      const df = Number(docFreq[token] || 1);
      const idf = Math.log((docCount + 1) / (df + 1)) + 1;
      score += 2 * idf;
    }

    if (score > 0) scores.push({ index: i, score });
  }

  scores.sort((a, b) => b.score - a.score || a.index - b.index);
  return scores.slice(0, 8).map((s) => sectionIndex.sections[s.index]);
}

function evidencePayload(section) {
  return {
    contentPath: section.contentPath,
    themeId: section.themeId,
    originalFicheIds: section.originalFicheIds || [],
    sectionId: section.sectionId,
    sectionTitle: section.sectionTitle,
    excerpt: String(section.sectionText || "").slice(0, 550),
  };
}

function buildPrompt(question, topSections) {
  const questionShape = {
    id: question.id,
    themeId: question.themeId,
    themeName: question.themeName,
    exams: question.exams || [],
    questionText: question.questionText,
    existingRelatedFicheIds: question.relatedFicheIds || [],
    existingCorrectPool: question.answerPools?.correct || [],
    existingDistractors: question.answerPools?.distractors || [],
  };

  const evidenceRules = [
    "N'utilise que les faits présents dans les sections fournies.",
    "Chaque bonne réponse DOIT avoir au moins une preuve section-level.",
    "Chaque preuve doit contenir: ficheId, contentPath, sectionId, sectionTitle, quote.",
    "quote doit être un extrait exact (copié) de la section fournie.",
    "Les distracteurs doivent être plausibles mais faux selon les sections.",
    "Les distracteurs doivent être du même type sémantique que la bonne réponse (même catégorie).",
    "Évite les distracteurs manifestement ridicules, caricaturaux ou hors-sujet.",
    "Évite les indices trop faciles (ex: seul choix avec mot-cue évident, longueur très différente).",
    "Garde une longueur de distracteurs comparable à la bonne réponse.",
    "Ne mets pas de réponse placeholder.",
    "Retourne strictement un objet JSON valide, sans markdown.",
  ];

  return [
    "Tu es un expert de QCM civique français.",
    "",
    "Objectif: proposer des pools de réponses pour une question, avec citations de preuves.",
    "",
    "Contraintes:",
    ...evidenceRules.map((r) => `- ${r}`),
    "",
    "Format JSON attendu:",
    JSON.stringify({
      correct: ["string"],
      distractors: ["string", "string", "string"],
      explanationByCorrect: { "<correct-answer>": "explication concise" },
      answerEvidence: [
        {
          answerText: "string",
          normalizedAnswer: "string-normalise",
          evidence: [
            {
              ficheId: "string",
              contentPath: "theme/subcategory/page.md",
              sectionId: "section-id",
              sectionTitle: "Titre section",
              quote: "extrait exact de la section",
            },
          ],
        },
      ],
      questionEvidence: [
        {
          ficheId: "string",
          contentPath: "theme/subcategory/page.md",
          sectionId: "section-id",
          sectionTitle: "Titre section",
          quote: "extrait exact",
        },
      ],
      relatedFicheIds: ["fiche-id"],
      qualityFlags: [],
    }, null, 2),
    "",
    "Question:",
    JSON.stringify(questionShape, null, 2),
    "",
    "Sections candidates:",
    JSON.stringify(topSections.map(evidencePayload), null, 2),
  ].join("\n");
}

function runProvider(provider, model, prompt, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    let cmd = "";
    let args = [];
    let useStdin = false;

    if (provider === "gemini") {
      cmd = "gemini";
      args = ["-m", model, "-o", "json", "-p", "Réponds avec du JSON strict.", "--yolo"];
      useStdin = true;
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
    } else if (provider === "copilot") {
      cmd = "copilot";
      args = ["-p", prompt, "--model", model, "-s"];
      useStdin = false;
    } else {
      resolve({
        status: 1,
        stdout: "",
        stderr: `Unsupported provider: ${provider}`,
        error: new Error(`Unsupported provider: ${provider}`),
      });
      return;
    }

    const startedAt = Date.now();
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1000);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 25 * 1024 * 1024) stdout = stdout.slice(-25 * 1024 * 1024);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 25 * 1024 * 1024) stderr = stderr.slice(-25 * 1024 * 1024);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        status: 1,
        stdout,
        stderr,
        error,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        status: timedOut ? 124 : code ?? 1,
        stdout,
        stderr: timedOut ? `${stderr}\nTimed out after ${timeoutMs}ms` : stderr,
        error: timedOut ? new Error(`Timeout after ${timeoutMs}ms`) : null,
        durationMs: Date.now() - startedAt,
      });
    });

    if (useStdin) {
      child.stdin.write(prompt);
    }
    child.stdin.end();
  });
}

function extractBalancedJsonObject(text) {
  const src = String(text || "");
  const start = src.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonFromProviderOutput(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed && typeof parsed.response === "string") {
      const nested = parseJsonFromProviderOutput(parsed.response);
      if (nested) return nested;
    }
    if (typeof parsed === "object" && parsed && typeof parsed.result === "string") {
      const nested = parseJsonFromProviderOutput(parsed.result);
      if (nested) return nested;
    }
    if (typeof parsed === "object" && parsed) return parsed;
  } catch {
    // Continue with extraction from plain text.
  }

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // noop
    }
  }

  const objText = extractBalancedJsonObject(text);
  if (!objText) return null;
  try {
    return JSON.parse(objText);
  } catch {
    return null;
  }
}

function countTokens(text) {
  return normalize(text).split(" ").filter(Boolean).length;
}

function startsWithArticle(text) {
  const first = normalize(text).split(" ")[0] || "";
  return ["le", "la", "les", "l", "un", "une", "des", "du"].includes(first);
}

function hasWeakDistractorPattern(text) {
  const n = normalize(text);
  return (
    n.includes("proposition incorrecte") ||
    n.includes("distracteur") ||
    n.includes("reponse a completer") ||
    n.includes("aucune de ces reponses")
  );
}

function hasNationalityMarker(text) {
  const n = normalize(text);
  const markers = [
    "francais", "francaise", "italien", "italienne", "americain", "americaine",
    "marocain", "marocaine", "espagnol", "espagnole", "allemand", "allemande",
    "anglais", "anglaise", "turc", "turque", "chinois", "chinoise",
  ];
  return markers.some((m) => n.includes(m));
}

function evaluateDistractorQuality(questionText, correct, distractors) {
  const issues = [];
  const warnings = [];
  let penalty = 0;

  if (distractors.some((d) => hasWeakDistractorPattern(d))) {
    issues.push("placeholder-like distractor detected");
    penalty += 25;
  }

  const correctLens = correct.map((c) => c.length).filter(Boolean);
  const distLens = distractors.map((d) => d.length).filter(Boolean);
  const avgCorrectLen =
    correctLens.length > 0 ? correctLens.reduce((a, b) => a + b, 0) / correctLens.length : 1;
  const avgDistLen =
    distLens.length > 0 ? distLens.reduce((a, b) => a + b, 0) / distLens.length : 1;
  const ratio = avgDistLen > 0 ? avgCorrectLen / avgDistLen : 999;

  if (ratio > 1.7 || ratio < 0.6) {
    warnings.push(`length imbalance ratio=${ratio.toFixed(2)}`);
    penalty += 8;
  }

  const correctTok = correct.map((c) => countTokens(c));
  const distTok = distractors.map((d) => countTokens(d));
  const avgCorrectTok =
    correctTok.length > 0 ? correctTok.reduce((a, b) => a + b, 0) / correctTok.length : 1;
  const avgDistTok =
    distTok.length > 0 ? distTok.reduce((a, b) => a + b, 0) / distTok.length : 1;

  if (avgDistTok > 0 && (avgCorrectTok / avgDistTok > 1.8 || avgCorrectTok / avgDistTok < 0.55)) {
    warnings.push("token-length imbalance");
    penalty += 6;
  }

  const allChoices = [...correct, ...distractors];
  const articleStarts = allChoices.map((c) => startsWithArticle(c));
  const articleCount = articleStarts.filter(Boolean).length;
  if (articleCount > 0 && articleCount < allChoices.length - 1) {
    warnings.push("format inconsistency: article prefix");
    penalty += 3;
  }

  const qHasFrenchCue = normalize(questionText).includes("francais") || normalize(questionText).includes("francaise");
  if (qHasFrenchCue) {
    const withFrenchCue = allChoices.filter((c) => normalize(c).includes("franc")).length;
    if (withFrenchCue === 1) {
      warnings.push("single french cue among options");
      penalty += 5;
    }
  }

  const correctHasNationality = correct.some((c) => hasNationalityMarker(c));
  const distractorsNationalityCount = distractors.filter((d) => hasNationalityMarker(d)).length;
  if (!correctHasNationality && distractorsNationalityCount >= 2) {
    warnings.push("distractors rely heavily on nationality markers");
    penalty += 5;
  }

  const score = Math.max(0, 100 - penalty);
  return { score, issues, warnings, ratio };
}

function sanitizeSuggestion(suggestion, question, sectionLookup) {
  const out = {
    correct: dedupe(Array.isArray(suggestion?.correct) ? suggestion.correct : []),
    distractors: dedupe(Array.isArray(suggestion?.distractors) ? suggestion.distractors : []),
    explanationByCorrect:
      suggestion && typeof suggestion.explanationByCorrect === "object"
        ? suggestion.explanationByCorrect
        : {},
    answerEvidence: Array.isArray(suggestion?.answerEvidence) ? suggestion.answerEvidence : [],
    questionEvidence: Array.isArray(suggestion?.questionEvidence) ? suggestion.questionEvidence : [],
    relatedFicheIds: dedupe(Array.isArray(suggestion?.relatedFicheIds) ? suggestion.relatedFicheIds : []),
    qualityFlags: dedupe(Array.isArray(suggestion?.qualityFlags) ? suggestion.qualityFlags : []),
  };

  if (out.correct.length === 0) {
    out.correct = dedupe(question.answerPools?.correct || []);
  }
  if (out.correct.length === 0) {
    out.correct = ["Réponse à compléter (source officielle non enrichie)"];
    out.qualityFlags.push("placeholder_answer");
  }

  const correctSet = new Set(out.correct.map((v) => normalize(v)));
  out.distractors = out.distractors.filter((d) => !correctSet.has(normalize(d)));
  while (out.distractors.length < 3) {
    out.distractors.push(`Distracteur ${out.distractors.length + 1}`);
    out.qualityFlags.push("weak_distractors");
  }

  const byAnswer = new Map();
  for (const entry of out.answerEvidence) {
    const answerText = String(entry?.answerText || "").trim();
    if (!answerText) continue;
    const normalizedAnswer = normalize(entry?.normalizedAnswer || answerText);
    const evidence = Array.isArray(entry?.evidence) ? entry.evidence : [];
    const cleanEvidence = [];
    for (const ev of evidence) {
      const contentPath = String(ev?.contentPath || "").trim();
      const sectionId = String(ev?.sectionId || "").trim();
      if (!contentPath || !sectionId) continue;
      const sectionKey = `${contentPath}#${sectionId}`;
      const resolved = sectionLookup.get(sectionKey);
      if (!resolved) continue;
      const ficheId = String(ev?.ficheId || resolved.originalFicheIds?.[0] || "").trim();
      const sectionTitle = String(ev?.sectionTitle || resolved.sectionTitle || "").trim();
      let quote = String(ev?.quote || "").trim();

      // Auto-correct quotes that don't match exactly
      if (quote && resolved.sectionText) {
        const match = fuzzyQuoteMatch(quote, resolved.sectionText);
        if (!match.exactMatch && match.score > 0) {
          const best = findBestPassage(quote, resolved.sectionText);
          if (best && best.score >= 0.5) {
            quote = best.text;
          }
        }
      }

      cleanEvidence.push({ ficheId, contentPath, sectionId, sectionTitle, quote });
    }
    byAnswer.set(normalizedAnswer, {
      answerText,
      normalizedAnswer,
      evidence: cleanEvidence,
    });
  }

  out.answerEvidence = out.correct.map((answerText) => {
    const key = normalize(answerText);
    const existing = byAnswer.get(key);
    if (existing) {
      existing.answerText = answerText;
      existing.normalizedAnswer = key;
      return existing;
    }
    out.qualityFlags.push("missing_correct_evidence");
    return {
      answerText,
      normalizedAnswer: key,
      evidence: [],
    };
  });

  out.questionEvidence = (out.questionEvidence || [])
    .map((ev) => {
      const contentPath = String(ev?.contentPath || "").trim();
      const sectionId = String(ev?.sectionId || "").trim();
      if (!contentPath || !sectionId) return null;
      const sectionKey = `${contentPath}#${sectionId}`;
      const resolved = sectionLookup.get(sectionKey);
      if (!resolved) return null;
      let quote = String(ev?.quote || "").trim();

      // Auto-correct quotes that don't match exactly
      if (quote && resolved.sectionText) {
        const match = fuzzyQuoteMatch(quote, resolved.sectionText);
        if (!match.exactMatch && match.score > 0) {
          const best = findBestPassage(quote, resolved.sectionText);
          if (best && best.score >= 0.5) {
            quote = best.text;
          }
        }
      }

      return {
        ficheId: String(ev?.ficheId || resolved.originalFicheIds?.[0] || "").trim(),
        contentPath,
        sectionId,
        sectionTitle: String(ev?.sectionTitle || resolved.sectionTitle || "").trim(),
        quote,
      };
    })
    .filter(Boolean);

  out.qualityFlags = dedupe(out.qualityFlags);
  out.qualityFlags = out.qualityFlags.filter((f) => VALID_QUALITY_FLAGS.has(f));

  const quality = evaluateDistractorQuality(question.questionText, out.correct, out.distractors);
  out.distractorQuality = quality;
  if ((quality.issues.length > 0 || quality.score < 65) && !out.qualityFlags.includes("weak_distractors")) {
    out.qualityFlags.push("weak_distractors");
  }

  return out;
}

function buildMarkdownReport(payload) {
  const lines = [];
  lines.push("# Suggestions de pools QCM");
  lines.push("");
  lines.push(`- Généré le: ${payload.generatedAt}`);
  lines.push(`- Filtre status: ${payload.statusFilter}`);
  lines.push(`- Provider mode: ${payload.providerMode}`);
  lines.push(`- Questions traitées: ${payload.stats.processed}/${payload.stats.totalEligible}`);
  lines.push(`- Succès: ${payload.stats.succeeded}`);
  lines.push(`- Échecs: ${payload.stats.failed}`);
  lines.push("");

  for (const item of payload.items) {
    lines.push(`## ${item.questionId} — ${item.questionText}`);
    lines.push("");
    lines.push(`- Provider: ${item.providerUsed || "N/A"} (${item.modelUsed || "N/A"})`);
    lines.push(`- Accepted: ${item.accepted ? "yes" : "no"}`);
    lines.push(`- Valid: ${item.valid ? "yes" : "no"}`);
    if (item.errors?.length) lines.push(`- Errors: ${item.errors.join("; ")}`);
    if (item.warnings?.length) lines.push(`- Warnings: ${item.warnings.join("; ")}`);
    if (item.attemptErrors?.length) lines.push(`- Attempt errors: ${item.attemptErrors.join("; ")}`);
    lines.push("");
    if (item.providerAttempts?.length) {
      lines.push("### Provider attempts");
      for (const attempt of item.providerAttempts) {
        lines.push(
          `- ${attempt.provider}:${attempt.model} -> ${attempt.status}${attempt.detail ? ` (${attempt.detail})` : ""}`,
        );
      }
      lines.push("");
    }
    if (item.suggestion) {
      lines.push("### Correct");
      for (const c of item.suggestion.correct || []) lines.push(`- ${c}`);
      lines.push("");
      lines.push("### Distractors");
      for (const d of item.suggestion.distractors || []) lines.push(`- ${d}`);
      lines.push("");
      lines.push("### Quality flags");
      for (const f of item.suggestion.qualityFlags || []) lines.push(`- ${f}`);
      if ((item.suggestion.qualityFlags || []).length === 0) lines.push("- (none)");
      if (item.suggestion.distractorQuality) {
        lines.push(`- distractor score: ${item.suggestion.distractorQuality.score}`);
        if ((item.suggestion.distractorQuality.issues || []).length > 0) {
          lines.push(`- distractor issues: ${item.suggestion.distractorQuality.issues.join("; ")}`);
        }
        if ((item.suggestion.distractorQuality.warnings || []).length > 0) {
          lines.push(`- distractor warnings: ${item.suggestion.distractorQuality.warnings.join("; ")}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n") + "\n";
}

function writeOutputs(jsonPath, mdPath, payload) {
  mkdirSync(dirname(jsonPath), { recursive: true });
  const jsonText = JSON.stringify(payload, null, 2) + "\n";
  writeFileSync(jsonPath, jsonText, "utf-8");
  writeFileSync(mdPath, buildMarkdownReport(payload), "utf-8");
}

function scoreCandidateSuggestion(suggestion) {
  const correctCount = suggestion.correct.length;
  const distractorCount = suggestion.distractors.length;
  const missingEvidence = suggestion.answerEvidence.filter((e) => (e.evidence || []).length === 0).length;
  const flagPenalty = (suggestion.qualityFlags || []).length;
  const qualityScore = Number(suggestion.distractorQuality?.score || 60);
  const qualityPenalty = Math.max(0, 70 - qualityScore) / 2;
  return correctCount * 10 + Math.min(3, distractorCount) * 2 - missingEvidence * 6 - flagPenalty * 2 - qualityPenalty;
}

async function processQuestion({
  q,
  providers,
  args,
  sectionIndex,
  sectionLookup,
}) {
  const topSections = scoreSections(q, sectionIndex);
  const prompt = buildPrompt(q, topSections);

  if (args.dryRun) {
    console.log(prompt);
    return null;
  }

  const attemptedProviders = [];
  const attemptErrors = [];
  const providerAttempts = [];
  const providerCandidates = [];
  let providerUsed = "";
  let modelUsed = "";

  const runOneProvider = async (provider) => {
    const model = modelFor(provider, args.model, args.fast);
    attemptedProviders.push(`${provider}:${model}`);
    const res = await runProvider(provider, model, prompt);

    if (res.error && res.status !== 124) {
      const detail = String(res.error.message || "").slice(0, 400);
      const msg = `${provider}: spawn error${detail ? ` (${detail})` : ""}`;
      attemptErrors.push(msg);
      providerAttempts.push({
        provider,
        model,
        status: "spawn_error",
        detail,
        durationMs: res.durationMs || 0,
      });
      if (args.verbose) console.error(`[${q.id}] ${msg}`);
      return null;
    }

    if (res.status !== 0) {
      const stderr = String(res.stderr || "").trim().slice(0, 800);
      const msg = `${provider}: exit ${res.status}${stderr ? ` (${stderr})` : ""}`;
      attemptErrors.push(msg);
      providerAttempts.push({
        provider,
        model,
        status: res.status === 124 ? "timeout" : `exit_${res.status}`,
        detail: stderr || "",
        durationMs: res.durationMs || 0,
      });
      if (args.verbose) console.error(`[${q.id}] ${msg}`);
      return null;
    }

    const parsed = parseJsonFromProviderOutput(res.stdout);
    if (!parsed) {
      const snippet = String(res.stdout || "").slice(0, 800);
      const msg = `${provider}: invalid JSON output`;
      attemptErrors.push(`${msg}${snippet ? ` (${snippet})` : ""}`);
      providerAttempts.push({
        provider,
        model,
        status: "invalid_json",
        detail: snippet,
        durationMs: res.durationMs || 0,
      });
      if (args.verbose) console.error(`[${q.id}] ${msg}\n${snippet}`);
      return null;
    }

    providerAttempts.push({
      provider,
      model,
      status: "success",
      detail: "",
      durationMs: res.durationMs || 0,
    });

    const suggestion = sanitizeSuggestion(parsed, q, sectionLookup);
    const validationErrors = [];
    const warnings = [];
    const overlap = suggestion.distractors.some((d) =>
      suggestion.correct.some((c) => normalize(c) === normalize(d)),
    );
    if (suggestion.correct.length < 1) validationErrors.push("suggestion has no correct answer");
    if (suggestion.distractors.length < 3) validationErrors.push("suggestion has less than 3 distractors");
    if (overlap) validationErrors.push("correct/distractor overlap after sanitization");
    const missingEvidence = suggestion.answerEvidence.some((e) => (e.evidence || []).length === 0);
    if (missingEvidence) warnings.push("some correct answers have no evidence");

    return {
      provider,
      model,
      suggestion,
      validationErrors,
      warnings,
      valid: validationErrors.length === 0,
      score: scoreCandidateSuggestion(suggestion),
    };
  };

  let winner = null;

  if (args.provider === "all") {
    const results = await Promise.all(providers.map((provider) => runOneProvider(provider)));
    const candidates = results.filter(Boolean);
    providerCandidates.push(
      ...candidates.map((c) => ({
        provider: c.provider,
        model: c.model,
        valid: c.valid,
        score: c.score,
        errors: c.validationErrors,
        warnings: c.warnings,
        suggestion: c.suggestion,
      })),
    );
    const validCandidates = candidates.filter((c) => c.valid);
    winner = (validCandidates.sort((a, b) => b.score - a.score)[0] || candidates[0]) || null;
  } else {
    for (const provider of providers) {
      const result = await runOneProvider(provider);
      if (!result) continue;
      providerCandidates.push({
        provider: result.provider,
        model: result.model,
        valid: result.valid,
        score: result.score,
        errors: result.validationErrors,
        warnings: result.warnings,
        suggestion: result.suggestion,
      });
      winner = result;
      break;
    }
  }

  let valid = false;
  let warnings = [];
  let suggestion = null;
  const validationErrors = [];

  if (winner) {
    providerUsed = winner.provider;
    modelUsed = winner.model;
    suggestion = winner.suggestion;
    warnings = [...winner.warnings];
    if (attemptErrors.length > 0) warnings.push("fallback provider used due previous attempt errors");
    validationErrors.push(...winner.validationErrors);
    valid = validationErrors.length === 0;
  } else {
    suggestion = sanitizeSuggestion({}, q, sectionLookup);
    suggestion.qualityFlags = dedupe([...(suggestion.qualityFlags || []), "manual_review_required"]);
    validationErrors.push("all providers failed to return valid JSON");
    valid = false;
  }

  return {
    questionId: q.id,
    questionText: q.questionText,
    exams: q.exams || [],
    reviewStatusBefore: q.reviewStatus || "pending",
    createdAt: new Date().toISOString(),
    accepted: false,
    valid,
    errors: validationErrors,
    warnings: dedupe(warnings),
    attemptErrors,
    providerAttempts,
    attemptedProviders,
    providerCandidates,
    providerUsed,
    modelUsed,
    suggestion,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const outBase =
    `answer-pools.${args.status || "pending"}${args.runId ? `.${args.runId}` : ""}`;
  const jsonPath = join(SUGGESTIONS_DIR, `${outBase}.json`);
  const mdPath = join(SUGGESTIONS_DIR, `${outBase}.md`);

  const questionBank = JSON.parse(readFileSync(QUESTION_BANK_PATH, "utf-8"));
  const sectionIndex = JSON.parse(readFileSync(SECTION_INDEX_PATH, "utf-8"));

  const sectionLookup = new Map();
  for (const section of sectionIndex.sections || []) {
    sectionLookup.set(`${section.contentPath}#${section.sectionId}`, section);
  }

  const providers = chooseProviders(args.provider);
  const eligible = questionBank.filter((q) => {
    if (args.status === "all") return true;
    return String(q.reviewStatus || "") === args.status;
  });
  const limited = args.limit > 0 ? eligible.slice(0, args.limit) : eligible;

  let payload = {
    generatedAt: new Date().toISOString(),
    statusFilter: args.status,
    providerMode: args.provider,
    modelHint: args.model || "",
    source: {
      questionBankPath: "data-init/question-bank.json",
      sectionIndexPath: "data-init/fiches-section-index.json",
    },
    stats: {
      totalEligible: limited.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
    },
    items: [],
  };

  if (args.resume && existsSync(jsonPath)) {
    payload = JSON.parse(readFileSync(jsonPath, "utf-8"));
    payload.stats.totalEligible = limited.length;
  }

  const done = new Set((payload.items || []).map((i) => i.questionId));
  const queue = limited.filter((q) => !done.has(q.id));

  if (args.dryRun && queue.length > 0) {
    const topSections = scoreSections(queue[0], sectionIndex);
    const prompt = buildPrompt(queue[0], topSections);
    console.log(prompt);
    return;
  }

  let cursor = 0;
  const total = queue.length;
  const workerCount = Math.max(1, Math.min(args.concurrency, total || 1));

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= total) return;

      const q = queue[index];
      const item = await processQuestion({
        q,
        providers,
        args,
        sectionIndex,
        sectionLookup,
      });
      if (!item) return;

      payload.items.push(item);
      payload.stats.processed += 1;
      if (item.valid) payload.stats.succeeded += 1;
      else payload.stats.failed += 1;

      writeOutputs(jsonPath, mdPath, payload);
      console.log(
        `[${payload.stats.processed}/${limited.length}] ${q.id}: ${item.valid ? "ok" : "failed"} (${item.providerUsed || "no-provider"})`,
      );
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  payload.generatedAt = new Date().toISOString();
  writeOutputs(jsonPath, mdPath, payload);

  console.log(`\nWritten ${jsonPath}`);
  console.log(`Written ${mdPath}`);
  console.log(
    `Processed ${payload.stats.processed}/${payload.stats.totalEligible}; ok=${payload.stats.succeeded}, failed=${payload.stats.failed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
