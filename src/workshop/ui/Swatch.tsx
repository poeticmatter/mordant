import { useId } from 'react';
import { BLUE, DYES, RED, YELLOW, type Dye } from '../../engine/shades.ts';
import { BROWN, mixOf, type Cloth } from '../engine.ts';
import type { Quad } from '../geometry.ts';
import { colourShares } from '../scoring.ts';

/** Indexed by mix bit set: 0 undyed, 1 red, 2 yellow, 3 orange, 4 blue, 5 purple, 6 green, 7 brown. */
const MIX_COLOURS = [
  'var(--color-cloth)',
  'var(--color-madder)',
  'var(--color-weld)',
  'var(--color-orange)',
  'var(--color-woad)',
  'var(--color-purple)',
  'var(--color-green)',
  'var(--color-brown)',
];
const MIX_NAMES = ['undyed', 'red', 'yellow', 'orange', 'blue', 'purple', 'green', 'brown'];
const DYE_PAIRS: readonly [Dye, Dye][] = [
  [RED, YELLOW],
  [YELLOW, BLUE],
  [RED, BLUE],
];

function describeCloth(cloth: Cloth, size: number): string {
  return [...colourShares(cloth, size)]
    .sort((first, second) => second[1] - first[1])
    .map(([mix, share]) => `${Math.round(100 * share)}% ${MIX_NAMES[mix]}`)
    .join(', ');
}

function points(quad: Quad): string {
  return quad.map((corner) => `${corner.x},${corner.y}`).join(' ');
}

/**
 * A cloth drawn exactly from its spray history, in its own coordinates (centre 0, 0). Each spray is a
 * mask (the cloth, minus whatever covered it); each dye is the union of its sprays; mixed colours are
 * painted where two or three dyes overlap, so edges stay smooth at any size.
 */
export function ClothArt({ cloth, size }: { cloth: Cloth; size: number }) {
  // useId returns colons, which some browsers reject inside url(#…).
  const prefix = `cloth${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const half = size / 2;
  const region = { x: -half, y: -half, width: size, height: size, maskUnits: 'userSpaceOnUse' as const };
  const square = { x: -half, y: -half, width: size, height: size };
  const dyesPresent = DYES.filter((dye) => cloth.layers.some((layer) => layer.dye === dye));
  const hasDye = (dye: Dye) => dyesPresent.includes(dye);
  const dyeMask = (dye: Dye) => `url(#${prefix}-dye${dye})`;

  return (
    <g>
      <defs>
        {cloth.layers.map((layer, index) => (
          <mask key={index} id={`${prefix}-layer${index}`} {...region}>
            <rect {...square} fill="white" />
            {layer.covers.map((quad, quadIndex) => (
              <polygon key={quadIndex} points={points(quad)} fill="black" />
            ))}
          </mask>
        ))}
        {dyesPresent.map((dye) => (
          <mask key={dye} id={`${prefix}-dye${dye}`} {...region}>
            {cloth.layers.map((layer, index) =>
              layer.dye === dye ? <rect key={index} {...square} fill="white" mask={`url(#${prefix}-layer${index})`} /> : null,
            )}
          </mask>
        ))}
      </defs>
      <rect {...square} fill={MIX_COLOURS[0]} />
      {dyesPresent.map((dye) => (
        <rect key={dye} {...square} fill={MIX_COLOURS[mixOf(dye)]} mask={dyeMask(dye)} />
      ))}
      {DYE_PAIRS.filter(([first, second]) => hasDye(first) && hasDye(second)).map(([first, second]) => (
        <g key={`${first}${second}`} mask={dyeMask(first)}>
          <rect {...square} fill={MIX_COLOURS[mixOf(first) | mixOf(second)]} mask={dyeMask(second)} />
        </g>
      ))}
      {dyesPresent.length === DYES.length && (
        <g mask={dyeMask(RED)}>
          <g mask={dyeMask(YELLOW)}>
            <rect {...square} fill={MIX_COLOURS[BROWN]} mask={dyeMask(BLUE)} />
          </g>
        </g>
      )}
    </g>
  );
}

/** A cloth on its own, as a square image, optionally turned as sewn into the quilt. */
export function Swatch({ cloth, size, turns = 0, label }: { cloth: Cloth; size: number; turns?: number; label?: string }) {
  const half = size / 2;
  return (
    <svg viewBox={`${-half} ${-half} ${size} ${size}`} role="img" aria-label={`${label ? `${label}: ` : ''}${describeCloth(cloth, size)}`} className="block aspect-square w-full rounded-[2px]">
      <g transform={`rotate(${turns * 90})`}>
        <ClothArt cloth={cloth} size={size} />
      </g>
    </svg>
  );
}
