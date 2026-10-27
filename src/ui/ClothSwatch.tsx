import type { Dye } from '../engine/shades.ts';
import { clothName } from './dyeLook.ts';
import { Stripes } from './Stripes.tsx';

interface ClothSwatchProps {
  clothId: number;
  dyes: readonly Dye[];
  capacity: number;
  /** Took its one stripe this season and ignores further bleeds (soak-once rule). */
  isSoaked?: boolean;
  /** Newest bands that just soaked in (or would, in a preview). */
  freshCount?: number;
  isGhost?: boolean;
  isShipped?: boolean;
}

/** A hanging cloth: name tag and dye bands, oldest at the top, newest at the hem. */
export function ClothSwatch({ clothId, dyes, capacity, isSoaked = false, freshCount = 0, isGhost = false, isShipped = false }: ClothSwatchProps) {
  return (
    <div className={`flex h-full w-full flex-col ${isGhost ? 'opacity-75' : ''}`}>
      <div className="flex items-baseline justify-between gap-1 px-0.5 text-[11px] leading-tight text-chalk">
        <span className="truncate font-semibold">{clothName(clothId)}</span>
        {isSoaked && <span className="shrink-0 text-chalk-soft">soaked</span>}
      </div>
      <div
        className={`cloth-hem mt-0.5 flex-1 overflow-hidden bg-cloth text-slate-deep ${isShipped ? 'ring-2 ring-weld' : ''} ${isSoaked ? 'saturate-[0.85]' : ''}`}
      >
        <Stripes bands={dyes} capacity={capacity} freshCount={freshCount} showsBleed />
      </div>
    </div>
  );
}
