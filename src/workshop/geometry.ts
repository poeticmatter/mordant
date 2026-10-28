/**
 * Where a cloth lies on the bench. Positions are bench units (one thread wide), snapped to whole units;
 * rotation is in steps of `ROTATION_STEP_DEGREES`, clockwise on screen (y grows downwards).
 */
export interface Placement {
  clothId: number;
  x: number;
  y: number;
  rotation: number;
}

export const ROTATION_STEP_DEGREES = 15;
export const ROTATION_STEPS = 360 / ROTATION_STEP_DEGREES;

export interface Point {
  x: number;
  y: number;
}

function radians(rotation: number): number {
  return (rotation * ROTATION_STEP_DEGREES * Math.PI) / 180;
}

/** Centre of thread (row, column) of a cloth `threads` wide, in bench coordinates. */
export function threadCentre(placement: Placement, threads: number, row: number, column: number): Point {
  const localX = column + 0.5 - threads / 2;
  const localY = row + 0.5 - threads / 2;
  const angle = radians(placement.rotation);
  return {
    x: placement.x + localX * Math.cos(angle) - localY * Math.sin(angle),
    y: placement.y + localX * Math.sin(angle) + localY * Math.cos(angle),
  };
}

/** Whether `point` lies on the cloth (strictly inside its square). */
export function covers(placement: Placement, threads: number, point: Point): boolean {
  const dx = point.x - placement.x;
  const dy = point.y - placement.y;
  const angle = radians(placement.rotation);
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const half = threads / 2;
  return Math.abs(localX) < half && Math.abs(localY) < half;
}

/**
 * For each cloth in `layout` (bottom first), which of its threads lie open to the spray:
 * a thread is masked when any cloth placed above it covers its centre.
 */
export function exposedThreads(layout: readonly Placement[], threads: number): boolean[][] {
  return layout.map((placement, depth) => {
    const above = layout.slice(depth + 1);
    const exposed: boolean[] = [];
    for (let row = 0; row < threads; row++) {
      for (let column = 0; column < threads; column++) {
        const centre = threadCentre(placement, threads, row, column);
        exposed.push(!above.some((other) => covers(other, threads, centre)));
      }
    }
    return exposed;
  });
}

/** A square grid of `size` × `size` values (row-major) after `turns` quarter turns clockwise. */
export function turnedGrid<T>(grid: readonly T[], size: number, turns: number): T[] {
  let current = grid.slice();
  for (let turn = 0; turn < ((turns % 4) + 4) % 4; turn++) {
    const next = new Array<T>(current.length);
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) next[row * size + column] = current[(size - 1 - column) * size + row];
    }
    current = next;
  }
  return current;
}
