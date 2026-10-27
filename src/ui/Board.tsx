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
  onSetAside: () => void;
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

export function Board({ game, selectedClothId, preview, onSelectCloth, onTapPeg, onHang, onSetAside, onInspectNow, onShowCloths }: BoardProps) {
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
      <ActionBar
        game={game}
        selectedClothId={selectedClothId}
        preview={preview}
        readyCount={view.readyIds.size}
        onHang={onHang}
        onSetAside={onSetAside}
        onInspectNow={onInspectNow}
      />
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
  onSetAside: () => void;
  onInspectNow: () => void;
}

function ActionBar({ game, selectedClothId, preview, readyCount, onHang, onSetAside, onInspectNow }: ActionBarProps) {
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
  const canSetAside = selectedClothId !== null && game.config.allowsSettingAside;
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-3">
      <p className="min-w-40 flex-1 text-chalk-soft">
        {selectedClothId === null ? 'Pick a cloth from your hand.' : 'Tap an empty peg to see what it would stain.'}
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

interface HandProps {
  game: SelvedgeState;
  selectedClothId: number | null;
  onSelect: (clothId: number) => void;
  onShowCloths: () => void;
}

function Hand({ game, selectedClothId, onSelect, onShowCloths }: HandProps) {
  return (
    <div className="flex flex-col gap-3">
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
      </section>
      <Basket game={game} onShowCloths={onShowCloths} />
    </div>
  );
}

/** Basket cloths sorted by colour, then stains: what you will draw is public, the order you draw it in is not. */
function basketCloths(game: SelvedgeState) {
  const sortKey = (clothId: number) => {
    const cloth = game.cloths[clothId];
    return [cloth.body, ...cloth.edges.map((edge) => (edge === null ? -1 : edge))];
  };
  return game.drawPile.slice().sort((first, second) => {
    const firstKey = sortKey(first);
    const secondKey = sortKey(second);
    const differingIndex = firstKey.findIndex((value, index) => value !== secondKey[index]);
    return differingIndex === -1 ? first - second : firstKey[differingIndex] - secondKey[differingIndex];
  });
}

/**
 * Playtest 2: a count that opened the list was never tapped; the player assumed the
 * basket was hidden. The contents are shown on the board instead.
 */
function Basket({ game, onShowCloths }: { game: SelvedgeState; onShowCloths: () => void }) {
  const cloths = basketCloths(game);
  return (
    <section aria-label="Basket">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">
          Basket <span className="font-normal text-chalk-soft">{cloths.length === 0 ? 'empty' : `${cloths.length}, drawn in random order`}</span>
        </h2>
        <button type="button" onClick={onShowCloths} className="text-sm text-chalk-soft underline underline-offset-2">
          Bigger view
        </button>
      </div>
      {cloths.length > 0 && (
        <ul className="mt-1.5 grid grid-cols-8 gap-1">
          {cloths.map((clothId) => {
            const cloth = game.cloths[clothId];
            return (
              <li key={clothId}>
                <ClothTile body={cloth.body} edges={cloth.edges} size="small" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
