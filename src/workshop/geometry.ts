/**
 * Where a cloth lies on the bench. Positions are bench units, snapped to whole units; rotation is in
 * steps of `ROTATION_STEP_DEGREES`, clockwise on screen (y grows downwards).
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

/** A convex four-cornered shape, corners in order around it. */
export type Quad = readonly [Point, Point, Point, Point];

function radians(rotation: number): number {
  return (rotation * ROTATION_STEP_DEGREES * Math.PI) / 180;
}

function rotated(point: Point, angle: number): Point {
  return { x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle) };
}

/** A point in a cloth's own coordinates (centre at 0, 0; sides at ±size/2) to bench coordinates. */
export function toBench(placement: Placement, local: Point): Point {
  const turned = rotated(local, radians(placement.rotation));
  return { x: placement.x + turned.x, y: placement.y + turned.y };
}

/** A bench point to a cloth's own coordinates. */
export function toLocal(placement: Placement, point: Point): Point {
  return rotated({ x: point.x - placement.x, y: point.y - placement.y }, -radians(placement.rotation));
}

/** Corners of a cloth `size` wide, in its own coordinates, clockwise from top-left. */
export function squareCorners(size: number): Quad {
  const half = size / 2;
  return [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];
}

/** Below this, a point counts as lying on an edge: floating-point noise shouldn't pick a side. */
const EDGE_TOLERANCE = 1e-9;

/** Which side of each edge a point lies on: +1 or −1, or 0 when it lies on the edge. */
function edgeSides(polygon: readonly Point[], point: Point): number[] {
  return polygon.map((from, index) => {
    const to = polygon[(index + 1) % polygon.length];
    const cross = (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
    return Math.abs(cross) <= EDGE_TOLERANCE ? 0 : Math.sign(cross);
  });
}

/** Strictly inside a convex polygon, whichever way round its corners run. Points on an edge are outside. */
export function isInsideConvex(polygon: readonly Point[], point: Point): boolean {
  const sides = edgeSides(polygon, point);
  return sides.every((side) => side === sides[0] && side !== 0);
}

/** Inside a convex polygon or on its edge. */
export function isInsideOrOnConvex(polygon: readonly Point[], point: Point): boolean {
  const sides = edgeSides(polygon, point).filter((side) => side !== 0);
  return sides.every((side) => side === sides[0]);
}

export function isInsideSquare(size: number, point: Point): boolean {
  const half = size / 2;
  return Math.abs(point.x) < half && Math.abs(point.y) < half;
}

/**
 * Where the cloths lying above `placement` cover it, as quads in its own coordinates.
 * Cloths too far away to touch it are left out.
 */
export function coversFrom(layout: readonly Placement[], depth: number, size: number): Quad[] {
  const placement = layout[depth];
  const reach = size * Math.SQRT2;
  return layout
    .slice(depth + 1)
    .filter((above) => Math.hypot(above.x - placement.x, above.y - placement.y) < reach)
    .map((above) => mapQuad(squareCorners(size), (corner) => toLocal(placement, toBench(above, corner))));
}

function mapQuad(quad: Quad, transform: (point: Point) => Point): Quad {
  return [transform(quad[0]), transform(quad[1]), transform(quad[2]), transform(quad[3])];
}


/** The eight ways to turn or flip a square about its centre, as maps on points. */
export const SQUARE_SYMMETRIES: readonly ((point: Point) => Point)[] = [
  (p) => ({ x: p.x, y: p.y }),
  (p) => ({ x: -p.y, y: p.x }),
  (p) => ({ x: -p.x, y: -p.y }),
  (p) => ({ x: p.y, y: -p.x }),
  (p) => ({ x: -p.x, y: p.y }),
  (p) => ({ x: p.x, y: -p.y }),
  (p) => ({ x: p.y, y: p.x }),
  (p) => ({ x: -p.y, y: -p.x }),
];
