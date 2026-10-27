import type { RulesConfig } from './config.ts';
import { bestAssignment, buildOrderDeck, postOrder, type Order, type PostedOrder, type RackView } from './orders.ts';
import { shuffle } from './rng.ts';
import { DYES, shadeOf, withDyeAdded, type Dye, type Shade } from './shades.ts';

export interface Cloth {
  id: number;
  baseDye: Dye;
  /** Oldest first. The last entry is what this cloth bleeds when hung. */
  dyes: Dye[];
  timesHung: number;
  isShipped: boolean;
  /** Under the soak-once rule, a cloth that took a stripe this season ignores further bleeds. */
  hasSoakedThisSeason: boolean;
  /** Bit k is set when this cloth has ever shared dye with cloth k (either direction). */
  kinMask: number;
}

export interface ShippedCloth {
  clothId: number;
  /** The cloth's dye memory at the moment it shipped. */
  dyes: Dye[];
  cell: number;
}

/** One filled order: usually one cloth, two for a bolt. */
export interface Shipment {
  order: Order;
  cloths: ShippedCloth[];
  points: number;
  season: number;
}

export interface Move {
  clothId: number;
  cell: number;
}

export interface GameState {
  config: RulesConfig;
  seed: number;
  rngState: number;
  season: number;
  /** Decisions made so far in the whole game. */
  turn: number;
  cloths: Cloth[];
  /** Top of the pile is the end of the array. */
  drawPile: number[];
  hand: number[];
  rack: (number | null)[];
  display: PostedOrder[];
  orderDeck: Order[];
  shipments: Shipment[];
  /** Hangs made this season, in order; lets observers replay the season's bleeds. */
  seasonHangs: Move[];
  score: number;
  isOver: boolean;
}

export class IllegalMoveError extends Error {}

const neighbourCache = new Map<string, number[][]>();

export function neighboursOf(cell: number, config: RulesConfig): readonly number[] {
  const key = `${config.rackWidth}x${config.rackHeight}`;
  let table = neighbourCache.get(key);
  if (!table) {
    table = buildNeighbourTable(config.rackWidth, config.rackHeight);
    neighbourCache.set(key, table);
  }
  return table[cell];
}

function buildNeighbourTable(width: number, height: number): number[][] {
  const table: number[][] = [];
  for (let cell = 0; cell < width * height; cell++) {
    const x = cell % width;
    const y = Math.floor(cell / width);
    const neighbours: number[] = [];
    if (y > 0) neighbours.push(cell - width);
    if (x > 0) neighbours.push(cell - 1);
    if (x < width - 1) neighbours.push(cell + 1);
    if (y < height - 1) neighbours.push(cell + width);
    table.push(neighbours);
  }
  return table;
}

export function createGame(seed: number, config: RulesConfig): GameState {
  const cloths: Cloth[] = [];
  for (const dye of DYES) {
    for (let copy = 0; copy < config.clothsPerDye; copy++) {
      cloths.push({ id: cloths.length, baseDye: dye, dyes: [dye], timesHung: 0, isShipped: false, hasSoakedThisSeason: false, kinMask: 0 });
    }
  }
  const orderShuffle = shuffle(buildOrderDeck(config.orderCatalogue), seed >>> 0);
  const orderDeck = orderShuffle.items;
  const display = orderDeck.splice(0, config.displaySize).map((order) => postOrder(order, 0));
  const state: GameState = {
    config,
    seed,
    rngState: orderShuffle.nextRngState,
    season: 0,
    turn: 0,
    cloths,
    drawPile: [],
    hand: [],
    rack: new Array<number | null>(config.rackWidth * config.rackHeight).fill(null),
    display,
    orderDeck,
    shipments: [],
    seasonHangs: [],
    score: 0,
    isOver: false,
  };
  startSeasonInPlace(state);
  return state;
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    cloths: state.cloths.map((cloth) => ({ ...cloth, dyes: cloth.dyes.slice() })),
    drawPile: state.drawPile.slice(),
    hand: state.hand.slice(),
    rack: state.rack.slice(),
    display: state.display.slice(),
    orderDeck: state.orderDeck.slice(),
    shipments: state.shipments.slice(),
    seasonHangs: state.seasonHangs.slice(),
  };
}

export function emptyCells(state: GameState): number[] {
  const cells: number[] = [];
  for (let cell = 0; cell < state.rack.length; cell++) {
    if (state.rack[cell] === null) cells.push(cell);
  }
  return cells;
}

export function legalMoves(state: GameState): Move[] {
  if (state.isOver) return [];
  const cells = emptyCells(state);
  const moves: Move[] = [];
  for (const clothId of state.hand) {
    for (const cell of cells) moves.push({ clothId, cell });
  }
  return moves;
}

