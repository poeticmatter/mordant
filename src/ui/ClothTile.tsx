import type { CSSProperties } from 'react';
import type { Dye } from '../engine/shades.ts';

const DYE_COLOURS = ['var(--color-madder)', 'var(--color-weld)', 'var(--color-woad)'];
export const DYE_NAMES = ['Red', 'Yellow', 'Blue'];
const DYE_LETTERS = ['R', 'Y', 'B'];
const DYE_INK = ['text-cloth', 'text-slate-deep', 'text-cloth'];
const SIDE_NAMES = ['Top', 'Right', 'Bottom', 'Left'] as const;
const CLEAN_EDGE = 'var(--color-cloth)';

export function dyeName(dye: Dye): string {
  return DYE_NAMES[dye];
}

interface ClothTileProps {
  body: Dye;
  edges: readonly (Dye | null)[];
  /** Sides that were just stained (or would be, in a preview); they flash once. */
  freshSides?: readonly number[];
  isGhost?: boolean;
  isShipping?: boolean;
  /** Frame thickness as a share of the tile, so the same drawing works at any size. */
  size?: 'large' | 'small';
}

/**
 * A cloth drawn like a picture frame: the centre is its own colour, each side of
 * the frame is the stain on that edge (unbleached when clean).
 */
export function ClothTile({ body, edges, freshSides = [], isGhost = false, isShipping = false, size = 'large' }: ClothTileProps) {
  const frame = size === 'large' ? 'clamp(7px, 2.6vw, 12px)' : '5px';
  const style: CSSProperties = {
    borderWidth: frame,
    borderStyle: 'solid',
    borderColor: edges.map((edge) => (edge === null ? CLEAN_EDGE : DYE_COLOURS[edge])).join(' '),
    backgroundColor: DYE_COLOURS[body],
  };
  const description = `${dyeName(body)} cloth; ${edges
    .map((edge, side) => `${SIDE_NAMES[side].toLowerCase()} ${edge === null ? 'clean' : dyeName(edge).toLowerCase()}`)
    .join(', ')}`;
  return (
    <div
      role="img"
      aria-label={description}
      style={style}
      className={`relative flex aspect-square w-full items-center justify-center rounded-[3px] ${isGhost ? 'opacity-70' : ''} ${isShipping ? 'outline-3 outline-offset-2 outline-weld' : ''}`}
    >
      <span className={`font-extrabold ${DYE_INK[body]} ${size === 'large' ? 'text-lg' : 'text-xs'}`}>{DYE_LETTERS[body]}</span>
      {freshSides.map((side) => (
        <span key={side} aria-hidden className={`stripe-fresh pointer-events-none absolute rounded-full bg-chalk ${FRESH_SIDE_MARK[side]}`} />
      ))}
    </div>
  );
}

/** A short tick just inside the side that took (or would take) a stain. */
const FRESH_SIDE_MARK = [
  'top-0.5 left-1/4 right-1/4 h-[3px]',
  'right-0.5 top-1/4 bottom-1/4 w-[3px]',
  'bottom-0.5 left-1/4 right-1/4 h-[3px]',
  'left-0.5 top-1/4 bottom-1/4 w-[3px]',
];

interface CommissionTileProps {
  body: Dye;
  /** Required stain per side; null means any. */
  edges: readonly (Dye | null)[];
}

/** A commission: the cloth colour wanted, and the stains wanted on some sides. Dashed sides take anything. */
export function CommissionTile({ body, edges }: CommissionTileProps) {
  const style: CSSProperties = {
    borderWidth: '6px',
    borderStyle: edges.map((edge) => (edge === null ? 'dashed' : 'solid')).join(' '),
    borderColor: edges.map((edge) => (edge === null ? 'var(--color-slate-line)' : DYE_COLOURS[edge])).join(' '),
    backgroundColor: DYE_COLOURS[body],
  };
  const description = `${dyeName(body)} cloth with ${edges
    .map((edge, side) => (edge === null ? null : `${dyeName(edge).toLowerCase()} ${SIDE_NAMES[side].toLowerCase()}`))
    .filter(Boolean)
    .join(', ')}`;
  return (
    <div role="img" aria-label={description} style={style} className="flex aspect-square w-full items-center justify-center rounded-[3px]">
      <span className={`text-xs font-extrabold ${DYE_INK[body]}`}>{DYE_LETTERS[body]}</span>
    </div>
  );
}
