import { BARE, type Colour } from '../cloth.ts';
import { PATTERNS, type Objective } from '../objectives.ts';
import type { Point } from '../geometry.ts';
import { COLOUR_FILLS, COLOUR_NAMES } from './Swatch.tsx';

/** Neutral stand-ins for "any two colours" in the mirror picture. */
const ANY_FIRST = 'var(--color-chalk-soft)';
const ANY_SECOND = 'var(--color-slate-line)';

function polygonPoints(polygon: readonly Point[]): string {
  return polygon.map((point) => `${point.x},${point.y}`).join(' ');
}

const FULL = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
];

function PatternPicture({ objective }: { objective: Extract<Objective, { kind: 'pattern' }> }) {
  const shape = PATTERNS[objective.pattern];
  const fill = (role: number) => COLOUR_FILLS[objective.colours[role]];
  return (
    <>
      <polygon points={polygonPoints(FULL)} fill={fill(0)} />
      {shape.overlays.map((overlay, index) => (
        <polygon key={index} points={polygonPoints(overlay.polygon)} fill={fill(overlay.role)} />
      ))}
    </>
  );
}

function CoveragePicture({ colour }: { colour: Colour }) {
  return (
    <>
      <rect x={-1} y={-1} width={2} height={2} fill="var(--color-slate-deep)" />
      <rect x={-1} y={0} width={2} height={1} fill={COLOUR_FILLS[colour]} />
      <line x1={-1} y1={0} x2={1} y2={0} stroke="var(--color-chalk)" strokeWidth={0.06} strokeDasharray="0.12 0.08" />
      <text x={0} y={-0.35} textAnchor="middle" fontSize={0.55} fontWeight={800} fill="var(--color-chalk)">
        ½+
      </text>
    </>
  );
}

function MirrorPicture() {
  return (
    <>
      <rect x={-1} y={-1} width={2} height={2} fill={ANY_SECOND} />
      <polygon points="-1,-1 -0.2,-1 -0.6,0.2 -1,1" fill={ANY_FIRST} />
      <polygon points="1,-1 0.2,-1 0.6,0.2 1,1" fill={ANY_FIRST} />
      <line x1={0} y1={-1} x2={0} y2={1} stroke="var(--color-chalk)" strokeWidth={0.08} strokeDasharray="0.15 0.1" />
    </>
  );
}

function ApartPicture({ first, second }: { first: Colour; second: Colour }) {
  return (
    <>
      <rect x={-1} y={-1} width={2} height={2} fill={COLOUR_FILLS[BARE]} />
      <circle cx={-0.45} cy={-0.35} r={0.42} fill={COLOUR_FILLS[first]} />
      <circle cx={0.45} cy={0.4} r={0.42} fill={COLOUR_FILLS[second]} />
      <line x1={-0.25} y1={0.55} x2={0.25} y2={-0.55} stroke="var(--color-slate-deep)" strokeWidth={0.1} />
    </>
  );
}

export function objectiveTitle(objective: Objective): string {
  switch (objective.kind) {
    case 'pattern':
      return PATTERNS[objective.pattern].title;
    case 'coverage':
      return `Mostly ${COLOUR_NAMES[objective.colour]}`;
    case 'mirror':
      return 'Mirror image';
    case 'apart':
      return 'Kept apart';
  }
}

/** One line on what counts, for the card and for screen readers. */
export function objectiveCaption(objective: Objective): string {
  switch (objective.kind) {
    case 'pattern':
      return `${objective.colours.map((colour) => COLOUR_NAMES[colour]).join(' and ')}, any way round`;
    case 'coverage':
      return `${COLOUR_NAMES[objective.colour]} covers at least ${Math.round(objective.share * 100)}%`;
    case 'mirror':
      return `the same reflected across a line, in 2+ colours`;
    case 'apart':
      return `${COLOUR_NAMES[objective.first]} and ${COLOUR_NAMES[objective.second]} each ${Math.round(objective.minimumShare * 100)}%+, never touching`;
  }
}

export function ObjectiveIcon({ objective }: { objective: Objective }) {
  return (
    <svg viewBox="-1 -1 2 2" role="img" aria-label={`${objectiveTitle(objective)}: ${objectiveCaption(objective)}`} className="block aspect-square w-full rounded-[2px]">
      {objective.kind === 'pattern' && <PatternPicture objective={objective} />}
      {objective.kind === 'coverage' && <CoveragePicture colour={objective.colour} />}
      {objective.kind === 'mirror' && <MirrorPicture />}
      {objective.kind === 'apart' && <ApartPicture first={objective.first} second={objective.second} />}
    </svg>
  );
}
