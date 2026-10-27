import {
  applyMoveInPlace,
  bleedInPlace,
  cloneState,
  distinctLegalMoves,
  emptyCells,
  legalMoves,
  type GameState,
  type Move,
} from '../engine/game.ts';
import { Random } from '../engine/rng.ts';
import { greedyMove } from './simpleBots.ts';
import type { Bot, Decision, MoveEvaluation } from './types.ts';

export interface PlannerOptions {
  name: string;
  /** Total rollouts per decision, spread over successive-halving rounds. */
  rolloutBudget: number;
  /** Chance a rollout step plays a random move instead of the greedy one. */
  rolloutEpsilon: number;
  /** Ablation: plans as if every cloth started this season at its printed base dye. */
  isMemoryBlind: boolean;
  /** Ablation: picks the cloth, then hangs it on a random empty peg. */
  hasRandomPlacement: boolean;
}

export const DEFAULT_PLANNER: PlannerOptions = {
  name: 'Planner',
  rolloutBudget: 400,
  rolloutEpsilon: 0.15,
  isMemoryBlind: false,
  hasRandomPlacement: false,
};

const UINT32_RANGE = 4294967296;

export function createPlanner(options: Partial<PlannerOptions> = {}): Bot {
  const settings: PlannerOptions = { ...DEFAULT_PLANNER, ...options };
  return {
    name: settings.name,
    decide(state, rng) {
      const belief = settings.isMemoryBlind ? forgetCarriedMemory(state) : state;
      const decision = searchBestMove(belief, rng, settings);
      if (!settings.hasRandomPlacement) return decision;
      return { ...decision, move: { clothId: decision.move.clothId, cell: rng.pick(emptyCells(state)) } };
    },
  };
}

function searchBestMove(state: GameState, rng: Random, settings: PlannerOptions): Decision {
  let candidates = distinctLegalMoves(state);
  if (candidates.length === 1) {
    return { move: candidates[0], evaluations: [{ move: candidates[0], value: state.score, samples: 0 }] };
  }
  const totals = new Map<Move, { sum: number; count: number }>(
    candidates.map((move) => [move, { sum: 0, count: 0 }]),
  );
  const rounds = Math.ceil(Math.log2(candidates.length));
  const budgetPerRound = settings.rolloutBudget / rounds;

  while (candidates.length > 1) {
    const rolloutsPerCandidate = Math.max(1, Math.floor(budgetPerRound / candidates.length));
    for (let sample = 0; sample < rolloutsPerCandidate; sample++) {
      // Common random numbers: every candidate faces the same hidden deck order,
      // so differences in outcome come from the move, not the shuffle.
      const rolloutSeed = rng.int(UINT32_RANGE);
      for (const move of candidates) {
        const total = totals.get(move)!;
        total.sum += rollout(state, move, rolloutSeed, settings.rolloutEpsilon);
        total.count++;
      }
    }
    candidates = candidates
      .slice()
      .sort((a, b) => meanOf(totals.get(b)!) - meanOf(totals.get(a)!))
      .slice(0, Math.ceil(candidates.length / 2));
  }

  const evaluations: MoveEvaluation[] = [...totals.entries()]
    .map(([move, total]) => ({ move, value: meanOf(total), samples: total.count }))
    .sort((a, b) => b.samples - a.samples || b.value - a.value);
  return { move: candidates[0], evaluations };
}

function meanOf(total: { sum: number; count: number }): number {
  return total.count === 0 ? -Infinity : total.sum / total.count;
}

function rollout(state: GameState, firstMove: Move, rolloutSeed: number, epsilon: number): number {
  const rng = new Random(rolloutSeed);
  const world = determinize(state, rng);
  applyMoveInPlace(world, firstMove);
  while (!world.isOver) {
    const move = rng.next() < epsilon ? rng.pick(legalMoves(world)) : greedyMove(world, rng);
    applyMoveInPlace(world, move);
  }
  return world.score;
}

/** One guess at everything the player cannot see: pile order, order deck order, future shuffles. */
function determinize(state: GameState, rng: Random): GameState {
  const world = cloneState(state);
  rng.shuffleInPlace(world.drawPile);
  rng.shuffleInPlace(world.orderDeck);
  world.rngState = rng.int(UINT32_RANGE);
  return world;
}

/**
 * What a player who ignores carried-over memory believes: every cloth started
 * this season at its base dye, then this season's bleeds (which they watched) happened.
 */
export function forgetCarriedMemory(state: GameState): GameState {
  const belief = cloneState(state);
  for (const cloth of belief.cloths) {
    cloth.dyes = [cloth.baseDye];
    cloth.hasSoakedThisSeason = false;
  }
  const replayRack: (number | null)[] = belief.rack.map(() => null);
  for (const hang of belief.seasonHangs) {
    replayRack[hang.cell] = hang.clothId;
    bleedInPlace(belief, replayRack, hang.cell);
  }
  return belief;
}
