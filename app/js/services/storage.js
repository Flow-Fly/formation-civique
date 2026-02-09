/** localStorage abstraction with fc_ prefix */
const PREFIX = "fc_";

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn("Storage save failed:", e);
  }
}

export function remove(key) {
  localStorage.removeItem(PREFIX + key);
}

export function exportAll() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(PREFIX)) {
      data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
    }
  }
  return data;
}

export function importAll(data) {
  for (const [key, value] of Object.entries(data)) {
    save(key, value);
  }
}

export function clearAll() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
