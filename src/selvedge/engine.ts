import { shuffle, nextRandom } from '../engine/rng.ts';
import { DYES, type Dye } from '../engine/shades.ts';

/** Sides in clockwise order; `OPPOSITE[side]` is the side that faces it. */
export const TOP = 0;
export const RIGHT = 1;
export const BOTTOM = 2;
export const LEFT = 3;
export const SIDES = [TOP, RIGHT, BOTTOM, LEFT] as const;
export const OPPOSITE = [BOTTOM, LEFT, TOP, RIGHT] as const;

export interface SelvedgeConfig {
  version: string;
  rackWidth: number;
  rackHeight: number;
  clothsPerDye: number;
  handSize: number;
  seasons: number;
  /** How many edges each commission in the pattern book fixes; its length is the book's size. */
  fixedEdgesPerCommission: readonly number[];
  /** Ablation switch: when false, every edge is washed clean at each season start. */
  carriesMemoryBetweenSeasons: boolean;
  allowsEarlyInspection: boolean;
  /** v7: a cloth in hand can be set aside for good instead of hung. */
  allowsSettingAside: boolean;
}

export interface Cloth {
  id: number;
  /** The cloth's own colour. Never changes; it is what the cloth stains its neighbours with. */
  body: Dye;
  /** Stain on each side (TOP, RIGHT, BOTTOM, LEFT), or null if that edge is still clean. */
  edges: (Dye | null)[];
  /** Season each edge was last stained in, so carried stains can be told from fresh ones. */
  edgeSeasons: (number | null)[];
  isShipped: boolean;
  /** Removed from the game by choice; never drawn again. */
  isSetAside: boolean;
}

export interface Commission {
  id: number;
  body: Dye;
  /** Required stain per side; null means that side doesn't matter. */
  edges: (Dye | null)[];
  completedSeason: number | null;
  /** Edge stains of the cloth that filled it, with the seasons they were stained in. */
  filledWith: { clothId: number; edgeSeasons: (number | null)[] } | null;
}

export type SelvedgeMove = { kind: 'hang'; clothId: number; cell: number } | { kind: 'setAside'; clothId: number } | { kind: 'inspect' };
export type HangMove = Extract<SelvedgeMove, { kind: 'hang' }>;

export interface SelvedgeState {
  config: SelvedgeConfig;
  seed: number;
  rngState: number;
  season: number;
  turn: number;
  cloths: Cloth[];
  /** Top of the pile is the end of the array. */
  drawPile: number[];
  hand: number[];
  rack: (number | null)[];
  commissions: Commission[];
  seasonHangs: HangMove[];
  isOver: boolean;
}

export class IllegalMoveError extends Error {}

export function neighbourCell(cell: number, side: number, config: SelvedgeConfig): number | null {
  const { rackWidth, rackHeight } = config;
  const x = cell % rackWidth;
  const y = Math.floor(cell / rackWidth);
  if (side === TOP) return y > 0 ? cell - rackWidth : null;
  if (side === RIGHT) return x < rackWidth - 1 ? cell + 1 : null;
  if (side === BOTTOM) return y < rackHeight - 1 ? cell + rackWidth : null;
  return x > 0 ? cell - 1 : null;
}

function drawCommissions(config: SelvedgeConfig, rngState: number): { commissions: Commission[]; rngState: number } {
  let state = rngState;
  const roll = (exclusiveMax: number) => {
    const draw = nextRandom(state);
    state = draw.nextRngState;
    return Math.floor(draw.value * exclusiveMax);
  };
  const commissions = config.fixedEdgesPerCommission.map((fixedCount, id): Commission => {
    const sideOrder = shuffle(SIDES, state);
    state = sideOrder.nextRngState;
    const fixedSides = new Set(sideOrder.items.slice(0, fixedCount));
    const edges = SIDES.map((side) => (fixedSides.has(side) ? DYES[roll(DYES.length)] : null));
    return { id, body: DYES[roll(DYES.length)], edges, completedSeason: null, filledWith: null };
  });
  return { commissions, rngState: state };
}

export function createGame(seed: number, config: SelvedgeConfig): SelvedgeState {
  const cloths: Cloth[] = [];
  for (const dye of DYES) {
    for (let copy = 0; copy < config.clothsPerDye; copy++) {
      cloths.push({ id: cloths.length, body: dye, edges: [null, null, null, null], edgeSeasons: [null, null, null, null], isShipped: false, isSetAside: false });
    }
  }
  const book = drawCommissions(config, seed >>> 0);
  const state: SelvedgeState = {
    config,
    seed,
    rngState: book.rngState,
    season: 0,
    turn: 0,
    cloths,
    drawPile: [],
    hand: [],
    rack: new Array<number | null>(config.rackWidth * config.rackHeight).fill(null),
    commissions: book.commissions,
    seasonHangs: [],
    isOver: false,
  };
  startSeasonInPlace(state);
  return state;
}

