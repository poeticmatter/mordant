import { Random } from '../engine/rng.ts';
import { DYES, type Dye } from '../engine/shades.ts';
import { BARE, blankCloths, COLOURS, readCloth, sprayed, type Cloth, type Colour, type Reading } from './cloth.ts';
import { placedRegions, regionShare, regionsOverlap, type Feature, type Objective } from './features.ts';
import type { Placement } from './geometry.ts';

/**
 * Builds a puzzle by playing a semi-random game (one spray of each dye, in a random order) and then
 * describing what each cloth ended up including. The game played is a known solution, so par is
 * always reachable.
 */

export interface GeneratorSettings {
  clothCount: number;
  clothSize: number;
  benchSize: number;
  /** A region counts as showing a colour in the generated cloth only at this share or more. */
  cleanShare: number;
  /** Most features per objective. Two different colours mean the cloth can't be met by one plain spray. */
  featuresPerObjective: number;
  /**
   * How many objectives may have fewer features. The top cloth of the last spray always ends up one
   * solid colour, so at least one cloth is plain; it becomes the natural stencil.
   */
  plainObjectivesAllowed: number;
}

export interface Spray {
  dye: Dye;
  /** Bottom first. */
  layout: Placement[];
}

export interface Puzzle {
  objectives: Objective[];
  par: number;
  /** The game the generator played. Its sprays meet every objective. */
  solution: Spray[];
}

const MAX_ATTEMPTS = 500;
/** How many cloths a generated spray lays out, and how often: [count, weight]. */
const LAYOUT_SIZES: readonly [number, number][] = [
  [2, 3],
  [3, 4],
  [4, 3],
];
const DIAGONAL_TURN = 3;
const DIAGONAL_CHANCE = 0.25;
/** Offsets from the bench centre that put edges on simple lines: halves when square, near-diagonals when turned. */
const SQUARE_OFFSETS = [-6, 0, 6];
const DIAGONAL_OFFSETS = [-4, 0, 4];

function weightedPick(rng: Random, options: readonly [number, number][]): number {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [value, weight] of options) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return options[options.length - 1][0];
}

function randomLayout(rng: Random, settings: GeneratorSettings): Placement[] {
  const ids = Array.from({ length: settings.clothCount }, (_, id) => id);
  rng.shuffleInPlace(ids);
  const centre = settings.benchSize / 2;
  const chosen = ids.slice(0, weightedPick(rng, LAYOUT_SIZES));
  return chosen.map((clothId, depth) => {
    const isDiagonal = rng.next() < DIAGONAL_CHANCE;
    if (depth === 0) return { clothId, x: centre, y: centre, rotation: isDiagonal ? DIAGONAL_TURN : 0 };
    const offsets = isDiagonal ? DIAGONAL_OFFSETS : SQUARE_OFFSETS;
    return { clothId, x: centre + rng.pick(offsets), y: centre + rng.pick(offsets), rotation: isDiagonal ? DIAGONAL_TURN : 0 };
  });
}

/** Every simple region the cloth shows cleanly, with its colour. */
function cleanFeatures(reading: Reading, settings: GeneratorSettings): Feature[] {
  return placedRegions().flatMap(({ region, polygon }) => {
    const colour = COLOURS.find((candidate) => regionShare(reading, polygon, candidate) >= settings.cleanShare);
    return colour === undefined ? [] : [{ region, polygon, colour }];
  });
}

/** Picks a region kind first, then one of its placements, so big and small regions come up alike. */
function pickFeature(rng: Random, features: readonly Feature[]): Feature {
  const regions = [...new Set(features.map((feature) => feature.region))];
  const region = rng.pick(regions);
  return rng.pick(features.filter((feature) => feature.region === region));
}

/** Up to `featuresPerObjective` non-overlapping features in different colours, the first one dyed; null if none is dyed. */
function describeCloth(rng: Random, cloth: Cloth, settings: GeneratorSettings): Objective | null {
  const reading = readCloth(cloth, settings.clothSize);
  const candidates = cleanFeatures(reading, settings);
  const dyed = candidates.filter((feature) => feature.colour !== BARE);
  if (dyed.length === 0) return null;
  const features = [pickFeature(rng, dyed)];
  while (features.length < settings.featuresPerObjective) {
    const usable = candidates.filter(
      (candidate) => features.every((chosen) => chosen.colour !== candidate.colour && !regionsOverlap(reading, chosen.polygon, candidate.polygon)),
    );
    if (usable.length === 0) break;
    features.push(pickFeature(rng, usable));
  }
  return { features };
}

function dyesAskedFor(objectives: readonly Objective[]): Set<Colour> {
  return new Set(objectives.flatMap((objective) => objective.features.map((feature) => feature.colour)).filter((colour) => colour !== BARE));
}

/** One attempt: play the sprays, then describe each cloth. Null when some cloth ended up too plain to ask for anything. */
function attempt(rng: Random, settings: GeneratorSettings): Puzzle | null {
  const order = DYES.slice();
  rng.shuffleInPlace(order);
  let cloths = blankCloths(settings.clothCount);
  const solution: Spray[] = order.map((dye) => {
    const layout = randomLayout(rng, settings);
    cloths = sprayed(cloths, dye, layout, settings.clothSize);
    return { dye, layout };
  });
  const objectives: Objective[] = [];
  for (const cloth of cloths) {
    const objective = describeCloth(rng, cloth, settings);
    if (objective === null) return null;
    objectives.push(objective);
  }
  const plainCount = objectives.filter((objective) => objective.features.length < settings.featuresPerObjective).length;
  if (plainCount > settings.plainObjectivesAllowed) return null;
  // Every dye must be asked for somewhere, so par (one spray of each) is also the fewest sprays possible.
  if (dyesAskedFor(objectives).size < DYES.length) return null;
  return { objectives, par: solution.length, solution };
}

export function generatePuzzle(seed: number, settings: GeneratorSettings): Puzzle {
  const rng = new Random(seed);
  for (let tries = 0; tries < MAX_ATTEMPTS; tries++) {
    const puzzle = attempt(rng, settings);
    if (puzzle) return puzzle;
  }
  throw new Error(`No puzzle found for seed ${seed} in ${MAX_ATTEMPTS} attempts`);
}
