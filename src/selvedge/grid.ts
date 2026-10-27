/** Sides in clockwise order; `OPPOSITE[side]` is the side that faces it. */
export const TOP = 0;
export const RIGHT = 1;
export const BOTTOM = 2;
export const LEFT = 3;
export const SIDES = [TOP, RIGHT, BOTTOM, LEFT] as const;
export const OPPOSITE = [BOTTOM, LEFT, TOP, RIGHT] as const;

export interface RackShape {
  rackWidth: number;
  rackHeight: number;
}

export function neighbourCell(cell: number, side: number, shape: RackShape): number | null {
  const { rackWidth, rackHeight } = shape;
  const x = cell % rackWidth;
  const y = Math.floor(cell / rackWidth);
  if (side === TOP) return y > 0 ? cell - rackWidth : null;
  if (side === RIGHT) return x < rackWidth - 1 ? cell + 1 : null;
  if (side === BOTTOM) return y < rackHeight - 1 ? cell + rackWidth : null;
  return x > 0 ? cell - 1 : null;
}
