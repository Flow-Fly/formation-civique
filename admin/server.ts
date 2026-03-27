import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BANK_PATH = join(ROOT, "data-init", "question-bank.json");
const SUGGESTIONS_DIR = join(ROOT, "data-init", "suggestions");
const FEEDBACK_PATH = join(SUGGESTIONS_DIR, "_review-feedback.json");

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

function feedbackKey(sourceFile: string, questionId: string): string {
  return `${sourceFile}::${questionId}`;
}

function emptyFeedbackFile(): SuggestionReviewFeedbackFile {
  return {
    updatedAt: new Date().toISOString(),
    items: {},
  };
}

function readFeedbackFile(): SuggestionReviewFeedbackFile {
  if (!existsSync(FEEDBACK_PATH)) return emptyFeedbackFile();

  try {
    const payload = JSON.parse(readFileSync(FEEDBACK_PATH, "utf-8"));
    if (!payload || typeof payload !== "object" || typeof payload.items !== "object") {
      return emptyFeedbackFile();
    }
    return {
      updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
      items: payload.items as Record<string, SuggestionReviewFeedback>,
    };
  } catch {
    return emptyFeedbackFile();
  }
}

function writeFeedbackFile(payload: SuggestionReviewFeedbackFile): void {
  mkdirSync(SUGGESTIONS_DIR, { recursive: true });
  writeFileSync(FEEDBACK_PATH, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

function sanitizeFeedbackVerdict(value: unknown): FeedbackVerdict {
  return value === "keep" || value === "rewrite" || value === "reject" ? value : "unreviewed";
}

function sanitizeQuestionReviewVerdict(value: unknown): QuestionReviewVerdict {
  return value === "ready" || value === "revise" || value === "skip" ? value : "unreviewed";
}

function sanitizeReviewFeedback(
  questionId: string,
  sourceFile: string,
  feedback: unknown,
): SuggestionReviewFeedback {
  const raw = feedback && typeof feedback === "object" ? feedback as Record<string, unknown> : {};
  const optionFeedbackRaw = Array.isArray(raw.optionFeedback) ? raw.optionFeedback : [];
  const optionFeedback: OptionReviewFeedback[] = [];
  const seen = new Set<string>();

  for (const entry of optionFeedbackRaw) {
    const row = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const optionText = String(row.optionText || "").trim();
    const role = row.role === "correct" ? "correct" : "distractor";
    const normalizedOption = normalize(String(row.normalizedOption || optionText));
    if (!optionText || !normalizedOption) continue;

    const key = `${role}:${normalizedOption}`;
    if (seen.has(key)) continue;
    seen.add(key);

    optionFeedback.push({
      optionText,
      normalizedOption,
      role,
      verdict: sanitizeFeedbackVerdict(row.verdict),
      comment: String(row.comment || "").trim(),
    });
  }

  return {
    sourceFile,
    questionId,
    overallVerdict: sanitizeQuestionReviewVerdict(raw.overallVerdict),
    overallComment: String(raw.overallComment || "").trim(),
    optionFeedback,
    updatedAt: new Date().toISOString(),
  };
}

function hasMeaningfulFeedback(feedback: SuggestionReviewFeedback): boolean {
  if (feedback.overallVerdict !== "unreviewed") return true;
  if (feedback.overallComment.trim()) return true;
  return feedback.optionFeedback.some(
    (entry) => entry.verdict !== "unreviewed" || entry.comment.trim().length > 0,
  );
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

type FeedbackVerdict = "unreviewed" | "keep" | "rewrite" | "reject";
type QuestionReviewVerdict = "unreviewed" | "ready" | "revise" | "skip";

interface OptionReviewFeedback {
  optionText: string;
  normalizedOption: string;
  role: "correct" | "distractor";
  verdict: FeedbackVerdict;
  comment: string;
}

interface SuggestionReviewFeedback {
  sourceFile: string;
  questionId: string;
  overallVerdict: QuestionReviewVerdict;
  overallComment: string;
  optionFeedback: OptionReviewFeedback[];
  updatedAt: string;
}

interface SuggestionReviewFeedbackFile {
  updatedAt: string;
  items: Record<string, SuggestionReviewFeedback>;
}

type QuestionProfile =
  | "yes_no"
  | "date_year"
  | "number_unit"
  | "website"
  | "person"
  | "place"
  | "institution"
  | "definition"
  | "quote";

type ReviewBucket = "high_confidence" | "manual_review_required";

interface StyleMetrics {
  questionProfile: QuestionProfile;
  correctCharLength: number;
  distractorCharLengths: number[];
  correctTokenLength: number;
  distractorTokenLengths: number[];
  charLengthRatio: number;
  tokenLengthRatio: number;
  obviousLengthCue: boolean;
  strictProfileCheck: boolean;
  profileMatchCount: number;
  optionCount: number;
  mismatchedOptions: string[];
}

interface SanitizedAnswerSuggestion {
  correct: string[];
  distractors: string[];
  explanationByCorrect: Record<string, string>;
  answerEvidence: AnswerEvidenceEntry[];
  questionEvidence: EvidencePointer[];
  relatedFicheIds: string[];
  candidateFicheIds: string[];
  qualityFlags: string[];
  questionProfile?: QuestionProfile;
  styleMetrics?: StyleMetrics;
  reviewBucket?: ReviewBucket;
  reviewReasons?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeAnswerSuggestion(suggestion: any): SanitizedAnswerSuggestion {
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
  const candidateFicheIds = dedupe(
    Array.isArray(suggestion?.candidateFicheIds) ? suggestion.candidateFicheIds : [],
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
    candidateFicheIds,
    qualityFlags,
    questionProfile: typeof suggestion?.questionProfile === "string" ? suggestion.questionProfile : undefined,
    styleMetrics:
      suggestion?.styleMetrics && typeof suggestion.styleMetrics === "object"
        ? suggestion.styleMetrics
        : undefined,
    reviewBucket:
      suggestion?.reviewBucket === "high_confidence" || suggestion?.reviewBucket === "manual_review_required"
        ? suggestion.reviewBucket
        : undefined,
    reviewReasons: dedupe(Array.isArray(suggestion?.reviewReasons) ? suggestion.reviewReasons : []),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeLinkSuggestion(suggestion: any): { relatedFicheIds: string[] } {
  const relatedFicheIds = dedupe(
    Array.isArray(suggestion?.relatedFicheIds)
      ? suggestion.relatedFicheIds
      : Array.isArray(suggestion?.candidateFicheIds)
        ? suggestion.candidateFicheIds
        : [],
  );

  return { relatedFicheIds };
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
    const feedbackFile = readFeedbackFile();
    let files: string[];
    try {
      files = readdirSync(SUGGESTIONS_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
    } catch {
      files = [];
    }
    for (const file of files) {
      const data = JSON.parse(readFileSync(join(SUGGESTIONS_DIR, file), "utf-8"));
      for (const item of data.items || []) {
        const qid = item.questionId;
        if (!qid) continue;
        if (!byQuestionId[qid]) byQuestionId[qid] = [];
        byQuestionId[qid].push({
          ...item,
          _sourceFile: file,
          reviewFeedback: feedbackFile.items[feedbackKey(file, qid)] || undefined,
        });
      }
    }
    res.json(byQuestionId);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function applyAnswerSuggestion(req: express.Request, res: express.Response) {
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

    const clean = sanitizeAnswerSuggestion(suggestion);
    if (clean.correct.length !== 1 || clean.distractors.length !== 3) {
      res.status(400).json({ error: "Sanitized pools invalid: need exactly 1 correct & exactly 3 distractors" });
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
    if (clean.questionProfile) q.questionProfile = clean.questionProfile;
    if (clean.styleMetrics) q.styleMetrics = clean.styleMetrics;
    if (clean.reviewBucket) q.reviewBucket = clean.reviewBucket;
    if (clean.reviewReasons && clean.reviewReasons.length > 0) q.reviewReasons = clean.reviewReasons;

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
}

// POST /api/questions/:id/apply-answer-suggestion — apply a QCM suggestion
app.post("/api/questions/:id/apply-answer-suggestion", applyAnswerSuggestion);

// Backward compatible alias
app.post("/api/questions/:id/apply-suggestion", applyAnswerSuggestion);

// POST /api/questions/:id/apply-link-suggestion — apply fiche shortlist
app.post("/api/questions/:id/apply-link-suggestion", (req, res) => {
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

    const clean = sanitizeLinkSuggestion(suggestion);
    if (clean.relatedFicheIds.length === 0) {
      res.status(400).json({ error: "Link suggestion must contain at least one fiche id" });
      return;
    }

    const q = bank[idx] as Record<string, unknown>;
    q.relatedFicheIds = clean.relatedFicheIds;

    bank[idx] = q;
    writeBank(bank);
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/suggestions/feedback", (req, res) => {
  try {
    const sourceFile = basename(String(req.body?.sourceFile || "").trim());
    const questionId = String(req.body?.questionId || "").trim();

    if (!sourceFile || !sourceFile.endsWith(".json")) {
      res.status(400).json({ error: "Invalid sourceFile" });
      return;
    }

    if (!questionId) {
      res.status(400).json({ error: "Missing questionId" });
      return;
    }

    const availableFiles = new Set(
      readdirSync(SUGGESTIONS_DIR).filter((file) => file.endsWith(".json") && !file.startsWith("_")),
    );
    if (!availableFiles.has(sourceFile)) {
      res.status(404).json({ error: "Suggestion source file not found" });
      return;
    }

    const clean = sanitizeReviewFeedback(questionId, sourceFile, req.body?.feedback);
    const store = readFeedbackFile();
    const key = feedbackKey(sourceFile, questionId);

    if (hasMeaningfulFeedback(clean)) store.items[key] = clean;
    else delete store.items[key];

    store.updatedAt = new Date().toISOString();
    writeFeedbackFile(store);
    res.json(clean);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Start ────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Admin API server running on http://localhost:${PORT}`);
});
