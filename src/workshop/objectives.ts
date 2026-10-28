import { nextRandom } from '../engine/rng.ts';
import { DYES, type Dye } from '../engine/shades.ts';
import { COLOURS, SAMPLES_PER_SIDE, shareOf, type Colour, type Reading } from './cloth.ts';
import { isInsideConvex, isInsideOrOnConvex, type Point } from './geometry.ts';

/**
 * What a commission asks for. Every objective can be drawn as a picture and judged on a cloth's
 * reading as a match from 0 to 1.
 */

export type PatternName = 'halfSquare' | 'hourglass' | 'squareInSquare' | 'fourPatch' | 'diamond' | 'cross' | 'bars';

/** A quilt block in unit coordinates (−1 to 1 across, y down): everything is role 0 unless an overlay says otherwise. */
export interface PatternShape {
  title: string;
  roles: number;
  overlays: { role: number; polygon: Point[] }[];
}

const THIRD = 1 / 3;

function rect(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

export const PATTERNS: Record<PatternName, PatternShape> = {
  halfSquare: {
    title: 'Half-square triangle',
    roles: 2,
    overlays: [{ role: 1, polygon: [{ x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }] }],
  },
  hourglass: {
    title: 'Hourglass',
    roles: 2,
    overlays: [
      { role: 1, polygon: [{ x: -1, y: -1 }, { x: 0, y: 0 }, { x: -1, y: 1 }] },
      { role: 1, polygon: [{ x: 1, y: -1 }, { x: 1, y: 1 }, { x: 0, y: 0 }] },
    ],
  },
  squareInSquare: { title: 'Square in a square', roles: 2, overlays: [{ role: 1, polygon: rect(-0.5, -0.5, 0.5, 0.5) }] },
  fourPatch: {
    title: 'Four-patch',
    roles: 2,
    overlays: [
      { role: 1, polygon: rect(0, -1, 1, 0) },
      { role: 1, polygon: rect(-1, 0, 0, 1) },
    ],
  },
  diamond: { title: 'Diamond in a square', roles: 2, overlays: [{ role: 1, polygon: [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }] }] },
  cross: {
    title: 'Cross',
    roles: 2,
    overlays: [
      { role: 1, polygon: rect(-THIRD, -1, THIRD, 1) },
      { role: 1, polygon: rect(-1, -THIRD, 1, THIRD) },
    ],
  },
  bars: {
    title: 'Three bars',
    roles: 3,
    overlays: [
      { role: 1, polygon: rect(-THIRD, -1, THIRD, 1) },
      { role: 2, polygon: rect(THIRD, -1, 1, 1) },
    ],
  },
};

export const PATTERN_NAMES = Object.keys(PATTERNS) as PatternName[]; // keys of a literal Record<PatternName, …>

export type Objective =
  | { kind: 'pattern'; pattern: PatternName; /** One colour per role. */ colours: Colour[] }
  | { kind: 'coverage'; colour: Dye; share: number }
  | { kind: 'mirror'; minimumShare: number }
  | { kind: 'apart'; first: Dye; second: Dye; minimumShare: number };

export const COVERAGE_SHARE = 0.5;
export const MIRROR_MINIMUM_SHARE = 0.15;
export const APART_MINIMUM_SHARE = 0.2;

export function roleAt(shape: PatternShape, point: Point): number {
  let role = 0;
  for (const overlay of shape.overlays) if (isInsideConvex(overlay.polygon, point)) role = overlay.role;
  return role;
}

/** The role a point would have if every edge it lies on counted as inside; differs from `roleAt` only on edges. */
function roleCountingEdges(shape: PatternShape, point: Point): number {
  let role = 0;
  for (const overlay of shape.overlays) if (isInsideOrOnConvex(overlay.polygon, point)) role = overlay.role;
  return role;
}

/** The eight ways to turn or flip a square. */
const SYMMETRIES: ((point: Point) => Point)[] = [
  (p) => ({ x: p.x, y: p.y }),
  (p) => ({ x: -p.y, y: p.x }),
  (p) => ({ x: -p.x, y: -p.y }),
  (p) => ({ x: p.y, y: -p.x }),
  (p) => ({ x: -p.x, y: p.y }),
  (p) => ({ x: p.x, y: -p.y }),
  (p) => ({ x: p.y, y: p.x }),
  (p) => ({ x: -p.y, y: -p.x }),
];

function patternMatch(objective: Extract<Objective, { kind: 'pattern' }>, reading: Reading): number {
  const shape = PATTERNS[objective.pattern];
  let best = 0;
  for (const symmetry of SYMMETRIES) {
    let matches = 0;
    reading.points.forEach((point, index) => {
      // A sample exactly on an edge of the block may match the colour on either side of it.
      const turned = symmetry(point);
      const colour = reading.colours[index];
      if (colour === objective.colours[roleAt(shape, turned)] || colour === objective.colours[roleCountingEdges(shape, turned)]) matches++;
    });
    best = Math.max(best, matches / reading.points.length);
  }
  return best;
}

