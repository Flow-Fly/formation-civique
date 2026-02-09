/** Quiz mode — practice + exam simulation */
import { getState } from "../state.js";
import { navigate } from "../router.js";
import * as storage from "../services/storage.js";
import * as engine from "../services/quiz-engine.js";
import * as sr from "../services/spaced-repetition.js";
import { recordStudyActivity } from "./dashboard.js";
import { ficheLink } from "../helpers/fiche-link.js";

let quizState = null;
let timerInterval = null;

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

export function renderQuiz(params = {}) {
  clearTimer();
  const el = document.getElementById("app-content");
  const questions = getState("questions") || [];

  if (quizState && quizState.active) {
    renderQuestion(el);
    return;
  }

  if (quizState && quizState.finished) {
    renderResults(el);
    return;
  }

  renderQuizSetup(el, params, questions);
}

function renderQuizSetup(el, params, questions) {
  const themes = [...new Map(questions.map((q) => [q.themeId, q.themeName])).entries()];
  const mode = params.mode || "practice";

  el.innerHTML = `
    <h1 class="mb-lg">${mode === "exam" ? "Simulation d'examen" : "Quiz"}</h1>

    <div class="card mb-md">
      ${mode === "exam"
        ? `
        <p class="mb-md">Simulation de l'examen civique : <strong>40 questions</strong>, <strong>45 minutes</strong>, seuil de reussite : <strong>80%</strong>.</p>
        <button class="btn btn-primary btn-lg btn-block" id="start-exam">Commencer l'examen</button>
      `
        : `
        <div class="mb-md">
          <label class="text-sm text-muted">Theme</label>
          <select id="theme-select" style="display: block; width: 100%; padding: var(--sp-sm); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-top: var(--sp-xs); background: var(--bg-card); color: var(--text-primary); font-size: var(--fs-base);">
            <option value="">Tous les themes</option>
            ${themes.map(([id, name]) => `<option value="${id}" ${params.theme === id ? "selected" : ""}>${name}</option>`).join("")}
          </select>
        </div>
        <div class="mb-md">
          <label class="text-sm text-muted">Nombre de questions</label>
          <select id="count-select" style="display: block; width: 100%; padding: var(--sp-sm); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-top: var(--sp-xs); background: var(--bg-card); color: var(--text-primary); font-size: var(--fs-base);">
            <option value="10">10</option>
            <option value="20" selected>20</option>
            <option value="30">30</option>
            <option value="50">50</option>
          </select>
        </div>
        <button class="btn btn-primary btn-lg btn-block" id="start-practice">Commencer</button>
      `}
    </div>

    <div class="flex gap-md">
      <a href="#/quiz?mode=practice" class="btn btn-secondary ${mode === "practice" ? "btn-primary" : ""}">Entrainement</a>
      <a href="#/quiz?mode=exam" class="btn btn-secondary ${mode === "exam" ? "btn-primary" : ""}">Examen</a>
    </div>
  `;

  if (mode === "exam") {
    el.querySelector("#start-exam").addEventListener("click", () => {
      const selected = engine.selectQuestions(questions, { count: 40 });
      startQuiz(selected, { timed: true, timeLimit: 45 * 60, isExam: true });
    });
  } else {
    el.querySelector("#start-practice").addEventListener("click", () => {
      const themeId = el.querySelector("#theme-select").value || null;
      const count = parseInt(el.querySelector("#count-select").value, 10);
      const selected = engine.selectQuestions(questions, { count, themeId });

      if (selected.length === 0) {
        alert("Aucune question disponible pour ce theme.");
        return;
      }
      startQuiz(selected, { timed: false, isExam: false });
    });
  }
}

function startQuiz(questions, options) {
  quizState = {
    questions,
    current: 0,
    answers: [],
    active: true,
    finished: false,
    timed: options.timed,
    timeLimit: options.timeLimit || 0,
    timeRemaining: options.timeLimit || 0,
    isExam: options.isExam,
    showingFeedback: false,
    selectedChoice: null,
  };

  if (options.timed) {
    timerInterval = setInterval(() => {
      quizState.timeRemaining--;
      updateTimerDisplay();
      if (quizState.timeRemaining <= 0) {
        finishQuiz();
      }
    }, 1000);
  }

  renderQuestion(document.getElementById("app-content"));
}

