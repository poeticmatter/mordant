import { humanProxyBot, orderReadingProxyBot } from '../bots/humanProxy.ts';
import { createPlanner, type PlannerOptions } from '../bots/planner.ts';
import { greedyBot, randomBot } from '../bots/simpleBots.ts';
import type { Bot } from '../bots/types.ts';

/** Serializable description of a bot, so worker threads can rebuild it. */
export type BotSpec =
  | { kind: 'random' }
  | { kind: 'greedy' }
  | { kind: 'humanProxy' }
  | { kind: 'orderReadingProxy' }
  | { kind: 'planner'; options: Partial<PlannerOptions> };

export function buildBot(spec: BotSpec): Bot {
  switch (spec.kind) {
    case 'random':
      return randomBot;
    case 'greedy':
      return greedyBot;
    case 'humanProxy':
      return humanProxyBot;
    case 'orderReadingProxy':
      return orderReadingProxyBot;
    case 'planner':
      return createPlanner(spec.options);
  }
}
