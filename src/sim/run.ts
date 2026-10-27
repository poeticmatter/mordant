import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { BotSpec } from './bots.ts';
import {
  calibratedTarget,
  decisionDensity,
  effectSize,
  pacing,
  runVariety,
  strategicDiversity,
  summarizeScores,
  tensionAuc,
} from './metrics.ts';
import type { GameRecord } from './play.ts';
import { playSeeds } from './pool.ts';
import { simRulesetFor } from './rulesets.ts';

const { values: args } = parseArgs({
  options: {
    rules: { type: 'string', default: 'v6' },
    games: { type: 'string', default: '2000' },
    'planner-games': { type: 'string', default: '100' },
    budget: { type: 'string', default: '400' },
    'skip-ablations': { type: 'boolean', default: false },
    'skip-headroom': { type: 'boolean', default: false },
  },
});

const ruleset = simRulesetFor(args.rules as string);
const version = ruleset.version;
const gameCount = Number(args.games);
const plannerGameCount = Number(args['planner-games']);
const budget = Number(args.budget);
const seeds = Array.from({ length: gameCount }, (_, index) => index + 1);
const plannerSeeds = seeds.slice(0, plannerGameCount);

async function timed(label: string, run: () => Promise<GameRecord[]>): Promise<GameRecord[]> {
  const started = performance.now();
  const records = await run();
  console.log(`  ${label.padEnd(26)} ${records.length} games in ${((performance.now() - started) / 1000).toFixed(1)}s`);
  return records;
}

const planner = (options: object): BotSpec => ({ kind: 'planner', options: { rolloutBudget: budget, ...options } });

console.log(`Ruleset ${version}`);
const random = await timed('Random', () => playSeeds(version, { kind: 'random' }, seeds));
const heuristicRecords: Record<string, GameRecord[]> = {};
for (const heuristic of ruleset.heuristicNames) {
  heuristicRecords[heuristic] = await timed(heuristic, () => playSeeds(version, { kind: 'heuristic', heuristic }, seeds));
}
const greedy = heuristicRecords.greedy;
const humanProxy = heuristicRecords.humanProxy;
const plannerRecords = await timed('Planner', () => playSeeds(version, planner({}), plannerSeeds));
const headroomSeeds = plannerSeeds.slice(0, Math.ceil(plannerGameCount / 3));
const strongPlanner = args['skip-headroom']
  ? null
  : await timed('Planner x4', () => playSeeds(version, planner({ name: 'Planner x4', rolloutBudget: budget * 4 }), headroomSeeds));
const ablations = args['skip-ablations']
  ? null
  : {
      memoryBlind: await timed('Planner memory-blind', () => playSeeds(version, planner({ isMemoryBlind: true }), plannerSeeds)),
      randomPlacement: await timed('Planner random-placement', () => playSeeds(version, planner({ hasRandomPlacement: true }), plannerSeeds)),
      noCarryRules: await timed('Planner, no-carry rules', () => playSeeds(version, planner({}), plannerSeeds, false)),
    };

const plannerOnSameSeeds = (subset: readonly GameRecord[]) =>
  plannerRecords.filter((record) => subset.some((other) => other.seed === record.seed));
const target = calibratedTarget(plannerRecords);

const report = {
  rules: version,
  budget,
  scores: {
    random: summarizeScores(random),
    ...Object.fromEntries(Object.entries(heuristicRecords).map(([name, records]) => [name, summarizeScores(records)])),
    planner: summarizeScores(plannerRecords),
    plannerX4: strongPlanner && summarizeScores(strongPlanner),
  },
  gradient: {
    greedyOverRandomSd: effectSize(greedy, random, greedy),
    // Warning sign when these stay near zero while the Planner's lead grows: the depth is out of human reach.
    ...Object.fromEntries(
      Object.entries(heuristicRecords)
        .filter(([name]) => name !== 'greedy')
        .map(([name, records]) => [`${name}OverGreedySd`, effectSize(records, greedy, greedy)]),
    ),
    plannerOverGreedySd: effectSize(plannerRecords, greedy.slice(0, plannerGameCount), plannerRecords),
    plannerOverHumanProxySd: effectSize(plannerRecords, humanProxy.slice(0, plannerGameCount), plannerRecords),
    headroomSd: strongPlanner && effectSize(strongPlanner, plannerOnSameSeeds(strongPlanner), plannerRecords),
  },
  // M13: a one-move player should not win comfortably (target ≤ 15 %).
  greedyCeiling: { greedyWinRate: summarizeScores(greedy).winRate, humanProxyWinRate: summarizeScores(humanProxy).winRate },
  density: decisionDensity(plannerRecords),
  ablations: ablations && {
    memoryBlindDropSd: effectSize(plannerRecords, ablations.memoryBlind, plannerRecords),
    randomPlacementDropSd: effectSize(plannerRecords, ablations.randomPlacement, plannerRecords),
    noCarryRulesDeltaSd: effectSize(plannerRecords, ablations.noCarryRules, plannerRecords),
    memoryBlind: summarizeScores(ablations.memoryBlind),
    randomPlacement: summarizeScores(ablations.randomPlacement),
    noCarryRules: summarizeScores(ablations.noCarryRules),
  },
  diversity: strategicDiversity(plannerRecords, ruleset.strategyLabelCount),
  tension: {
    calibratedTarget: target,
    aucAtHalf: tensionAuc(plannerRecords, 0.5, target),
    aucAtThreeQuarters: tensionAuc(plannerRecords, 0.75, target),
  },
  variety: runVariety(plannerRecords),
  pacing: pacing(plannerRecords),
};

const round = (value: number) => Math.round(value * 1000) / 1000;
console.log(JSON.stringify(report, (_key, value) => (typeof value === 'number' ? round(value) : value), 2));

mkdirSync('sims', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(`sims/${version}-${stamp}.json`, JSON.stringify(report, null, 2));
writeFileSync(`sims/${version}-${stamp}-planner-records.json`, JSON.stringify(plannerRecords));
