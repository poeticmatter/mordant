import { isOwned, isSpoiled, shippedCount, type Cloth, type TagsState } from '../selvedge/tags/engine.ts';
import { ClothTile } from './ClothTile.tsx';
import type { InspectionReport } from './session.ts';

function SheetShell({ title, children, onClose, closeLabel }: { title: string; children: React.ReactNode; onClose: () => void; closeLabel: string }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-deep/80 sm:items-center" role="dialog" aria-modal aria-label={title}>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-slate p-4 sm:rounded-lg">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {children}
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

function ClothGrid({ cloths }: { cloths: readonly Cloth[] }) {
  return (
    <ul className="mt-2 grid grid-cols-5 gap-2">
      {cloths.map((cloth) => (
        <li key={cloth.id}>
          <ClothTile look={cloth} size="small" />
        </li>
      ))}
    </ul>
  );
}

export function InspectionSheet({ report, game, onContinue }: { report: InspectionReport; game: TagsState; onContinue: () => void }) {
  const seasonsLeft = game.config.seasons - game.season;
  const summary =
    report.shipped.length === 0
      ? 'Nothing on the rack matched its tag.'
      : `Shipped ${report.shipped.length}. ${report.keptCount} ${report.keptCount === 1 ? 'cloth goes' : 'cloths go'} back in the basket with their colours.`;
  return (
    <SheetShell
      title={`Season ${report.season + 1} inspection`}
      onClose={onContinue}
      closeLabel={game.isOver ? 'See how it ended' : `Start season ${report.season + 2}`}
    >
      <p className="mt-1 text-chalk-soft">{summary}</p>
      {report.shipped.length > 0 && <ClothGrid cloths={report.shipped} />}
      {!game.isOver && (
        <p className="mt-3">
          {shippedCount(game)} of {game.config.shipTarget} shipped, {seasonsLeft} {seasonsLeft === 1 ? 'season' : 'seasons'} to go.
        </p>
      )}
    </SheetShell>
  );
}

const PLACES = ['in hand', 'on the rack', 'in the basket'] as const;

function placeOf(game: TagsState, clothId: number): (typeof PLACES)[number] {
  if (game.hand.includes(clothId)) return 'in hand';
  if (game.rack.includes(clothId)) return 'on the rack';
  return 'in the basket';
}

/** Every cloth you still own, with its colours and tag. The basket is shuffled: you know what's in it, not the order. */
export function ClothsSheet({ game, onClose }: { game: TagsState; onClose: () => void }) {
  const owned = game.cloths.filter(isOwned);
  const spoiledCount = owned.filter(isSpoiled).length;
  return (
    <SheetShell title="Your cloths" onClose={onClose} closeLabel="Back to the rack">
      <p className="mt-1 text-chalk-soft">
        You know what's in the basket, not the order you'll draw it in.
        {spoiledCount > 0 && ` ${spoiledCount} can no longer meet ${spoiledCount === 1 ? 'its' : 'their'} tag.`}
      </p>
      {PLACES.map((place) => {
        const here = owned.filter((cloth) => placeOf(game, cloth.id) === place);
        if (here.length === 0) return null;
        return (
          <section key={place} className="mt-4">
            <h3 className="font-semibold">{place[0].toUpperCase() + place.slice(1)}</h3>
            <ClothGrid cloths={here} />
          </section>
        );
      })}
    </SheetShell>
  );
}

export function FinalTally({ game, onMenu, onNewGame }: { game: TagsState; onMenu: () => void; onNewGame: () => void }) {
  const shipped = shippedCount(game);
  const isWon = shipped >= game.config.shipTarget;
  const unshipped = game.cloths.filter((cloth) => cloth.shippedSeason === null);
  return (
    <section className="flex flex-col gap-3 py-6">
      <h2 className="text-4xl font-extrabold">{isWon ? 'The orders are out.' : 'Orders left waiting.'}</h2>
      <p className="text-chalk-soft">
        Shipped {shipped} of {game.cloths.length}; the target was {game.config.shipTarget}.
        {unshipped.length > 0 && ' These never shipped:'}
      </p>
      {unshipped.length > 0 && <ClothGrid cloths={unshipped} />}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onMenu} className="flex-1 rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          Copy the log
        </button>
        <button type="button" onClick={onNewGame} className="flex-1 rounded-sm bg-slate-raised py-3 font-semibold">
          New game
        </button>
      </div>
    </section>
  );
}
