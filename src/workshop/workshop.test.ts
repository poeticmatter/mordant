import { describe, expect, it } from 'vitest';
import { Random } from '../engine/rng.ts';
import { BLUE, DYES, RED, YELLOW, type Dye } from '../engine/shades.ts';
import { BARE, colourAt, readCloth, type Cloth, type Colour } from './cloth.ts';
import { RULES_V11 } from './config.ts';
import { applyMove, createGame, IllegalMoveError, openCommissions, totalStars, type WorkshopMove, type WorkshopState } from './engine.ts';
import { coversFrom, isInsideConvex, squareCorners, toBench, toLocal, type Placement, type Point } from './geometry.ts';
import { dealObjectives, matchOf, starsFor, type Objective } from './objectives.ts';

const SIZE = RULES_V11.clothSize;
const HALF = SIZE / 2;

function at(clothId: number, x: number, y: number, rotation = 0): Placement {
  return { clothId, x, y, rotation };
}

function sprayed(state: WorkshopState, dye: Dye, layout: Placement[]): WorkshopState {
  return applyMove(state, { kind: 'spray', dye, layout });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** A cloth built straight from layers, for judging objectives without playing a game. */
function clothOf(...layers: { dye: Dye; covers?: Point[][] }[]): Cloth {
  return {
    id: 0,
    layers: layers.map(({ dye, covers = [] }) => ({ dye, covers: covers.map((quad) => [quad[0], quad[1], quad[2], quad[3]] as const) })),
    deliveredTo: null,
  };
}

/** Covers everything below-right of the cloth's falling diagonal (x + y > 0). */
const BELOW_DIAGONAL: Point[] = [
  { x: -SIZE, y: SIZE },
  { x: SIZE, y: -SIZE },
  { x: 2 * SIZE, y: 0 },
  { x: 0, y: 2 * SIZE },
];

function match(objective: Objective, cloth: Cloth): number {
  return matchOf(objective, readCloth(cloth, SIZE));
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
    expect([isInsideConvex(cover, { x: 5, y: 0 }), isInsideConvex(cover, { x: -5, y: 0 })]).toEqual([true, false]);
  });

  it('leaves the top cloth uncovered', () => {
    expect(coversFrom([at(0, 18, 18), at(1, 24, 18)], 1, SIZE)).toEqual([]);
  });

  it('ignores cloths too far away to touch', () => {
    expect(coversFrom([at(0, 0, 0), at(1, 36, 36)], 0, SIZE)).toEqual([]);
  });

  it('lists the square’s corners clockwise from top-left', () => {
    expect(squareCorners(2)[1]).toEqual({ x: 1, y: -1 });
  });
});

describe('spraying', () => {
  it('dyes the exposed part of a lower cloth', () => {
    const start = createGame(1, RULES_V11);
    const [lower, upper] = start.bench;
    const after = sprayed(start, RED, [at(lower, 18, 18), at(upper, 24, 18)]);
    expect(colourAt(after.cloths[lower], SIZE, { x: -5, y: 0 })).toBe(RED);
  });

  it('leaves the covered part of a lower cloth as it was', () => {
    const start = createGame(1, RULES_V11);
    const [lower, upper] = start.bench;
    const after = sprayed(start, RED, [at(lower, 18, 18), at(upper, 24, 18)]);
    expect(colourAt(after.cloths[lower], SIZE, { x: 5, y: 0 })).toBe(BARE);
  });

  it('follows a turned cloth’s diagonal edge', () => {
    const start = createGame(1, RULES_V11);
    const [lower, upper] = start.bench;
    const after = sprayed(start, BLUE, [at(lower, 18, 18), at(upper, 18, 18, 3)]);
    const cloth = after.cloths[lower];
    expect([colourAt(cloth, SIZE, { x: -5.9, y: -5.9 }), colourAt(cloth, SIZE, { x: 0, y: -5.9 })]).toEqual([BLUE, BARE]);
  });

  it('covers an earlier dye rather than mixing with it', () => {
    expect(colourAt(clothOf({ dye: RED }, { dye: YELLOW }), SIZE, { x: 0, y: 0 })).toBe(YELLOW);
  });

  it('keeps the earlier dye where the later spray was masked', () => {
    expect(colourAt(clothOf({ dye: RED }, { dye: YELLOW, covers: [BELOW_DIAGONAL] }), SIZE, { x: 3, y: 3 })).toBe(RED);
  });

  it('allows one spray per round', () => {
    const start = createGame(1, RULES_V11);
    const once = sprayed(start, RED, [at(start.bench[0], 18, 18)]);
    expect(() => sprayed(once, BLUE, [at(start.bench[0], 18, 18)])).toThrow(IllegalMoveError);
  });

  it('rejects a cloth laid off the bench', () => {
    const start = createGame(1, RULES_V11);
    expect(() => sprayed(start, RED, [at(start.bench[0], RULES_V11.benchSize + 1, 18)])).toThrow(IllegalMoveError);
  });
});

