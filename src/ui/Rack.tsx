import type { ClothLook, TagsState } from '../selvedge/tags/engine.ts';
import { ClothTile } from './ClothTile.tsx';

export interface PegView {
  clothId: number;
  look: ClothLook;
  freshSides: readonly number[];
}

interface RackProps {
  game: TagsState;
  /** What each peg shows: the live rack, or the rack as a previewed hang would leave it. */
  pegs: readonly (PegView | null)[];
  previewCell: number | null;
  shippingCells: ReadonlySet<number>;
  canHang: boolean;
  onTapPeg: (cell: number) => void;
}

/** The drying rack: a frame of pegs. Edges against the frame keep their colour. */
export function Rack({ game, pegs, previewCell, shippingCells, canHang, onTapPeg }: RackProps) {
  return (
    <section
      aria-label="Drying rack"
      className="grid items-start gap-1.5 rounded-md border-4 border-hemp/70 bg-slate-deep p-1.5"
      style={{ gridTemplateColumns: `repeat(${game.config.rackWidth}, minmax(0, 1fr))` }}
    >
      {pegs.map((peg, cell) => {
        if (peg === null) {
          return (
            <button
              key={cell}
              type="button"
              disabled={!canHang}
              onClick={() => onTapPeg(cell)}
              aria-label={`Empty peg ${cell + 1}`}
              className={`aspect-square w-full rounded-[3px] border-2 border-dashed ${canHang ? 'border-hemp bg-hemp/10' : 'border-slate-line/60'}`}
            />
          );
        }
        const isPreview = cell === previewCell;
        return (
          <div key={cell} className={isPreview ? 'rounded-[4px] outline-2 outline-offset-2 outline-weld' : ''}>
            <ClothTile look={peg.look} freshSides={peg.freshSides} isGhost={isPreview} isShipping={shippingCells.has(cell)} />
          </div>
        );
      })}
    </section>
  );
}
