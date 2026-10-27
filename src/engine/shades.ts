export type Dye = 0 | 1 | 2;
export const RED: Dye = 0;
export const YELLOW: Dye = 1;
export const BLUE: Dye = 2;
export const DYES: readonly Dye[] = [RED, YELLOW, BLUE];

/**
 * A shade is what a cloth's dye memory looks like to a merchant.
 * Plain primaries (0–2) are any non-full single-dye memory; deep primaries (3–5)
 * are a memory full of one dye. Numbering lets `primaryShade + DEEP_OFFSET`
 * name the deep version.
 */
export type Shade = number;
export const SHADE = {
  red: 0,
  yellow: 1,
  blue: 2,
  deepRed: 3,
  deepYellow: 4,
  deepBlue: 5,
  orange: 6,
  green: 7,
  purple: 8,
  brown: 9,
  undyed: 10,
} as const;
export const SHADE_COUNT = 11;
export const DEEP_OFFSET = 3;

export const SHADE_NAMES: readonly string[] = [
  'Red', 'Yellow', 'Blue',
  'Deep Red', 'Deep Yellow', 'Deep Blue',
  'Orange', 'Green', 'Purple',
  'Brown', 'Undyed',
];

export function isPlainPrimary(shade: Shade): boolean {
  return shade <= SHADE.blue;
}

export function isDeepPrimary(shade: Shade): boolean {
  return shade >= SHADE.deepRed && shade <= SHADE.deepBlue;
}

function absentDye(presentMask: number): Dye {
  if ((presentMask & 1) === 0) return RED;
  if ((presentMask & 2) === 0) return YELLOW;
  return BLUE;
}

function secondaryWithout(absent: Dye): Shade {
  if (absent === BLUE) return SHADE.orange;
  if (absent === RED) return SHADE.green;
  return SHADE.purple;
}

export function shadeOf(dyes: readonly Dye[], memoryCapacity: number): Shade {
  if (dyes.length === 0) return SHADE.undyed;
  let presentMask = 0;
  for (const dye of dyes) presentMask |= 1 << dye;
  const kinds = (presentMask & 1) + ((presentMask >> 1) & 1) + ((presentMask >> 2) & 1);
  if (kinds === 3) return SHADE.brown;
  if (kinds === 2) return secondaryWithout(absentDye(presentMask));
  const primary = dyes[0];
  return dyes.length >= memoryCapacity ? primary + DEEP_OFFSET : primary;
}

/** Memory after `dye` soaks in: appended as newest, oldest dropped when full. */
export function withDyeAdded(dyes: readonly Dye[], dye: Dye, memoryCapacity: number): Dye[] {
  const next = dyes.length >= memoryCapacity ? dyes.slice(1) : dyes.slice();
  next.push(dye);
  return next;
}
