import { canSoak, type GameState } from '../engine/game.ts';
import type { Dye } from '../engine/shades.ts';
import { ClothSwatch } from './ClothSwatch.tsx';
import { clothName } from './dyeLook.ts';

/** Everything the rack draws on top of the cloths themselves. */
export interface RackHighlights {
  previewCell: number | null;
  /** Newest stripes that just soaked in (or would, in a preview), per cloth. */
  freshByClothId: ReadonlyMap<number, number>;
  /** Pegs whose cloth would ship if the season ended now. */
  shippingCells: ReadonlySet<number>;
  /** The cloth being looked at, and the pegs holding its kin. */
  focusedClothId: number | null;
  kinCells: ReadonlySet<number>;
}

interface RackProps {
  game: GameState;
  /** Memories to draw per peg: the live rack, or the rack as it would be after a previewed hang. */
  memories: readonly (readonly Dye[] | null)[];
  occupants: readonly (number | null)[];
  highlights: RackHighlights;
  canHang: boolean;
  onTapPeg: (cell: number) => void;
  onTapCloth: (clothId: number) => void;
}

export function Rack({ game, memories, occupants, highlights, canHang, onTapPeg, onTapCloth }: RackProps) {
  const { rackWidth, rackHeight } = game.config;
  return (
    <section aria-label="Drying rack" className="flex flex-col gap-2">
      {Array.from({ length: rackHeight }, (_, row) => (
        <div key={row} className="relative">
          <div className="absolute inset-x-0 top-1.5 h-0.5 rounded-full bg-hemp/70" aria-hidden />
          <div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${rackWidth}, minmax(0, 1fr))` }}>
            {Array.from({ length: rackWidth }, (_, column) => {
              const cell = row * rackWidth + column;
              const clothId = occupants[cell];
              const dyes = memories[cell];
              return (
                <div key={cell} className="flex flex-col items-center">
                  <div className="z-10 h-3 w-2 rounded-[1px] bg-hemp" aria-hidden />
                  {clothId === null || dyes === null ? (
                    <EmptyPeg cell={cell} canHang={canHang} onTapPeg={onTapPeg} />
                  ) : (
                    <HungCloth
                      game={game}
                      cell={cell}
                      clothId={clothId}
                      dyes={dyes}
                      highlights={highlights}
                      onTapPeg={onTapPeg}
                      onTapCloth={onTapCloth}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function EmptyPeg({ cell, canHang, onTapPeg }: { cell: number; canHang: boolean; onTapPeg: (cell: number) => void }) {
  return (
    <button
      type="button"
      disabled={!canHang}
      onClick={() => onTapPeg(cell)}
      aria-label={`Empty peg ${cell + 1}`}
      className={`h-28 w-full rounded-sm border border-dashed ${canHang ? 'border-hemp/80 bg-hemp/10' : 'border-slate-line'}`}
    />
  );
}

interface HungClothProps {
  game: GameState;
  cell: number;
  clothId: number;
  dyes: readonly Dye[];
  highlights: RackHighlights;
  onTapPeg: (cell: number) => void;
  onTapCloth: (clothId: number) => void;
}

function outlineClass(isPreview: boolean, isFocused: boolean, isKin: boolean): string {
  if (isPreview) return 'rounded-sm outline-2 outline-offset-2 outline-weld';
  if (isFocused) return 'rounded-sm outline-2 outline-offset-2 outline-chalk';
  if (isKin) return 'rounded-sm outline-2 outline-offset-2 outline-dashed outline-chalk-soft';
  return '';
}

function HungCloth({ game, cell, clothId, dyes, highlights, onTapPeg, onTapCloth }: HungClothProps) {
  const isPreview = cell === highlights.previewCell;
  const isFocused = clothId === highlights.focusedClothId;
  const isKin = highlights.kinCells.has(cell);
  // Tapping the previewed ghost hangs it; tapping a hung cloth shows its kin.
  const onClick = isPreview ? () => onTapPeg(cell) : () => onTapCloth(clothId);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPreview ? `Hang ${clothName(clothId)} here` : `${clothName(clothId)}: show cloths it has shared dye with`}
      aria-pressed={isPreview ? undefined : isFocused}
      className={`h-28 w-full ${outlineClass(isPreview, isFocused, isKin)}`}
    >
      <ClothSwatch
        clothId={clothId}
        dyes={dyes}
        capacity={game.config.memoryCapacity}
        isSoaked={!isPreview && !canSoak(game, clothId)}
        freshCount={highlights.freshByClothId.get(clothId) ?? 0}
        isGhost={isPreview}
        isShipped={highlights.shippingCells.has(cell)}
      />
    </button>
  );
}
