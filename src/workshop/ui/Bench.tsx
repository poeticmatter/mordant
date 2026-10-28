import { useRef, type PointerEvent } from 'react';
import type { WorkshopState } from '../engine.ts';
import { ROTATION_STEP_DEGREES, type Placement } from '../geometry.ts';
import { ClothArt } from './Swatch.tsx';

/** Room around the bench so a turned cloth near the edge is still fully visible (half a diagonal of 12). */
const MARGIN = 9;
/** Pointer travel, in bench units, below which a press counts as a tap rather than a drag. */
const TAP_SLOP = 0.4;

interface BenchProps {
  game: WorkshopState;
  layout: readonly Placement[];
  selectedClothId: number | null;
  onSelect: (clothId: number | null) => void;
  onMove: (clothId: number, x: number, y: number) => void;
}

interface Drag {
  clothId: number;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}

/**
 * The workshop bench. Cloths put down later lie on top, and whatever you can see from above is
 * exactly what the spray will reach. Drag to move (snaps to whole units); tap to select. Cloths can
 * still be moved after spraying, to look at what each one got.
 */
export function Bench({ game, layout, selectedClothId, onSelect, onMove }: BenchProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const { benchSize, clothSize } = game.config;
  const half = clothSize / 2;

  function benchPoint(event: PointerEvent): { x: number; y: number } | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function startDrag(event: PointerEvent<SVGGElement>, placement: Placement) {
    event.stopPropagation();
    onSelect(placement.clothId);
    const point = benchPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { clothId: placement.clothId, pointerId: event.pointerId, startX: point.x, startY: point.y, originX: placement.x, originY: placement.y };
  }

  function continueDrag(event: PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    const point = benchPoint(event);
    if (!drag || drag.pointerId !== event.pointerId || !point) return;
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    if (Math.hypot(dx, dy) < TAP_SLOP) return;
    onMove(drag.clothId, clamp(Math.round(drag.originX + dx), benchSize), clamp(Math.round(drag.originY + dy), benchSize));
  }

  function endDrag() {
    dragRef.current = null;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${-MARGIN} ${-MARGIN} ${benchSize + 2 * MARGIN} ${benchSize + 2 * MARGIN}`}
      className="block aspect-square w-full touch-none select-none"
      role="group"
      aria-label="Workshop bench"
      onPointerDown={() => onSelect(null)}
    >
      <rect x={-MARGIN} y={-MARGIN} width={benchSize + 2 * MARGIN} height={benchSize + 2 * MARGIN} fill="var(--color-slate-deep)" />
      <rect x={0} y={0} width={benchSize} height={benchSize} fill="none" stroke="var(--color-hemp)" strokeOpacity={0.5} strokeWidth={0.3} strokeDasharray="1 1" />
      {layout.map((placement) => {
        const isSelected = placement.clothId === selectedClothId;
        return (
          <g
            key={placement.clothId}
            transform={`translate(${placement.x} ${placement.y}) rotate(${placement.rotation * ROTATION_STEP_DEGREES})`}
            onPointerDown={(event) => startDrag(event, placement)}
            onPointerMove={continueDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="cursor-grab"
            role="img"
            aria-label={`Cloth ${placement.clothId + 1}${isSelected ? ', selected' : ''}`}
          >
            <rect x={-half - 0.25} y={-half - 0.25} width={clothSize + 0.5} height={clothSize + 0.5} fill="var(--color-slate)" opacity={0.6} />
            <ClothArt cloth={game.cloths[placement.clothId]} size={clothSize} />
            {isSelected && (
              <rect x={-half} y={-half} width={clothSize} height={clothSize} fill="none" stroke="var(--color-chalk)" strokeWidth={0.5} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
