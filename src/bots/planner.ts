import { Random } from '../engine/rng.ts';
import type { Bot, Decision, GameAdapter, MoveEvaluation } from './types.ts';

export interface PlannerOptions {
  name: string;
  /** Total rollouts per decision, spread over successive-halving rounds. */
  rolloutBudget: number;
  /** Chance a rollout step plays a random move instead of the greedy one. */
  rolloutEpsilon: number;
  /** Ablation: plans on the belief of a player who ignores carried-over memory. */
  isMemoryBlind: boolean;
  /** Ablation: picks the card, then plays it on a random legal spot. */
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

/**
 * Flat Monte Carlo search with successive halving. Rollouts re-guess hidden
 * information every time (determinization), so the planner never sees the deck order.
 */
export function createPlanner<S, M>(adapter: GameAdapter<S, M>, options: Partial<PlannerOptions> = {}): Bot<S, M> {
  const settings: PlannerOptions = { ...DEFAULT_PLANNER, ...options };
  return {
    name: settings.name,
    decide(state, rng) {
      const belief = settings.isMemoryBlind ? adapter.forgetCarriedMemory(state) : state;
      const decision = searchBestMove(adapter, belief, rng, settings);
      if (!settings.hasRandomPlacement) return decision;
      return { ...decision, move: adapter.withRandomPlacement(state, decision.move, rng) };
    },
  };
}

function searchBestMove<S, M>(adapter: GameAdapter<S, M>, state: S, rng: Random, settings: PlannerOptions): Decision<M> {
  let candidates = adapter.distinctMoves(state);
  if (candidates.length === 1) {
    return { move: candidates[0], evaluations: [{ move: candidates[0], value: adapter.score(state), samples: 0 }] };
  }
  const totals = new Map<M, { sum: number; count: number }>(candidates.map((move) => [move, { sum: 0, count: 0 }]));
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
        total.sum += rollout(adapter, state, move, rolloutSeed, settings.rolloutEpsilon);
        total.count++;
      }
    }
    candidates = candidates
      .slice()
      .sort((a, b) => meanOf(totals.get(b)!) - meanOf(totals.get(a)!))
      .slice(0, Math.ceil(candidates.length / 2));
  }

  const evaluations: MoveEvaluation<M>[] = [...totals.entries()]
    .map(([move, total]) => ({ move, value: meanOf(total), samples: total.count }))
    .sort((a, b) => b.samples - a.samples || b.value - a.value);
  return { move: candidates[0], evaluations };
}

function meanOf(total: { sum: number; count: number }): number {
  return total.count === 0 ? -Infinity : total.sum / total.count;
}

function rollout<S, M>(adapter: GameAdapter<S, M>, state: S, firstMove: M, rolloutSeed: number, epsilon: number): number {
  const rng = new Random(rolloutSeed);
  const world = adapter.determinize(state, rng);
  adapter.applyMoveInPlace(world, firstMove);
  const greedy = adapter.heuristics.greedy;
  while (!adapter.isOver(world)) {
    const move = rng.next() < epsilon ? rng.pick(adapter.legalMoves(world)) : greedy(world, rng);
    adapter.applyMoveInPlace(world, move);
  }
  return adapter.score(world);
}
