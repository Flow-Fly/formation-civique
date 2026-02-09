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

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  questionText: string;
  choices: Choice[];
  correctAnswer: string;
  explanation: string;
  themeId: string;
  themeName: string;
  relatedFicheIds: string[];
}

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
