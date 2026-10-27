import { createPlanner, type PlannerOptions } from '../bots/planner.ts';
import type { Bot, GameAdapter } from '../bots/types.ts';

/** Serializable description of a bot, so worker threads can rebuild it. */
export type BotSpec =
  | { kind: 'random' }
  /** One of the adapter's named one-move heuristics (greedy, humanProxy, …). */
  | { kind: 'heuristic'; heuristic: string }
  | { kind: 'planner'; options: Partial<PlannerOptions> };

export function buildBot<S, M>(adapter: GameAdapter<S, M>, spec: BotSpec): Bot<S, M> {
  switch (spec.kind) {
    case 'random':
      return { name: 'Random', decide: (state, rng) => ({ move: rng.pick(adapter.legalMoves(state)) }) };
    case 'heuristic': {
      const heuristic = adapter.heuristics[spec.heuristic];
      if (!heuristic) throw new Error(`This ruleset has no "${spec.heuristic}" heuristic`);
      return { name: spec.heuristic, decide: (state, rng) => ({ move: heuristic(state, rng) }) };
    }
    case 'planner':
      return createPlanner(adapter, spec.options);
  }
}
