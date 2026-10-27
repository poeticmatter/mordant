import type { GameAdapter, ShipmentRecord } from '../../bots/types.ts';
import type { Random } from '../../engine/rng.ts';
import { greedyMove, humanProxyMove } from '../../selvedge/bots.ts';
import {
  applyMove,
  applyMoveInPlace,
  cloneState,
  completedCount,
  emptyCells,
  isWin,
  legalMoves,
  moveSignature,
  stainNeighboursInPlace,
  type Commission,
  type SelvedgeMove,
  type SelvedgeState,
} from '../../selvedge/engine.ts';

const UINT32_RANGE = 4294967296;
const DYE_LETTERS = ['R', 'Y', 'B'];

function distinctMoves(state: SelvedgeState): SelvedgeMove[] {
  const seen = new Set<string>();
  return legalMoves(state).filter((move) => {
    const signature = moveSignature(state, move);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function determinize(state: SelvedgeState, rng: Random): SelvedgeState {
  const world = cloneState(state);
  rng.shuffleInPlace(world.drawPile);
  world.rngState = rng.int(UINT32_RANGE);
  return world;
}

/** Every edge washed clean, then only this season's hangs (which the player watched) replayed. */
function forgetCarriedMemory(state: SelvedgeState): SelvedgeState {
  const belief = cloneState(state);
  for (const cloth of belief.cloths) {
    cloth.edges = [null, null, null, null];
    cloth.edgeSeasons = [null, null, null, null];
  }
  const replayRack: (number | null)[] = belief.rack.map(() => null);
  for (const hang of belief.seasonHangs) {
    replayRack[hang.cell] = hang.clothId;
    stainNeighboursInPlace(belief, replayRack, hang.cell);
  }
  return belief;
}

function visibleChanges(before: SelvedgeState, after: SelvedgeState) {
  let changed = 0;
  for (const clothId of before.rack) {
    if (clothId === null) continue;
    if (before.cloths[clothId].edges.join() !== after.cloths[clothId].edges.join()) changed++;
  }
  return { lookChanges: changed, memoryChanges: changed };
}

function commissionKey(commission: Commission): string {
  const edges = commission.edges.map((edge) => (edge === null ? '-' : DYE_LETTERS[edge])).join('');
  return `${DYE_LETTERS[commission.body]}:${edges}`;
}

/**
 * Strategy label, fixed before looking at results: "carried" when the cloth that
 * filled it relied on a stain from an earlier season, "fresh" when every required
 * edge was stained in the season it shipped.
 */
function commissionCategory(commission: Commission): string {
  const filled = commission.filledWith;
  if (!filled) return 'unfilled';
  const isCarried = commission.edges.some(
    (wanted, side) => wanted !== null && filled.edgeSeasons[side] !== commission.completedSeason,
  );
  return isCarried ? 'carried' : 'fresh';
}

function shipments(state: SelvedgeState): ShipmentRecord[] {
  return state.commissions
    .filter((commission) => commission.completedSeason !== null)
    .map((commission) => ({
      orderKey: commissionKey(commission),
      category: commissionCategory(commission),
      points: 1,
      season: commission.completedSeason as number, // filtered to completed commissions above
    }));
}

export const selvedgeAdapter: GameAdapter<SelvedgeState, SelvedgeMove> = {
  legalMoves,
  distinctMoves,
  cloneState,
  applyMove,
  applyMoveInPlace,
  isOver: (state) => state.isOver,
  score: completedCount,
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
