export type ExamCode = "CSP" | "CR" | "NAT";
export type Difficulty = "easy" | "medium" | "hard";
export type ReviewStatus = "pending" | "reviewed";
export type QuestionProfile =
  | "yes_no"
  | "date_year"
  | "number_unit"
  | "website"
  | "person"
  | "place"
  | "institution"
  | "definition"
  | "quote";
export type ReviewBucket = "high_confidence" | "manual_review_required";
export type FeedbackVerdict = "unreviewed" | "keep" | "rewrite" | "reject";
export type QuestionReviewVerdict = "unreviewed" | "ready" | "revise" | "skip";
export type QualityFlag =
  | "missing_correct_evidence"
  | "weak_distractors"
  | "placeholder_answer"
  | "manual_review_required";

export interface SourceMeta {
  localNumber: number;
  globalNumber: number;
}

export interface AnswerPools {
  correct: string[];
  distractors: string[];
}

export interface EvidencePointer {
  ficheId: string;
  contentPath: string;
  sectionId: string;
  sectionTitle: string;
  quote: string;
}

export interface AnswerEvidenceEntry {
  answerText: string;
  normalizedAnswer: string;
  evidence: EvidencePointer[];
}

export interface StyleMetrics {
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

export interface FicheCandidate {
  ficheId: string;
  title: string;
  themeId: string;
  themeName: string;
  subcategoryName: string;
  score: number;
  questionProfile: QuestionProfile;
  matchedTerms: string[];
  reasons: string[];
}

export interface OptionReviewFeedback {
  optionText: string;
  normalizedOption: string;
  role: "correct" | "distractor";
  verdict: FeedbackVerdict;
  comment: string;
}

export interface SuggestionReviewFeedback {
  sourceFile: string;
  questionId: string;
  overallVerdict: QuestionReviewVerdict;
  overallComment: string;
  optionFeedback: OptionReviewFeedback[];
  updatedAt: string;
}

export interface QuestionBankItem {
  id: string;
  themeId: string;
  themeName: string;
  questionText: string;
  exams: ExamCode[];
  sourceMetaByExam: Partial<Record<ExamCode, SourceMeta>>;
  answerPools: AnswerPools;
  explanationTemplate?: string;
  explanationByCorrect?: Record<string, string>;
  relatedFicheIds: string[];
  answerEvidence?: AnswerEvidenceEntry[];
  questionEvidence?: EvidencePointer[];
  qualityFlags?: QualityFlag[];
  questionProfile?: QuestionProfile;
  styleMetrics?: StyleMetrics;
  reviewBucket?: ReviewBucket;
  reviewReasons?: string[];
  difficultyByExam: Partial<Record<ExamCode, Difficulty>>;
  reviewStatus: ReviewStatus;
}

export interface SuggestionItem {
  kind?: "answer_pool" | "fiche_link";
  _sourceFile?: string;
  questionId: string;
  questionText: string;
  exams?: ExamCode[];
  reviewStatusBefore: ReviewStatus;
  createdAt: string;
  accepted?: boolean;
  questionProfile?: QuestionProfile;
  candidateFicheIds?: string[];
  suggestion: {
    correct?: string[];
    distractors?: string[];
    explanationByCorrect?: Record<string, string>;
    answerEvidence?: AnswerEvidenceEntry[];
    questionEvidence?: EvidencePointer[];
    relatedFicheIds?: string[];
    candidateFicheIds?: string[];
    ficheCandidates?: FicheCandidate[];
    qualityFlags?: QualityFlag[];
    questionProfile?: QuestionProfile;
    styleMetrics?: StyleMetrics;
    reviewBucket?: ReviewBucket;
    reviewReasons?: string[];
  };
  validation?: {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  };
  apply?: {
    applied: boolean;
    reason: string;
    checkedAt: string;
  };
  reviewFeedback?: SuggestionReviewFeedback;
}

export interface SuggestionFile {
  kind?: "answer_pool" | "fiche_link";
  generatedAt: string;
  statusFilter: string;
  source: unknown;
  items: SuggestionItem[];
}

export type SuggestionsByQuestionId = Record<string, SuggestionItem[]>;
