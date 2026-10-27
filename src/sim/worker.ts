import { parentPort, workerData } from 'node:worker_threads';
import type { RulesConfig } from '../engine/config.ts';
import { buildBot, type BotSpec } from './bots.ts';
import { playGame } from './play.ts';

export interface WorkerJob {
  config: RulesConfig;
  botSpec: BotSpec;
  seeds: number[];
}

const job = workerData as WorkerJob; // workerData is untyped; run.ts is its only producer.
const bot = buildBot(job.botSpec);
const records = job.seeds.map((seed) => playGame(seed, job.config, bot));
parentPort?.postMessage(records);
