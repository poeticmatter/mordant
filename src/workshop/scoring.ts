import { BROWN, colourAt, UNDYED, type Cloth, type Mix, type Patch, type WorkshopState } from './engine.ts';
import { unturned, type Point } from './geometry.ts';

export interface QuiltScore {
  /** Stitches across seams where both sides share a dyed colour. */
  seams: number;
  /** Squares showing at least the configured number of dyed colours. */
  colourfulSquares: number;
  total: number;
}

/** Samples per side when estimating how much of a square each colour covers. */
const AREA_SAMPLES_PER_SIDE = 24;
/** How far inside the edge a seam stitch looks, so it reads the cloth and not the boundary. */
const SEAM_INSET = 0.05;

function isScoringColour(mix: Mix): boolean {
  return mix !== UNDYED && mix !== BROWN;
}

/** The colour of a sewn square at a point in quilt-square coordinates (centre 0, 0; sides at ±size/2). */
export function patchColourAt(state: WorkshopState, patch: Patch, point: Point): Mix {
  return colourAt(state.cloths[patch.clothId], state.config.clothSize, unturned(point, patch.turns));
}

/** Points along one side of a square, just inside it: right side when `side` is 'right', bottom when 'bottom'. */
function stitchPoints(state: WorkshopState, side: 'right' | 'left' | 'bottom' | 'top'): Point[] {
  const { clothSize, stitchesPerSeam } = state.config;
  const half = clothSize / 2;
  const edge = half - SEAM_INSET;
  return Array.from({ length: stitchesPerSeam }, (_, index) => {
    const along = -half + ((index + 0.5) * clothSize) / stitchesPerSeam;
    if (side === 'right') return { x: edge, y: along };
    if (side === 'left') return { x: -edge, y: along };
    if (side === 'bottom') return { x: along, y: edge };
    return { x: along, y: -edge };
  });
}

function matchingStitches(state: WorkshopState, first: Patch, firstSide: 'right' | 'bottom', second: Patch): number {
  const secondSide = firstSide === 'right' ? 'left' : 'top';
  const mine = stitchPoints(state, firstSide).map((point) => patchColourAt(state, first, point));
  const theirs = stitchPoints(state, secondSide).map((point) => patchColourAt(state, second, point));
  return mine.filter((mix, index) => isScoringColour(mix) && mix === theirs[index]).length;
}

/** Matching stitches along every seam between two sewn squares. */
export function seamScore(state: WorkshopState, quilt: readonly (Patch | null)[] = state.quilt): number {
  const { quiltWidth } = state.config;
  let matches = 0;
  quilt.forEach((patch, slot) => {
    if (patch === null) return;
    const right = slot % quiltWidth < quiltWidth - 1 ? quilt[slot + 1] : null;
    const below = quilt[slot + quiltWidth] ?? null;
    if (right) matches += matchingStitches(state, patch, 'right', right);
    if (below) matches += matchingStitches(state, patch, 'bottom', below);
  });
  return matches;
}

/** Share of a cloth covered by each colour, estimated on an even grid of samples. */
export function colourShares(cloth: Cloth, clothSize: number): Map<Mix, number> {
  const step = clothSize / AREA_SAMPLES_PER_SIDE;
  const counts = new Map<Mix, number>();
  for (let row = 0; row < AREA_SAMPLES_PER_SIDE; row++) {
    for (let column = 0; column < AREA_SAMPLES_PER_SIDE; column++) {
      const point = { x: -clothSize / 2 + (column + 0.5) * step, y: -clothSize / 2 + (row + 0.5) * step };
      const mix = colourAt(cloth, clothSize, point);
      counts.set(mix, (counts.get(mix) ?? 0) + 1);
    }
  }
  const total = AREA_SAMPLES_PER_SIDE * AREA_SAMPLES_PER_SIDE;
  return new Map([...counts].map(([mix, count]) => [mix, count / total]));
}

/** Dyed colours (not brown) that cover enough of the cloth to count as showing. */
export function showingColours(state: WorkshopState, clothId: number): Mix[] {
  return [...colourShares(state.cloths[clothId], state.config.clothSize)]
    .filter(([mix, share]) => isScoringColour(mix) && share >= state.config.colourfulMinimumShare)
    .map(([mix]) => mix);
}

export function scoreQuilt(state: WorkshopState, quilt: readonly (Patch | null)[] = state.quilt): QuiltScore {
  const seams = seamScore(state, quilt);
  const colourfulSquares = quilt.filter((patch) => patch !== null && showingColours(state, patch.clothId).length >= state.config.colourfulMinimum).length;
  return { seams, colourfulSquares, total: seams + colourfulSquares * state.config.colourfulBonus };
}
