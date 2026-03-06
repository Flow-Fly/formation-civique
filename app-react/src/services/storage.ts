import type { ExamCode } from "@/types/index.ts";

const PREFIX = "fc_";
const MIGRATION_MARKER = "migration_exam_scoped_v1";

function scopedName(key: string, exam?: ExamCode): string {
  return exam ? `${key}__${exam}` : key;
}

function fullKey(key: string): string {
  return PREFIX + key;
}

export function load<T>(key: string, fallback: T, exam?: ExamCode): T {
  try {
    const raw = localStorage.getItem(fullKey(scopedName(key, exam)));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown, exam?: ExamCode): void {
  try {
    localStorage.setItem(fullKey(scopedName(key, exam)), JSON.stringify(value));
  } catch (e) {
    console.warn("Storage save failed:", e);
  }
}

export function remove(key: string, exam?: ExamCode): void {
  localStorage.removeItem(fullKey(scopedName(key, exam)));
}

export function exportAll(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      try {
        data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
      } catch {
        data[k.slice(PREFIX.length)] = localStorage.getItem(k);
      }
    }
  }
  return data;
}

export function importAll(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    try {
      localStorage.setItem(fullKey(key), JSON.stringify(value));
    } catch {
      // ignore malformed import entries
    }
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

export function migrateLegacyExamData(defaultExam: ExamCode = "CR"): void {
  try {
    const marker = load<boolean>(MIGRATION_MARKER, false);
    if (marker) return;

    const keysToMigrate = ["sm2_data", "quiz_history", "streak", "fiches_read"];

    for (const key of keysToMigrate) {
      const legacyKey = fullKey(key);
      const scopedKey = fullKey(scopedName(key, defaultExam));

      const legacyRaw = localStorage.getItem(legacyKey);
      const scopedRaw = localStorage.getItem(scopedKey);

      if (legacyRaw && !scopedRaw) {
        localStorage.setItem(scopedKey, legacyRaw);
      }
    }

    save(MIGRATION_MARKER, true);
  } catch (e) {
    console.warn("Legacy exam data migration failed:", e);
  }
}
