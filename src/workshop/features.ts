import type { Colour, Reading } from './cloth.ts';
import { isInsideConvex, SQUARE_SYMMETRIES, type Point } from './geometry.ts';

/**
 * Objectives say what a cloth must *include*, not what it must be: one or two simple regions in a
 * colour. Everything else on the cloth is free.
 */

export type RegionName = 'half' | 'diagonalHalf' | 'quarter' | 'corner' | 'centre' | 'edgeStripe' | 'middleBand';

const THIRD = 1 / 3;

function rect(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

/** Regions in unit coordinates (−1 to 1 across, y down), in one standard position each. */
export const REGIONS: Record<RegionName, { title: string; polygon: Point[] }> = {
  half: { title: 'half', polygon: rect(-1, -1, 0, 1) },
  diagonalHalf: { title: 'diagonal half', polygon: [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }] },
  quarter: { title: 'quarter', polygon: rect(-1, -1, 0, 0) },
  corner: { title: 'corner', polygon: [{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: -1, y: 0 }] },
  centre: { title: 'centre', polygon: rect(-0.5, -0.5, 0.5, 0.5) },
  edgeStripe: { title: 'edge stripe', polygon: rect(-1, -1, -THIRD, 1) },
  middleBand: { title: 'middle band', polygon: rect(-THIRD, -1, THIRD, 1) },
};

export const REGION_NAMES = Object.keys(REGIONS) as RegionName[]; // keys of a literal Record<RegionName, …>

/** One region of an objective, already placed (turned or flipped) relative to the objective's other regions. */
export interface Feature {
  region: RegionName;
  polygon: Point[];
  colour: Colour;
}

export interface Objective {
  features: Feature[];
}

/** Share of the samples inside `polygon` (after mapping each sample by `symmetry`) that show `colour`. */
export function regionShare(reading: Reading, polygon: readonly Point[], colour: Colour, symmetry: (point: Point) => Point = (point) => point): number {
  let inside = 0;
  let matching = 0;
  reading.points.forEach((point, index) => {
    if (!isInsideConvex(polygon, symmetry(point))) return;
    inside++;
    if (reading.colours[index] === colour) matching++;
  });
  return inside === 0 ? 0 : matching / inside;
}

/**
 * How well a cloth meets an objective: under the best turn or flip of the whole objective, the share
 * of its weakest feature. The objective is met once this reaches the threshold.
 */
export function objectiveProgress(objective: Objective, reading: Reading): number {
  let best = 0;
  for (const symmetry of SQUARE_SYMMETRIES) {
    const weakest = Math.min(...objective.features.map((feature) => regionShare(reading, feature.polygon, feature.colour, symmetry)));
    best = Math.max(best, weakest);
  }
  return best;
}

export function isObjectiveMet(objective: Objective, reading: Reading, threshold: number): boolean {
  return objectiveProgress(objective, reading) >= threshold - 1e-9;
}

/** Every placement of every region, without duplicates (the centre looks the same every way round). */
export function placedRegions(): { region: RegionName; polygon: Point[] }[] {
  const seen = new Set<string>();
  const placed: { region: RegionName; polygon: Point[] }[] = [];
  for (const region of REGION_NAMES) {
    for (const symmetry of SQUARE_SYMMETRIES) {
      const polygon = REGIONS[region].polygon.map(symmetry);
      const key = polygon
        .map((point) => `${Math.round(point.x * 1000)},${Math.round(point.y * 1000)}`)
        .sort()
        .join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      placed.push({ region, polygon });
    }
  }
  return placed;
}

/** Whether two placed regions share any sample points (used to keep an objective's features distinct). */
export function regionsOverlap(reading: Reading, first: readonly Point[], second: readonly Point[]): boolean {
  return reading.points.some((point) => isInsideConvex(first, point) && isInsideConvex(second, point));
}