/**
 * Two moves with the same signature lead to identical futures (same dye memory
 * on the same peg), so searches and decision metrics treat them as one choice.
 */
export function moveSignature(state: GameState, move: Move): string {
  return `${state.cloths[move.clothId].dyes.join('')}@${move.cell}`;
}

export function distinctLegalMoves(state: GameState): Move[] {
  const seen = new Set<string>();
  return legalMoves(state).filter((move) => {
    const signature = moveSignature(state, move);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function isLegalMove(state: GameState, move: Move): boolean {
  return !state.isOver && state.hand.includes(move.clothId) && state.rack[move.cell] === null;
}

/** Pure: returns the next state and leaves `state` untouched. */
export function applyMove(state: GameState, move: Move): GameState {
  if (!isLegalMove(state, move)) {
    throw new IllegalMoveError(`Cloth ${move.clothId} cannot be hung on peg ${move.cell}`);
  }
  const next = cloneState(state);
  applyMoveInPlace(next, move);
  return next;
}

/**
 * Mutates `state`. Only for simulations that own a private clone; everything
 * else goes through `applyMove`.
 */
export function applyMoveInPlace(state: GameState, move: Move): void {
  state.hand.splice(state.hand.indexOf(move.clothId), 1);
  state.rack[move.cell] = move.clothId;
  const wetCloth = state.cloths[move.clothId];
  wetCloth.timesHung++;
  bleedInPlace(state, state.rack, move.cell);
  state.seasonHangs.push(move);
  const drawn = state.drawPile.pop();
  if (drawn !== undefined) state.hand.push(drawn);
  state.turn++;

  const isRackFull = state.rack.every((occupant) => occupant !== null);
  if (isRackFull || state.hand.length === 0) {
    inspectInPlace(state);
    endSeasonInPlace(state);
  }
}

export function canSoak(state: GameState, clothId: number): boolean {
  return !(state.config.soaksOncePerSeason && state.cloths[clothId].hasSoakedThisSeason);
}

/**
 * Bleeds the wet cloth at `cell` into its neighbours on `rack`. Takes the rack as
 * an argument so observers can replay a season's hangs onto a scratch rack.
 */
export function bleedInPlace(state: GameState, rack: readonly (number | null)[], cell: number): void {
  const wetCloth = state.cloths[rack[cell] as number]; // callers bleed from a peg they just filled
  const bleedDye = wetCloth.dyes[wetCloth.dyes.length - 1];
  if (bleedDye === undefined) return;
  for (const neighbourCell of neighboursOf(cell, state.config)) {
    const neighbourId = rack[neighbourCell];
    if (neighbourId === null || !canSoak(state, neighbourId)) continue;
    const neighbour = state.cloths[neighbourId];
    neighbour.dyes = withDyeAdded(neighbour.dyes, bleedDye, state.config.memoryCapacity);
    neighbour.hasSoakedThisSeason = true;
    neighbour.kinMask |= 1 << wetCloth.id;
    wetCloth.kinMask |= 1 << neighbour.id;
  }
}

export function areKin(state: GameState, clothA: number, clothB: number): boolean {
  return ((state.cloths[clothA].kinMask >> clothB) & 1) === 1;
}

export function clothShade(state: GameState, clothId: number): Shade {
  return shadeOf(state.cloths[clothId].dyes, state.config.memoryCapacity);
}

export function rackMemories(state: GameState): (Dye[] | null)[] {
  return state.rack.map((clothId) => (clothId === null ? null : state.cloths[clothId].dyes));
}

/** Kin relations between rack pegs, from the cloths' lifelong kin memory. */
function rackKinMasks(state: GameState): number[] {
  return state.rack.map((clothId) => {
    if (clothId === null) return 0;
    const clothKin = state.cloths[clothId].kinMask;
    let pegMask = 0;
    state.rack.forEach((otherId, otherCell) => {
      if (otherId !== null && ((clothKin >> otherId) & 1) === 1) pegMask |= 1 << otherCell;
    });
    return pegMask;
  });
}

export function rackView(state: GameState): RackView {
  return { memories: rackMemories(state), kinMasks: rackKinMasks(state) };
}

export function pegsOf(pegMask: number): number[] {
  const pegs: number[] = [];
  for (let remaining = pegMask; remaining !== 0; remaining &= remaining - 1) {
    pegs.push(31 - Math.clz32(remaining & -remaining));
  }
  return pegs;
}

function inspectInPlace(state: GameState): void {
  const assignment = bestAssignment(state.display, rackView(state), state.config.memoryCapacity);
  const fulfilledOrderIds = new Set<number>();
  state.display.forEach((order, orderIndex) => {
    const pegMask = assignment.pegMaskByOrder[orderIndex];
    if (pegMask === 0) return;
    const cloths = pegsOf(pegMask).map((cell) => {
      const clothId = state.rack[cell] as number; // the assignment only picks occupied pegs
      return { clothId, dyes: state.cloths[clothId].dyes.slice(), cell };
    });
    state.shipments.push({ order, cloths, points: order.points, season: state.season });
    for (const { clothId, cell } of cloths) {
      state.cloths[clothId].isShipped = true;
      state.rack[cell] = null;
    }
    state.score += order.points;
    fulfilledOrderIds.add(order.id);
  });
  refillDisplayInPlace(state, fulfilledOrderIds);
}

/** Inspections this order has now sat through, counting the one just held. */
export function inspectionsSeen(order: PostedOrder, currentSeason: number): number {
  return currentSeason - order.postedSeason + 1;
}

function isWithdrawn(state: GameState, order: PostedOrder): boolean {
  const lifetime = state.config.orderLifetimeInspections;
  return lifetime !== null && inspectionsSeen(order, state.season) >= lifetime;
}

/** Filled and withdrawn orders are replaced in place, so surviving orders keep their slot. */
function refillDisplayInPlace(state: GameState, fulfilledOrderIds: ReadonlySet<number>): void {
  const refilled: PostedOrder[] = [];
  for (const order of state.display) {
    if (!fulfilledOrderIds.has(order.id) && !isWithdrawn(state, order)) {
      refilled.push(order);
      continue;
    }
    const replacement = state.orderDeck.shift();
    if (replacement) refilled.push(postOrder(replacement, state.season + 1));
  }
  state.display = refilled;
}

function endSeasonInPlace(state: GameState): void {
  state.rack.fill(null);
  state.hand = [];
  state.drawPile = [];
  state.seasonHangs = [];
  state.season++;
  if (state.season >= state.config.seasons) {
    state.isOver = true;
    return;
  }
  startSeasonInPlace(state);
}

function startSeasonInPlace(state: GameState): void {
  const owned = state.cloths.filter((cloth) => !cloth.isShipped);
  if (owned.length === 0) {
    state.isOver = true;
    return;
  }
  for (const cloth of owned) {
    cloth.hasSoakedThisSeason = false;
    if (!state.config.carriesMemoryBetweenSeasons) {
      cloth.dyes = [cloth.baseDye];
      cloth.kinMask = 0;
    }
  }
  const pileShuffle = shuffle(
    owned.map((cloth) => cloth.id),
    state.rngState,
  );
  state.rngState = pileShuffle.nextRngState;
  state.drawPile = pileShuffle.items;
  state.hand = state.drawPile.splice(-state.config.handSize).reverse();
}

/** Occupied neighbours of `move.cell` that the hang would soak. */
export function pegsSoakedBy(state: GameState, move: Move): number[] {
  if (state.cloths[move.clothId].dyes.length === 0) return [];
  return neighboursOf(move.cell, state.config).filter((neighbourCell) => {
    const neighbourId = state.rack[neighbourCell];
    return neighbourId !== null && canSoak(state, neighbourId);
  });
}

/**
 * The rack as inspection would see it right after `move`, without touching `state`.
 * `current` lets callers that preview many moves share one `rackView` call.
 */
export function rackViewAfterHang(state: GameState, move: Move, current: RackView = rackView(state)): RackView {
  const memories = current.memories.slice();
  const kinMasks = current.kinMasks.slice();
  const wetCloth = state.cloths[move.clothId];
  memories[move.cell] = wetCloth.dyes;
  let wetPegKin = 0;
  state.rack.forEach((otherId, otherCell) => {
    if (otherId !== null && ((wetCloth.kinMask >> otherId) & 1) === 1) {
      wetPegKin |= 1 << otherCell;
      kinMasks[otherCell] |= 1 << move.cell;
    }
  });
  const bleedDye = wetCloth.dyes[wetCloth.dyes.length - 1];
  for (const neighbourCell of pegsSoakedBy(state, move)) {
    const soakedDyes = memories[neighbourCell] as Dye[]; // pegsSoakedBy only returns occupied pegs
    memories[neighbourCell] = withDyeAdded(soakedDyes, bleedDye, state.config.memoryCapacity);
    wetPegKin |= 1 << neighbourCell;
    kinMasks[neighbourCell] |= 1 << move.cell;
  }
  kinMasks[move.cell] = wetPegKin;
  return { memories, kinMasks };
}

/** Points an inspection right after `move` would pay. Non-mutating, for bots. */
export function previewInspectionPoints(state: GameState, move: Move): number {
  return bestAssignment(state.display, rackViewAfterHang(state, move), state.config.memoryCapacity).points;
}

export function isWin(state: GameState): boolean {
  return state.score >= state.config.targetScore;
}
