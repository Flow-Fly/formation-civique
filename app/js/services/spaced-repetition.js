/**
 * SM-2 spaced repetition algorithm
 * Simplified 4-button: Again(0), Hard(2), Good(3), Easy(5)
 */
import * as storage from "./storage.js";

const STORAGE_KEY = "sm2_data";

function getAll() {
  return storage.load(STORAGE_KEY, {});
}

function saveAll(data) {
  storage.save(STORAGE_KEY, data);
}

export function getCardState(questionId) {
  const all = getAll();
  return all[questionId] || null;
}

export function getAllCardStates() {
  return getAll();
}

/**
 * Rate a card. Quality: 0=Again, 2=Hard, 3=Good, 5=Easy
 */
export function rateCard(questionId, quality) {
  const all = getAll();
  const now = Date.now();

  let card = all[questionId] || {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: 0,
    lastReview: 0,
  };

  card.lastReview = now;

  if (quality < 2) {
    // Again — reset
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

  // Update ease factor (SM-2 formula)
  card.easeFactor = Math.max(
    1.3,
    card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Set next review date
  card.nextReview = now + card.interval * 24 * 60 * 60 * 1000;

  all[questionId] = card;
  saveAll(all);
  return card;
}

/**
 * Get questions due for review today
 */
export function getDueCards(questions) {
  const all = getAll();
  const now = Date.now();

  return questions.filter((q) => {
    const card = all[q.id];
    if (!card) return false;
    return card.nextReview <= now;
  });
}

/**
 * Get new (never studied) questions
 */
export function getNewCards(questions) {
  const all = getAll();
  return questions.filter((q) => !all[q.id]);
}

/**
 * Get studied card count
 */
export function getStudiedCount() {
  return Object.keys(getAll()).length;
}

/**
 * Get mastery stats
 */
export function getMasteryStats(questions) {
  const all = getAll();
  let mastered = 0;
  let learning = 0;

  for (const q of questions) {
    const card = all[q.id];
    if (!card) continue;
    if (card.interval >= 21) mastered++;
    else learning++;
  }

  return { mastered, learning, total: questions.length, new: questions.length - mastered - learning };
}

/**
 * Get per-theme mastery
 */
export function getThemeMastery(questions) {
  const all = getAll();
  const themes = {};

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
