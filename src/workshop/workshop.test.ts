import { describe, expect, it } from 'vitest';
import { Random } from '../engine/rng.ts';
import { BLUE, RED, YELLOW } from '../engine/shades.ts';
import { RULES_V9 } from './config.ts';
import { applyMove, BROWN, createGame, freeSlots, IllegalMoveError, mixOf, UNDYED, type WorkshopMove, type WorkshopState } from './engine.ts';
import { covers, exposedThreads, threadCentre, turnedGrid, type Placement } from './geometry.ts';
import { colourCount, scoreQuilt } from './scoring.ts';

const SIZE = RULES_V9.threads;
const ORANGE = mixOf(RED) | mixOf(YELLOW);

function at(clothId: number, x: number, y: number, rotation = 0): Placement {
  return { clothId, x, y, rotation };
}

function sprayed(state: WorkshopState, dye: number, layout: Placement[]): WorkshopState {
  return applyMove(state, { kind: 'spray', dye: dye as 0 | 1 | 2, layout });
}

describe('geometry', () => {
  it('puts the first thread half a thread inside the top-left corner', () => {
    expect(threadCentre(at(0, 18, 18), SIZE, 0, 0)).toEqual({ x: 12.5, y: 12.5 });
  });

  it('turns a cloth clockwise on screen', () => {
    const centre = threadCentre(at(0, 18, 18, 6), SIZE, 0, 0);
    expect([Math.round(centre.x * 10) / 10, Math.round(centre.y * 10) / 10]).toEqual([23.5, 12.5]);
  });

  it('covers points inside a turned cloth and not outside it', () => {
    const diamond = at(0, 18, 18, 3);
    expect([covers(diamond, SIZE, { x: 18, y: 26 }), covers(diamond, SIZE, { x: 24, y: 24 })]).toEqual([true, false]);
  });

  it('masks the part of a lower cloth that a higher one covers', () => {
    const [lower] = exposedThreads([at(0, 18, 18), at(1, 24, 18)], SIZE);
    expect([lower[0], lower[SIZE - 1]]).toEqual([true, false]);
  });

  it('leaves the top cloth fully exposed', () => {
    const [, upper] = exposedThreads([at(0, 18, 18), at(1, 24, 18)], SIZE);
    expect(upper.every(Boolean)).toBe(true);
  });

  it('turns a grid a quarter clockwise', () => {
    expect(turnedGrid(['a', 'b', 'c', 'd'], 2, 1)).toEqual(['c', 'a', 'd', 'b']);
  });
});

describe('spraying', () => {
  it('dyes exposed threads and leaves masked ones undyed', () => {
    const start = createGame(1, RULES_V9);
    const [lower, upper] = start.bench;
    const after = sprayed(start, RED, [at(lower, 18, 18), at(upper, 24, 18)]);
    expect([after.cloths[lower].threads[0], after.cloths[lower].threads[SIZE - 1]]).toEqual([mixOf(RED), UNDYED]);
  });

  it('mixes a second dye into threads that already hold one', () => {
    let state = createGame(1, RULES_V9);
    const [cloth] = state.bench;
    state = sprayed(state, RED, [at(cloth, 18, 18)]);
    state = applyMove(state, { kind: 'endRound' });
    state = { ...state, bench: [cloth, ...state.bench.filter((id) => id !== cloth)] };
    state = sprayed(state, YELLOW, [at(cloth, 18, 18)]);
    expect(state.cloths[cloth].threads[0]).toBe(ORANGE);
  });

  it('allows one spray per round', () => {
    const start = createGame(1, RULES_V9);
    const once = sprayed(start, RED, [at(start.bench[0], 18, 18)]);
    expect(() => sprayed(once, BLUE, [at(start.bench[0], 18, 18)])).toThrow(IllegalMoveError);
  });

  it('rejects a cloth laid off the bench', () => {
    const start = createGame(1, RULES_V9);
    expect(() => sprayed(start, RED, [at(start.bench[0], RULES_V9.benchSize + 1, 18)])).toThrow(IllegalMoveError);
  });
});

describe('rounds and the quilt', () => {
  it('returns unquilted bench cloths to the deck at the end of a round', () => {
    const start = createGame(2, RULES_V9);
    const after = applyMove(start, { kind: 'endRound' });
    expect(after.deck.length + after.bench.length).toBe(RULES_V9.clothCount);
  });

  it('takes a quilted cloth out of play for good', () => {
    const start = createGame(2, RULES_V9);
    const cloth = start.bench[0];
    const after = applyMove(applyMove(start, { kind: 'quilt', clothId: cloth, slot: 4, turns: 1 }), { kind: 'endRound' });
    expect([after.quilt[4]?.clothId, after.deck.includes(cloth) || after.bench.includes(cloth)]).toEqual([cloth, false]);
  });

  it('ends after the last round', () => {
    let state = createGame(3, RULES_V9);
    while (!state.isOver) state = applyMove(state, { kind: 'endRound' });
    expect(state.round).toBe(RULES_V9.rounds);
  });
});

describe('scoring', () => {
  function quiltOf(left: number[], right: number[]): WorkshopState {
    const state = createGame(4, RULES_V9);
    state.cloths[0].threads = left;
    state.cloths[1].threads = right;
    state.quilt = state.quilt.map((_, slot) => (slot === 0 ? { clothId: 0, turns: 0 } : slot === 1 ? { clothId: 1, turns: 0 } : null));
    return state;
  }
  const plain = (mix: number) => new Array<number>(SIZE * SIZE).fill(mix);

  it('scores each matching dyed thread pair across a seam', () => {
    expect(scoreQuilt(quiltOf(plain(ORANGE), plain(ORANGE))).seams).toBe(SIZE);
  });

  it('never matches brown threads', () => {
    expect(scoreQuilt(quiltOf(plain(BROWN), plain(BROWN))).seams).toBe(0);
  });

  it('never matches undyed threads', () => {
    expect(scoreQuilt(quiltOf(plain(UNDYED), plain(UNDYED))).seams).toBe(0);
  });

  it('counts dyed colours, leaving out undyed and brown', () => {
    expect(colourCount([UNDYED, BROWN, ORANGE, mixOf(RED), ORANGE])).toBe(2);
  });
});

describe('random play', () => {
  it('survives 200 random games without an illegal move', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = new Random(seed);
      let state = createGame(seed, RULES_V9);
      while (!state.isOver) state = applyMove(state, randomMove(state, rng));
      expect(state.isOver).toBe(true);
    }
  });
});

function randomMove(state: WorkshopState, rng: Random): WorkshopMove {
  const roll = rng.next();
  if (!state.hasSprayed && state.bench.length > 0 && roll < 0.6) {
    const layout = state.bench.map((clothId) => at(clothId, rng.int(RULES_V9.benchSize + 1), rng.int(RULES_V9.benchSize + 1), rng.int(24)));
    return { kind: 'spray', dye: rng.int(3) as 0 | 1 | 2, layout };
  }
  if (state.bench.length > 0 && roll < 0.8) return { kind: 'quilt', clothId: rng.pick(state.bench), slot: rng.pick(freeSlots(state)), turns: rng.int(4) };
  return { kind: 'endRound' };
}
