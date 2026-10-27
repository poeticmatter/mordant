import { useMemo } from 'react';
import { neighbourCell, OPPOSITE, SIDES } from '../selvedge/grid.ts';
import { canInspectEarly, isSpoiled, rackAfterHang, shippingCells, type ClothLook, type HangMove, type TagsState } from '../selvedge/tags/engine.ts';
import { ClothTile, dyeName } from './ClothTile.tsx';
import { Rack, type PegView } from './Rack.tsx';
import { touchedBy } from './session.ts';

interface BoardProps {
  game: TagsState;
  selectedClothId: number | null;
  preview: HangMove | null;
  onSelectCloth: (clothId: number) => void;
  onTapPeg: (cell: number) => void;
  onTurn: () => void;
  onHang: () => void;
  onSetAside: () => void;
  onInspectNow: () => void;
  onShowCloths: () => void;
}

/** Sides that a hang on `cell` dyes, on the hung cloth and on each neighbour it touches. */
function freshSidesOfHang(occupants: readonly (number | null)[], game: TagsState, cell: number): Map<number, number[]> {
  const fresh = new Map<number, number[]>([[cell, []]]);
  for (const side of SIDES) {
    const neighbourAt = neighbourCell(cell, side, game.config);
    if (neighbourAt === null || occupants[neighbourAt] === null) continue;
    fresh.get(cell)!.push(side);
    fresh.set(neighbourAt, [OPPOSITE[side]]);
  }
  return fresh;
}

function pegViews(game: TagsState, preview: HangMove | null): { pegs: (PegView | null)[]; looks: (ClothLook | null)[] } {
  const occupants = game.rack.slice();
  if (preview) occupants[preview.cell] = preview.clothId;
  const looks: (ClothLook | null)[] = preview ? rackAfterHang(game, preview) : game.rack.map((id) => (id === null ? null : game.cloths[id]));
  const freshCell = preview?.cell ?? game.seasonHangs.at(-1)?.cell;
  const fresh = freshCell === undefined ? new Map<number, number[]>() : freshSidesOfHang(occupants, game, freshCell);
  const pegs = occupants.map((clothId, cell): PegView | null => {
    const look = looks[cell];
    if (clothId === null || look === null) return null;
    return { clothId, look, freshSides: fresh.get(cell) ?? [] };
  });
  return { pegs, looks };
}

export function Board({ game, selectedClothId, preview, onSelectCloth, onTapPeg, onTurn, onHang, onSetAside, onInspectNow, onShowCloths }: BoardProps) {
  const view = useMemo(() => {
    const { pegs, looks } = pegViews(game, preview);
    return { pegs, shipping: new Set(shippingCells(looks)) };
  }, [game, preview]);

  return (
    <div className="flex flex-col gap-4">
      <Rack
        game={game}
        pegs={view.pegs}
        previewCell={preview?.cell ?? null}
        shippingCells={view.shipping}
        canHang={selectedClothId !== null}
        onTapPeg={onTapPeg}
      />
      <p className="-mt-2 text-xs text-chalk-soft">
        Under each cloth, its tag: the four edges its customer wants, on any sides. Filled chips are done. Outlined cloths
        would ship if inspected now.
      </p>
      <ActionBar
        game={game}
        selectedClothId={selectedClothId}
        preview={preview}
        readyCount={view.shipping.size}
        onTurn={onTurn}
        onHang={onHang}
        onSetAside={onSetAside}
        onInspectNow={onInspectNow}
      />
      <Hand game={game} selectedClothId={selectedClothId} onSelect={onSelectCloth} />
      <button type="button" onClick={onShowCloths} className="self-start rounded-sm border border-slate-line px-4 py-3">
        See the basket ({game.drawPile.length})
      </button>
    </div>
  );
}

/** Cloths, the hung one included, that this hang would spoil for good. */
function newlySpoiledCount(game: TagsState, preview: HangMove): number {
  const after = rackAfterHang(game, preview);
  return after.filter((look, cell) => {
    if (look === null || !isSpoiled(look)) return false;
    const before = cell === preview.cell ? game.cloths[preview.clothId] : game.cloths[game.rack[cell] as number]; // `after` only has looks on occupied pegs
    return !isSpoiled(before);
  }).length;
}

function previewSummary(game: TagsState, preview: HangMove): string {
  const touched = touchedBy(game, preview.cell);
  if (touched.length === 0) return 'Touches nothing here, so no edges change.';
  const hung = game.cloths[preview.clothId];
  const mixes = `Mixes ${dyeName(hung.body).toLowerCase()} into ${touched.length} ${touched.length === 1 ? 'neighbour' : 'neighbours'} and takes their colours.`;
  const spoiled = newlySpoiledCount(game, preview);
  if (spoiled === 0) return mixes;
  return `${mixes} Spoils ${spoiled} ${spoiled === 1 ? 'cloth' : 'cloths'} for good.`;
}

interface ActionBarProps {
  game: TagsState;
  selectedClothId: number | null;
  preview: HangMove | null;
  readyCount: number;
  onTurn: () => void;
  onHang: () => void;
  onSetAside: () => void;
  onInspectNow: () => void;
}

function ActionBar({ game, selectedClothId, preview, readyCount, onTurn, onHang, onSetAside, onInspectNow }: ActionBarProps) {
  if (preview) {
    return (
      <div className="flex min-h-12 flex-wrap items-center gap-3">
        <p className="min-w-40 flex-1">{previewSummary(game, preview)}</p>
        {game.config.allowsTurning && (
          <button type="button" onClick={onTurn} className="rounded-sm border border-slate-line px-4 py-3">
            Turn it
          </button>
        )}
        <button type="button" onClick={onHang} className="rounded-sm bg-weld px-5 py-3 font-semibold text-slate-deep">
          Hang it
        </button>
      </div>
    );
  }
  const canSetAside = selectedClothId !== null && game.config.allowsSettingAside;
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-3">
      <p className="min-w-40 flex-1 text-chalk-soft">
        {selectedClothId === null ? 'Pick a cloth from your hand.' : 'Tap an empty peg to see what it would do.'}
      </p>
      {canSetAside && (
        <button type="button" onClick={onSetAside} className="rounded-sm border border-slate-line px-4 py-3">
          Set aside for good
        </button>
      )}
      {canInspectEarly(game) && (
        <button type="button" onClick={onInspectNow} className="rounded-sm border border-weld px-4 py-3 font-semibold text-weld">
          Inspect now{readyCount > 0 ? ` (${readyCount})` : ''}
        </button>
      )}
    </div>
  );
}

function Hand({ game, selectedClothId, onSelect }: { game: TagsState; selectedClothId: number | null; onSelect: (clothId: number) => void }) {
  return (
    <section aria-label="Your hand" className="grid grid-cols-3 items-end gap-3">
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
            className={`rounded-sm p-2 transition-transform ${isSelected ? '-translate-y-2 bg-slate-raised outline-2 outline-chalk' : 'bg-slate-deep'}`}
          >
            <ClothTile look={cloth} />
          </button>
        );
      })}
    </section>
  );
}
