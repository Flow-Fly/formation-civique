export type ExamCode = "CSP" | "CR" | "NAT";
export type Difficulty = "easy" | "medium" | "hard";
export type ReviewStatus = "pending" | "reviewed";
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
  difficultyByExam: Partial<Record<ExamCode, Difficulty>>;
  reviewStatus: ReviewStatus;
}

export interface SuggestionItem {
  questionId: string;
  questionText: string;
  reviewStatusBefore: ReviewStatus;
  createdAt: string;
  accepted?: boolean;
  suggestion: {
    correct: string[];
    distractors: string[];
    explanationByCorrect?: Record<string, string>;
    answerEvidence?: AnswerEvidenceEntry[];
    questionEvidence?: EvidencePointer[];
    relatedFicheIds?: string[];
    qualityFlags?: QualityFlag[];
  };
  validation?: {
    valid: boolean;
    errors?: string[];
  };
  apply?: {
    applied: boolean;
    reason: string;
    checkedAt: string;
  };
}

export interface SuggestionFile {
  generatedAt: string;
  statusFilter: string;
  source: string;
  items: SuggestionItem[];
}

export type SuggestionsByQuestionId = Record<string, SuggestionItem[]>;
