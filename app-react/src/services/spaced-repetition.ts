import type {
  CardState,
  MasteryStats,
  Quality,
  ThemeMastery,
  ExamCode,
} from "@/types/index.ts";
import * as storage from "./storage.ts";

const STORAGE_KEY = "sm2_data";

interface MinimalQuestion {
  id: string;
  themeId: string;
  themeName: string;
}

function getAll(exam: ExamCode): Record<string, CardState> {
  return storage.load<Record<string, CardState>>(STORAGE_KEY, {}, exam);
}

function saveAll(data: Record<string, CardState>, exam: ExamCode): void {
  storage.save(STORAGE_KEY, data, exam);
}

export function getCardState(questionId: string, exam: ExamCode): CardState | null {
  const all = getAll(exam);
  return all[questionId] || null;
}

export function getAllCardStates(exam: ExamCode): Record<string, CardState> {
  return getAll(exam);
}

export function rateCard(questionId: string, quality: Quality, exam: ExamCode): CardState {
  const all = getAll(exam);
  const now = Date.now();

  const card: CardState = all[questionId] || {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: 0,
    lastReview: 0,
  };

  card.lastReview = now;

  if (quality < 2) {
    card.repetitions = 0;
    card.interval = 1;
  } else {
    if (card.repetitions === 0) {
      card.interval = 1;
    } else if (card.repetitions === 1) {
      card.interval = 3;
    } else {
      card.interval = Math.round(card.interval * card.easeFactor);
    }
    card.repetitions++;
  }

  card.easeFactor = Math.max(
    1.3,
    card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  card.nextReview = now + card.interval * 24 * 60 * 60 * 1000;

  all[questionId] = card;
  saveAll(all, exam);
  return card;
}

export function getDueCards<T extends MinimalQuestion>(questions: T[], exam: ExamCode): T[] {
  const all = getAll(exam);
  const now = Date.now();

  return questions.filter((q) => {
    const card = all[q.id];
    if (!card) return false;
    return card.nextReview <= now;
  });
}

export function getNewCards<T extends MinimalQuestion>(questions: T[], exam: ExamCode): T[] {
  const all = getAll(exam);
  return questions.filter((q) => !all[q.id]);
}

export function getStudiedCount(exam: ExamCode): number {
  return Object.keys(getAll(exam)).length;
}

export function getMasteryStats<T extends MinimalQuestion>(questions: T[], exam: ExamCode): MasteryStats {
  const all = getAll(exam);
  let mastered = 0;
  let learning = 0;

  for (const q of questions) {
    const card = all[q.id];
    if (!card) continue;
    if (card.interval >= 21) mastered++;
    else learning++;
  }

  return {
    mastered,
    learning,
    total: questions.length,
    new: questions.length - mastered - learning,
  };
}

export function getThemeMastery<T extends MinimalQuestion>(questions: T[], exam: ExamCode): ThemeMastery {
  const all = getAll(exam);
  const themes: ThemeMastery = {};

  for (const q of questions) {
    if (!themes[q.themeId]) {
      themes[q.themeId] = { name: q.themeName, total: 0, studied: 0, mastered: 0 };
    }
    themes[q.themeId].total++;
    const card = all[q.id];
    if (card) {
      themes[q.themeId].studied++;
      if (card.interval >= 21) themes[q.themeId].mastered++;
    }
  }

  return themes;
}

export function recordStudyActivity(exam: ExamCode): void {
  const data = storage.load<{ count: number; lastDate: string | null }>(
    "streak",
    {
      count: 0,
      lastDate: null,
    },
    exam,
  );
  const today = new Date().toISOString().slice(0, 10);

  if (data.lastDate === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (data.lastDate === yesterday) {
    data.count++;
  } else if (data.lastDate !== today) {
    data.count = 1;
  }
  data.lastDate = today;
  storage.save("streak", data, exam);
}
