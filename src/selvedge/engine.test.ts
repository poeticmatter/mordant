import { describe, expect, it } from 'vitest';
import { RULES_V6 } from './config.ts';
import {
  applyMove,
  bestFill,
  BOTTOM,
  createGame,
  IllegalMoveError,
  LEFT,
  legalMoves,
  RIGHT,
  TOP,
  type Commission,
  type SelvedgeState,
} from './engine.ts';
import { BLUE, RED, YELLOW } from '../engine/shades.ts';

function hangFirstTwoSideBySide(seed: number): { state: SelvedgeState; left: number; right: number } {
  let state = createGame(seed, RULES_V6);
  const [left, right] = state.hand;
  state = applyMove(state, { kind: 'hang', clothId: left, cell: 0 });
  state = applyMove(state, { kind: 'hang', clothId: right, cell: 1 });
  return { state, left, right };
}

function playOut(seed: number): SelvedgeState {
  let state = createGame(seed, RULES_V6);
  while (!state.isOver) state = applyMove(state, legalMoves(state).find((move) => move.kind === 'hang') ?? legalMoves(state)[0]);
  return state;
}

describe('staining', () => {
  it('stains the hung cloth’s touching edge with its neighbour’s colour', () => {
    const { state, left, right } = hangFirstTwoSideBySide(5);
    expect(state.cloths[right].edges[LEFT]).toBe(state.cloths[left].body);
  });

  it('stains the neighbour’s facing edge with the hung cloth’s colour', () => {
    const { state, left, right } = hangFirstTwoSideBySide(5);
    expect(state.cloths[left].edges[RIGHT]).toBe(state.cloths[right].body);
  });

  it('leaves edges against the frame clean', () => {
    const { state, left } = hangFirstTwoSideBySide(5);
    expect([state.cloths[left].edges[TOP], state.cloths[left].edges[LEFT]]).toEqual([null, null]);
  });

  it('keeps stains when the cloths come back next season', () => {
    let { state, left, right } = hangFirstTwoSideBySide(5);
    state = applyMove(state, { kind: 'inspect' });
    const carried = [state.cloths[left].edges[RIGHT], state.cloths[right].edges[LEFT]];
    expect(carried).toEqual([state.cloths[right].body, state.cloths[left].body]);
  });
});

describe('inspection', () => {
  it('cannot be called before anything is hung this season', () => {
    const state = createGame(5, RULES_V6);
    expect(() => applyMove(state, { kind: 'inspect' })).toThrow(IllegalMoveError);
  });

  it('starts a new season when called early', () => {
    const { state } = hangFirstTwoSideBySide(5);
    expect(applyMove(state, { kind: 'inspect' }).season).toBe(1);
  });

  it('fills as many commissions as the rack allows, one cloth each', () => {
    const wantsRedTop = (id: number): Commission => ({
      id,
      body: BLUE,
      edges: [RED, null, null, null],
      completedSeason: null,
      filledWith: null,
    });
    const blueWithRedTop = { body: BLUE, edges: [RED, null, YELLOW, null] };
    expect(bestFill([wantsRedTop(0), wantsRedTop(1)], [blueWithRedTop, null, blueWithRedTop])).toEqual([0, 2]);
  });
});

describe('a whole game', () => {
  it('replays identically from the same seed and moves', () => {
    expect(JSON.stringify(playOut(42))).toBe(JSON.stringify(playOut(42)));
  });

  it('ends within the configured seasons', () => {
    expect(playOut(3).season).toBeLessThanOrEqual(RULES_V6.seasons);
  });

  it('deals a pattern book with the configured number of fixed edges', () => {
    const fixed = createGame(9, RULES_V6).commissions.map((commission) => commission.edges.filter((edge) => edge !== null).length);
    expect(fixed).toEqual([...RULES_V6.fixedEdgesPerCommission]);
  });

  it('never stains the bottom edge of a cloth in the bottom row', () => {
    let state = createGame(13, RULES_V6);
    const bottomRowCell = RULES_V6.rackWidth * (RULES_V6.rackHeight - 1);
    const clothId = state.hand[0];
    state = applyMove(state, { kind: 'hang', clothId, cell: bottomRowCell });
    while (state.season === 0) state = applyMove(state, legalMoves(state).find((move) => move.kind === 'hang')!);
    expect(state.cloths[clothId].edges[BOTTOM]).toBeNull();
  });
});
