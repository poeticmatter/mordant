import { parentPort, workerData } from 'node:worker_threads';
import type { BotSpec } from './bots.ts';
import { simRulesetFor } from './rulesets.ts';

export interface WorkerJob {
  version: string;
  carriesMemory: boolean;
  botSpec: BotSpec;
  seeds: number[];
}

const job = workerData as WorkerJob; // workerData is untyped; pool.ts is its only producer.
parentPort?.postMessage(simRulesetFor(job.version).play(job.botSpec, job.seeds, job.carriesMemory));
