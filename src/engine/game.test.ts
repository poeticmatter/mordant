import { describe, expect, it } from 'vitest';
import { RULES_V1, RULES_V4 } from './config.ts';
import { applyMove, createGame, IllegalMoveError, legalMoves, previewInspectionPoints, type GameState } from './game.ts';
import { BLUE, RED, SHADE, shadeOf, YELLOW } from './shades.ts';

function playOutWithFirstMoves(seed: number): GameState {
  let state = createGame(seed, RULES_V1);
  while (!state.isOver) state = applyMove(state, legalMoves(state)[0]);
  return state;
}

describe('shadeOf', () => {
  it('reads a single dye unit as its plain primary', () => {
    expect(shadeOf([RED], 3)).toBe(SHADE.red);
  });

  it('reads a full memory of one dye as deep', () => {
    expect(shadeOf([BLUE, BLUE, BLUE], 3)).toBe(SHADE.deepBlue);
  });

  it('reads two kinds of dye as their secondary regardless of ratio', () => {
    expect(shadeOf([YELLOW, BLUE, BLUE], 3)).toBe(SHADE.green);
  });

  it('reads three kinds of dye as brown', () => {
    expect(shadeOf([RED, YELLOW, BLUE], 3)).toBe(SHADE.brown);
  });
});

describe('hanging a cloth', () => {
  it('bleeds the wet cloth’s newest dye into orthogonal neighbours only', () => {
    const start = createGame(7, RULES_V1);
    const [first, second] = start.hand;
    const afterFirst = applyMove(start, { clothId: first, cell: 0 });
    const afterSecond = applyMove(afterFirst, { clothId: second, cell: 1 });
    const secondDye = start.cloths[second].dyes[0];
    expect(afterSecond.cloths[first].dyes).toEqual([start.cloths[first].dyes[0], secondDye]);
  });

  it('does not change the wet cloth itself', () => {
    const start = createGame(7, RULES_V1);
    const [first, second] = start.hand;
    const afterFirst = applyMove(start, { clothId: first, cell: 0 });
    const afterSecond = applyMove(afterFirst, { clothId: second, cell: 1 });
    expect(afterSecond.cloths[second].dyes).toEqual(start.cloths[second].dyes);
  });

  it('leaves the original state untouched', () => {
    const start = createGame(7, RULES_V1);
    const snapshot = JSON.stringify(start);
    applyMove(start, legalMoves(start)[0]);
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it('rejects hanging on an occupied peg', () => {
    const start = createGame(7, RULES_V1);
    const afterFirst = applyMove(start, { clothId: start.hand[0], cell: 0 });
    expect(() => applyMove(afterFirst, { clothId: afterFirst.hand[0], cell: 0 })).toThrow(IllegalMoveError);
  });
});

describe('a whole game', () => {
  it('replays identically from the same seed and moves', () => {
    expect(JSON.stringify(playOutWithFirstMoves(42))).toBe(JSON.stringify(playOutWithFirstMoves(42)));
  });

  it('ends after the configured number of seasons', () => {
    expect(playOutWithFirstMoves(3).season).toBe(RULES_V1.seasons);
  });

  it('scores exactly the points of its shipments', () => {
    const end = playOutWithFirstMoves(5);
    expect(end.score).toBe(end.shipments.reduce((sum, shipment) => sum + shipment.points, 0));
  });

  it('predicts the inspection payout of the move that ends a season', () => {
    let state = createGame(11, RULES_V1);
    while (state.season === 0) {
      const move = legalMoves(state)[0];
      const predicted = previewInspectionPoints(state, move);
      const next = applyMove(state, move);
      if (next.season === 1) expect(next.score - state.score).toBe(predicted);
      state = next;
    }
  });
});

describe('the soak-once rule (v4)', () => {
  function hangThree(seed: number): GameState {
    // Peg 1 sits between pegs 0 and 2, so it is bled on twice: by the cloths hung on 0 and then on 2.
    let state = createGame(seed, RULES_V4);
    const [middle, left, right] = state.hand;
    state = applyMove(state, { clothId: middle, cell: 1 });
    state = applyMove(state, { clothId: left, cell: 0 });
    return applyMove(state, { clothId: right, cell: 2 });
  }

  it('lets a cloth take only the first stripe bled into it each season', () => {
    const start = createGame(21, RULES_V4);
    const [middle, left] = start.hand;
    const end = hangThree(21);
    expect(end.cloths[middle].dyes).toEqual([start.cloths[middle].dyes[0], start.cloths[left].dyes[0]]);
  });

  it('lets the cloth soak again once a new season starts', () => {
    let state = hangThree(21);
    while (state.season === 0) state = applyMove(state, legalMoves(state)[0]);
    const owned = state.cloths.filter((cloth) => !cloth.isShipped);
    expect(owned.every((cloth) => !cloth.hasSoakedThisSeason)).toBe(true);
  });
});
