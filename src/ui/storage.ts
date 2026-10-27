import type { GameLog } from './gameLog.ts';

const LOGS_KEY = 'mordant.logs.v1';

/**
 * Logs live in this browser only. Storage can be unavailable (private mode,
 * blocked site data); the game still works, the export just covers this session.
 */
export function loadLogs(): GameLog[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? (JSON.parse(raw) as GameLog[]) : []; // written only by saveLogs below
  } catch (error) {
    console.warn('Could not read saved game logs; starting with none.', error);
    return [];
  }
}

export function saveLogs(logs: readonly GameLog[]): void {
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch (error) {
    console.warn('Could not save game logs; export still works until this tab closes.', error);
  }
}
