import { emptyCells, rackView, rackViewAfterHang, type GameState, type Move } from '../engine/game.ts';
import { orderAccepts, type Order } from '../engine/orders.ts';
import type { Random } from '../engine/rng.ts';
import type { Dye } from '../engine/shades.ts';

/**
 * A stand-in for a thoughtful but unaided human:
 * - looks one hang ahead, never at future seasons;
 * - sees which dyes a cloth holds, not their order (stripe orders are judged by colour);
 * - values partial progress toward orders, not just what would ship right now.
 * Weighting: a fully met order counts its points; a partly met one counts a share of them.
 */
const PARTIAL_PROGRESS_WEIGHT = 0.5;

function dyeCounts(dyes: readonly (Dye | null)[]): number[] {
  const counts = [0, 0, 0];
  for (const dye of dyes) if (dye !== null) counts[dye]++;
  return counts;
}

/** How much of an order a cloth satisfies, stripe by stripe in position (0..1). */
export function positionalProgress(order: Order, dyes: readonly Dye[], memoryCapacity: number): number {
  const { requirement } = order;
  if (requirement.kind === 'shade') return orderAccepts(order, dyes, memoryCapacity) ? 1 : 0;
  const offset = dyes.length - requirement.pattern.length;
  let fixed = 0;
  let matched = 0;
  requirement.pattern.forEach((wanted, stripe) => {
    if (wanted === null) return;
    fixed++;
    if (dyes[offset + stripe] === wanted) matched++;
  });
  return fixed === 0 ? 1 : matched / fixed;
}

/** How much of an order a cloth satisfies, judged by colour only (0..1). */
export function colourProgress(order: Order, dyes: readonly Dye[], memoryCapacity: number): number {
  const { requirement } = order;
  if (requirement.kind === 'shade') return orderAccepts(order, dyes, memoryCapacity) ? 1 : 0;
  const wanted = dyeCounts(requirement.pattern);
  const window = dyeCounts(dyes.slice(-requirement.pattern.length));
  const wantedTotal = wanted[0] + wanted[1] + wanted[2];
  if (wantedTotal === 0) return 1;
  const overlap = Math.min(wanted[0], window[0]) + Math.min(wanted[1], window[1]) + Math.min(wanted[2], window[2]);
  return overlap / wantedTotal;
}

type ProgressFn = (order: Order, dyes: readonly Dye[], memoryCapacity: number) => number;

/** Sum over orders of the best single cloth's progress, ignoring that cloths can only ship once. */
function rackValue(display: readonly Order[], memories: readonly (readonly Dye[] | null)[], memoryCapacity: number, progressOf: ProgressFn): number {
  let value = 0;
  for (const order of display) {
    let best = 0;
    for (const dyes of memories) {
      if (dyes === null) continue;
      best = Math.max(best, progressOf(order, dyes, memoryCapacity));
      if (best === 1) break;
    }
    value += order.points * (best === 1 ? 1 : PARTIAL_PROGRESS_WEIGHT * best);
  }
  return value;
}

function bestMoveByValue(state: GameState, rng: Random, progressOf: ProgressFn): Move {
  const current = rackView(state);
  let bestMoves: Move[] = [];
  let bestValue = -Infinity;
  for (const clothId of state.hand) {
    for (const cell of emptyCells(state)) {
      const move = { clothId, cell };
      const value = rackValue(state.display, rackViewAfterHang(state, move, current).memories, state.config.memoryCapacity, progressOf);
      if (value > bestValue + 1e-9) {
        bestValue = value;
        bestMoves = [move];
      } else if (Math.abs(value - bestValue) <= 1e-9) {
        bestMoves.push(move);
      }
    }
  }
  return rng.pick(bestMoves);
}

/** The proxy the playtest gate is judged by: sees colour, not stripe order. */
export function humanProxyMove(state: GameState, rng: Random): Move {
  return bestMoveByValue(state, rng, colourProgress);
}

/** Diagnostic sibling: identical, except it reads stripe order exactly. */
export function orderReadingProxyMove(state: GameState, rng: Random): Move {
  return bestMoveByValue(state, rng, positionalProgress);
}
