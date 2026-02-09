const PREFIX = "fc_";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn("Storage save failed:", e);
  }
}

export function remove(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

export function exportAll(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
    }
  }
  return data;
}

export function importAll(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    save(key, value);
  }
}

export function clearAll(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
