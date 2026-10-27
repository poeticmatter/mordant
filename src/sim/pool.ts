import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { RulesConfig } from '../engine/config.ts';
import type { BotSpec } from './bots.ts';
import type { GameRecord } from './play.ts';
import type { WorkerJob } from './worker.ts';

const WORKER_URL = new URL('./worker.ts', import.meta.url);
const CHUNKS_PER_WORKER = 4;

function runJob(job: WorkerJob): Promise<GameRecord[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, { workerData: job });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}

/** Plays every seed with the bot, spread across all CPU cores. Results keep seed order. */
export async function playSeeds(config: RulesConfig, botSpec: BotSpec, seeds: number[]): Promise<GameRecord[]> {
  const workerCount = Math.max(1, availableParallelism() - 1);
  const chunkSize = Math.max(1, Math.ceil(seeds.length / (workerCount * CHUNKS_PER_WORKER)));
  const chunks: number[][] = [];
  for (let start = 0; start < seeds.length; start += chunkSize) chunks.push(seeds.slice(start, start + chunkSize));

  const results: GameRecord[][] = new Array(chunks.length);
  let nextChunk = 0;
  async function drainQueue(): Promise<void> {
    while (nextChunk < chunks.length) {
      const index = nextChunk++;
      results[index] = await runJob({ config, botSpec, seeds: chunks[index] });
    }
  }
  await Promise.all(Array.from({ length: workerCount }, drainQueue));
  return results.flat();
}
