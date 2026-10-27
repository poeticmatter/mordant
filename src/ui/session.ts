import { applyMove, createGame, neighbourCell, SIDES, type Commission, type SelvedgeConfig, type SelvedgeMove, type SelvedgeState } from '../selvedge/engine.ts';

export function replayGame(seed: number, moves: readonly SelvedgeMove[], config: SelvedgeConfig): SelvedgeState {
  return moves.reduce((state, move) => applyMove(state, move), createGame(seed, config));
}

export interface InspectionReport {
  season: number;
  filled: Commission[];
  stillOpen: Commission[];
}

/** What the inspector did, if `move` ended a season; null otherwise. */
export function inspectionAfter(before: SelvedgeState, after: SelvedgeState): InspectionReport | null {
  if (after.season === before.season && !after.isOver) return null;
  return {
    season: before.season,
    filled: after.commissions.filter((commission) => commission.completedSeason === before.season),
    stillOpen: after.commissions.filter((commission) => commission.completedSeason === null),
  };
}

/** Cloths a hang on `cell` would touch (and so stain, and be stained by). */
export function touchedBy(state: SelvedgeState, cell: number): number[] {
  return SIDES.map((side) => neighbourCell(cell, side, state.config))
    .map((neighbourAt) => (neighbourAt === null ? null : state.rack[neighbourAt]))
    .filter((clothId): clothId is number => clothId !== null);
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