/** Sample index of the reflection of `index` across one of the square's four mirror axes. */
const MIRRORS: ((row: number, column: number) => number)[] = [
  (row, column) => row * SAMPLES_PER_SIDE + (SAMPLES_PER_SIDE - 1 - column),
  (row, column) => (SAMPLES_PER_SIDE - 1 - row) * SAMPLES_PER_SIDE + column,
  (row, column) => column * SAMPLES_PER_SIDE + row,
  (row, column) => (SAMPLES_PER_SIDE - 1 - column) * SAMPLES_PER_SIDE + (SAMPLES_PER_SIDE - 1 - row),
];

/** Shares of the two most common colours, largest first. */
function topTwoShares(reading: Reading): [number, number] {
  const shares = COLOURS.map((colour) => shareOf(reading, colour)).sort((first, second) => second - first);
  return [shares[0], shares[1]];
}

function mirrorMatch(objective: Extract<Objective, { kind: 'mirror' }>, reading: Reading): number {
  let best = 0;
  for (const mirror of MIRRORS) {
    let matches = 0;
    reading.colours.forEach((colour, index) => {
      if (colour === reading.colours[mirror(Math.floor(index / SAMPLES_PER_SIDE), index % SAMPLES_PER_SIDE)]) matches++;
    });
    best = Math.max(best, matches / reading.colours.length);
  }
  const [, secondShare] = topTwoShares(reading);
  return best * Math.min(1, secondShare / objective.minimumShare);
}

/** Pairs of side-by-side samples where one is `first` and the other `second`. */
function touchingPairs(reading: Reading, first: Colour, second: Colour): number {
  const isPair = (a: Colour, b: Colour) => (a === first && b === second) || (a === second && b === first);
  let pairs = 0;
  reading.colours.forEach((colour, index) => {
    const column = index % SAMPLES_PER_SIDE;
    if (column < SAMPLES_PER_SIDE - 1 && isPair(colour, reading.colours[index + 1])) pairs++;
    if (index + SAMPLES_PER_SIDE < reading.colours.length && isPair(colour, reading.colours[index + SAMPLES_PER_SIDE])) pairs++;
  });
  return pairs;
}

function apartMatch(objective: Extract<Objective, { kind: 'apart' }>, reading: Reading): number {
  const presence = Math.min(1, shareOf(reading, objective.first) / objective.minimumShare, shareOf(reading, objective.second) / objective.minimumShare);
  const separation = Math.max(0, 1 - touchingPairs(reading, objective.first, objective.second) / SAMPLES_PER_SIDE);
  return presence * separation;
}

/** How well a cloth's reading meets the objective, from 0 to 1. */
export function matchOf(objective: Objective, reading: Reading): number {
  switch (objective.kind) {
    case 'pattern':
      return patternMatch(objective, reading);
    case 'coverage':
      return Math.min(1, shareOf(reading, objective.colour) / objective.share);
    case 'mirror':
      return mirrorMatch(objective, reading);
    case 'apart':
      return apartMatch(objective, reading);
  }
}

/** Stars for a match, given ascending thresholds for one, two and three stars. */
export function starsFor(match: number, thresholds: readonly number[]): number {
  return thresholds.filter((threshold) => match >= threshold - 1e-9).length;
}

class SeededPicker {
  rngState: number;

  constructor(rngState: number) {
    this.rngState = rngState;
  }

  int(exclusiveMax: number): number {
    const draw = nextRandom(this.rngState);
    this.rngState = draw.nextRngState;
    return Math.floor(draw.value * exclusiveMax);
  }

  /** `count` different items, in random order. */
  distinct<T>(items: readonly T[], count: number): T[] {
    const pool = items.slice();
    return Array.from({ length: count }, () => pool.splice(this.int(pool.length), 1)[0]);
  }
}

/** `count − 1` different quilt blocks in random colours, then one coverage, mirror or kept-apart objective. */
export function dealObjectives(count: number, rngState: number): { objectives: Objective[]; rngState: number } {
  const picker = new SeededPicker(rngState);
  const patterns = picker.distinct(PATTERN_NAMES, count - 1).map(
    (pattern): Objective => ({ kind: 'pattern', pattern, colours: picker.distinct(COLOURS, PATTERNS[pattern].roles) }),
  );
  const [first, second] = picker.distinct(DYES, 2);
  const others: Objective[] = [
    { kind: 'coverage', colour: first, share: COVERAGE_SHARE },
    { kind: 'mirror', minimumShare: MIRROR_MINIMUM_SHARE },
    { kind: 'apart', first, second, minimumShare: APART_MINIMUM_SHARE },
  ];
  return { objectives: [...patterns, others[picker.int(others.length)]], rngState: picker.rngState };
}
