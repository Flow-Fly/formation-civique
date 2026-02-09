/** Flashcard mode — flip cards with SM-2 rating */
import { getState } from "../state.js";
import * as sr from "../services/spaced-repetition.js";
import { recordStudyActivity } from "./dashboard.js";

let deckState = null;

export function renderFlashcards(params = {}) {
  const el = document.getElementById("app-content");
  const questions = getState("questions") || [];

  if (deckState && deckState.active) {
    renderCard(el);
    return;
  }

  renderDeckSetup(el, params, questions);
}

function renderDeckSetup(el, params, questions) {
  const dueCards = sr.getDueCards(questions);
  const newCards = sr.getNewCards(questions);
  const themes = [...new Map(questions.map((q) => [q.themeId, q.themeName])).entries()];

  // Auto-start if deck param is provided
  if (params.deck === "due" && dueCards.length > 0) {
    startDeck(dueCards);
    renderCard(el);
    return;
  }

  el.innerHTML = `
    <h1 class="mb-lg">Cartes memoire</h1>

    <div class="stat-grid mb-lg">
      <div class="card stat-item">
        <div class="stat-value">${dueCards.length}</div>
        <div class="stat-label">A reviser</div>
      </div>
      <div class="card stat-item">
        <div class="stat-value">${newCards.length}</div>
        <div class="stat-label">Nouvelles</div>
      </div>
      <div class="card stat-item">
        <div class="stat-value">${questions.length - newCards.length}</div>
        <div class="stat-label">Etudiees</div>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card-header">Choisir un paquet</div>

      <div style="display: flex; flex-direction: column; gap: var(--sp-sm);">
        ${dueCards.length > 0
          ? `<button class="btn btn-primary btn-block" data-deck="due">A reviser (${dueCards.length})</button>`
          : `<button class="btn btn-block" disabled>Aucune carte a reviser</button>`}
        <button class="btn btn-secondary btn-block" data-deck="new">Nouvelles cartes (${Math.min(20, newCards.length)})</button>
        <button class="btn btn-secondary btn-block" data-deck="all">Toutes (${questions.length})</button>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card-header">Par theme</div>
      ${themes
        .map(
          ([id, name]) => {
            const count = questions.filter((q) => q.themeId === id).length;
            return `<button class="btn btn-secondary btn-block mb-sm" data-deck="theme" data-theme="${id}">${name} (${count})</button>`;
          }
        )
        .join("")}
    </div>

    <p class="text-sm text-muted text-center">
      Raccourcis : <span class="kbd">Espace</span> retourner &middot;
      <span class="kbd">1</span> Encore &middot; <span class="kbd">2</span> Difficile &middot;
      <span class="kbd">3</span> Bien &middot; <span class="kbd">4</span> Facile
    </p>
  `;

  el.querySelectorAll("[data-deck]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const deck = btn.dataset.deck;
      let cards;

      if (deck === "due") cards = dueCards;
      else if (deck === "new") cards = newCards.slice(0, 20);
      else if (deck === "all") cards = [...questions].sort(() => Math.random() - 0.5);
      else if (deck === "theme") cards = questions.filter((q) => q.themeId === btn.dataset.theme).sort(() => Math.random() - 0.5);

      if (!cards || cards.length === 0) {
        alert("Aucune carte disponible.");
        return;
      }
      startDeck(cards);
      renderCard(el);
    });
  });
}

function startDeck(cards) {
  deckState = {
    cards,
    current: 0,
    flipped: false,
    active: true,
    reviewed: 0,
    ratings: { again: 0, hard: 0, good: 0, easy: 0 },
  };
}

