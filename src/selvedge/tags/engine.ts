import { nextRandom, shuffle } from '../../engine/rng.ts';
import { DYES, type Dye } from '../../engine/shades.ts';
import { neighbourCell, OPPOSITE, SIDES } from '../grid.ts';

/**
 * Selvedge v8: every cloth carries its own order (its tag), and dyes mix where cloths touch.
 * Nothing lives outside the deck.
 */

/** The primaries soaked into an edge, as a bit set (`1 << dye` for each). */
export type Mix = number;
export const BROWN: Mix = 0b111;

export function mixOf(dye: Dye): Mix {
  return 1 << dye;
}

export interface TagsConfig {
  version: string;
  rackWidth: number;
  rackHeight: number;
  clothsPerDye: number;
  /**
   * Mixed edges wanted by each copy of a colour (the tag's other edges are plain);
   * one entry per copy, so its length is `clothsPerDye`.
   */
  tagSizes: readonly number[];
  handSize: number;
  seasons: number;
  /** Cloths to ship for a win. */
  shipTarget: number;
  /** Ablation switch: when false, every edge is washed back to plain at each season start. */
  carriesMemoryBetweenSeasons: boolean;
  allowsEarlyInspection: boolean;
  allowsSettingAside: boolean;
  /** Whether a cloth can be turned as it is hung; false is an ablation. */
  allowsTurning: boolean;
}

export interface ClothLook {
  body: Dye;
  /** The colour the customer wants on each of the four edges, on any sides, sorted. Plain edges are the body colour. */
  tag: readonly Mix[];
  /** Colour of each edge (TOP, RIGHT, BOTTOM, LEFT). Starts as the body colour and only ever gains dyes. */
  edges: readonly Mix[];
}

export interface Cloth extends ClothLook {
  id: number;
  edges: Mix[];
  /** Season each edge last gained a colour, so carried colour can be told from fresh. */
  edgeSeasons: (number | null)[];
  shippedSeason: number | null;
  /** Removed from the game by choice; never drawn again. */
  isSetAside: boolean;
}

export type TagsMove =
  | { kind: 'hang'; clothId: number; cell: number; /** Quarter turns clockwise before hanging. */ turns: number }
  | { kind: 'setAside'; clothId: number }
  | { kind: 'inspect' };
export type HangMove = Extract<TagsMove, { kind: 'hang' }>;

export interface TagsState {
  config: TagsConfig;
  seed: number;
  rngState: number;
  season: number;
  turn: number;
  cloths: Cloth[];
  /** Top of the pile is the end of the array. */
  drawPile: number[];
  hand: number[];
  rack: (number | null)[];
  seasonHangs: HangMove[];
  isOver: boolean;
}

export class IllegalMoveError extends Error {}

const QUARTER_TURNS = [0, 1, 2, 3] as const;

/** The two secondaries a dye can be part of: red gives orange or purple, and so on. */
export function secondariesWith(dye: Dye): Mix[] {
  return DYES.filter((other) => other !== dye).map((other) => mixOf(dye) | mixOf(other));
}

function dealTags(config: TagsConfig, rngState: number): { tags: Mix[][]; rngState: number } {
  let state = rngState;
  const tags: Mix[][] = [];
  for (const dye of DYES) {
    const options = secondariesWith(dye);
    for (const size of config.tagSizes) {
      const tag: Mix[] = [];
      for (let wanted = 0; wanted < size; wanted++) {
        const draw = nextRandom(state);
        state = draw.nextRngState;
        tag.push(options[Math.floor(draw.value * options.length)]);
      }
      while (tag.length < SIDES.length) tag.push(mixOf(dye));
      tags.push(tag.sort((first, second) => first - second));
    }
  }
  return { tags, rngState: state };
}

export function createGame(seed: number, config: TagsConfig): TagsState {
  if (config.tagSizes.length !== config.clothsPerDye) throw new Error(`${config.version}: tagSizes must list one size per copy`);
  const dealt = dealTags(config, seed >>> 0);
  const cloths = dealt.tags.map((tag, id): Cloth => {
    const body = DYES[Math.floor(id / config.clothsPerDye)];
    return { id, body, tag, edges: SIDES.map(() => mixOf(body)), edgeSeasons: SIDES.map(() => null), shippedSeason: null, isSetAside: false };
  });
  const state: TagsState = {
    config,
    seed,
    rngState: dealt.rngState,
    season: 0,
    turn: 0,
    cloths,
    drawPile: [],
    hand: [],
    rack: new Array<number | null>(config.rackWidth * config.rackHeight).fill(null),
    seasonHangs: [],
    isOver: false,
  };
  startSeasonInPlace(state);
  return state;
}

