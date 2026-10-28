import { shuffle } from '../engine/rng.ts';
import type { Dye } from '../engine/shades.ts';
import { readCloth, type Cloth, type SprayLayer } from './cloth.ts';
import { coversFrom, ROTATION_STEPS, type Placement } from './geometry.ts';
import { dealObjectives, matchOf, starsFor, type Objective } from './objectives.ts';

/**
 * Selvedge "Workshop" (v9+): lay blank cloths on a bench, overlapping and turned as you like, and spray
 * them. Whatever lies on top keeps the dye off, so every cloth builds up a pattern from its history.
 * From v11, finished cloths are delivered to commissions that ask for particular patterns.
 */

export interface WorkshopConfig {
  version: string;
  clothCount: number;
  /** Side of a cloth, in bench units. */
  clothSize: number;
  /** Bench width and height, in bench units. Cloth centres must lie on it. */
  benchSize: number;
  handSize: number;
  rounds: number;
  commissionCount: number;
  /** Match needed for one, two and three stars. */
  starThresholds: readonly [number, number, number];
}

export interface Commission {
  id: number;
  objective: Objective;
  clothId: number | null;
  stars: number | null;
}

export type WorkshopMove =
  | { kind: 'spray'; dye: Dye; /** Bottom first. */ layout: Placement[] }
  | { kind: 'deliver'; clothId: number; commissionId: number }
  | { kind: 'endRound' };

export interface WorkshopState {
  config: WorkshopConfig;
  seed: number;
  rngState: number;
  round: number;
  cloths: Cloth[];
  /** Cloths waiting to be drawn, top of the pile at the end. */
  deck: number[];
  /** Cloths drawn this round and not yet delivered. */
  bench: number[];
  hasSprayed: boolean;
  commissions: Commission[];
  isOver: boolean;
}

export class IllegalMoveError extends Error {}

export function createGame(seed: number, config: WorkshopConfig): WorkshopState {
  const cloths = Array.from({ length: config.clothCount }, (_, id): Cloth => ({ id, layers: [], deliveredTo: null }));
  const dealt = dealObjectives(config.commissionCount, seed >>> 0);
  const state: WorkshopState = {
    config,
    seed,
    rngState: dealt.rngState,
    round: 0,
    cloths,
    deck: cloths.map((cloth) => cloth.id),
    bench: [],
    hasSprayed: false,
    commissions: dealt.objectives.map((objective, id) => ({ id, objective, clothId: null, stars: null })),
    isOver: false,
  };
  startRoundInPlace(state);
  return state;
}

export function cloneState(state: WorkshopState): WorkshopState {
  return {
    ...state,
    // Layers are never mutated once made, so sharing them is safe.
    cloths: state.cloths.map((cloth) => ({ ...cloth, layers: cloth.layers.slice() })),
    deck: state.deck.slice(),
    bench: state.bench.slice(),
    commissions: state.commissions.map((commission) => ({ ...commission })),
  };
}

/** How well a cloth meets a commission right now, from 0 to 1. */
export function matchFor(state: WorkshopState, clothId: number, commission: Commission): number {
  return matchOf(commission.objective, readCloth(state.cloths[clothId], state.config.clothSize));
}

export function starsForMatch(state: WorkshopState, match: number): number {
  return starsFor(match, state.config.starThresholds);
}

function isOnBench(state: WorkshopState, placement: Placement): boolean {
  const { benchSize } = state.config;
  const isWhole = [placement.x, placement.y, placement.rotation].every(Number.isInteger);
  return isWhole && placement.x >= 0 && placement.x <= benchSize && placement.y >= 0 && placement.y <= benchSize && placement.rotation >= 0 && placement.rotation < ROTATION_STEPS;
}

/** Why `move` is illegal, or null when it is legal. Spelled out so the UI and tests can say what went wrong. */
export function illegalReason(state: WorkshopState, move: WorkshopMove): string | null {
  if (state.isOver) return 'the game is over';
  if (move.kind === 'endRound') return null;
  if (move.kind === 'deliver') {
    if (!state.bench.includes(move.clothId)) return 'that cloth is not on the bench';
    const commission = state.commissions[move.commissionId];
    if (!commission) return 'no such commission';
    if (commission.clothId !== null) return 'that commission is already filled';
    return null;
  }
  if (state.hasSprayed) return 'you already sprayed this round';
  if (move.layout.length === 0) return 'nothing is laid out';
  const ids = move.layout.map((placement) => placement.clothId);
  if (new Set(ids).size !== ids.length) return 'a cloth is laid out twice';
  if (!ids.every((id) => state.bench.includes(id))) return 'a cloth in the layout is not on the bench';
  if (!move.layout.every((placement) => isOnBench(state, placement))) return 'a cloth lies off the bench';
  return null;
}

export function applyMove(state: WorkshopState, move: WorkshopMove): WorkshopState {
  const reason = illegalReason(state, move);
  if (reason !== null) throw new IllegalMoveError(`Illegal move ${JSON.stringify(move)}: ${reason}`);
  const next = cloneState(state);
  applyMoveInPlace(next, move);
  return next;
}

/** Mutates `state`. Only for simulations that own a private clone; everything else uses `applyMove`. */
export function applyMoveInPlace(state: WorkshopState, move: WorkshopMove): void {
  switch (move.kind) {
    case 'spray':
      sprayInPlace(state, move.dye, move.layout);
      return;
    case 'deliver':
      deliverInPlace(state, move.clothId, move.commissionId);
      return;
    case 'endRound':
      endRoundInPlace(state);
  }
}

/** The layer each laid-out cloth takes from a spray: everything not covered by a cloth above it. */
export function sprayLayers(state: WorkshopState, dye: Dye, layout: readonly Placement[]): Map<number, SprayLayer> {
  return new Map(layout.map((placement, depth) => [placement.clothId, { dye, covers: coversFrom(layout, depth, state.config.clothSize) }]));
}

function sprayInPlace(state: WorkshopState, dye: Dye, layout: readonly Placement[]): void {
  for (const [clothId, layer] of sprayLayers(state, dye, layout)) state.cloths[clothId].layers.push(layer);
  state.hasSprayed = true;
}

function deliverInPlace(state: WorkshopState, clothId: number, commissionId: number): void {
  const commission = state.commissions[commissionId];
  commission.clothId = clothId;
  commission.stars = starsForMatch(state, matchFor(state, clothId, commission));
  state.cloths[clothId].deliveredTo = commissionId;
  state.bench.splice(state.bench.indexOf(clothId), 1);
  if (state.commissions.every((other) => other.clothId !== null)) state.isOver = true;
}

function endRoundInPlace(state: WorkshopState): void {
  state.deck.push(...state.bench);
  state.bench = [];
  state.round++;
  if (state.round >= state.config.rounds || state.deck.length === 0) {
    state.isOver = true;
    return;
  }
  startRoundInPlace(state);
}

function startRoundInPlace(state: WorkshopState): void {
  const shuffled = shuffle(state.deck, state.rngState);
  state.rngState = shuffled.nextRngState;
  state.deck = shuffled.items;
  state.bench = state.deck.splice(-state.config.handSize).reverse();
  state.hasSprayed = false;
}

export function totalStars(state: WorkshopState): number {
  return state.commissions.reduce((sum, commission) => sum + (commission.stars ?? 0), 0);
}

export function openCommissions(state: WorkshopState): Commission[] {
  return state.commissions.filter((commission) => commission.clothId === null);
}
