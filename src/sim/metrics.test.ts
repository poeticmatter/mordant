import { describe, expect, it } from 'vitest';
import { calibratedTarget } from './metrics.ts';
import type { GameRecord } from './play.ts';

function recordsScoring(scores: readonly number[]): GameRecord[] {
  return scores.map((score, seed) => ({ seed, botName: 'test', score, isWin: false, decisions: [], shipments: [], moves: [] }));
}

describe('calibratedTarget', () => {
  it('uses the 35th percentile when some games fall short of it', () => {
    expect(calibratedTarget(recordsScoring([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeGreaterThan(1);
  });

  it('moves up to the next score when every game reaches the percentile', () => {
    expect(calibratedTarget(recordsScoring([7, 7, 7, 7, 8, 8, 8, 8, 8, 8]))).toBe(8);
  });
});
