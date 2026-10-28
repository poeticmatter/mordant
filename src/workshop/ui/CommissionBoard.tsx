import { matchFor, starsForMatch, type Commission, type WorkshopState } from '../engine.ts';
import { ObjectiveIcon, objectiveCaption, objectiveTitle } from './ObjectiveIcon.tsx';
import { Swatch } from './Swatch.tsx';

const MAX_STARS = 3;

export function Stars({ count }: { count: number }) {
  return (
    <span aria-label={`${count} of ${MAX_STARS} stars`} className="tracking-tight">
      <span className="text-weld">{'★'.repeat(count)}</span>
      <span className="text-slate-line">{'★'.repeat(MAX_STARS - count)}</span>
    </span>
  );
}

interface CommissionBoardProps {
  game: WorkshopState;
  /** The selected cloth, measured live against every open commission. */
  selectedClothId: number | null;
  onChoose: (commissionId: number) => void;
}

/** The commissions as pictures. With a cloth selected, each open card shows how well that cloth matches it now. */
export function CommissionBoard({ game, selectedClothId, onChoose }: CommissionBoardProps) {
  return (
    <section aria-label="Commissions">
      <ul className="grid grid-cols-2 gap-2">
        {game.commissions.map((commission) => (
          <li key={commission.id}>
            <CommissionCard game={game} commission={commission} selectedClothId={selectedClothId} onChoose={onChoose} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommissionCard({ game, commission, selectedClothId, onChoose }: { game: WorkshopState; commission: Commission; selectedClothId: number | null; onChoose: (commissionId: number) => void }) {
  const { objective } = commission;
  const isOpen = commission.clothId === null;
  const match = isOpen && selectedClothId !== null ? matchFor(game, selectedClothId, commission) : null;
  const deliveredCloth = commission.clothId === null ? null : game.cloths[commission.clothId];
  return (
    <button
      type="button"
      disabled={!isOpen || selectedClothId === null}
      onClick={() => onChoose(commission.id)}
      className={`flex w-full gap-2 rounded-sm p-2 text-left ${isOpen ? 'bg-slate-deep' : 'bg-slate-deep/50'} ${match !== null ? 'outline-1 outline-weld/60' : ''}`}
    >
      <div className="w-14 shrink-0">
        {deliveredCloth === null ? <ObjectiveIcon objective={objective} /> : <Swatch cloth={deliveredCloth} size={game.config.clothSize} label="Delivered" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="leading-tight font-semibold">{objectiveTitle(objective)}</p>
        <p className="text-xs leading-snug text-chalk-soft">{objectiveCaption(objective)}</p>
        {!isOpen && commission.stars !== null && (
          <p className="mt-1 text-sm">
            Delivered <Stars count={commission.stars} />
          </p>
        )}
        {match !== null && (
          <p className="mt-1 text-sm">
            {Math.round(match * 100)}% <Stars count={starsForMatch(game, match)} />
          </p>
        )}
      </div>
    </button>
  );
}

/** Confirmation before a delivery, which can't be undone. */
export function DeliverySheet({ game, clothId, commissionId, onConfirm, onCancel }: { game: WorkshopState; clothId: number; commissionId: number; onConfirm: () => void; onCancel: () => void }) {
  const commission = game.commissions[commissionId];
  const match = matchFor(game, clothId, commission);
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-deep/80 sm:items-center" role="dialog" aria-modal aria-label="Deliver this cloth">
      <div className="w-full max-w-lg rounded-t-lg bg-slate p-4 sm:rounded-lg">
        <h2 className="text-xl font-extrabold">Deliver to {objectiveTitle(commission.objective)}?</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <figure>
            <Swatch cloth={game.cloths[clothId]} size={game.config.clothSize} label="Your cloth" />
            <figcaption className="mt-1 text-center text-sm text-chalk-soft">Your cloth</figcaption>
          </figure>
          <figure>
            <ObjectiveIcon objective={commission.objective} />
            <figcaption className="mt-1 text-center text-sm text-chalk-soft">Wanted</figcaption>
          </figure>
        </div>
        <p className="mt-3 text-lg">
          {Math.round(match * 100)}% match: <Stars count={starsForMatch(game, match)} />
        </p>
        <p className="text-sm text-chalk-soft">The cloth leaves the game and the commission closes.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-sm border border-slate-line py-3">
            Not yet
          </button>
          <button type="button" onClick={onConfirm} className="flex-1 rounded-sm bg-weld py-3 font-semibold text-slate-deep">
            Deliver
          </button>
        </div>
      </div>
    </div>
  );
}
