import { humanProxyMove, orderReadingProxyMove } from '../../bots/humanProxy.ts';
import { greedyMove } from '../../bots/simpleBots.ts';
import type { GameAdapter } from '../../bots/types.ts';
import type { RulesConfig } from '../../engine/config.ts';
import {
  applyMove,
  applyMoveInPlace,
  bleedInPlace,
  clothShade,
  cloneState,
  distinctLegalMoves,
  emptyCells,
  isWin,
  legalMoves,
  type GameState,
  type Move,
} from '../../engine/game.ts';
import { buildOrderDeck } from '../../engine/orders.ts';
import type { Random } from '../../engine/rng.ts';
import { categoryCount, orderCategory, orderKey } from '../orderLabels.ts';

const UINT32_RANGE = 4294967296;

/**
 * What a player who ignores carried-over memory believes: every cloth started
 * this season at its base dye with no kin, then this season's bleeds (which they watched) happened.
 */
export function forgetCarriedMemory(state: GameState): GameState {
  const belief = cloneState(state);
  for (const cloth of belief.cloths) {
    cloth.dyes = [cloth.baseDye];
    cloth.hasSoakedThisSeason = false;
    cloth.kinMask = 0;
  }
  const replayRack: (number | null)[] = belief.rack.map(() => null);
  for (const hang of belief.seasonHangs) {
    replayRack[hang.cell] = hang.clothId;
    bleedInPlace(belief, replayRack, hang.cell);
  }
  return belief;
}

function determinize(state: GameState, rng: Random): GameState {
  const world = cloneState(state);
  rng.shuffleInPlace(world.drawPile);
  rng.shuffleInPlace(world.orderDeck);
  world.rngState = rng.int(UINT32_RANGE);
  return world;
}

function visibleChanges(before: GameState, after: GameState) {
  let lookChanges = 0;
  let memoryChanges = 0;
  for (const clothId of before.rack) {
    if (clothId === null) continue;
    if (before.cloths[clothId].dyes.join('') === after.cloths[clothId].dyes.join('')) continue;
    memoryChanges++;
    if (clothShade(before, clothId) !== clothShade(after, clothId)) lookChanges++;
  }
  return { lookChanges, memoryChanges };
}

export function mordantAdapter(config: RulesConfig): GameAdapter<GameState, Move> {
  return {
    legalMoves,
    distinctMoves: distinctLegalMoves,
    cloneState,
    applyMove,
    applyMoveInPlace,
    isOver: (state) => state.isOver,
    score: (state) => state.score,
    isWin,
    season: (state) => state.season,
    determinize,
    heuristics: { greedy: greedyMove, humanProxy: humanProxyMove, orderReadingProxy: orderReadingProxyMove },
    forgetCarriedMemory,
    withRandomPlacement: (state, move, rng) => ({ clothId: move.clothId, cell: rng.pick(emptyCells(state)) }),
    visibleChanges,
    shipments: (state) =>
      state.shipments.map(({ order, points, season }) => ({
        orderKey: orderKey(order),
        category: orderCategory(order),
        points,
        season,
      })),
    strategyLabelCount: categoryCount(buildOrderDeck(config.orderCatalogue)),
  };
}
