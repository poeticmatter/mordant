export interface LoggedMove<M> {
  move: M;
  /** Milliseconds since the game started. */
  atMs: number;
}

/** One game's playtest log. `M` is the game's move type; each game supplies its own text codec. */
export interface GameLog<M> {
  rules: string;
  seed: number;
  startedAt: string;
  moves: LoggedMove<M>[];
  /** Final score, once the game is over. */
  finalScore: number | null;
  /** UI events (rules opened, menu opened, …) that help explain hesitation. */
  events: { kind: string; atMs: number }[];
}

export interface MoveCodec<M> {
  encode(move: M): string;
  decode(text: string): M;
}

export function startLog<M>(rules: string, seed: number): GameLog<M> {
  return { rules, seed, startedAt: new Date().toISOString(), moves: [], finalScore: null, events: [] };
}

export function elapsedMs<M>(log: GameLog<M>): number {
  return Date.now() - Date.parse(log.startedAt);
}

export function withMove<M>(log: GameLog<M>, move: M): GameLog<M> {
  return { ...log, moves: [...log.moves, { move, atMs: elapsedMs(log) }] };
}

export function withEvent<M>(log: GameLog<M>, kind: string): GameLog<M> {
  return { ...log, events: [...log.events, { kind, atMs: elapsedMs(log) }] };
}

export function withFinalScore<M>(log: GameLog<M>, finalScore: number): GameLog<M> {
  return { ...log, finalScore };
}

/** Compact text a playtester can paste into chat. One move per line: `m <move> <ms>`. */
export function formatLogForExport<M>(logs: readonly GameLog<M>[], codec: MoveCodec<M>): string {
  return logs
    .map((log) =>
      [
        `# game rules=${log.rules} seed=${log.seed} started=${log.startedAt} final=${log.finalScore ?? 'unfinished'}`,
        ...log.moves.map(({ move, atMs }) => `m ${codec.encode(move)} ${atMs}`),
        ...log.events.map(({ kind, atMs }) => `e ${kind} ${atMs}`),
      ].join('\n'),
    )
    .join('\n');
}

/** Moves from an exported log, for replaying a game exactly. */
export function parseExportedMoves<M>(text: string, codec: MoveCodec<M>): M[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('m '))
    .map((line) => codec.decode(line.slice(2).replace(/\s\d+$/, '')));
}
