/** Dashboard — progress overview, streak, readiness */
import { getState } from "../state.js";
import * as storage from "../services/storage.js";
import * as sr from "../services/spaced-repetition.js";

function getStreak() {
  const data = storage.load("streak", { count: 0, lastDate: null });
  const today = new Date().toISOString().slice(0, 10);
  return { ...data, isToday: data.lastDate === today };
}

export function recordStudyActivity() {
  const data = storage.load("streak", { count: 0, lastDate: null });
  const today = new Date().toISOString().slice(0, 10);

  if (data.lastDate === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (data.lastDate === yesterday) {
    data.count++;
  } else if (data.lastDate !== today) {
    data.count = 1;
  }
  data.lastDate = today;
  storage.save("streak", data);
}

export function renderDashboard() {
  const el = document.getElementById("app-content");
  const questions = getState("questions") || [];
  const stats = sr.getMasteryStats(questions);
  const themeMastery = sr.getThemeMastery(questions);
  const dueCards = sr.getDueCards(questions);
  const streak = getStreak();
  const quizHistory = storage.load("quiz_history", []);

  const masteryPct = stats.total > 0 ? Math.round(((stats.mastered + stats.learning * 0.4) / stats.total) * 100) : 0;
  const readiness = Math.min(100, Math.round((stats.mastered / stats.total) * 100 * 1.25));

  const lastQuiz = quizHistory.length > 0 ? quizHistory[quizHistory.length - 1] : null;

  el.innerHTML = `
    <h1 class="mb-lg">Tableau de bord</h1>

    <div class="card mb-md">
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-value">${masteryPct}%</div>
          <div class="stat-label">Progression</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.mastered + stats.learning}/${stats.total}</div>
          <div class="stat-label">Etudiees</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${dueCards.length}</div>
          <div class="stat-label">A reviser</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${streak.count}</div>
          <div class="stat-label">Jours de suite</div>
        </div>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card-header">Estimation de preparation</div>
      <div class="progress-bar mb-sm">
        <div class="progress-bar-fill ${readiness >= 80 ? "success" : ""}" style="width: ${readiness}%"></div>
      </div>
      <p class="text-sm text-muted">
        ${readiness >= 80
          ? "Vous etes pret(e) pour l'examen !"
          : readiness >= 50
          ? "Continuez a reviser, vous progressez bien."
          : "Commencez par etudier les fiches et faire des quiz."}
      </p>
      ${lastQuiz ? `<p class="text-sm mt-sm">Dernier quiz : ${lastQuiz.percentage}% (${lastQuiz.correct}/${lastQuiz.total})</p>` : ""}
    </div>

    <div class="card mb-md">
      <div class="card-header">Progression par theme</div>
      ${Object.entries(themeMastery)
        .map(
          ([id, t]) => `
        <div class="mb-md">
          <div class="flex-between mb-sm">
            <span class="text-sm">${t.name}</span>
            <span class="text-sm text-muted">${t.studied}/${t.total}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width: ${Math.round((t.studied / t.total) * 100)}%"></div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="flex gap-md" style="flex-wrap: wrap;">
      ${dueCards.length > 0
        ? `<a href="#/flashcards?deck=due" class="btn btn-primary">Reviser ${dueCards.length} carte(s)</a>`
        : ""}
      <a href="#/quiz?mode=practice" class="btn btn-secondary">Quiz rapide</a>
      <a href="#/quiz?mode=exam" class="btn btn-secondary">Simulation examen</a>
    </div>
  `;
}