export function cloneState(state: TagsState): TagsState {
  return {
    ...state,
    cloths: state.cloths.map((cloth) => ({ ...cloth, edges: cloth.edges.slice(), edgeSeasons: cloth.edgeSeasons.slice() })),
    drawPile: state.drawPile.slice(),
    hand: state.hand.slice(),
    rack: state.rack.slice(),
    seasonHangs: state.seasonHangs.slice(),
  };
}

export function isOwned(cloth: Cloth): boolean {
  return cloth.shippedSeason === null && !cloth.isSetAside;
}

function countOf(mixes: readonly Mix[], mix: Mix): number {
  return mixes.filter((other) => other === mix).length;
}

/**
 * A cloth that can never meet its tag: edges only ever gain colour, so a brown edge, or more
 * edges of a mix than the tag wants, is permanent.
 */
export function isSpoiled(look: ClothLook): boolean {
  const plain = mixOf(look.body);
  return look.edges.some((mix) => mix !== plain && countOf(look.edges, mix) > countOf(look.tag, mix));
}

/** How many of the tag's wanted edges are already there (each edge counts once). */
export function tagProgress(look: ClothLook): number {
  let met = 0;
  for (const wanted of new Set(look.tag)) met += Math.min(countOf(look.tag, wanted), countOf(look.edges, wanted));
  return met;
}

/** For each tag entry in order, whether an edge of the cloth answers it (each edge answers one entry). */
export function metTagEntries(look: ClothLook): boolean[] {
  const unused = look.edges.slice();
  return look.tag.map((wanted) => {
    const index = unused.indexOf(wanted);
    if (index === -1) return false;
    unused.splice(index, 1);
    return true;
  });
}

export function isTagMet(look: ClothLook): boolean {
  return tagProgress(look) === look.tag.length;
}

/** Edges after `turns` quarter turns clockwise: what was on top ends up on the right. */
export function turnedEdges<T>(edges: readonly T[], turns: number): T[] {
  return SIDES.map((side) => edges[(side - turns + SIDES.length * 4) % SIDES.length]);
}

export function emptyCells(state: TagsState): number[] {
  const cells: number[] = [];
  state.rack.forEach((occupant, cell) => {
    if (occupant === null) cells.push(cell);
  });
  return cells;
}

export function canInspectEarly(state: TagsState): boolean {
  return state.config.allowsEarlyInspection && state.seasonHangs.length > 0;
}

export function legalMoves(state: TagsState): TagsMove[] {
  if (state.isOver) return [];
  const cells = emptyCells(state);
  const turnOptions = state.config.allowsTurning ? QUARTER_TURNS : [0];
  const moves: TagsMove[] = state.hand.flatMap((clothId) =>
    cells.flatMap((cell) => turnOptions.map((turns): TagsMove => ({ kind: 'hang', clothId, cell, turns }))),
  );
  if (state.config.allowsSettingAside) moves.push(...state.hand.map((clothId): TagsMove => ({ kind: 'setAside', clothId })));
  if (canInspectEarly(state)) moves.push({ kind: 'inspect' });
  return moves;
}

function lookKey(look: ClothLook): string {
  return `${look.body}/${look.tag.join('')}/${look.edges.join('')}`;
}

/** Moves with the same signature lead to identical futures (same cloth, turned the same way, on the same peg). */
export function moveSignature(state: TagsState, move: TagsMove): string {
  if (move.kind === 'inspect') return 'inspect';
  const cloth = state.cloths[move.clothId];
  if (move.kind === 'setAside') return `${lookKey(cloth)}@aside`;
  return `${lookKey({ ...cloth, edges: turnedEdges(cloth.edges, move.turns) })}@${move.cell}`;
}

export function isLegalMove(state: TagsState, move: TagsMove): boolean {
  if (state.isOver) return false;
  if (move.kind === 'inspect') return canInspectEarly(state);
  if (!state.hand.includes(move.clothId)) return false;
  if (move.kind === 'setAside') return state.config.allowsSettingAside;
  const isTurnAllowed = state.config.allowsTurning ? QUARTER_TURNS.some((turns) => turns === move.turns) : move.turns === 0;
  return isTurnAllowed && state.rack[move.cell] === null;
}

export function applyMove(state: TagsState, move: TagsMove): TagsState {
  if (!isLegalMove(state, move)) throw new IllegalMoveError(`Illegal move ${JSON.stringify(move)}`);
  const next = cloneState(state);
  applyMoveInPlace(next, move);
  return next;
}

