import type { RulesConfig } from '../engine/config.ts';
import {
  applyMove,
  canSoak,
  createGame,
  neighboursOf,
  type GameState,
  type Move,
  type Shipment,
} from '../engine/game.ts';

export function replayGame(seed: number, moves: readonly Move[], config: RulesConfig): GameState {
  return moves.reduce((state, move) => applyMove(state, move), createGame(seed, config));
}

export interface InspectionReport {
  season: number;
  shipments: Shipment[];
  pointsEarned: number;
}

/** What the inspector saw, if `move` ended a season; null otherwise. */
export function inspectionAfter(before: GameState, move: Move, after: GameState): InspectionReport | null {
  if (after.season === before.season && !after.isOver) return null;
  const shipments = after.shipments.filter((shipment) => shipment.season === before.season);
  return {
    season: before.season,
    shipments,
    pointsEarned: shipments.reduce((sum, shipment) => sum + shipment.points, 0),
  };
}

/** Cloths that a hang on `cell` would soak, i.e. occupied orthogonal neighbours. */
export function soakedBy(state: GameState, cell: number): number[] {
  return neighboursOf(cell, state.config)
    .map((neighbourCell) => state.rack[neighbourCell])
    .filter((clothId): clothId is number => clothId !== null && canSoak(state, clothId));
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
