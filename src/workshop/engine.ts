import { shuffle } from '../engine/rng.ts';
import type { Dye } from '../engine/shades.ts';
import { exposedThreads, ROTATION_STEPS, type Placement } from './geometry.ts';

/**
 * Selvedge v9, "Workshop": lay blank cloths on a bench, overlapping and turned as you like, and spray
 * them. Whatever lies on top resists the dye, so every cloth builds up a pattern from its history.
 * Finished cloths are sewn into a quilt.
 */

/** The primaries soaked into a thread, as a bit set (`1 << dye` for each); 0 is undyed. */
export type Mix = number;
export const UNDYED: Mix = 0;
export const BROWN: Mix = 0b111;

export function mixOf(dye: Dye): Mix {
  return 1 << dye;
}

export interface WorkshopConfig {
  version: string;
  clothCount: number;
  /** Threads along each side of a cloth; a cloth is that many bench units wide. */
  threads: number;
  /** Bench width and height, in bench units. Cloth centres must lie on it. */
  benchSize: number;
  handSize: number;
  rounds: number;
  quiltWidth: number;
  quiltHeight: number;
  /** Points for a quilt square showing at least `colourfulMinimum` different dyed colours. */
  colourfulBonus: number;
  colourfulMinimum: number;
}

export interface Cloth {
  id: number;
  /** Row-major, `threads × threads`. Threads only ever gain dye. */
  threads: Mix[];
  isQuilted: boolean;
}

export interface Patch {
  clothId: number;
  /** Quarter turns clockwise as sewn in. */
  turns: number;
}

export type WorkshopMove =
  | { kind: 'spray'; dye: Dye; /** Bottom first. */ layout: Placement[] }
  | { kind: 'quilt'; clothId: number; slot: number; turns: number }
  | { kind: 'endRound' };

export interface WorkshopState {
  config: WorkshopConfig;
  seed: number;
  rngState: number;
  round: number;
  cloths: Cloth[];
  /** Cloths waiting to be drawn, top of the pile at the end. */
  deck: number[];
  /** Cloths drawn this round and not yet sewn into the quilt. */
  bench: number[];
  hasSprayed: boolean;
  quilt: (Patch | null)[];
  isOver: boolean;
}

export class IllegalMoveError extends Error {}

export function createGame(seed: number, config: WorkshopConfig): WorkshopState {
  const cloths = Array.from({ length: config.clothCount }, (_, id): Cloth => ({
    id,
    threads: new Array<Mix>(config.threads * config.threads).fill(UNDYED),
    isQuilted: false,
  }));
  const state: WorkshopState = {
    config,
    seed,
    rngState: seed >>> 0,
    round: 0,
    cloths,
    deck: cloths.map((cloth) => cloth.id),
    bench: [],
    hasSprayed: false,
    quilt: new Array<Patch | null>(config.quiltWidth * config.quiltHeight).fill(null),
    isOver: false,
  };
  startRoundInPlace(state);
  return state;
}

export function cloneState(state: WorkshopState): WorkshopState {
  return {
    ...state,
    cloths: state.cloths.map((cloth) => ({ ...cloth, threads: cloth.threads.slice() })),
    deck: state.deck.slice(),
    bench: state.bench.slice(),
    quilt: state.quilt.map((patch) => (patch === null ? null : { ...patch })),
  };
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
  if (move.kind === 'quilt') {
    if (!state.bench.includes(move.clothId)) return 'that cloth is not on the bench';
    if (state.quilt[move.slot] !== null) return 'that quilt slot is taken';
    if (!Number.isInteger(move.turns) || move.turns < 0 || move.turns > 3) return 'turns must be 0–3';
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
    case 'quilt':
      state.quilt[move.slot] = { clothId: move.clothId, turns: move.turns };
      state.cloths[move.clothId].isQuilted = true;
      state.bench.splice(state.bench.indexOf(move.clothId), 1);
      if (state.quilt.every((patch) => patch !== null)) state.isOver = true;
      return;
    case 'endRound':
      endRoundInPlace(state);
  }
}

/** Every thread not covered by a cloth above it takes the dye. */
export function sprayedThreads(state: WorkshopState, dye: Dye, layout: readonly Placement[]): Map<number, Mix[]> {
  const exposed = exposedThreads(layout, state.config.threads);
  return new Map(
    layout.map((placement, depth) => [
      placement.clothId,
      state.cloths[placement.clothId].threads.map((mix, index) => (exposed[depth][index] ? mix | mixOf(dye) : mix)),
    ]),
  );
}

function sprayInPlace(state: WorkshopState, dye: Dye, layout: readonly Placement[]): void {
  for (const [clothId, threads] of sprayedThreads(state, dye, layout)) state.cloths[clothId].threads = threads;
  state.hasSprayed = true;
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

export function freeSlots(state: WorkshopState): number[] {
  return state.quilt.flatMap((patch, slot) => (patch === null ? [slot] : []));
}
