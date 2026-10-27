import type { Move } from '../engine/game.ts';

export interface LoggedMove {
  move: Move;
  /** Milliseconds since the game started. */
  atMs: number;
}

export interface GameLog {
  rules: string;
  seed: number;
  startedAt: string;
  moves: LoggedMove[];
  finalScore: number | null;
  /** Free-form UI events (rules opened, undo used, …) that help explain hesitation. */
  events: { kind: string; atMs: number }[];
}

export function startLog(rules: string, seed: number): GameLog {
  return { rules, seed, startedAt: new Date().toISOString(), moves: [], finalScore: null, events: [] };
}

export function elapsedMs(log: GameLog): number {
  return Date.now() - Date.parse(log.startedAt);
}

export function withMove(log: GameLog, move: Move): GameLog {
  return { ...log, moves: [...log.moves, { move, atMs: elapsedMs(log) }] };
}

export function withEvent(log: GameLog, kind: string): GameLog {
  return { ...log, events: [...log.events, { kind, atMs: elapsedMs(log) }] };
}

export function withFinalScore(log: GameLog, finalScore: number): GameLog {
  return { ...log, finalScore };
}

/** Compact text a playtester can paste into chat. One move per line keeps it diffable. */
export function formatLogForExport(logs: readonly GameLog[]): string {
  return logs
    .map((log) =>
      [
        `# game rules=${log.rules} seed=${log.seed} started=${log.startedAt} final=${log.finalScore ?? 'unfinished'}`,
        ...log.moves.map(({ move, atMs }) => `m ${move.clothId} ${move.cell} ${atMs}`),
        ...log.events.map(({ kind, atMs }) => `e ${kind} ${atMs}`),
      ].join('\n'),
    )
    .join('\n');
}
