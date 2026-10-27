import { isOwned, type SelvedgeState } from '../selvedge/engine.ts';
import { ClothTile, CommissionTile } from './ClothTile.tsx';
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

export function InspectionSheet({ report, game, onContinue }: { report: InspectionReport; game: SelvedgeState; onContinue: () => void }) {
  const seasonsLeft = game.config.seasons - game.season;
  const summary =
    report.filled.length === 0
      ? 'Nothing on the rack matched the book.'
      : `Filled ${report.filled.length}. Those cloths leave; the rest come back next season with their stains.`;
  return (
    <SheetShell
      title={`Season ${report.season + 1} inspection`}
      onClose={onContinue}
      closeLabel={game.isOver ? 'See how the book ended' : `Start season ${report.season + 2}`}
    >
      <p className="mt-1 text-chalk-soft">{summary}</p>
      {report.filled.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {report.filled.map((commission) => (
            <li key={commission.id}>
              <CommissionTile body={commission.body} edges={commission.edges} />
            </li>
          ))}
        </ul>
      )}
      {!game.isOver && (
        <p className="mt-3">
          {report.stillOpen.length} left in the book, {seasonsLeft} {seasonsLeft === 1 ? 'season' : 'seasons'} to go.
        </p>
      )}
    </SheetShell>
  );
}

const PLACES = ['in hand', 'on the rack', 'in the basket'] as const;

function placeOf(game: SelvedgeState, clothId: number): (typeof PLACES)[number] {
  if (game.hand.includes(clothId)) return 'in hand';
  if (game.rack.includes(clothId)) return 'on the rack';
  return 'in the basket';
}

/** Every cloth you still own, with its stains. The basket is shuffled: you know what's in it, not the order. */
export function ClothsSheet({ game, onClose }: { game: SelvedgeState; onClose: () => void }) {
  const owned = game.cloths.filter(isOwned);
  return (
    <SheetShell title="Your cloths" onClose={onClose} closeLabel="Back to the rack">
      <p className="mt-1 text-chalk-soft">You know what's in the basket, not the order you'll draw it in.</p>
      {PLACES.map((place) => {
        const here = owned.filter((cloth) => placeOf(game, cloth.id) === place);
        if (here.length === 0) return null;
        return (
          <section key={place} className="mt-4">
            <h3 className="font-semibold">{place[0].toUpperCase() + place.slice(1)}</h3>
            <ul className="mt-2 grid grid-cols-5 gap-2">
              {here.map((cloth) => (
                <li key={cloth.id}>
                  <ClothTile body={cloth.body} edges={cloth.edges} size="small" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </SheetShell>
  );
}

export function FinalTally({ game, onMenu, onNewGame }: { game: SelvedgeState; onMenu: () => void; onNewGame: () => void }) {
  const unfilled = game.commissions.filter((commission) => commission.completedSeason === null);
  return (
    <section className="flex flex-col gap-3 py-6">
      <h2 className="text-4xl font-extrabold">{unfilled.length === 0 ? 'The book is complete.' : 'The book is unfinished.'}</h2>
      <p className="text-chalk-soft">
        {unfilled.length === 0
          ? `All ${game.commissions.length} commissions filled in ${game.season} ${game.season === 1 ? 'season' : 'seasons'}.`
          : `${game.commissions.length - unfilled.length} of ${game.commissions.length} filled. These were left:`}
      </p>
      {unfilled.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {unfilled.map((commission) => (
            <li key={commission.id}>
              <CommissionTile body={commission.body} edges={commission.edges} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onMenu} className="flex-1 rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          Copy the log
        </button>
        <button type="button" onClick={onNewGame} className="flex-1 rounded-sm bg-slate-raised py-3 font-semibold">
          New book
        </button>
      </div>
    </section>
  );
}
