import { describe, expect, it } from 'vitest';
import { BLUE, RED, YELLOW, type Dye } from '../engine/shades.ts';
import { BARE, blankCloths, colourAt, readCloth, sprayed, type Cloth } from './cloth.ts';
import { RULES_V12 } from './config.ts';
import { applyMove, createGame, IllegalMoveError, isClothDone, parName, scoreToPar, type WorkshopState } from './engine.ts';
import { isObjectiveMet, objectiveProgress, REGIONS, type Objective } from './features.ts';
import { generatePuzzle } from './generator.ts';
import { coversFrom, isInsideConvex, squareCorners, toBench, toLocal, type Placement } from './geometry.ts';

const SIZE = RULES_V12.clothSize;
const HALF = SIZE / 2;
const CENTRE = RULES_V12.benchSize / 2;

function at(clothId: number, x: number, y: number, rotation = 0): Placement {
  return { clothId, x, y, rotation };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Cloth 0 after sprays, each over cloth 0 at the centre plus the given covers on top. */
function clothAfter(...sprays: [Dye, Placement[]][]): Cloth {
  let cloths = blankCloths(4);
  for (const [dye, covers] of sprays) cloths = sprayed(cloths, dye, [at(0, CENTRE, CENTRE), ...covers], SIZE);
  return cloths[0];
}

function objectiveOf(...features: [keyof typeof REGIONS, number][]): Objective {
  return { features: features.map(([region, colour]) => ({ region, polygon: REGIONS[region].polygon, colour: colour as 0 })) };
}

function progress(objective: Objective, cloth: Cloth): number {
  return objectiveProgress(objective, readCloth(cloth, SIZE));
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

  it('lists the square’s corners clockwise from top-left', () => {
    expect(squareCorners(2)[1]).toEqual({ x: 1, y: -1 });
  });
});

describe('spraying', () => {
  it('dyes the exposed part of a lower cloth', () => {
    expect(colourAt(clothAfter([RED, [at(1, CENTRE + 6, CENTRE)]]), SIZE, { x: -3, y: 0 })).toBe(RED);
  });

  it('leaves the covered part of a lower cloth as it was', () => {
    expect(colourAt(clothAfter([RED, [at(1, CENTRE + 6, CENTRE)]]), SIZE, { x: 3, y: 0 })).toBe(BARE);
  });

  it('covers an earlier dye rather than mixing with it', () => {
    expect(colourAt(clothAfter([RED, []], [YELLOW, []]), SIZE, { x: 0, y: 0 })).toBe(YELLOW);
  });

  it('leaves cloths off the bench untouched', () => {
    expect(sprayed(blankCloths(2), BLUE, [at(0, CENTRE, CENTRE)], SIZE)[1].layers).toEqual([]);
  });
});

describe('objectives', () => {
  it('is met by a cloth that includes the region in its colour', () => {
    const redLeftHalf = clothAfter([RED, [at(1, CENTRE + 6, CENTRE)]]);
    expect(isObjectiveMet(objectiveOf(['half', RED]), readCloth(redLeftHalf, SIZE), RULES_V12.metThreshold)).toBe(true);
  });

  it('accepts the region turned any way round', () => {
    const redTopHalf = clothAfter([RED, [at(1, CENTRE, CENTRE + 6)]]);
    expect(progress(objectiveOf(['half', RED]), redTopHalf)).toBe(1);
  });

  it('ignores what the rest of the cloth looks like', () => {
    const redLeftThenBlueStripe = clothAfter([RED, []], [BLUE, [at(1, CENTRE - 4, CENTRE)]]);
    expect(progress(objectiveOf(['quarter', RED]), redLeftThenBlueStripe)).toBe(1);
  });

  it('needs every feature at once, in their places relative to each other', () => {
    const redLeftBareRight = clothAfter([RED, [at(1, CENTRE + 6, CENTRE)]]);
    const redHalfWithBareCornerInIt = objectiveOf(['half', RED], ['corner', BARE]);
    expect(isObjectiveMet(redHalfWithBareCornerInIt, readCloth(redLeftBareRight, SIZE), RULES_V12.metThreshold)).toBe(false);
  });

  it('is not met by a blank cloth when it asks for a dye', () => {
    expect(progress(objectiveOf(['centre', YELLOW]), blankCloths(1)[0])).toBe(0);
  });
});

describe('the generator', () => {
  const seeds = Array.from({ length: 12 }, (_, index) => index + 1);

  it('makes puzzles its own game solves', () => {
    const solved = seeds.map((seed) => {
      const game = createGame(seed, RULES_V12);
      return game.puzzle.solution.reduce((state: WorkshopState, spray) => applyMove(state, { kind: 'spray', ...spray }), game).isSolved;
    });
    expect(solved.every(Boolean)).toBe(true);
  });

  it('sets par at one spray of each dye', () => {
    expect(generatePuzzle(5, RULES_V12).par).toBe(3);
  });

  it('asks for every dye somewhere, so par is also the fewest sprays', () => {
    const objectives = generatePuzzle(9, RULES_V12).objectives;
    const dyes = new Set(objectives.flatMap((objective) => objective.features.map((feature) => feature.colour)).filter((colour) => colour !== BARE));
    expect(dyes.size).toBe(3);
  });

  it('gives at most one cloth a single feature', () => {
    const singles = seeds.map((seed) => generatePuzzle(seed, RULES_V12).objectives.filter((objective) => objective.features.length < 2).length);
    expect(Math.max(...singles)).toBeLessThanOrEqual(1);
  });

  it('makes the same puzzle from the same seed', () => {
    expect(JSON.stringify(generatePuzzle(3, RULES_V12))).toBe(JSON.stringify(generatePuzzle(3, RULES_V12)));
  });
});

describe('play', () => {
  it('starts with no cloth done', () => {
    const game = createGame(4, RULES_V12);
    expect(game.cloths.some((cloth) => isClothDone(game, cloth.id))).toBe(false);
  });

  it('counts each spray as a stroke', () => {
    const game = applyMove(createGame(4, RULES_V12), { kind: 'spray', dye: RED, layout: [at(0, CENTRE, CENTRE)] });
    expect(game.strokes).toBe(1);
  });

  it('refuses a spray with nothing on the bench', () => {
    expect(() => applyMove(createGame(4, RULES_V12), { kind: 'spray', dye: RED, layout: [] })).toThrow(IllegalMoveError);
  });

  it('names scores like minigolf', () => {
    expect([-1, 0, 1].map(parName)).toEqual(['Birdie', 'Par', 'Bogey']);
  });

  it('scores the generator’s own game at par', () => {
    const game = createGame(6, RULES_V12);
    const done = game.puzzle.solution.reduce((state: WorkshopState, spray) => applyMove(state, { kind: 'spray', ...spray }), game);
    expect(scoreToPar(done)).toBe(0);
  });
});
