import { useMemo } from 'react';
import {
  bestFill,
  canInspectEarly,
  neighbourCell,
  openCommissions,
  OPPOSITE,
  rackAfterHang,
  SIDES,
  type ClothLook,
  type HangMove,
  type SelvedgeState,
} from '../selvedge/engine.ts';
import { ClothTile, CommissionTile, dyeName } from './ClothTile.tsx';
import { Rack, type PegView } from './Rack.tsx';
import { touchedBy } from './session.ts';

interface BoardProps {
  game: SelvedgeState;
  selectedClothId: number | null;
  preview: HangMove | null;
  onSelectCloth: (clothId: number) => void;
  onTapPeg: (cell: number) => void;
  onHang: () => void;
  onInspectNow: () => void;
  onShowCloths: () => void;
}

/** Sides that a hang on `cell` stains, on the hung cloth and on each neighbour it touches. */
function freshSidesOfHang(rack: readonly (unknown | null)[], game: SelvedgeState, cell: number): Map<number, number[]> {
  const fresh = new Map<number, number[]>([[cell, []]]);
  for (const side of SIDES) {
    const neighbourAt = neighbourCell(cell, side, game.config);
    if (neighbourAt === null || rack[neighbourAt] === null) continue;
    fresh.get(cell)!.push(side);
    fresh.set(neighbourAt, [OPPOSITE[side]]);
  }
  return fresh;
}

function pegViews(game: SelvedgeState, preview: HangMove | null): { pegs: (PegView | null)[]; looks: (ClothLook | null)[] } {
  const occupants = game.rack.slice();
  if (preview) occupants[preview.cell] = preview.clothId;
  const looks: (ClothLook | null)[] = preview ? rackAfterHang(game, preview) : game.rack.map((id) => (id === null ? null : game.cloths[id]));
  const lastHang = game.seasonHangs.at(-1);
  const freshCell = preview?.cell ?? lastHang?.cell;
  const fresh = freshCell === undefined ? new Map<number, number[]>() : freshSidesOfHang(occupants, game, freshCell);
  const pegs = occupants.map((clothId, cell): PegView | null => {
    const look = looks[cell];
    if (clothId === null || look === null) return null;
    return { clothId, body: look.body, edges: look.edges, freshSides: fresh.get(cell) ?? [] };
  });
  return { pegs, looks };
}

export function Board({ game, selectedClothId, preview, onSelectCloth, onTapPeg, onHang, onInspectNow, onShowCloths }: BoardProps) {
  const view = useMemo(() => {
    const { pegs, looks } = pegViews(game, preview);
    const open = openCommissions(game);
    const fill = bestFill(open, looks);
    const readyIds = new Set(open.filter((_, index) => fill[index] !== -1).map((commission) => commission.id));
    return { pegs, readyIds, shippingCells: new Set(fill.filter((cell) => cell !== -1)) };
  }, [game, preview]);

  return (
    <div className="flex flex-col gap-4">
      <PatternBook game={game} readyIds={view.readyIds} />
      <Rack
        game={game}
        pegs={view.pegs}
        previewCell={preview?.cell ?? null}
        shippingCells={view.shippingCells}
        canHang={selectedClothId !== null}
        onTapPeg={onTapPeg}
      />
      <ActionBar game={game} selectedClothId={selectedClothId} preview={preview} readyCount={view.readyIds.size} onHang={onHang} onInspectNow={onInspectNow} />
      <Hand game={game} selectedClothId={selectedClothId} onSelect={onSelectCloth} onShowCloths={onShowCloths} />
    </div>
  );
}

function PatternBook({ game, readyIds }: { game: SelvedgeState; readyIds: ReadonlySet<number> }) {
  return (
    <section aria-label="Pattern book">
      <ul className="grid grid-cols-4 gap-2">
        {game.commissions.map((commission) => {
          const isDone = commission.completedSeason !== null;
          const isReady = readyIds.has(commission.id);
          return (
            <li
              key={commission.id}
              className={`relative rounded-sm border p-1.5 ${isReady ? 'border-weld bg-weld/10' : isDone ? 'border-transparent opacity-35' : 'border-slate-line'}`}
            >
              <CommissionTile body={commission.body} edges={commission.edges} />
              <p className={`mt-1 text-center text-xs ${isReady ? 'font-semibold text-weld' : 'text-chalk-soft'}`}>
                {isDone ? 'filled' : isReady ? 'ready' : 'open'}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-xs text-chalk-soft">Dashed sides take any stain. "Ready" ones would be filled if you inspected now.</p>
    </section>
  );
}

interface ActionBarProps {
  game: SelvedgeState;
  selectedClothId: number | null;
  preview: HangMove | null;
  readyCount: number;
  onHang: () => void;
  onInspectNow: () => void;
}

function ActionBar({ game, selectedClothId, preview, readyCount, onHang, onInspectNow }: ActionBarProps) {
  if (preview) {
    const touched = touchedBy(game, preview.cell);
    const hung = game.cloths[preview.clothId];
    return (
      <div className="flex min-h-12 items-center gap-3">
        <p className="flex-1">
          {touched.length === 0
            ? 'Touches nothing here, so no edges change.'
            : `Stains ${touched.length} ${touched.length === 1 ? 'neighbour' : 'neighbours'} ${dyeName(hung.body).toLowerCase()} and takes their colours.`}
        </p>
        <button type="button" onClick={onHang} className="rounded-sm bg-weld px-5 py-3 font-semibold text-slate-deep">
          Hang it
        </button>
      </div>
    );
  }
  return (
    <div className="flex min-h-12 items-center gap-3">
      <p className="flex-1 text-chalk-soft">
        {selectedClothId === null ? 'Pick a cloth from your hand.' : 'Tap an empty peg to preview, tap again to hang.'}
      </p>
      {canInspectEarly(game) && (
        <button type="button" onClick={onInspectNow} className="rounded-sm border border-weld px-4 py-3 font-semibold text-weld">
          Inspect now{readyCount > 0 ? ` (${readyCount})` : ''}
        </button>
      )}
    </div>
  );
}

interface HandProps {
  game: SelvedgeState;
  selectedClothId: number | null;
  onSelect: (clothId: number) => void;
  onShowCloths: () => void;
}

function Hand({ game, selectedClothId, onSelect, onShowCloths }: HandProps) {
  return (
    <section aria-label="Your hand" className="grid grid-cols-4 items-end gap-2">
      {game.hand.map((clothId) => {
        const cloth = game.cloths[clothId];
        const isSelected = clothId === selectedClothId;
        return (
          <button
            key={clothId}
            type="button"
            onClick={() => onSelect(clothId)}
            aria-pressed={isSelected}
            aria-label={`Pick up the ${dyeName(cloth.body).toLowerCase()} cloth`}
            className={`rounded-sm p-1.5 transition-transform ${isSelected ? '-translate-y-2 bg-slate-raised outline-2 outline-chalk' : 'bg-slate-deep'}`}
          >
            <ClothTile body={cloth.body} edges={cloth.edges} />
          </button>
        );
      })}
      <button type="button" onClick={onShowCloths} className="flex aspect-square flex-col items-center justify-center rounded-sm border border-slate-line text-xs text-chalk-soft">
        <span className="text-2xl font-extrabold text-chalk">{game.drawPile.length}</span>
        in basket
      </button>
    </section>
  );
}
