/**
 * Quiz engine — question selection, scoring, timing
 */

/**
 * Select random questions with optional theme filter
 */
export function selectQuestions(allQuestions, { count = 20, themeId = null, shuffle = true } = {}) {
  let pool = themeId ? allQuestions.filter((q) => q.themeId === themeId) : [...allQuestions];

  if (shuffle) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }

  return pool.slice(0, count);
}

/**
 * Calculate quiz score
 */
export function calculateScore(answers) {
  const correct = answers.filter((a) => a.isCorrect).length;
  const total = answers.length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Per-theme breakdown
  const themes = {};
  for (const a of answers) {
    if (!themes[a.themeId]) {
      themes[a.themeId] = { name: a.themeName, correct: 0, total: 0 };
    }
    themes[a.themeId].total++;
    if (a.isCorrect) themes[a.themeId].correct++;
  }

  return { correct, total, percentage, themes, passed: percentage >= 80 };
}

/**
 * Format time (seconds) to mm:ss
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
