import type { TagsMove } from '../selvedge/tags/engine.ts';

export interface LoggedMove {
  move: TagsMove;
  /** Milliseconds since the game started. */
  atMs: number;
}

export interface GameLog {
  rules: string;
  seed: number;
  startedAt: string;
  moves: LoggedMove[];
  /** Cloths shipped, once the game is over. */
  finalScore: number | null;
  /** UI events (rules opened, menu opened, …) that help explain hesitation. */
  events: { kind: string; atMs: number }[];
}

export function startLog(rules: string, seed: number): GameLog {
  return { rules, seed, startedAt: new Date().toISOString(), moves: [], finalScore: null, events: [] };
}

export function elapsedMs(log: GameLog): number {
  return Date.now() - Date.parse(log.startedAt);
}

export function withMove(log: GameLog, move: TagsMove): GameLog {
  return { ...log, moves: [...log.moves, { move, atMs: elapsedMs(log) }] };
}

export function withEvent(log: GameLog, kind: string): GameLog {
  return { ...log, events: [...log.events, { kind, atMs: elapsedMs(log) }] };
}

export function withFinalScore(log: GameLog, finalScore: number): GameLog {
  return { ...log, finalScore };
}

/** `h <cloth> <peg> <quarter turns>` for a hang, `a <cloth>` for setting a cloth aside, `i` for calling the inspection early. */
export function encodeMove(move: TagsMove): string {
  switch (move.kind) {
    case 'hang':
      return `h ${move.clothId} ${move.cell} ${move.turns}`;
    case 'setAside':
      return `a ${move.clothId}`;
    case 'inspect':
      return 'i';
  }
}

export function decodeMove(text: string): TagsMove {
  const [kind, clothId, cell, turns] = text.trim().split(' ');
  if (kind === 'i') return { kind: 'inspect' };
  if (kind === 'h') return { kind: 'hang', clothId: Number(clothId), cell: Number(cell), turns: Number(turns) };
  if (kind === 'a') return { kind: 'setAside', clothId: Number(clothId) };
  throw new Error(`Unrecognised logged move "${text}"`);
}

/** Compact text a playtester can paste into chat. One move per line: `m <move> <ms>`. */
export function formatLogForExport(logs: readonly GameLog[]): string {
  return logs
    .map((log) =>
      [
        `# game rules=${log.rules} seed=${log.seed} started=${log.startedAt} final=${log.finalScore ?? 'unfinished'}`,
        ...log.moves.map(({ move, atMs }) => `m ${encodeMove(move)} ${atMs}`),
        ...log.events.map(({ kind, atMs }) => `e ${kind} ${atMs}`),
      ].join('\n'),
    )
    .join('\n');
}

/** Moves from an exported log, for replaying a game exactly. */
export function parseExportedMoves(text: string): TagsMove[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('m '))
    .map((line) => decodeMove(line.slice(2).replace(/\s\d+$/, '')));
}
