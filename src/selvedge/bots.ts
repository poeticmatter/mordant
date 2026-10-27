import type { Random } from '../engine/rng.ts';
import {
  bestFill,
  clothFits,
  emptyCells,
  openCommissions,
  rackAfterHang,
  SIDES,
  type ClothLook,
  type Commission,
  type HangMove,
  type SelvedgeMove,
  type SelvedgeState,
} from './engine.ts';

function hangMoves(state: SelvedgeState): HangMove[] {
  const cells = emptyCells(state);
  return state.hand.flatMap((clothId) => cells.map((cell): HangMove => ({ kind: 'hang', clothId, cell })));
}

function bestByValue(state: SelvedgeState, rng: Random, valueOf: (looks: (ClothLook | null)[]) => number): SelvedgeMove {
  let bestMoves: HangMove[] = [];
  let bestValue = -Infinity;
  for (const move of hangMoves(state)) {
    const value = valueOf(rackAfterHang(state, move));
    if (value > bestValue + 1e-9) {
      bestValue = value;
      bestMoves = [move];
    } else if (Math.abs(value - bestValue) <= 1e-9) {
      bestMoves.push(move);
    }
  }
  return rng.pick(bestMoves);
}

function fillCount(open: readonly Commission[], looks: readonly (ClothLook | null)[]): number {
  return bestFill(open, looks).filter((cell) => cell !== -1).length;
}

/** Hangs to maximise commissions filled if the rack were inspected now; never calls inspection early. */
export function greedyMove(state: SelvedgeState, rng: Random): SelvedgeMove {
  const open = openCommissions(state);
  return bestByValue(state, rng, (looks) => fillCount(open, looks));
}

/** Share of a commission's requirements (body plus fixed edges) a cloth already meets. */
export function commissionProgress(commission: Commission, cloth: ClothLook): number {
  if (clothFits(cloth, commission)) return 1;
  const fixedSides = SIDES.filter((side) => commission.edges[side] !== null);
  const met = (cloth.body === commission.body ? 1 : 0) + fixedSides.filter((side) => cloth.edges[side] === commission.edges[side]).length;
  return met / (1 + fixedSides.length);
}

const PARTIAL_PROGRESS_WEIGHT = 0.5;

/** One hang ahead, no thought for future seasons, but values getting closer to commissions. */
export function humanProxyMove(state: SelvedgeState, rng: Random): SelvedgeMove {
  const open = openCommissions(state);
  return bestByValue(state, rng, (looks) => {
    const partial = open.reduce((sum, commission) => {
      const best = Math.max(0, ...looks.map((look) => (look === null ? 0 : commissionProgress(commission, look))));
      return sum + (best === 1 ? 0 : best);
    }, 0);
    return fillCount(open, looks) + PARTIAL_PROGRESS_WEIGHT * partial;
  });
}
