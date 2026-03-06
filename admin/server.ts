import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const SUGGESTIONS_DIR = join(ROOT, "data-init", "suggestions");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────

function readBank(): unknown[] {
  return JSON.parse(readFileSync(BANK_PATH, "utf-8"));
}

function writeBank(bank: unknown[]): void {
  writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2) + "\n", "utf-8");
}

function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
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

interface EvidencePointer {
  ficheId: string;
  contentPath: string;
  sectionId: string;
  sectionTitle: string;
  quote: string;
}

interface AnswerEvidenceEntry {
  answerText: string;
  normalizedAnswer: string;
  evidence: EvidencePointer[];
}

interface SanitizedSuggestion {
  correct: string[];
  distractors: string[];
  explanationByCorrect: Record<string, string>;
  answerEvidence: AnswerEvidenceEntry[];
  questionEvidence: EvidencePointer[];
  relatedFicheIds: string[];
  qualityFlags: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeSuggestion(suggestion: any): SanitizedSuggestion {
  const correct = dedupe(Array.isArray(suggestion?.correct) ? suggestion.correct : []);
  const correctSet = new Set(correct.map((v: string) => normalize(v)));
  const distractors = dedupe(Array.isArray(suggestion?.distractors) ? suggestion.distractors : [])
    .filter((d: string) => !correctSet.has(normalize(d)));

  const explanationByCorrectRaw =
    suggestion && typeof suggestion.explanationByCorrect === "object"
      ? suggestion.explanationByCorrect
      : {};
  const explanationByCorrect: Record<string, string> = {};
  for (const answer of correct) {
    const exact = explanationByCorrectRaw[answer];
    if (exact) {
      explanationByCorrect[answer] = String(exact);
      continue;
    }
    const byNormalizedKey = Object.entries(explanationByCorrectRaw).find(
      ([k]) => normalize(k) === normalize(answer),
    );
    if (byNormalizedKey) explanationByCorrect[answer] = String(byNormalizedKey[1]);
  }

  const answerEvidence: AnswerEvidenceEntry[] = Array.isArray(suggestion?.answerEvidence)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? suggestion.answerEvidence.map((entry: any) => ({
        answerText: String(entry?.answerText || "").trim(),
        normalizedAnswer: normalize(entry?.normalizedAnswer || entry?.answerText || ""),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evidence: Array.isArray(entry?.evidence)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? entry.evidence.map((ev: any) => ({
              ficheId: String(ev?.ficheId || "").trim(),
              contentPath: String(ev?.contentPath || "").trim(),
              sectionId: String(ev?.sectionId || "").trim(),
              sectionTitle: String(ev?.sectionTitle || "").trim(),
              quote: String(ev?.quote || "").trim(),
            }))
          : [],
      }))
    : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questionEvidence: EvidencePointer[] = Array.isArray(suggestion?.questionEvidence)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? suggestion.questionEvidence.map((ev: any) => ({
        ficheId: String(ev?.ficheId || "").trim(),
        contentPath: String(ev?.contentPath || "").trim(),
        sectionId: String(ev?.sectionId || "").trim(),
        sectionTitle: String(ev?.sectionTitle || "").trim(),
        quote: String(ev?.quote || "").trim(),
      }))
    : [];

  const relatedFromSuggestion = dedupe(
    Array.isArray(suggestion?.relatedFicheIds) ? suggestion.relatedFicheIds : [],
  );
  const relatedFromEvidence = dedupe(
    [
      ...answerEvidence.flatMap((entry) => (entry.evidence || []).map((ev) => ev.ficheId)),
      ...questionEvidence.map((ev) => ev.ficheId),
    ].filter(Boolean),
  );

  const qualityFlags = dedupe(
    Array.isArray(suggestion?.qualityFlags) ? suggestion.qualityFlags : [],
  );

  return {
    correct,
    distractors,
    explanationByCorrect,
    answerEvidence,
    questionEvidence,
    relatedFicheIds: dedupe([...relatedFromSuggestion, ...relatedFromEvidence]),
    qualityFlags,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────

// GET /api/questions — full question bank
app.get("/api/questions", (_req, res) => {
  try {
    const bank = readBank();
    res.json(bank);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/questions/:id — merge partial update
app.patch("/api/questions/:id", (req, res) => {
  try {
    const bank = readBank() as Record<string, unknown>[];
    const idx = bank.findIndex((q) => q.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    const updated = { ...bank[idx], ...req.body };
    bank[idx] = updated;
    writeBank(bank);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/suggestions — all suggestion files, indexed by questionId
app.get("/api/suggestions", (_req, res) => {
  try {
    const byQuestionId: Record<string, unknown[]> = {};
    let files: string[];
    try {
      files = readdirSync(SUGGESTIONS_DIR).filter((f) => f.endsWith(".json"));
    } catch {
      files = [];
    }
    for (const file of files) {
      const data = JSON.parse(readFileSync(join(SUGGESTIONS_DIR, file), "utf-8"));
      for (const item of data.items || []) {
        const qid = item.questionId;
        if (!qid) continue;
        if (!byQuestionId[qid]) byQuestionId[qid] = [];
        byQuestionId[qid].push({ ...item, _sourceFile: file });
      }
    }
    res.json(byQuestionId);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/questions/:id/apply-suggestion — apply a suggestion
app.post("/api/questions/:id/apply-suggestion", (req, res) => {
  try {
    const bank = readBank() as Record<string, unknown>[];
    const idx = bank.findIndex((q) => q.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    const suggestion = req.body.suggestion;
    if (!suggestion) {
      res.status(400).json({ error: "Missing suggestion in body" });
      return;
    }

    const clean = sanitizeSuggestion(suggestion);
    if (clean.correct.length < 1 || clean.distractors.length < 3) {
      res.status(400).json({ error: "Sanitized pools invalid: need >=1 correct & >=3 distractors" });
      return;
    }

    const q = bank[idx] as Record<string, unknown>;
    q.answerPools = { correct: clean.correct, distractors: clean.distractors };

    if (Object.keys(clean.explanationByCorrect).length > 0) {
      q.explanationByCorrect = clean.explanationByCorrect;
    }

    q.relatedFicheIds = dedupe([
      ...((q.relatedFicheIds as string[]) || []),
      ...clean.relatedFicheIds,
    ]);
    q.answerEvidence = clean.answerEvidence;
    q.questionEvidence = clean.questionEvidence;
    q.qualityFlags = clean.qualityFlags;

    const hasStrictEvidence =
      clean.answerEvidence.length > 0 &&
      clean.answerEvidence.every((entry) => (entry.evidence || []).length > 0);
    if (hasStrictEvidence) q.reviewStatus = "reviewed";

    bank[idx] = q;
    writeBank(bank);
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Start ────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Admin API server running on http://localhost:${PORT}`);
});