function renderQuestion(el) {
  const { questions, current, timed, timeRemaining, isExam, showingFeedback, selectedChoice } = quizState;
  const q = questions[current];

  el.innerHTML = `
    <div class="flex-between mb-md">
      <span class="text-sm text-muted">Question ${current + 1}/${questions.length}</span>
      ${timed ? `<span class="timer" id="timer">${engine.formatTime(timeRemaining)}</span>` : ""}
    </div>

    <div class="progress-bar mb-md">
      <div class="progress-bar-fill" style="width: ${((current + 1) / questions.length) * 100}%"></div>
    </div>

    <div class="card mb-md">
      <div class="badge mb-sm">${q.themeName}</div>
      <h2 class="mb-lg" style="font-size: var(--fs-lg);">${q.questionText}</h2>

      <div class="choice-list" id="choices">
        ${q.choices
          .map(
            (c) => `
          <button class="choice-btn ${showingFeedback ? "disabled" : ""} ${
              showingFeedback && c.id === q.correctAnswer ? "correct" : ""
            } ${showingFeedback && c.id === selectedChoice && c.id !== q.correctAnswer ? "incorrect" : ""} ${
              !showingFeedback && c.id === selectedChoice ? "selected" : ""
            }" data-id="${c.id}">
            <span class="choice-id">${c.id}</span>
            <span>${c.text}</span>
          </button>
        `
          )
          .join("")}
      </div>

      ${showingFeedback
        ? `
        <div class="mt-md" style="padding: var(--sp-md); background: ${selectedChoice === q.correctAnswer ? "var(--success-bg)" : "var(--error-bg)"}; border-radius: var(--radius-md);">
          <strong>${selectedChoice === q.correctAnswer ? "Bonne reponse !" : "Mauvaise reponse"}</strong>
          <p class="mt-sm text-sm">${q.explanation}</p>
          ${ficheLink(q)}
        </div>
      `
        : ""}
    </div>

    ${showingFeedback
      ? `<button class="btn btn-primary btn-block" id="next-btn">
          ${current + 1 < questions.length ? "Question suivante" : "Voir les resultats"}
        </button>`
      : isExam
        ? `<div class="flex-between">
            <button class="btn btn-secondary" id="skip-btn">Passer</button>
          </div>`
        : ""
    }
  `;

  // Event: choose answer
  if (!showingFeedback) {
    el.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const choiceId = btn.dataset.id;
        const isCorrect = choiceId === q.correctAnswer;

        quizState.selectedChoice = choiceId;
        quizState.answers.push({
          questionId: q.id,
          themeId: q.themeId,
          themeName: q.themeName,
          chosen: choiceId,
          correct: q.correctAnswer,
          isCorrect,
        });

        // SM-2 rating based on answer
        sr.rateCard(q.id, isCorrect ? 3 : 0);

        if (isExam) {
          // In exam mode, go straight to next question (no immediate feedback)
          quizState.selectedChoice = null;
          quizState.current++;
          if (quizState.current >= quizState.questions.length) {
            finishQuiz();
          } else {
            renderQuestion(el);
          }
        } else {
          // Practice mode: show feedback
          quizState.showingFeedback = true;
          renderQuestion(el);
        }
      });
    });
  }

  // Event: next question (practice mode)
  const nextBtn = el.querySelector("#next-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      quizState.showingFeedback = false;
      quizState.selectedChoice = null;
      quizState.current++;
      if (quizState.current >= quizState.questions.length) {
        finishQuiz();
      } else {
        renderQuestion(el);
      }
    });
  }

  // Event: skip (exam mode)
  const skipBtn = el.querySelector("#skip-btn");
  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      quizState.answers.push({
        questionId: q.id,
        themeId: q.themeId,
        themeName: q.themeName,
        chosen: null,
        correct: q.correctAnswer,
        isCorrect: false,
      });
      quizState.current++;
      if (quizState.current >= quizState.questions.length) {
        finishQuiz();
      } else {
        renderQuestion(el);
      }
    });
  }
}

