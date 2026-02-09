/** Settings — dark mode, export/import, reset */
import * as storage from "../services/storage.js";

export function getSettings() {
  return storage.load("settings", {
    darkMode: false,
    dailyGoal: 20,
  });
}

export function applyTheme() {
  const settings = getSettings();
  document.documentElement.setAttribute(
    "data-theme",
    settings.darkMode ? "dark" : "light"
  );
}

export function renderSettings() {
  const el = document.getElementById("app-content");
  const settings = getSettings();

  el.innerHTML = `
    <h1 class="mb-lg">Parametres</h1>

    <div class="card mb-md">
      <div class="card-header">Affichage</div>
      <div class="flex-between mb-md">
        <span>Mode sombre</span>
        <div class="toggle ${settings.darkMode ? "active" : ""}" id="dark-toggle" role="switch" aria-checked="${settings.darkMode}" tabindex="0"></div>
      </div>
      <div class="mb-md">
        <label class="text-sm text-muted">Objectif quotidien (cartes)</label>
        <select id="daily-goal" style="display: block; width: 100%; padding: var(--sp-sm); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-top: var(--sp-xs); background: var(--bg-card); color: var(--text-primary);">
          <option value="10" ${settings.dailyGoal === 10 ? "selected" : ""}>10</option>
          <option value="20" ${settings.dailyGoal === 20 ? "selected" : ""}>20</option>
          <option value="30" ${settings.dailyGoal === 30 ? "selected" : ""}>30</option>
          <option value="50" ${settings.dailyGoal === 50 ? "selected" : ""}>50</option>
        </select>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card-header">Donnees</div>
      <div style="display: flex; flex-direction: column; gap: var(--sp-sm);">
        <button class="btn btn-secondary btn-block" id="export-btn">Exporter la progression (JSON)</button>
        <label class="btn btn-secondary btn-block" style="cursor: pointer;">
          Importer une progression
          <input type="file" accept=".json" id="import-input" style="display: none;">
        </label>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card-header" style="color: var(--error);">Zone de danger</div>
      <button class="btn btn-danger btn-block" id="reset-btn">Reinitialiser toutes les donnees</button>
      <p class="text-sm text-muted mt-sm">Cette action est irreversible. Toute votre progression sera perdue.</p>
    </div>
  `;

  // Dark mode toggle
  el.querySelector("#dark-toggle").addEventListener("click", () => {
    settings.darkMode = !settings.darkMode;
    storage.save("settings", settings);
    applyTheme();
    renderSettings();
  });

  // Daily goal
  el.querySelector("#daily-goal").addEventListener("change", (e) => {
    settings.dailyGoal = parseInt(e.target.value, 10);
    storage.save("settings", settings);
  });

  // Export
  el.querySelector("#export-btn").addEventListener("click", () => {
    const data = storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formation-civique-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import
  el.querySelector("#import-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        storage.importAll(data);
        alert("Progression importee avec succes !");
        renderSettings();
      } catch {
        alert("Fichier invalide.");
      }
    };
    reader.readAsText(file);
  });

  // Reset
  el.querySelector("#reset-btn").addEventListener("click", () => {
    showConfirmModal(el);
  });
}

function showConfirmModal(parentEl) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>Confirmer la reinitialisation</h2>
      <p class="mb-lg">Toute votre progression sera supprimee. Cette action est irreversible.</p>
      <div style="display: flex; gap: var(--sp-sm); justify-content: flex-end;">
        <button class="btn btn-secondary" id="cancel-reset">Annuler</button>
        <button class="btn btn-danger" id="confirm-reset">Reinitialiser</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#cancel-reset").addEventListener("click", () => {
    overlay.remove();
  });

  overlay.querySelector("#confirm-reset").addEventListener("click", () => {
    storage.clearAll();
    overlay.remove();
    alert("Donnees reinitialisees.");
    renderSettings();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}
