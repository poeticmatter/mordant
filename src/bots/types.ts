import type { Random } from '../engine/rng.ts';

export interface MoveEvaluation<M> {
  move: M;
  /** Expected final score as estimated by the bot. */
  value: number;
  samples: number;
}

export interface Decision<M> {
  move: M;
  /** Present for searching bots; feeds decision-density metrics. */
  evaluations?: MoveEvaluation<M>[];
}

export interface Bot<S, M> {
  name: string;
  decide(state: S, rng: Random): Decision<M>;
}

/** What a finished game shipped, in terms the strategy and variety metrics understand. */
export interface ShipmentRecord {
  /** Identity of what was asked for, ignoring which copy (run-variety metric). */
  orderKey: string;
  /** Strategy label, fixed per ruleset before looking at any results (strategic-diversity metric). */
  category: string;
  points: number;
  season: number;
}

export type MoveHeuristic<S, M> = (state: S, rng: Random) => M;

/**
 * Everything bots and the simulator need from a ruleset. Each game family (Mordant
 * v1–v5, Selvedge v6+) provides one, so search and metrics are written once.
 */
export interface GameAdapter<S, M> {
  legalMoves(state: S): M[];
  /** Legal moves with functionally identical ones (same card state on the same peg) collapsed. */
  distinctMoves(state: S): M[];
  cloneState(state: S): S;
  applyMove(state: S, move: M): S;
  /** Mutates `state`; only for private simulation clones. */
  applyMoveInPlace(state: S, move: M): void;
  isOver(state: S): boolean;
  score(state: S): number;
  isWin(state: S): boolean;
  season(state: S): number;
  /** A private clone with everything hidden from the player (pile order, future shuffles) re-guessed. */
  determinize(state: S, rng: Random): S;
  /** One-move heuristics by name; must include `greedy` and `humanProxy`. */
  heuristics: Readonly<Record<string, MoveHeuristic<S, M>>>;
  /** Ablation: what a player who ignores carried-over memory believes the state is. */
  forgetCarriedMemory(state: S): S;
  /** Ablation: the same card on a random legal spot. */
  withRandomPlacement(state: S, move: M, rng: Random): M;
  /** Legibility metric: cards whose summary look changed, and cards whose memory changed at all. */
  visibleChanges(before: S, after: S): { lookChanges: number; memoryChanges: number };
  shipments(state: S): ShipmentRecord[];
  /** Number of strategy labels `shipments` can produce. */
  strategyLabelCount: number;
}
