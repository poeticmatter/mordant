import { useId } from 'react';
import { BARE, COLOURS, readCloth, shareOf, type Cloth, type Colour } from '../cloth.ts';
import type { Quad } from '../geometry.ts';

/** Indexed by colour: red, yellow, blue, bare cloth. */
export const COLOUR_FILLS: Record<Colour, string> = {
  0: 'var(--color-madder)',
  1: 'var(--color-weld)',
  2: 'var(--color-woad)',
  [BARE]: 'var(--color-cloth)',
};
export const COLOUR_NAMES: Record<Colour, string> = { 0: 'red', 1: 'yellow', 2: 'blue', [BARE]: 'bare' };

function describeCloth(cloth: Cloth, size: number): string {
  const reading = readCloth(cloth, size);
  return COLOURS.map((colour) => ({ colour, share: shareOf(reading, colour) }))
    .filter(({ share }) => share > 0)
    .sort((first, second) => second.share - first.share)
    .map(({ colour, share }) => `${Math.round(100 * share)}% ${COLOUR_NAMES[colour]}`)
    .join(', ');
}

function points(quad: Quad): string {
  return quad.map((corner) => `${corner.x},${corner.y}`).join(' ');
}

/**
 * A cloth drawn exactly from its spray history, in its own coordinates (centre 0, 0). Each spray is
 * painted over the last, masked where cloths above it kept the dye off, so edges stay smooth at any size.
 */
export function ClothArt({ cloth, size }: { cloth: Cloth; size: number }) {
  // useId returns colons, which some browsers reject inside url(#…).
  const prefix = `cloth${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const half = size / 2;
  const square = { x: -half, y: -half, width: size, height: size };
  return (
    <g>
      <defs>
        {cloth.layers.map((layer, index) =>
          layer.covers.length === 0 ? null : (
            <mask key={index} id={`${prefix}-layer${index}`} maskUnits="userSpaceOnUse" {...square}>
              <rect {...square} fill="white" />
              {layer.covers.map((quad, quadIndex) => (
                <polygon key={quadIndex} points={points(quad)} fill="black" />
              ))}
            </mask>
          ),
        )}
      </defs>
      <rect {...square} fill={COLOUR_FILLS[BARE]} />
      {cloth.layers.map((layer, index) => (
        <rect key={index} {...square} fill={COLOUR_FILLS[layer.dye]} mask={layer.covers.length === 0 ? undefined : `url(#${prefix}-layer${index})`} />
      ))}
    </g>
  );
}

/** A cloth on its own, as a square image. */
export function Swatch({ cloth, size, label }: { cloth: Cloth; size: number; label?: string }) {
  const half = size / 2;
  return (
    <svg
      viewBox={`${-half} ${-half} ${size} ${size}`}
      role="img"
      aria-label={`${label ? `${label}: ` : ''}${describeCloth(cloth, size)}`}
      className="block aspect-square w-full rounded-[2px]"
    >
      <ClothArt cloth={cloth} size={size} />
    </svg>
  );
}
