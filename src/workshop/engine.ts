import type { Dye } from '../engine/shades.ts';
import { blankCloths, readCloth, sprayed, type Cloth } from './cloth.ts';
import { isObjectiveMet, objectiveProgress } from './features.ts';
import { generatePuzzle, type Puzzle } from './generator.ts';
import { ROTATION_STEPS, type Placement } from './geometry.ts';

/**
 * Selvedge "Workshop" puzzle (v12+): four blank cloths, each with an objective. Lay cloths on the bench,
 * overlapping and turned, and spray; whatever lies on top keeps the dye off, and a spray covers what
 * was there. Meet every objective in as few sprays as you can. Par comes from the game that generated
 * the puzzle.
 */

export interface WorkshopConfig {
  version: string;
  clothCount: number;
  /** Side of a cloth, in bench units. */
  clothSize: number;
  /** Bench width and height, in bench units. Cloth centres must lie on it. */
  benchSize: number;
  /** Share of a feature's region that must show its colour for the feature to count. */
  metThreshold: number;
  /** Share the generator demands before it describes a region as showing a colour. */
  cleanShare: number;
  /** Most features in each objective. */
  featuresPerObjective: number;
  /** Objectives allowed fewer features (see the generator). */
  plainObjectivesAllowed: number;
}

export type WorkshopMove = { kind: 'spray'; dye: Dye; /** Bottom first. */ layout: Placement[] };

export interface WorkshopState {
  config: WorkshopConfig;
  seed: number;
  puzzle: Puzzle;
  cloths: Cloth[];
  strokes: number;
  isSolved: boolean;
}

export class IllegalMoveError extends Error {}

export function createGame(seed: number, config: WorkshopConfig): WorkshopState {
  const puzzle = generatePuzzle(seed, config);
  return { config, seed, puzzle, cloths: blankCloths(config.clothCount), strokes: 0, isSolved: false };
}

export function progressOf(state: WorkshopState, clothId: number): number {
  return objectiveProgress(state.puzzle.objectives[clothId], readCloth(state.cloths[clothId], state.config.clothSize));
}

export function isClothDone(state: WorkshopState, clothId: number): boolean {
  return isObjectiveMet(state.puzzle.objectives[clothId], readCloth(state.cloths[clothId], state.config.clothSize), state.config.metThreshold);
}

function isOnBench(state: WorkshopState, placement: Placement): boolean {
  const { benchSize } = state.config;
  const isWhole = [placement.x, placement.y, placement.rotation].every(Number.isInteger);
  return isWhole && placement.x >= 0 && placement.x <= benchSize && placement.y >= 0 && placement.y <= benchSize && placement.rotation >= 0 && placement.rotation < ROTATION_STEPS;
}

/** Why `move` is illegal, or null when it is legal. Spelled out so the UI and tests can say what went wrong. */
export function illegalReason(state: WorkshopState, move: WorkshopMove): string | null {
  if (state.isSolved) return 'the puzzle is solved';
  if (move.layout.length === 0) return 'nothing is laid out';
  const ids = move.layout.map((placement) => placement.clothId);
  if (new Set(ids).size !== ids.length) return 'a cloth is laid out twice';
  if (!ids.every((id) => state.cloths[id] !== undefined)) return 'no such cloth';
  if (!move.layout.every((placement) => isOnBench(state, placement))) return 'a cloth lies off the bench';
  return null;
}

export function applyMove(state: WorkshopState, move: WorkshopMove): WorkshopState {
  const reason = illegalReason(state, move);
  if (reason !== null) throw new IllegalMoveError(`Illegal move ${JSON.stringify(move)}: ${reason}`);
  const next: WorkshopState = { ...state, cloths: sprayed(state.cloths, move.dye, move.layout, state.config.clothSize), strokes: state.strokes + 1 };
  return { ...next, isSolved: next.cloths.every((cloth) => isClothDone(next, cloth.id)) };
}

/** Strokes against par: negative is under par. */
export function scoreToPar(state: WorkshopState): number {
  return state.strokes - state.puzzle.par;
}

const PAR_NAMES = new Map<number, string>([
  [-2, 'Eagle'],
  [-1, 'Birdie'],
  [0, 'Par'],
  [1, 'Bogey'],
  [2, 'Double bogey'],
]);

export function parName(relative: number): string {
  return PAR_NAMES.get(relative) ?? (relative < 0 ? `${-relative} under par` : `${relative} over par`);
}
