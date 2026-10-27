import type { GameAdapter, ShipmentRecord } from '../../bots/types.ts';
import type { Random } from '../../engine/rng.ts';
import { greedyMove, humanProxyMove } from '../../selvedge/tags/bots.ts';
import {
  applyMove,
  applyMoveInPlace,
  bleedInPlace,
  cloneState,
  emptyCells,
  isTagMet,
  isWin,
  legalMoves,
  mixOf,
  moveSignature,
  shippedCount,
  type Cloth,
  type TagsMove,
  type TagsState,
} from '../../selvedge/tags/engine.ts';

const UINT32_RANGE = 4294967296;

function distinctMoves(state: TagsState): TagsMove[] {
  const seen = new Set<string>();
  return legalMoves(state).filter((move) => {
    const signature = moveSignature(state, move);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function determinize(state: TagsState, rng: Random): TagsState {
  const world = cloneState(state);
  rng.shuffleInPlace(world.drawPile);
  world.rngState = rng.int(UINT32_RANGE);
  return world;
}

function plainEdges(cloth: Cloth): void {
  cloth.edges = cloth.edges.map(() => mixOf(cloth.body));
  cloth.edgeSeasons = cloth.edgeSeasons.map(() => null);
}

/** Every edge washed back to plain, then only this season's hangs (which the player watched) replayed. */
function forgetCarriedMemory(state: TagsState): TagsState {
  const belief = cloneState(state);
  belief.cloths.forEach(plainEdges);
  const replayRack: (number | null)[] = belief.rack.map(() => null);
  for (const hang of belief.seasonHangs) {
    replayRack[hang.cell] = hang.clothId;
    bleedInPlace(belief, replayRack, hang.cell);
  }
  return belief;
}

function visibleChanges(before: TagsState, after: TagsState) {
  let changed = 0;
  for (const clothId of before.rack) {
    if (clothId === null) continue;
    if (before.cloths[clothId].edges.join() !== after.cloths[clothId].edges.join()) changed++;
  }
  return { lookChanges: changed, memoryChanges: changed };
}

/**
 * Strategy label, fixed before looking at results: "carried" when the cloth could not have
 * shipped on the colour it gained in its shipping season alone, "fresh" otherwise.
 */
function shipmentCategory(cloth: Cloth): string {
  const freshOnly = cloth.edges.map((mix, side) => (cloth.edgeSeasons[side] === cloth.shippedSeason ? mix : mixOf(cloth.body)));
  return isTagMet({ ...cloth, edges: freshOnly }) ? 'fresh' : 'carried';
}

function shipments(state: TagsState): ShipmentRecord[] {
  return state.cloths
    .filter((cloth) => cloth.shippedSeason !== null)
    .map((cloth) => ({
      orderKey: `${cloth.body}:${cloth.tag.join('')}`,
      category: shipmentCategory(cloth),
      points: 1,
      season: cloth.shippedSeason as number, // filtered to shipped cloths above
    }));
}

export const tagsAdapter: GameAdapter<TagsState, TagsMove> = {
  legalMoves,
  distinctMoves,
  cloneState,
  applyMove,
  applyMoveInPlace,
  isOver: (state) => state.isOver,
  score: shippedCount,
  isWin,
  season: (state) => state.season,
  determinize,
  heuristics: { greedy: greedyMove, humanProxy: humanProxyMove },
  forgetCarriedMemory,
  withRandomPlacement: (state, move, rng) => (move.kind === 'hang' ? { ...move, cell: rng.pick(emptyCells(state)) } : move),
  visibleChanges,
  shipments,
  strategyLabelCount: 2,
};
