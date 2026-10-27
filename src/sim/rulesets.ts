import type { GameAdapter } from '../bots/types.ts';
import { RULESETS as MORDANT_RULESETS, type RulesConfig } from '../engine/config.ts';
import { createGame as createMordantGame } from '../engine/game.ts';
import { RULES_V6, RULES_V7, V6_PROBES } from '../selvedge/config.ts';
import { createGame as createSelvedgeGame, type SelvedgeConfig } from '../selvedge/engine.ts';
import { RULES_V8, V8_PROBES } from '../selvedge/tags/config.ts';
import { createGame as createTagsGame, type TagsConfig } from '../selvedge/tags/engine.ts';
import { mordantAdapter } from './adapters/mordant.ts';
import { selvedgeAdapter } from './adapters/selvedge.ts';
import { tagsAdapter } from './adapters/tags.ts';
import { buildBot, type BotSpec } from './bots.ts';
import { playGame, type CreateGame, type GameRecord } from './play.ts';

/** A ruleset as the simulator sees it, with its game state and move types hidden inside. */
export interface SimRuleset {
  version: string;
  heuristicNames: string[];
  strategyLabelCount: number;
  /** Plays each seed. `carriesMemory: false` runs the no-carry rules ablation. */
  play(spec: BotSpec, seeds: readonly number[], carriesMemory: boolean): GameRecord[];
}

function simRuleset<S, M>(
  version: string,
  adapter: GameAdapter<S, M>,
  createGameFor: (carriesMemory: boolean) => CreateGame<S>,
): SimRuleset {
  return {
    version,
    heuristicNames: Object.keys(adapter.heuristics),
    strategyLabelCount: adapter.strategyLabelCount,
    play(spec, seeds, carriesMemory) {
      const bot = buildBot(adapter, spec);
      const createGame = createGameFor(carriesMemory);
      return seeds.map((seed) => playGame(adapter, createGame, seed, bot));
    },
  };
}

function mordantRuleset(config: RulesConfig): SimRuleset {
  return simRuleset(config.version, mordantAdapter(config), (carriesMemory) => (seed) =>
    createMordantGame(seed, { ...config, carriesMemoryBetweenSeasons: carriesMemory }),
  );
}

function selvedgeRuleset(config: SelvedgeConfig): SimRuleset {
  return simRuleset(config.version, selvedgeAdapter, (carriesMemory) => (seed) =>
    createSelvedgeGame(seed, { ...config, carriesMemoryBetweenSeasons: carriesMemory }),
  );
}

function tagsRuleset(config: TagsConfig): SimRuleset {
  return simRuleset(config.version, tagsAdapter, (carriesMemory) => (seed) =>
    createTagsGame(seed, { ...config, carriesMemoryBetweenSeasons: carriesMemory }),
  );
}

export const SIM_RULESETS: Record<string, SimRuleset> = {
  ...Object.fromEntries(Object.values(MORDANT_RULESETS).map((config) => [config.version, mordantRuleset(config)])),
  v6: selvedgeRuleset(RULES_V6),
  v7: selvedgeRuleset(RULES_V7),
  ...Object.fromEntries(V6_PROBES.map((config) => [config.version, selvedgeRuleset(config)])),
  v8: tagsRuleset(RULES_V8),
  ...Object.fromEntries(V8_PROBES.map((config) => [config.version, tagsRuleset(config)])),
};

export function simRulesetFor(version: string): SimRuleset {
  const ruleset = SIM_RULESETS[version];
  if (!ruleset) throw new Error(`Unknown ruleset "${version}". Known: ${Object.keys(SIM_RULESETS).join(', ')}`);
  return ruleset;
}
