import type { QuizAnswer, QuizScore } from "@/types/index.ts";

export function selectQuestions<T extends { themeId: string }>(
  allQuestions: T[],
  options: { count?: number; themeId?: string | null; shuffle?: boolean } = {},
): T[] {
  const { count = 20, themeId = null, shuffle = true } = options;
  const pool = themeId
    ? allQuestions.filter((q) => q.themeId === themeId)
    : [...allQuestions];

  if (shuffle) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }

  return pool.slice(0, count);
}

export function calculateScore(answers: QuizAnswer[]): QuizScore {
  const correct = answers.filter((a) => a.isCorrect).length;
  const total = answers.length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  const themes: Record<string, { name: string; correct: number; total: number }> = {};
  for (const a of answers) {
    if (!themes[a.themeId]) {
      themes[a.themeId] = { name: a.themeName, correct: 0, total: 0 };
    }
    themes[a.themeId].total++;
    if (a.isCorrect) themes[a.themeId].correct++;
  }

  return { correct, total, percentage, themes, passed: percentage >= 80 };
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
