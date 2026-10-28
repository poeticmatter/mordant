import type { GameLog } from './gameLog.ts';

/** One key per move shape: v1–v5, v6–v7 (pattern book), v8 (tagged cloths), v9 (workshop). */
export const LOG_KEYS = {
  tags: 'selvedge.logs.v8',
  workshop: 'selvedge.logs.v9',
} as const;

/**
 * Logs live in this browser only. Storage can be unavailable (private mode,
 * blocked site data); the game still works, the export just covers this session.
 */
export function loadLogs<M>(key: string): GameLog<M>[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as GameLog<M>[]) : []; // written only by saveLogs below, under the same key
  } catch (error) {
    console.warn(`Could not read saved game logs (${key}); starting with none.`, error);
    return [];
  }
}

export function saveLogs<M>(key: string, logs: readonly GameLog<M>[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(logs));
  } catch (error) {
    console.warn(`Could not save game logs (${key}); export still works until this tab closes.`, error);
  }
}