describe('objectives', () => {
  const halfSquare = (first: Colour, second: Colour): Objective => ({ kind: 'pattern', pattern: 'halfSquare', colours: [first, second] });

  it('fully matches a half-square triangle made with a diagonal mask', () => {
    expect(match(halfSquare(BLUE, BARE), clothOf({ dye: BLUE, covers: [BELOW_DIAGONAL] }))).toBe(1);
  });

  it('accepts a block turned the other way round', () => {
    expect(match(halfSquare(BARE, BLUE), clothOf({ dye: BLUE, covers: [BELOW_DIAGONAL] }))).toBe(1);
  });

  it('half matches a half-square triangle on a cloth of one colour', () => {
    expect(round(match(halfSquare(BLUE, RED), clothOf({ dye: BLUE })))).toBeCloseTo(0.5, 1);
  });

  it('fully matches a four-patch made with two offset masks', () => {
    const topLeft = squareCorners(SIZE).map((corner) => ({ x: corner.x - HALF, y: corner.y - HALF }));
    const bottomRight = squareCorners(SIZE).map((corner) => ({ x: corner.x + HALF, y: corner.y + HALF }));
    const cloth = clothOf({ dye: RED }, { dye: YELLOW, covers: [topLeft, bottomRight] });
    expect(match({ kind: 'pattern', pattern: 'fourPatch', colours: [RED, YELLOW] }, cloth)).toBe(1);
  });

  it('measures coverage against the share asked for', () => {
    expect(match({ kind: 'coverage', colour: BLUE, share: 0.5 }, clothOf({ dye: BLUE, covers: [BELOW_DIAGONAL] }))).toBe(1);
  });

  it('finds a mirror line on a diagonal split', () => {
    expect(match({ kind: 'mirror', minimumShare: 0.15 }, clothOf({ dye: BLUE, covers: [BELOW_DIAGONAL] }))).toBe(1);
  });

  it('gives no mirror credit to a cloth of one colour', () => {
    expect(match({ kind: 'mirror', minimumShare: 0.15 }, clothOf({ dye: BLUE }))).toBe(0);
  });

  it('marks down two dyes that touch along a long edge', () => {
    const touching = clothOf({ dye: RED }, { dye: BLUE, covers: [BELOW_DIAGONAL] });
    expect(match({ kind: 'apart', first: RED, second: BLUE, minimumShare: 0.2 }, touching)).toBeLessThan(0.1);
  });

  it('awards stars at the thresholds', () => {
    expect([0.69, 0.7, 0.9, 0.95].map((value) => starsFor(value, RULES_V11.starThresholds))).toEqual([0, 1, 2, 3]);
  });

  it('deals different quilt blocks plus one other kind', () => {
    const { objectives } = dealObjectives(4, 99);
    const patterns = objectives.filter((objective) => objective.kind === 'pattern');
    expect([patterns.length, new Set(patterns.map((objective) => objective.kind === 'pattern' && objective.pattern)).size]).toEqual([3, 3]);
  });
});

describe('commissions', () => {
  it('scores a delivery and takes the cloth out of play', () => {
    const start = createGame(2, RULES_V11);
    const cloth = start.bench[0];
    const after = applyMove(applyMove(start, { kind: 'deliver', clothId: cloth, commissionId: 0 }), { kind: 'endRound' });
    expect([after.commissions[0].stars !== null, after.deck.includes(cloth) || after.bench.includes(cloth)]).toEqual([true, false]);
  });

  it('refuses a second delivery to a filled commission', () => {
    const start = createGame(2, RULES_V11);
    const once = applyMove(start, { kind: 'deliver', clothId: start.bench[0], commissionId: 0 });
    expect(() => applyMove(once, { kind: 'deliver', clothId: start.bench[1], commissionId: 0 })).toThrow(IllegalMoveError);
  });

  it('ends once every commission is delivered', () => {
    let state = createGame(2, RULES_V11);
    for (const commission of state.commissions) state = applyMove(state, { kind: 'deliver', clothId: state.bench[0], commissionId: commission.id });
    expect([state.isOver, totalStars(state) >= 0]).toEqual([true, true]);
  });

  it('ends after the last round', () => {
    let state = createGame(3, RULES_V11);
    while (!state.isOver) state = applyMove(state, { kind: 'endRound' });
    expect(state.round).toBe(RULES_V11.rounds);
  });
});

describe('random play', () => {
  it('survives 100 random games without an illegal move', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = new Random(seed);
      let state = createGame(seed, RULES_V11);
      while (!state.isOver) state = applyMove(state, randomMove(state, rng));
      expect(state.isOver).toBe(true);
    }
  });
});

function randomMove(state: WorkshopState, rng: Random): WorkshopMove {
  const roll = rng.next();
  if (!state.hasSprayed && state.bench.length > 0 && roll < 0.6) {
    const layout = state.bench.map((clothId) => at(clothId, rng.int(RULES_V11.benchSize + 1), rng.int(RULES_V11.benchSize + 1), rng.int(24)));
    return { kind: 'spray', dye: rng.pick(DYES), layout };
  }
  if (state.bench.length > 0 && roll < 0.75) return { kind: 'deliver', clothId: rng.pick(state.bench), commissionId: rng.pick(openCommissions(state)).id };
  return { kind: 'endRound' };
}