export function cloneState(state: SelvedgeState): SelvedgeState {
  return {
    ...state,
    cloths: state.cloths.map((cloth) => ({ ...cloth, edges: cloth.edges.slice(), edgeSeasons: cloth.edgeSeasons.slice() })),
    drawPile: state.drawPile.slice(),
    hand: state.hand.slice(),
    rack: state.rack.slice(),
    commissions: state.commissions.map((commission) => ({ ...commission })),
    seasonHangs: state.seasonHangs.slice(),
  };
}

export function emptyCells(state: SelvedgeState): number[] {
  const cells: number[] = [];
  state.rack.forEach((occupant, cell) => {
    if (occupant === null) cells.push(cell);
  });
  return cells;
}

export function canInspectEarly(state: SelvedgeState): boolean {
  return state.config.allowsEarlyInspection && state.seasonHangs.length > 0;
}

export function isOwned(cloth: Cloth): boolean {
  return !cloth.isShipped && !cloth.isSetAside;
}

export function legalMoves(state: SelvedgeState): SelvedgeMove[] {
  if (state.isOver) return [];
  const cells = emptyCells(state);
  const moves: SelvedgeMove[] = state.hand.flatMap((clothId) => cells.map((cell): SelvedgeMove => ({ kind: 'hang', clothId, cell })));
  if (state.config.allowsSettingAside) moves.push(...state.hand.map((clothId): SelvedgeMove => ({ kind: 'setAside', clothId })));
  if (canInspectEarly(state)) moves.push({ kind: 'inspect' });
  return moves;
}

/** Moves with the same signature lead to identical futures (same body and stains on the same peg). */
export function moveSignature(state: SelvedgeState, move: SelvedgeMove): string {
  if (move.kind === 'inspect') return 'inspect';
  const cloth = state.cloths[move.clothId];
  const look = `${cloth.body}${cloth.edges.map((edge) => edge ?? '-').join('')}`;
  return move.kind === 'hang' ? `${look}@${move.cell}` : `${look}@aside`;
}

export function isLegalMove(state: SelvedgeState, move: SelvedgeMove): boolean {
  if (state.isOver) return false;
  if (move.kind === 'inspect') return canInspectEarly(state);
  if (move.kind === 'setAside') return state.config.allowsSettingAside && state.hand.includes(move.clothId);
  return state.hand.includes(move.clothId) && state.rack[move.cell] === null;
}

export function applyMove(state: SelvedgeState, move: SelvedgeMove): SelvedgeState {
  if (!isLegalMove(state, move)) throw new IllegalMoveError(`Illegal move ${JSON.stringify(move)}`);
  const next = cloneState(state);
  applyMoveInPlace(next, move);
  return next;
}

/** Mutates `state`. Only for simulations that own a private clone; everything else uses `applyMove`. */
export function applyMoveInPlace(state: SelvedgeState, move: SelvedgeMove): void {
  state.turn++;
  if (move.kind === 'inspect') {
    finishSeasonInPlace(state);
    return;
  }
  state.hand.splice(state.hand.indexOf(move.clothId), 1);
  if (move.kind === 'setAside') {
    state.cloths[move.clothId].isSetAside = true;
  } else {
    state.rack[move.cell] = move.clothId;
    stainNeighboursInPlace(state, state.rack, move.cell);
    state.seasonHangs.push(move);
  }
  const drawn = state.drawPile.pop();
  if (drawn !== undefined) state.hand.push(drawn);
  const isRackFull = state.rack.every((occupant) => occupant !== null);
  if (isRackFull || state.hand.length === 0) finishSeasonInPlace(state);
}

/** Touching cloths stain each other's facing edges with their body colours. Takes the rack so observers can replay. */
export function stainNeighboursInPlace(state: SelvedgeState, rack: readonly (number | null)[], cell: number): void {
  const hung = state.cloths[rack[cell] as number]; // callers stain from a peg they just filled
  for (const side of SIDES) {
    const neighbourAt = neighbourCell(cell, side, state.config);
    const neighbourId = neighbourAt === null ? null : rack[neighbourAt];
    if (neighbourId === null) continue;
    const neighbour = state.cloths[neighbourId];
    hung.edges[side] = neighbour.body;
    hung.edgeSeasons[side] = state.season;
    neighbour.edges[OPPOSITE[side]] = hung.body;
    neighbour.edgeSeasons[OPPOSITE[side]] = state.season;
  }
}