function renderCard(el) {
  const { cards, current, flipped } = deckState;

  if (current >= cards.length) {
    renderDeckSummary(el);
    return;
  }

  const q = cards[current];

  el.innerHTML = `
    <div class="flex-between mb-md">
      <span class="text-sm text-muted">Carte ${current + 1}/${cards.length}</span>
      <span class="badge">${q.themeName}</span>
    </div>

    <div class="progress-bar mb-lg">
      <div class="progress-bar-fill" style="width: ${((current) / cards.length) * 100}%"></div>
    </div>

    <div class="flashcard-container">
      <div class="flashcard ${flipped ? "flipped" : ""}" id="flashcard" tabindex="0" role="button" aria-label="Retourner la carte">
        <div class="flashcard-face flashcard-front">
          <div class="flashcard-question">${q.questionText}</div>
          <p class="text-sm text-muted text-center mt-md">Cliquez pour retourner</p>
        </div>
        <div class="flashcard-face flashcard-back">
          <div class="flashcard-answer">
            <p style="font-weight: var(--fw-bold); color: var(--success); margin-bottom: var(--sp-sm);">
              ${q.choices.find((c) => c.id === q.correctAnswer)?.text || ""}
            </p>
            <p class="text-sm">${q.explanation}</p>
          </div>
        </div>
      </div>
    </div>

    ${flipped
      ? `
      <div class="rating-buttons mt-lg">
        <button class="rating-btn again" data-quality="0">Encore</button>
        <button class="rating-btn hard" data-quality="2">Difficile</button>
        <button class="rating-btn good" data-quality="3">Bien</button>
        <button class="rating-btn easy" data-quality="5">Facile</button>
      </div>
      <p class="text-sm text-muted text-center mt-sm">
        <span class="kbd">1</span> <span class="kbd">2</span> <span class="kbd">3</span> <span class="kbd">4</span>
      </p>
    `
      : ""}
  `;

  // Flip card
  const card = el.querySelector("#flashcard");
  card.addEventListener("click", () => {
    if (!deckState.flipped) {
      deckState.flipped = true;
      renderCard(el);
    }
  });

  // Rating buttons
  el.querySelectorAll(".rating-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const quality = parseInt(btn.dataset.quality, 10);
      rateAndAdvance(quality, el);
    });
  });

  // Keyboard navigation
  const keyHandler = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!deckState.flipped) {
        deckState.flipped = true;
        renderCard(el);
      }
    } else if (deckState.flipped) {
      const keyMap = { "1": 0, "2": 2, "3": 3, "4": 5 };
      if (keyMap[e.key] !== undefined) {
        e.preventDefault();
        rateAndAdvance(keyMap[e.key], el);
      }
    }
  };

  document.addEventListener("keydown", keyHandler);
  // Cleanup on re-render
  deckState._keyHandler = keyHandler;
}

function rateAndAdvance(quality, el) {
  const q = deckState.cards[deckState.current];
  sr.rateCard(q.id, quality);

  const ratingNames = { 0: "again", 2: "hard", 3: "good", 5: "easy" };
  deckState.ratings[ratingNames[quality]]++;
  deckState.reviewed++;

  // Clean up keyboard handler
  if (deckState._keyHandler) {
    document.removeEventListener("keydown", deckState._keyHandler);
  }

  deckState.current++;
  deckState.flipped = false;
  recordStudyActivity();
  renderCard(el);
}

function renderDeckSummary(el) {
  const { reviewed, ratings } = deckState;

  // Clean up keyboard handler
  if (deckState._keyHandler) {
    document.removeEventListener("keydown", deckState._keyHandler);
  }

  deckState.active = false;

  el.innerHTML = `
    <h1 class="mb-lg text-center">Session terminee !</h1>

    <div class="card mb-md text-center">
      <div class="stat-value" style="font-size: 3rem;">${reviewed}</div>
      <div class="stat-label">cartes revisees</div>
    </div>

    <div class="card mb-md">
      <div class="card-header">Repartition</div>
      <div class="stat-grid">
        <div class="stat-item"><div class="stat-value" style="color: var(--error);">${ratings.again}</div><div class="stat-label">Encore</div></div>
        <div class="stat-item"><div class="stat-value" style="color: var(--warning);">${ratings.hard}</div><div class="stat-label">Difficile</div></div>
        <div class="stat-item"><div class="stat-value" style="color: var(--success);">${ratings.good}</div><div class="stat-label">Bien</div></div>
        <div class="stat-item"><div class="stat-value" style="color: var(--accent);">${ratings.easy}</div><div class="stat-label">Facile</div></div>
      </div>
    </div>

    <div class="flex gap-md" style="flex-wrap: wrap; justify-content: center;">
      <button class="btn btn-primary" id="restart-btn">Nouveau paquet</button>
      <a href="#/dashboard" class="btn btn-secondary">Tableau de bord</a>
    </div>
  `;

  el.querySelector("#restart-btn").addEventListener("click", () => {
    deckState = null;
    renderFlashcards({});
  });
}

export function cleanupFlashcards() {
  if (deckState?._keyHandler) {
    document.removeEventListener("keydown", deckState._keyHandler);
  }
  deckState = null;
}
