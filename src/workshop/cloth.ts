import type { Dye } from '../engine/shades.ts';
import { isInsideConvex, isInsideSquare, type Point, type Quad } from './geometry.ts';

/** Undyed cloth. Patterns can ask for it like any dye. */
export const BARE = 3;
export type Colour = Dye | typeof BARE;
export const COLOURS: readonly Colour[] = [0, 1, 2, BARE];

/** One spray a cloth took: the dye, and where cloths above it kept the dye off (in its own coordinates). */
export interface SprayLayer {
  dye: Dye;
  covers: Quad[];
}

export interface Cloth {
  id: number;
  /** Every spray the cloth has taken, oldest first. A cloth is exactly its history. */
  layers: SprayLayer[];
  /** The commission it was delivered to, once delivered. */
  deliveredTo: number | null;
}

/** The colour at a point of a cloth, in its own coordinates: the last dye that reached it, or bare cloth. */
export function colourAt(cloth: Cloth, size: number, point: Point): Colour {
  if (!isInsideSquare(size, point)) return BARE;
  for (let index = cloth.layers.length - 1; index >= 0; index--) {
    const layer = cloth.layers[index];
    if (!layer.covers.some((quad) => isInsideConvex(quad, point))) return layer.dye;
  }
  return BARE;
}

/** Samples per side of the grid every judgement of a cloth is made on. */
export const SAMPLES_PER_SIDE = 24;

/**
 * The cloth read on an even grid, row by row, in normalised coordinates (−1 to 1 across), so
 * objectives can judge it without knowing its size.
 */
export interface Reading {
  points: Point[];
  colours: Colour[];
}

export function readCloth(cloth: Cloth, size: number): Reading {
  const points: Point[] = [];
  const colours: Colour[] = [];
  for (let row = 0; row < SAMPLES_PER_SIDE; row++) {
    for (let column = 0; column < SAMPLES_PER_SIDE; column++) {
      const unit = { x: -1 + (2 * (column + 0.5)) / SAMPLES_PER_SIDE, y: -1 + (2 * (row + 0.5)) / SAMPLES_PER_SIDE };
      points.push(unit);
      colours.push(colourAt(cloth, size, { x: (unit.x * size) / 2, y: (unit.y * size) / 2 }));
    }
  }
  return { points, colours };
}

export function shareOf(reading: Reading, colour: Colour): number {
  return reading.colours.filter((other) => other === colour).length / reading.colours.length;
}