export interface ClothLook {
  body: Dye;
  edges: (Dye | null)[];
}

/** Rack cloths as they would look right after `move`, without touching `state`. */
export function rackAfterHang(state: SelvedgeState, move: HangMove): (ClothLook | null)[] {
  const looks: (ClothLook | null)[] = state.rack.map((clothId) => (clothId === null ? null : state.cloths[clothId]));
  const hung = state.cloths[move.clothId];
  const hungEdges = hung.edges.slice();
  for (const side of SIDES) {
    const neighbourAt = neighbourCell(move.cell, side, state.config);
    const neighbour = neighbourAt === null ? null : looks[neighbourAt];
    if (neighbourAt === null || neighbour === null) continue;
    hungEdges[side] = neighbour.body;
    const neighbourEdges = neighbour.edges.slice();
    neighbourEdges[OPPOSITE[side]] = hung.body;
    looks[neighbourAt] = { body: neighbour.body, edges: neighbourEdges };
  }
  looks[move.cell] = { body: hung.body, edges: hungEdges };
  return looks;
}

export function clothFits(cloth: Pick<Cloth, 'body' | 'edges'>, commission: Commission): boolean {
  return cloth.body === commission.body && commission.edges.every((wanted, side) => wanted === null || cloth.edges[side] === wanted);
}

/**
 * Most commissions the rack can fill at once (each cloth fills one). Books are small
 * and each commission fits few cloths, so an exhaustive bitmask search is exact and cheap.
 */
export function bestFill(openCommissions: readonly Commission[], rackCloths: readonly (Pick<Cloth, 'body' | 'edges'> | null)[]): number[] {
  const masks = openCommissions.map((commission) => {
    let mask = 0;
    rackCloths.forEach((cloth, slot) => {
      if (cloth !== null && clothFits(cloth, commission)) mask |= 1 << slot;
    });
    return mask;
  });
  let best: number[] = openCommissions.map(() => -1);
  let bestCount = 0;
  const current = best.slice();
  function search(index: number, used: number, count: number): void {
    if (count + (openCommissions.length - index) <= bestCount) return;
    if (index === openCommissions.length) {
      bestCount = count;
      best = current.slice();
      return;
    }
    for (let available = masks[index] & ~used; available !== 0; available &= available - 1) {
      const bit = available & -available;
      current[index] = 31 - Math.clz32(bit);
      search(index + 1, used | bit, count + 1);
    }
    current[index] = -1;
    search(index + 1, used, count);
  }
  search(0, 0, 0);
  return best;
}

export function openCommissions(state: SelvedgeState): Commission[] {
  return state.commissions.filter((commission) => commission.completedSeason === null);
}

function finishSeasonInPlace(state: SelvedgeState): void {
  const open = openCommissions(state);
  const fill = bestFill(open, state.rack.map((clothId) => (clothId === null ? null : state.cloths[clothId])));
  open.forEach((commission, index) => {
    const cell = fill[index];
    if (cell === -1) return;
    const cloth = state.cloths[state.rack[cell] as number]; // bestFill only picks occupied pegs
    cloth.isShipped = true;
    commission.completedSeason = state.season;
    commission.filledWith = { clothId: cloth.id, edgeSeasons: cloth.edgeSeasons.slice() };
  });
  state.rack.fill(null);
  state.hand = [];
  state.drawPile = [];
  state.seasonHangs = [];
  state.season++;
  const hasClothsLeft = state.cloths.some(isOwned);
  if (state.season >= state.config.seasons || openCommissions(state).length === 0 || !hasClothsLeft) {
    state.isOver = true;
    return;
  }
  startSeasonInPlace(state);
}

function startSeasonInPlace(state: SelvedgeState): void {
  const owned = state.cloths.filter(isOwned);
  if (!state.config.carriesMemoryBetweenSeasons) {
    for (const cloth of owned) {
      cloth.edges = [null, null, null, null];
      cloth.edgeSeasons = [null, null, null, null];
    }
  }
  const pile = shuffle(owned.map((cloth) => cloth.id), state.rngState);
  state.rngState = pile.nextRngState;
  state.drawPile = pile.items;
  state.hand = state.drawPile.splice(-state.config.handSize).reverse();
}

export function completedCount(state: SelvedgeState): number {
  return state.commissions.length - openCommissions(state).length;
}

export function isWin(state: SelvedgeState): boolean {
  return openCommissions(state).length === 0;
}
