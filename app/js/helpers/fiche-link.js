/** Render a "learn more" link to the primary related fiche */
import { getState } from "../state.js";

export function ficheLink(question) {
  const ids = question.relatedFicheIds;
  if (!ids || ids.length === 0) return "";

  const fichesData = getState("fichesData");
  if (!fichesData) return "";

  const fiche = fichesData.fiches.find((f) => f.id === ids[0]);
  if (!fiche) return "";

  const href = `#/study?fiche=${encodeURIComponent(fiche.id)}`;
  return `<p class="mt-sm text-sm"><a href="${href}" style="color: var(--accent); text-decoration: none;">Fiche : ${fiche.title} &rarr;</a></p>`;
}
