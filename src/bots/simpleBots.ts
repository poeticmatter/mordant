import { emptyCells, pegsSoakedBy, rackView, rackViewAfterHang, type GameState, type Move } from '../engine/game.ts';
import { acceptanceMasks, candidatePegSets, isBolt, maxPointsFromCandidates, orderAccepts } from '../engine/orders.ts';
import type { Random } from '../engine/rng.ts';
import { withDyeAdded, type Dye } from '../engine/shades.ts';

/**
 * The move that would pay the most if the rack were inspected right now; ties
 * broken at random. Same result as `previewInspectionPoints` per move, but only
 * re-checks the pegs a hang changes, because rollouts call this every step.
 */
export function greedyMove(state: GameState, rng: Random): Move {
  const { display, config } = state;
  const capacity = config.memoryCapacity;
  const current = rackView(state);
  const baseMasks = acceptanceMasks(display, current.memories, capacity);
  const hasBolts = display.some(isBolt);
  const masks = baseMasks.slice();
  let bestMoves: Move[] = [];
  let bestPoints = -Infinity;

  for (const clothId of state.hand) {
    const wetDyes = state.cloths[clothId].dyes;
    const bleedDye = wetDyes[wetDyes.length - 1];
    for (const cell of emptyCells(state)) {
      const move = { clothId, cell };
      for (let orderIndex = 0; orderIndex < display.length; orderIndex++) {
        masks[orderIndex] = baseMasks[orderIndex];
        if (orderAccepts(display[orderIndex], wetDyes, capacity)) masks[orderIndex] |= 1 << cell;
      }
      for (const soakedCell of pegsSoakedBy(state, move)) {
        const soaked = withDyeAdded(current.memories[soakedCell] as Dye[], bleedDye, capacity); // soaked pegs are occupied
        const bit = 1 << soakedCell;
        for (let orderIndex = 0; orderIndex < display.length; orderIndex++) {
          if (orderAccepts(display[orderIndex], soaked, capacity)) masks[orderIndex] |= bit;
          else masks[orderIndex] &= ~bit;
        }
      }
      const kinMasks = hasBolts ? rackViewAfterHang(state, move, current).kinMasks : current.kinMasks;
      const candidates = display.map((order, orderIndex) => candidatePegSets(order, masks[orderIndex], kinMasks));
      const points = maxPointsFromCandidates(display, candidates);
      if (points > bestPoints) {
        bestPoints = points;
        bestMoves = [move];
      } else if (points === bestPoints) {
        bestMoves.push(move);
      }
    }
  }
  return rng.pick(bestMoves);
}
