export const APP_OPEN_SEARCH_EVENT = "formation-civique:open-search";

export function openSearchDialog() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APP_OPEN_SEARCH_EVENT));
}
