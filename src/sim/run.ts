import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { RULESETS } from '../engine/config.ts';
import { buildOrderDeck } from '../engine/orders.ts';
import { categoryCount } from './orderLabels.ts';
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

const { values: args } = parseArgs({
  options: {
    rules: { type: 'string', default: 'v1' },
    games: { type: 'string', default: '2000' },
    'planner-games': { type: 'string', default: '300' },
    budget: { type: 'string', default: '400' },
    'skip-ablations': { type: 'boolean', default: false },
    'skip-headroom': { type: 'boolean', default: false },
  },
});

const config = RULESETS[args.rules as string];
if (!config) throw new Error(`Unknown ruleset "${args.rules}". Known: ${Object.keys(RULESETS).join(', ')}`);
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

console.log(`Ruleset ${config.version} (target ${config.targetScore})`);
const random = await timed('Random', () => playSeeds(config, { kind: 'random' }, seeds));
const greedy = await timed('Greedy', () => playSeeds(config, { kind: 'greedy' }, seeds));
const humanProxy = await timed('Human-proxy', () => playSeeds(config, { kind: 'humanProxy' }, seeds));
const orderReadingProxy = await timed('Human-proxy reads order', () => playSeeds(config, { kind: 'orderReadingProxy' }, seeds));
const plannerRecords = await timed('Planner', () => playSeeds(config, planner({}), plannerSeeds));
const headroomSeeds = plannerSeeds.slice(0, Math.ceil(plannerGameCount / 3));
const strongPlanner = args['skip-headroom']
  ? null
  : await timed('Planner x4', () => playSeeds(config, planner({ name: 'Planner x4', rolloutBudget: budget * 4 }), headroomSeeds));
const ablations = args['skip-ablations']
  ? null
  : {
      memoryBlind: await timed('Planner memory-blind', () => playSeeds(config, planner({ isMemoryBlind: true }), plannerSeeds)),
      randomPlacement: await timed('Planner random-placement', () =>
        playSeeds(config, planner({ hasRandomPlacement: true }), plannerSeeds),
      ),
      noCarryRules: await timed('Planner, no-carry rules', () =>
        playSeeds({ ...config, carriesMemoryBetweenSeasons: false }, planner({}), plannerSeeds),
      ),
    };

const plannerOnSameSeeds = (subset: readonly GameRecord[]) =>
  plannerRecords.filter((record) => subset.some((other) => other.seed === record.seed));

const report = {
  rules: config.version,
  target: config.targetScore,
  budget,
  scores: {
    random: summarizeScores(random),
    greedy: summarizeScores(greedy),
    humanProxy: summarizeScores(humanProxy),
    orderReadingProxy: summarizeScores(orderReadingProxy),
    planner: summarizeScores(plannerRecords),
    plannerX4: strongPlanner && summarizeScores(strongPlanner),
  },
  gradient: {
    greedyOverRandomSd: effectSize(greedy, random, greedy),
    // Warning sign when this stays near zero while the Planner's lead grows: the depth is out of human reach.
    humanProxyOverGreedySd: effectSize(humanProxy, greedy, greedy),
    orderReadingProxyOverGreedySd: effectSize(orderReadingProxy, greedy, greedy),
    plannerOverHumanProxySd: effectSize(plannerRecords, humanProxy.slice(0, plannerGameCount), plannerRecords),
    plannerOverGreedySd: effectSize(plannerRecords, greedy.slice(0, plannerGameCount), plannerRecords),
    headroomSd: strongPlanner && effectSize(strongPlanner, plannerOnSameSeeds(strongPlanner), plannerRecords),
  },
  density: decisionDensity(plannerRecords),
  ablations: ablations && {
    memoryBlindDropSd: effectSize(plannerRecords, ablations.memoryBlind, plannerRecords),
    randomPlacementDropSd: effectSize(plannerRecords, ablations.randomPlacement, plannerRecords),
    noCarryRulesDeltaSd: effectSize(plannerRecords, ablations.noCarryRules, plannerRecords),
    memoryBlind: summarizeScores(ablations.memoryBlind),
    randomPlacement: summarizeScores(ablations.randomPlacement),
    noCarryRules: summarizeScores(ablations.noCarryRules),
  },
  diversity: strategicDiversity(plannerRecords, categoryCount(buildOrderDeck(config.orderCatalogue))),
  tension: {
    calibratedTarget: calibratedTarget(plannerRecords),
    aucAtHalf: tensionAuc(plannerRecords, 0.5, calibratedTarget(plannerRecords)),
    aucAtThreeQuarters: tensionAuc(plannerRecords, 0.75, calibratedTarget(plannerRecords)),
  },
  variety: runVariety(plannerRecords),
  pacing: pacing(plannerRecords),
};

const round = (value: number) => Math.round(value * 1000) / 1000;
console.log(JSON.stringify(report, (_key, value) => (typeof value === 'number' ? round(value) : value), 2));

mkdirSync('sims', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(`sims/${config.version}-${stamp}.json`, JSON.stringify(report, null, 2));
writeFileSync(`sims/${config.version}-${stamp}-planner-records.json`, JSON.stringify(plannerRecords));
