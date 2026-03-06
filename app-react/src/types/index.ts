export interface FicheReference {
  label: string;
  url: string;
}

export interface FicheSection {
  heading: string;
  content: string;
}

export interface Fiche {
  id: string;
  title: string;
  themeId: string;
  themeName: string;
  subcategoryId: string;
  subcategoryName: string;
  objectives: string[];
  sections: FicheSection[];
  references: FicheReference[];
}

export interface FicheIndexEntry {
  id: string;
  title: string;
}

export interface SubcategoryIndex {
  id: string;
  name: string;
  fiches: FicheIndexEntry[];
}

export interface ThemeIndex {
  id: string;
  name: string;
  subcategories: SubcategoryIndex[];
}

export interface FichesIndex {
  themes: ThemeIndex[];
}

export interface FichesData {
  index: FichesIndex;
  fiches: Fiche[];
}

export type ExamCode = "CSP" | "CR" | "NAT";
export type Difficulty = "easy" | "medium" | "hard";
export type ReviewStatus = "pending" | "reviewed";
export type QualityFlag =
  | "missing_correct_evidence"
  | "weak_distractors"
  | "placeholder_answer"
  | "manual_review_required";

export interface ExamRule {
  questionCount: number;
  timeLimitMinutes: number;
  passScorePercent: number;
  passCorrectAnswers: number;
  disclaimer: string;
}

export type ExamConfig = Record<ExamCode, ExamRule>;

export interface Choice {
  id: string;
  text: string;
}

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

export interface QuestionInstance {
  id: string;
  exam: ExamCode;
  questionText: string;
  choices: Choice[];
  correctAnswer: string;
  correctText: string;
  explanation: string;
  themeId: string;
  themeName: string;
  relatedFicheIds: string[];
  choiceEvidenceById?: Record<string, EvidencePointer[]>;
  correctEvidence?: EvidencePointer[];
  difficulty: Difficulty;
}

// Backward-compatible alias for existing component APIs.
export type Question = QuestionInstance;

export interface CardState {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
  lastReview: number;
}

export interface MasteryStats {
  mastered: number;
  learning: number;
  total: number;
  new: number;
}

export interface ThemeMasteryEntry {
  name: string;
  total: number;
  studied: number;
  mastered: number;
}

export type ThemeMastery = Record<string, ThemeMasteryEntry>;

export interface QuizAnswer {
  questionId: string;
  themeId: string;
  themeName: string;
  chosen: string | null;
  correct: string;
  isCorrect: boolean;
}

export interface ThemeScore {
  name: string;
  correct: number;
  total: number;
}

export interface QuizScore {
  correct: number;
  total: number;
  percentage: number;
  themes: Record<string, ThemeScore>;
  passed: boolean;
}

export interface QuizHistoryEntry extends QuizScore {
  date: string;
  isExam: boolean;
}

export interface StreakData {
  count: number;
  lastDate: string | null;
}

export interface Settings {
  darkMode: boolean;
  dailyGoal: number;
}

export type Quality = 0 | 2 | 3 | 5;

export type RatingName = "again" | "hard" | "good" | "easy";

// ─── Content index types (markdown-based fiches) ────────────────────

export interface ContentPageMeta {
  id: string;
  title: string;
  path: string; // relative to public/content/
  originalFicheIds: string[];
}

export interface SubcategoryGroupIndex {
  id: string;
  name: string;
  pages: ContentPageMeta[];
}

export interface ContentSubcategoryIndex {
  id: string;
  name: string;
  pages?: ContentPageMeta[]; // ungrouped pages
  groups?: SubcategoryGroupIndex[]; // grouped pages
}

export interface ContentThemeIndex {
  id: string;
  name: string;
  subcategories: ContentSubcategoryIndex[];
}

export interface ContentIndex {
  themes: ContentThemeIndex[];
}
