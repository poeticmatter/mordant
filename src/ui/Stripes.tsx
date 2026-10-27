import type { Dye } from '../engine/shades.ts';
import { dyeLook } from './dyeLook.ts';

interface StripesProps {
  /** Oldest first; `null` draws a wildcard band (orders) . */
  bands: readonly (Dye | null)[];
  capacity: number;
  /** How many of the newest bands just soaked in, so they flash once. */
  freshCount?: number;
  /** Marks the newest band as the one that bleeds. */
  showsBleed?: boolean;
  compact?: boolean;
}

/**
 * Draws a dye memory top (oldest) to bottom (newest), aligned to the hem, so a
 * cloth and an order line up band for band.
 */
export function Stripes({ bands, capacity, freshCount = 0, showsBleed = false, compact = false }: StripesProps) {
  const emptyBands = Math.max(0, capacity - bands.length);
  const letterSize = compact ? 'text-[10px]' : 'text-xs';
  return (
    <div className="flex h-full flex-col">
      {Array.from({ length: emptyBands }, (_, index) => (
        <div key={`empty-${index}`} className="flex-1 border-b border-slate-deep/10" />
      ))}
      {bands.map((band, index) => {
        const isNewest = index === bands.length - 1;
        const isFresh = index >= bands.length - freshCount;
        if (band === null) {
          return (
            <div
              key={index}
              className={`flex flex-1 items-center justify-center bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgb(35_43_48/0.15)_4px_6px)] ${letterSize} text-slate-deep/60`}
              aria-label="any dye"
            >
              any
            </div>
          );
        }
        const look = dyeLook(band);
        return (
          <div
            key={`${index}-${band}`}
            className={`relative flex flex-1 items-center justify-center font-semibold ${look.fill} ${look.ink} ${letterSize} ${isFresh ? 'stripe-fresh' : ''}`}
            aria-label={look.name}
          >
            {look.letter}
            {showsBleed && isNewest && <BleedDrip />}
          </div>
        );
      })}
    </div>
  );
}

function BleedDrip() {
  return (
    <svg
      viewBox="0 0 10 14"
      className="absolute right-1 bottom-0.5 h-3 w-2 opacity-80"
      aria-label="bleeds into neighbours"
    >
      <path d="M5 0 C5 4 9 7 9 10 A4 4 0 0 1 1 10 C1 7 5 4 5 0 Z" fill="currentColor" />
    </svg>
  );
}