function updateTimerDisplay() {
  const timerEl = document.getElementById("timer");
  if (!timerEl) return;
  timerEl.textContent = engine.formatTime(quizState.timeRemaining);
  timerEl.className = "timer";
  if (quizState.timeRemaining < 60) timerEl.classList.add("danger");
  else if (quizState.timeRemaining < 300) timerEl.classList.add("warning");
}

function finishQuiz() {
  clearTimer();
  quizState.active = false;
  quizState.finished = true;

  const score = engine.calculateScore(quizState.answers);

  // Save to history
  const history = storage.load("quiz_history", []);
  history.push({
    date: new Date().toISOString(),
    ...score,
    isExam: quizState.isExam,
  });
  storage.save("quiz_history", history);

  recordStudyActivity();
  renderResults(document.getElementById("app-content"));
}

function renderResults(el) {
  const score = engine.calculateScore(quizState.answers);
  const mistakes = quizState.answers.filter((a) => !a.isCorrect);
  const questions = getState("questions") || [];

  el.innerHTML = `
    <h1 class="mb-lg text-center">${quizState.isExam ? "Resultats de l'examen" : "Resultats"}</h1>

    <div class="card mb-md text-center">
      <div class="score-circle ${score.passed ? "pass" : "fail"}" style="margin-bottom: var(--sp-md);">
        <span class="score-value">${score.percentage}%</span>
        <span class="score-label">${score.correct}/${score.total}</span>
      </div>
      <p style="font-size: var(--fs-lg); font-weight: var(--fw-bold); color: ${score.passed ? "var(--success)" : "var(--error)"};">
        ${score.passed ? "Reussi !" : "Non reussi"}
      </p>
      ${quizState.isExam ? `<p class="text-sm text-muted mt-sm">Seuil : 80% (${Math.ceil(score.total * 0.8)}/${score.total})</p>` : ""}
    </div>

    <div class="card mb-md">
      <div class="card-header">Par theme</div>
      ${Object.entries(score.themes)
        .map(
          ([id, t]) => `
        <div class="flex-between mb-sm">
          <span class="text-sm">${t.name}</span>
          <span class="text-sm ${t.correct === t.total ? "badge badge-success" : ""}">${t.correct}/${t.total}</span>
        </div>
      `
        )
        .join("")}
    </div>

    ${mistakes.length > 0
      ? `
      <div class="card mb-md">
        <div class="card-header">Erreurs (${mistakes.length})</div>
        ${mistakes
          .map((m) => {
            const q = questions.find((qq) => qq.id === m.questionId);
            if (!q) return "";
            const correctText = q.choices.find((c) => c.id === m.correct)?.text || "";
            return `
            <div class="list-item" style="flex-direction: column; align-items: flex-start; gap: var(--sp-xs);">
              <span class="text-sm" style="font-weight: var(--fw-medium);">${q.questionText}</span>
              <span class="text-sm" style="color: var(--success);">Reponse : ${correctText}</span>
            </div>
          `;
          })
          .join("")}
      </div>
    `
      : ""}

    <div class="flex gap-md" style="flex-wrap: wrap;">
      <button class="btn btn-primary" id="retry-btn">Recommencer</button>
      <a href="#/dashboard" class="btn btn-secondary">Tableau de bord</a>
      ${mistakes.length > 0 ? `<button class="btn btn-secondary" id="review-mistakes-btn">Reviser les erreurs</button>` : ""}
    </div>
  `;

  el.querySelector("#retry-btn").addEventListener("click", () => {
    quizState = null;
    navigate("/quiz?mode=" + (quizState?.isExam ? "exam" : "practice"));
  });

  const reviewBtn = el.querySelector("#review-mistakes-btn");
  if (reviewBtn) {
    reviewBtn.addEventListener("click", () => {
      const mistakeQuestions = mistakes
        .map((m) => questions.find((q) => q.id === m.questionId))
        .filter(Boolean);
      quizState = null;
      startQuiz(mistakeQuestions, { timed: false, isExam: false });
      renderQuestion(document.getElementById("app-content"));
    });
  }
}

export function cleanupQuiz() {
  clearTimer();
  quizState = null;
}
