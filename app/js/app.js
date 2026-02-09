/** Main entry point */
import { registerRoute, initRouter } from "./router.js";
import { setState } from "./state.js";
import { renderHeader } from "./components/header.js";
import { renderDashboard } from "./components/dashboard.js";
import { renderStudy } from "./components/study.js";
import { renderQuiz, cleanupQuiz } from "./components/quiz.js";
import { renderFlashcards, cleanupFlashcards } from "./components/flashcard.js";
import { renderSettings, applyTheme } from "./components/settings.js";

async function loadData() {
  const [fichesRes, questionsRes] = await Promise.all([
    fetch("data/fiches.json"),
    fetch("data/questions.json"),
  ]);

  const fichesData = await fichesRes.json();
  const questions = await questionsRes.json();

  setState("fichesData", fichesData);
  setState("questions", questions);
}

function cleanupAll() {
  cleanupQuiz();
  cleanupFlashcards();
}

async function init() {
  // Apply theme early
  applyTheme();

  // Render header
  renderHeader();

  // Load data
  try {
    await loadData();
  } catch (e) {
    console.error("Failed to load data:", e);
    document.getElementById("app-content").innerHTML =
      '<div class="empty-state"><p>Erreur de chargement des donnees.</p></div>';
    return;
  }

  // Register routes
  registerRoute("/dashboard", () => {
    cleanupAll();
    renderDashboard();
  });

  registerRoute("/study", (params) => {
    cleanupAll();
    renderStudy(params);
  });

  registerRoute("/quiz", (params) => {
    cleanupFlashcards();
    renderQuiz(params);
  });

  registerRoute("/flashcards", (params) => {
    cleanupQuiz();
    renderFlashcards(params);
  });

  registerRoute("/settings", () => {
    cleanupAll();
    renderSettings();
  });

  // Start router
  initRouter();
}

init();
