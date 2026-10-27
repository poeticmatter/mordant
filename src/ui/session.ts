import { neighbourCell, SIDES } from '../selvedge/grid.ts';
import { applyMove, createGame, type Cloth, type TagsConfig, type TagsMove, type TagsState } from '../selvedge/tags/engine.ts';

export function replayGame(seed: number, moves: readonly TagsMove[], config: TagsConfig): TagsState {
  return moves.reduce((state, move) => applyMove(state, move), createGame(seed, config));
}

export interface InspectionReport {
  season: number;
  shipped: Cloth[];
  /** Cloths you still own, going back in the basket. */
  keptCount: number;
}

/** What the inspector did, if `move` ended a season; null otherwise. */
export function inspectionAfter(before: TagsState, after: TagsState): InspectionReport | null {
  if (after.season === before.season && !after.isOver) return null;
  return {
    season: before.season,
    shipped: after.cloths.filter((cloth) => cloth.shippedSeason === before.season),
    keptCount: after.cloths.filter((cloth) => cloth.shippedSeason === null && !cloth.isSetAside).length,
  };
}

/** Cloths a hang on `cell` would touch (and so mix colours with). */
export function touchedBy(state: TagsState, cell: number): number[] {
  return SIDES.map((side) => neighbourCell(cell, side, state.config))
    .map((neighbourAt) => (neighbourAt === null ? null : state.rack[neighbourAt]))
    .filter((clothId): clothId is number => clothId !== null);
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
