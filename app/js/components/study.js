/** Study mode — browse fiches by theme, read content */
import { getState } from "../state.js";
import * as storage from "../services/storage.js";

function getReadFiches() {
  return storage.load("fiches_read", {});
}

function markAsRead(ficheId) {
  const read = getReadFiches();
  read[ficheId] = Date.now();
  storage.save("fiches_read", read);
}

export function renderStudy(params = {}) {
  const el = document.getElementById("app-content");
  const fichesData = getState("fichesData");
  const questions = getState("questions") || [];

  if (!fichesData) {
    el.innerHTML = '<div class="empty-state"><p>Chargement des fiches...</p></div>';
    return;
  }

  if (params.fiche) {
    renderFiche(el, params.fiche, fichesData, questions);
    return;
  }

  renderThemeBrowser(el, fichesData);
}

function renderThemeBrowser(el, fichesData) {
  const index = fichesData.index;
  const readFiches = getReadFiches();

  el.innerHTML = `
    <h1 class="mb-lg">Fiches d'etude</h1>
    <div class="card">
      ${index.themes
        .map(
          (theme, ti) => `
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" data-theme="${ti}">
            <span>
              <strong>${theme.name}</strong>
              <span class="text-sm text-muted"> — ${theme.subcategories.reduce((a, s) => a + s.fiches.length, 0)} fiches</span>
            </span>
            <span class="arrow">&#9654;</span>
          </button>
          <div class="accordion-content" id="theme-${ti}">
            <div class="accordion-content-inner">
              ${theme.subcategories
                .map(
                  (subcat) => `
                <h3 class="mt-md mb-sm" style="font-size: var(--fs-sm); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                  ${subcat.name}
                </h3>
                ${subcat.fiches
                  .map(
                    (f) => `
                  <a href="#/study?fiche=${encodeURIComponent(f.id)}" class="list-item" style="text-decoration: none; color: inherit;">
                    <span>${f.title} ${readFiches[f.id] ? '<span class="badge badge-success">Lu</span>' : ""}</span>
                    <span class="arrow" style="color: var(--text-muted);">&#9654;</span>
                  </a>
                `
                  )
                  .join("")}
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  // Accordion behavior
  el.querySelectorAll(".accordion-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      const content = btn.nextElementSibling;
      content.classList.toggle("open", !expanded);
    });
  });
}

function renderFiche(el, ficheId, fichesData, questions) {
  const fiche = fichesData.fiches.find((f) => f.id === ficheId);
  if (!fiche) {
    el.innerHTML = '<div class="empty-state"><p>Fiche non trouvee.</p></div>';
    return;
  }

  // Find related questions
  const relatedQ = questions.filter((q) => q.themeId === fiche.themeId).slice(0, 5);

  // Find prev/next fiche in same subcategory
  const sameSub = fichesData.fiches.filter(
    (f) => f.themeId === fiche.themeId && f.subcategoryId === fiche.subcategoryId
  );
  const idx = sameSub.findIndex((f) => f.id === ficheId);
  const prev = idx > 0 ? sameSub[idx - 1] : null;
  const next = idx < sameSub.length - 1 ? sameSub[idx + 1] : null;

  el.innerHTML = `
    <div class="mb-md">
      <a href="#/study" style="color: var(--text-secondary);">&larr; Retour aux fiches</a>
    </div>

    <div class="card mb-md">
      <div class="flex-between mb-sm">
        <span class="badge">${fiche.themeName}</span>
        <button class="btn btn-sm btn-secondary" id="mark-read-btn">
          Marquer comme lu
        </button>
      </div>

      <h1 class="mb-md">${fiche.title}</h1>

      ${fiche.objectives.length > 0
        ? `
        <div class="mb-md" style="background: var(--accent-light); padding: var(--sp-md); border-radius: var(--radius-md);">
          <strong>Objectifs :</strong>
          <ul style="margin-top: var(--sp-xs); padding-left: var(--sp-lg);">
            ${fiche.objectives.map((o) => `<li>${o}</li>`).join("")}
          </ul>
        </div>
      `
        : ""}

      <div class="fiche-content">
        ${fiche.sections
          .map(
            (s) => `
          <h3>${s.heading}</h3>
          ${s.content
            .split("\n\n")
            .map((p) => {
              if (p.startsWith("- ")) {
                return `<ul>${p
                  .split("\n")
                  .filter((l) => l.startsWith("- "))
                  .map((l) => `<li>${l.slice(2)}</li>`)
                  .join("")}</ul>`;
              }
              return `<p>${p}</p>`;
            })
            .join("")}
        `
          )
          .join("")}
      </div>

      ${fiche.references.length > 0
        ? `
        <div class="mt-lg">
          <h3>Pour aller plus loin</h3>
          <ul style="padding-left: var(--sp-lg);">
            ${fiche.references.map((r) => `<li><a href="${r.url}" target="_blank" rel="noopener">${r.label}</a></li>`).join("")}
          </ul>
        </div>
      `
        : ""}
    </div>

    <div class="flex-between mb-md">
      ${prev ? `<a href="#/study?fiche=${encodeURIComponent(prev.id)}" class="btn btn-secondary">&larr; Precedent</a>` : "<span></span>"}
      ${next ? `<a href="#/study?fiche=${encodeURIComponent(next.id)}" class="btn btn-secondary">Suivant &rarr;</a>` : "<span></span>"}
    </div>

    ${relatedQ.length > 0
      ? `
      <div class="card">
        <div class="card-header">Questions liees</div>
        ${relatedQ.map((q) => `<div class="list-item"><span class="text-sm">${q.questionText}</span></div>`).join("")}
        <div class="mt-sm">
          <a href="#/quiz?mode=practice&theme=${fiche.themeId}" class="btn btn-sm btn-secondary">Quiz sur ce theme</a>
        </div>
      </div>
    `
      : ""}
  `;

  // Mark as read button
  el.querySelector("#mark-read-btn").addEventListener("click", (e) => {
    markAsRead(ficheId);
    e.target.textContent = "Lu !";
    e.target.classList.remove("btn-secondary");
    e.target.classList.add("btn-success");
    e.target.disabled = true;
  });
}