/** Mutates `state`. Only for simulations that own a private clone; everything else uses `applyMove`. */
export function applyMoveInPlace(state: TagsState, move: TagsMove): void {
  state.turn++;
  if (move.kind === 'inspect') {
    finishSeasonInPlace(state);
    return;
  }
  state.hand.splice(state.hand.indexOf(move.clothId), 1);
  const cloth = state.cloths[move.clothId];
  if (move.kind === 'setAside') {
    cloth.isSetAside = true;
  } else {
    cloth.edges = turnedEdges(cloth.edges, move.turns);
    cloth.edgeSeasons = turnedEdges(cloth.edgeSeasons, move.turns);
    state.rack[move.cell] = move.clothId;
    bleedInPlace(state, state.rack, move.cell);
    state.seasonHangs.push(move);
  }
  const drawn = state.drawPile.pop();
  if (drawn !== undefined) state.hand.push(drawn);
  const isRackFull = state.rack.every((occupant) => occupant !== null);
  if (isRackFull || state.hand.length === 0) finishSeasonInPlace(state);
}

function soakInPlace(cloth: Cloth, side: number, dye: Dye, season: number): void {
  const mixed = cloth.edges[side] | mixOf(dye);
  if (mixed === cloth.edges[side]) return;
  cloth.edges[side] = mixed;
  cloth.edgeSeasons[side] = season;
}

/** The cloth on `cell` and each cloth touching it mix their colours into the edges they share. Takes the rack so observers can replay. */
export function bleedInPlace(state: TagsState, rack: readonly (number | null)[], cell: number): void {
  const hung = state.cloths[rack[cell] as number]; // callers bleed from a peg they just filled
  for (const side of SIDES) {
    const neighbourAt = neighbourCell(cell, side, state.config);
    const neighbourId = neighbourAt === null ? null : rack[neighbourAt];
    if (neighbourId === null) continue;
    const neighbour = state.cloths[neighbourId];
    soakInPlace(hung, side, neighbour.body, state.season);
    soakInPlace(neighbour, OPPOSITE[side], hung.body, state.season);
  }
}

/** Rack cloths as they would look right after `move`, without touching `state`. */
export function rackAfterHang(state: TagsState, move: HangMove): (ClothLook | null)[] {
  const looks: (ClothLook | null)[] = state.rack.map((clothId) => (clothId === null ? null : state.cloths[clothId]));
  const hung = state.cloths[move.clothId];
  const hungEdges = turnedEdges(hung.edges, move.turns);
  for (const side of SIDES) {
    const neighbourAt = neighbourCell(move.cell, side, state.config);
    const neighbour = neighbourAt === null ? null : looks[neighbourAt];
    if (neighbourAt === null || neighbour === null) continue;
    hungEdges[side] |= mixOf(neighbour.body);
    const neighbourEdges = neighbour.edges.slice();
    neighbourEdges[OPPOSITE[side]] |= mixOf(hung.body);
    looks[neighbourAt] = { ...neighbour, edges: neighbourEdges };
  }
  looks[move.cell] = { ...hung, edges: hungEdges };
  return looks;
}

export function shippingCells(looks: readonly (ClothLook | null)[]): number[] {
  return looks.flatMap((look, cell) => (look !== null && isTagMet(look) ? [cell] : []));
}

function finishSeasonInPlace(state: TagsState): void {
  for (const cell of shippingCells(state.rack.map((clothId) => (clothId === null ? null : state.cloths[clothId])))) {
    state.cloths[state.rack[cell] as number].shippedSeason = state.season; // shippingCells only returns occupied pegs
  }
  state.rack.fill(null);
  state.hand = [];
  state.drawPile = [];
  state.seasonHangs = [];
  state.season++;
  if (state.season >= state.config.seasons || !state.cloths.some(isOwned)) {
    state.isOver = true;
    return;
  }
  startSeasonInPlace(state);
}

function startSeasonInPlace(state: TagsState): void {
  const owned = state.cloths.filter(isOwned);
  if (!state.config.carriesMemoryBetweenSeasons) {
    for (const cloth of owned) {
      cloth.edges = SIDES.map(() => mixOf(cloth.body));
      cloth.edgeSeasons = SIDES.map(() => null);
    }
  }
  const pile = shuffle(owned.map((cloth) => cloth.id), state.rngState);
  state.rngState = pile.nextRngState;
  state.drawPile = pile.items;
  state.hand = state.drawPile.splice(-state.config.handSize).reverse();
}

export function shippedCount(state: TagsState): number {
  return state.cloths.filter((cloth) => cloth.shippedSeason !== null).length;
}

export function isWin(state: TagsState): boolean {
  return shippedCount(state) >= state.config.shipTarget;
}
