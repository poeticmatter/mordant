import { describe, expect, it } from 'vitest';
import { Random } from '../engine/rng.ts';
import { BLUE, DYES, RED, YELLOW, type Dye } from '../engine/shades.ts';
import { RULES_V10 } from './config.ts';
import { applyMove, colourAt, createGame, freeSlots, IllegalMoveError, mixOf, UNDYED, type Cloth, type WorkshopMove, type WorkshopState } from './engine.ts';
import { coversFrom, isInsideQuad, squareCorners, toBench, toLocal, unturned, type Placement } from './geometry.ts';
import { scoreQuilt, showingColours } from './scoring.ts';

const SIZE = RULES_V10.clothSize;
const HALF = SIZE / 2;
const ORANGE = mixOf(RED) | mixOf(YELLOW);

function at(clothId: number, x: number, y: number, rotation = 0): Placement {
  return { clothId, x, y, rotation };
}

function sprayed(state: WorkshopState, dye: Dye, layout: Placement[]): WorkshopState {
  return applyMove(state, { kind: 'spray', dye, layout });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe('geometry', () => {
  it('turns a cloth clockwise on screen', () => {
    const corner = toBench(at(0, 18, 18, 6), { x: -HALF, y: -HALF });
    expect([round(corner.x), round(corner.y)]).toEqual([24, 12]);
  });

  it('maps bench points back to the cloth they came from', () => {
    const placement = at(0, 20, 15, 5);
    const local = toLocal(placement, toBench(placement, { x: 1.5, y: -2 }));
    expect([round(local.x), round(local.y)]).toEqual([1.5, -2]);
  });

  it('sees a cloth above as a quad over the one below', () => {
    const [cover] = coversFrom([at(0, 18, 18), at(1, 24, 18)], 0, SIZE);
    expect([isInsideQuad(cover, { x: 5, y: 0 }), isInsideQuad(cover, { x: -5, y: 0 })]).toEqual([true, false]);
  });

  it('leaves the top cloth uncovered', () => {
    expect(coversFrom([at(0, 18, 18), at(1, 24, 18)], 1, SIZE)).toEqual([]);
  });

  it('ignores cloths too far away to touch', () => {
    expect(coversFrom([at(0, 0, 0), at(1, 36, 36)], 0, SIZE)).toEqual([]);
  });

  it('undoes a quilt square’s quarter turn', () => {
    const point = unturned({ x: HALF - 1, y: 0 }, 1);
    expect([round(point.x), round(point.y)]).toEqual([0, -(HALF - 1)]);
  });

  it('lists the square’s corners clockwise from top-left', () => {
    expect(squareCorners(2)).toEqual([
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ]);
  });
});

describe('spraying', () => {
  it('dyes the exposed part of a lower cloth', () => {
    const start = createGame(1, RULES_V10);
    const [lower, upper] = start.bench;
    const after = sprayed(start, RED, [at(lower, 18, 18), at(upper, 24, 18)]);
    expect(colourAt(after.cloths[lower], SIZE, { x: -5, y: 0 })).toBe(mixOf(RED));
  });

  it('leaves the covered part of a lower cloth as it was', () => {
    const start = createGame(1, RULES_V10);
    const [lower, upper] = start.bench;
    const after = sprayed(start, RED, [at(lower, 18, 18), at(upper, 24, 18)]);
    expect(colourAt(after.cloths[lower], SIZE, { x: 5, y: 0 })).toBe(UNDYED);
  });

  it('follows a turned cloth’s diagonal edge', () => {
    const start = createGame(1, RULES_V10);
    const [lower, upper] = start.bench;
    const after = sprayed(start, BLUE, [at(lower, 18, 18), at(upper, 18, 18, 3)]);
    const cloth = after.cloths[lower];
    expect([colourAt(cloth, SIZE, { x: -5.9, y: -5.9 }), colourAt(cloth, SIZE, { x: 0, y: -5.9 })]).toEqual([mixOf(BLUE), UNDYED]);
  });

  it('mixes a second dye into what is already there', () => {
    let state = createGame(1, RULES_V10);
    const [cloth] = state.bench;
    state = sprayed(state, RED, [at(cloth, 18, 18)]);
    state = applyMove(state, { kind: 'endRound' });
    state = { ...state, bench: [cloth, ...state.bench.filter((id) => id !== cloth)] };
    state = sprayed(state, YELLOW, [at(cloth, 18, 18)]);
    expect(colourAt(state.cloths[cloth], SIZE, { x: 0, y: 0 })).toBe(ORANGE);
  });

  it('allows one spray per round', () => {
    const start = createGame(1, RULES_V10);
    const once = sprayed(start, RED, [at(start.bench[0], 18, 18)]);
    expect(() => sprayed(once, BLUE, [at(start.bench[0], 18, 18)])).toThrow(IllegalMoveError);
  });

  it('rejects a cloth laid off the bench', () => {
    const start = createGame(1, RULES_V10);
    expect(() => sprayed(start, RED, [at(start.bench[0], RULES_V10.benchSize + 1, 18)])).toThrow(IllegalMoveError);
  });
});

describe('rounds and the quilt', () => {
  it('has exactly as many cloths as quilt squares', () => {
    expect(RULES_V10.clothCount).toBe(RULES_V10.quiltWidth * RULES_V10.quiltHeight);
  });

  it('returns unquilted bench cloths to the deck at the end of a round', () => {
    const after = applyMove(createGame(2, RULES_V10), { kind: 'endRound' });
    expect(after.deck.length + after.bench.length).toBe(RULES_V10.clothCount);
  });

  it('takes a quilted cloth out of play for good', () => {
    const start = createGame(2, RULES_V10);
    const cloth = start.bench[0];
    const after = applyMove(applyMove(start, { kind: 'quilt', clothId: cloth, slot: 4, turns: 1 }), { kind: 'endRound' });
    expect([after.quilt[4]?.clothId, after.deck.includes(cloth) || after.bench.includes(cloth)]).toEqual([cloth, false]);
  });

  it('ends after the last round', () => {
    let state = createGame(3, RULES_V10);
    while (!state.isOver) state = applyMove(state, { kind: 'endRound' });
    expect(state.round).toBe(RULES_V10.rounds);
  });
});

describe('scoring', () => {
  /** A cloth sprayed whole with each dye in turn. */
  function solid(id: number, ...dyes: Dye[]): Cloth {
    return { id, layers: dyes.map((dye) => ({ dye, covers: [] })), isQuilted: true };
  }

  function quiltOf(left: Cloth, right: Cloth): WorkshopState {
    const state = createGame(4, RULES_V10);
    state.cloths[0] = { ...left, id: 0 };
    state.cloths[1] = { ...right, id: 1 };
    state.quilt = state.quilt.map((_, slot) => (slot === 0 ? { clothId: 0, turns: 0 } : slot === 1 ? { clothId: 1, turns: 0 } : null));
    return state;
  }

  it('scores every stitch of a seam between two same-coloured squares', () => {
    expect(scoreQuilt(quiltOf(solid(0, RED, YELLOW), solid(1, RED, YELLOW))).seams).toBe(RULES_V10.stitchesPerSeam);
  });

  it('never matches brown', () => {
    expect(scoreQuilt(quiltOf(solid(0, RED, YELLOW, BLUE), solid(1, RED, YELLOW, BLUE))).seams).toBe(0);
  });

  it('never matches undyed cloth', () => {
    expect(scoreQuilt(quiltOf(solid(0), solid(1))).seams).toBe(0);
  });

  it('counts the dyed colours showing on a cloth', () => {
    const rightHalf = [
      { x: 0, y: -SIZE },
      { x: SIZE, y: -SIZE },
      { x: SIZE, y: SIZE },
      { x: 0, y: SIZE },
    ] as const;
    const state = createGame(5, RULES_V10);
    state.cloths[0] = { id: 0, layers: [{ dye: RED, covers: [] }, { dye: YELLOW, covers: [rightHalf] }], isQuilted: false };
    expect(showingColours(state, 0).sort()).toEqual([mixOf(RED), ORANGE].sort());
  });
});

describe('random play', () => {
  it('survives 100 random games without an illegal move', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = new Random(seed);
      let state = createGame(seed, RULES_V10);
      while (!state.isOver) state = applyMove(state, randomMove(state, rng));
      expect(state.isOver).toBe(true);
    }
  });
});

function randomMove(state: WorkshopState, rng: Random): WorkshopMove {
  const roll = rng.next();
  if (!state.hasSprayed && state.bench.length > 0 && roll < 0.6) {
    const layout = state.bench.map((clothId) => at(clothId, rng.int(RULES_V10.benchSize + 1), rng.int(RULES_V10.benchSize + 1), rng.int(24)));
    return { kind: 'spray', dye: rng.pick(DYES), layout };
  }
  if (state.bench.length > 0 && roll < 0.8) return { kind: 'quilt', clothId: rng.pick(state.bench), slot: rng.pick(freeSlots(state)), turns: rng.int(4) };
  return { kind: 'endRound' };
}
