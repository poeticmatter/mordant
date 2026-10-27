import type { GameState } from '../engine/game.ts';
import { ClothSwatch } from './ClothSwatch.tsx';
import { clothName } from './dyeLook.ts';
import { OrderCard } from './OrderCard.tsx';
import type { InspectionReport } from './session.ts';

interface InspectionSheetProps {
  report: InspectionReport;
  game: GameState;
  onContinue: () => void;
}

function listNames(clothIds: readonly number[]): string {
  return clothIds.map(clothName).join(' and ');
}

export function InspectionSheet({ report, game, onContinue }: InspectionSheetProps) {
  const capacity = game.config.memoryCapacity;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-deep/80 sm:items-center" role="dialog" aria-modal>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-slate p-4 sm:rounded-lg">
        <h2 className="text-xl font-extrabold">Season {report.season + 1} inspection</h2>
        <p className="mt-1 text-sm text-chalk-soft">
          {report.shipments.length === 0
            ? 'No cloth matched an order. Every cloth goes back in the basket, stripes and all.'
            : `Filled ${report.shipments.length} ${report.shipments.length === 1 ? 'order' : 'orders'} for ${report.pointsEarned} points. Unsold cloths go back in the basket with their stripes.`}
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {report.shipments.map((shipment) => (
            <li key={shipment.order.id} className="grid grid-cols-[1fr_4.5rem] items-center gap-3">
              <div className="flex items-center gap-2">
                {shipment.cloths.map((cloth) => (
                  <div key={cloth.clothId} className="h-24 w-16 shrink-0">
                    <ClothSwatch clothId={cloth.clothId} dyes={cloth.dyes} capacity={capacity} isShipped />
                  </div>
                ))}
                <p className="text-sm">
                  {listNames(shipment.cloths.map((cloth) => cloth.clothId))} {shipment.cloths.length > 1 ? 'fill' : 'fills'} an
                  order for <strong>{shipment.points}</strong>.
                </p>
              </div>
              <OrderCard order={shipment.order} capacity={capacity} isMet />
            </li>
          ))}
        </ul>
        <button type="button" onClick={onContinue} className="mt-4 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          {game.isOver ? 'See the final tally' : `Start season ${report.season + 2}`}
        </button>
      </div>
    </div>
  );
}
