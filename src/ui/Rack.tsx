import type { Dye } from '../engine/shades.ts';
import type { SelvedgeState } from '../selvedge/engine.ts';
import { ClothTile } from './ClothTile.tsx';

export interface PegView {
  clothId: number;
  body: Dye;
  edges: readonly (Dye | null)[];
  freshSides: readonly number[];
}

interface RackProps {
  game: SelvedgeState;
  /** What each peg shows: the live rack, or the rack as a previewed hang would leave it. */
  pegs: readonly (PegView | null)[];
  previewCell: number | null;
  shippingCells: ReadonlySet<number>;
  canHang: boolean;
  onTapPeg: (cell: number) => void;
}

/** The drying rack: a frame of pegs. Edges against the frame never get stained. */
export function Rack({ game, pegs, previewCell, shippingCells, canHang, onTapPeg }: RackProps) {
  return (
    <section
      aria-label="Drying rack"
      className="grid gap-1.5 rounded-md border-4 border-hemp/70 bg-slate-deep p-1.5"
      style={{ gridTemplateColumns: `repeat(${game.config.rackWidth}, minmax(0, 1fr))` }}
    >
      {pegs.map((peg, cell) => {
        const isPreview = cell === previewCell;
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
        return (
          <div key={cell} className={isPreview ? 'rounded-[4px] outline-2 outline-offset-2 outline-chalk' : ''}>
            <ClothTile body={peg.body} edges={peg.edges} freshSides={peg.freshSides} isGhost={isPreview} isShipping={shippingCells.has(cell)} />
          </div>
        );
      })}
    </section>
  );
}
