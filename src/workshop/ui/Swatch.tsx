import type { Mix } from '../engine.ts';

/** Indexed by mix bit set: 0 undyed, 1 red, 2 yellow, 3 orange, 4 blue, 5 purple, 6 green, 7 brown. */
const THREAD_COLOURS = [
  'var(--color-cloth)',
  'var(--color-madder)',
  'var(--color-weld)',
  'var(--color-orange)',
  'var(--color-woad)',
  'var(--color-purple)',
  'var(--color-green)',
  'var(--color-brown)',
];
const COLOUR_NAMES = ['undyed', 'red', 'yellow', 'orange', 'blue', 'purple', 'green', 'brown'];

export function colourName(mix: Mix): string {
  return COLOUR_NAMES[mix];
}

function describe(threads: readonly Mix[]): string {
  const counts = new Map<Mix, number>();
  for (const mix of threads) counts.set(mix, (counts.get(mix) ?? 0) + 1);
  return [...counts]
    .sort((first, second) => second[1] - first[1])
    .map(([mix, count]) => `${Math.round((100 * count) / threads.length)}% ${COLOUR_NAMES[mix]}`)
    .join(', ');
}

/** The threads of a cloth, drawn into an SVG group spanning `x`, `y` to `x + size`, `y + size`. */
export function SwatchThreads({ threads, size, x, y }: { threads: readonly Mix[]; size: number; x: number; y: number }) {
  const side = Math.sqrt(threads.length);
  const step = size / side;
  return (
    <g shapeRendering="crispEdges">
      {threads.map((mix, index) => (
        <rect
          key={index}
          x={x + (index % side) * step}
          y={y + Math.floor(index / side) * step}
          width={step + 0.02}
          height={step + 0.02}
          fill={THREAD_COLOURS[mix]}
        />
      ))}
    </g>
  );
}

/** A cloth on its own, as a square image. */
export function Swatch({ threads, label }: { threads: readonly Mix[]; label?: string }) {
  return (
    <svg viewBox="0 0 1 1" role="img" aria-label={`${label ? `${label}: ` : ''}${describe(threads)}`} className="block aspect-square w-full rounded-[2px]">
      <SwatchThreads threads={threads} size={1} x={0} y={0} />
    </svg>
  );
}
