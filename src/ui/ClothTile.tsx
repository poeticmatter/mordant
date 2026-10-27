import type { CSSProperties } from 'react';
import type { Dye } from '../engine/shades.ts';
import { metTagEntries, type ClothLook, type Mix } from '../selvedge/tags/engine.ts';

/** Indexed by mix bit set: 1 red, 2 yellow, 3 orange, 4 blue, 5 purple, 6 green, 7 brown. */
const MIX_COLOURS = [
  '',
  'var(--color-madder)',
  'var(--color-weld)',
  'var(--color-orange)',
  'var(--color-woad)',
  'var(--color-purple)',
  'var(--color-green)',
  'var(--color-brown)',
];
const MIX_NAMES = ['', 'Red', 'Yellow', 'Orange', 'Blue', 'Purple', 'Green', 'Brown'];
const DYE_NAMES = ['Red', 'Yellow', 'Blue'];
const DYE_LETTERS = ['R', 'Y', 'B'];
const DYE_INK = ['text-cloth', 'text-slate-deep', 'text-cloth'];
const SIDE_NAMES = ['top', 'right', 'bottom', 'left'] as const;

export function dyeName(dye: Dye): string {
  return DYE_NAMES[dye];
}

export function mixName(mix: Mix): string {
  return MIX_NAMES[mix];
}

function mixColour(mix: Mix): string {
  return MIX_COLOURS[mix];
}

export function describeTag(look: ClothLook): string {
  return look.tag.map((mix) => mixName(mix).toLowerCase()).join(', ');
}

interface ClothTileProps {
  look: ClothLook;
  /** Sides that just took colour (or would, in a preview); they flash once. */
  freshSides?: readonly number[];
  isGhost?: boolean;
  isShipping?: boolean;
  size?: 'large' | 'small';
}

/**
 * A cloth drawn like a picture frame: the centre is its own colour, each side of the frame is
 * the colour that edge has become. Its tag (what the customer wants) sits underneath.
 */
export function ClothTile({ look, freshSides = [], isGhost = false, isShipping = false, size = 'large' }: ClothTileProps) {
  const frame = size === 'large' ? 'clamp(7px, 2.6vw, 12px)' : '5px';
  const style: CSSProperties = {
    borderWidth: frame,
    borderStyle: 'solid',
    borderColor: look.edges.map(mixColour).join(' '),
    backgroundColor: mixColour(1 << look.body),
  };
  const description = `${dyeName(look.body)} cloth; edges ${look.edges
    .map((mix, side) => `${SIDE_NAMES[side]} ${mixName(mix).toLowerCase()}`)
    .join(', ')}; wants ${describeTag(look)}`;
  return (
    <div role="img" aria-label={description} className={`flex flex-col gap-1 ${isGhost ? 'opacity-70' : ''}`}>
      <div
        style={style}
        className={`relative flex aspect-square w-full items-center justify-center rounded-[3px] ${isShipping ? 'outline-3 outline-offset-2 outline-chalk' : ''}`}
      >
        <span className={`font-extrabold ${DYE_INK[look.body]} ${size === 'large' ? 'text-lg' : 'text-xs'}`}>{DYE_LETTERS[look.body]}</span>
        {freshSides.map((side) => (
          <span key={side} aria-hidden className={`stripe-fresh pointer-events-none absolute rounded-full bg-chalk ${FRESH_SIDE_MARK[side]}`} />
        ))}
      </div>
      <TagStrip look={look} size={size} />
    </div>
  );
}

/** A short tick just inside the side that took (or would take) colour. */
const FRESH_SIDE_MARK = [
  'top-0.5 left-1/4 right-1/4 h-[3px]',
  'right-0.5 top-1/4 bottom-1/4 w-[3px]',
  'bottom-0.5 left-1/4 right-1/4 h-[3px]',
  'left-0.5 top-1/4 bottom-1/4 w-[3px]',
];

/**
 * The tag: one chip per edge the customer wants, in any order. A filled chip is an edge the
 * cloth already has; a hollow one is still missing.
 */
export function TagStrip({ look, size = 'large' }: { look: ClothLook; size?: 'large' | 'small' }) {
  const met = metTagEntries(look);
  const chip = size === 'large' ? 'h-2.5' : 'h-1.5';
  return (
    <div aria-hidden className="flex gap-0.5">
      {look.tag.map((mix, index) => (
        <span
          key={index}
          className={`${chip} flex-1 rounded-[2px] border-2`}
          style={{ borderColor: mixColour(mix), backgroundColor: met[index] ? mixColour(mix) : 'transparent' }}
        />
      ))}
    </div>
  );
}
