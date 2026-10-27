import { describe, expect, it } from 'vitest';
import { RULES_V1, RULES_V4, RULES_V5 } from '../engine/config.ts';
import { applyMove, createGame, legalMoves, previewInspectionPoints } from '../engine/game.ts';
import { Random } from '../engine/rng.ts';
import { greedyMove } from './simpleBots.ts';

describe('greedyMove', () => {
  it.each([RULES_V1, RULES_V4, RULES_V5])('always picks a move with the highest previewed payout ($version)', (rules) => {
    const rng = new Random(1);
    let state = createGame(99, rules);
    while (!state.isOver) {
      const best = Math.max(...legalMoves(state).map((move) => previewInspectionPoints(state, move)));
      const chosen = greedyMove(state, rng);
      expect(previewInspectionPoints(state, chosen)).toBe(best);
      state = applyMove(state, chosen);
    }
  });
});
