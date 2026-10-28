import { useId } from 'react';
import { REGIONS, type Objective } from '../features.ts';
import type { Point } from '../geometry.ts';
import { COLOUR_FILLS, COLOUR_NAMES } from './Swatch.tsx';

function polygonPoints(polygon: readonly Point[]): string {
  return polygon.map((point) => `${point.x},${point.y}`).join(' ');
}

export function describeObjective(objective: Objective): string {
  return objective.features.map((feature) => `a ${COLOUR_NAMES[feature.colour]} ${REGIONS[feature.region].title}`).join(' and ');
}

/**
 * What a cloth must include: the asked-for regions in their colours, on a hatched ground that means
 * "anything goes here". The whole picture may be turned or flipped.
 */
export function ObjectiveIcon({ objective }: { objective: Objective }) {
  const hatchId = `hatch${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="-1 -1 2 2" role="img" aria-label={`Must include ${describeObjective(objective)}, any way round`} className="block aspect-square w-full rounded-[2px]">
      <defs>
        <pattern id={hatchId} width={0.25} height={0.25} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={0.25} height={0.25} fill="var(--color-slate-deep)" />
          <line x1={0} y1={0} x2={0} y2={0.25} stroke="var(--color-slate-line)" strokeWidth={0.07} />
        </pattern>
      </defs>
      <rect x={-1} y={-1} width={2} height={2} fill={`url(#${hatchId})`} />
      {objective.features.map((feature, index) => (
        <polygon
          key={index}
          points={polygonPoints(feature.polygon)}
          fill={COLOUR_FILLS[feature.colour]}
          stroke="var(--color-slate-deep)"
          strokeWidth={0.03}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
