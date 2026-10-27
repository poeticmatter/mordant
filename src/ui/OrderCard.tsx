import type { Order, OrderRequirement } from '../engine/orders.ts';
import { SHADE_NAMES } from '../engine/shades.ts';
import { Stripes } from './Stripes.tsx';

interface OrderCardProps {
  order: Order;
  capacity: number;
  /** Highlights orders the current rack (or preview) would fill. */
  isMet?: boolean;
  /** The order is withdrawn if it is still unfilled at this season's inspection. */
  isLeaving?: boolean;
}

function statusLabel(isMet: boolean, isLeaving: boolean): string {
  if (isMet) return 'ready';
  return isLeaving ? 'last season' : 'order';
}

export function OrderCard({ order, capacity, isMet = false, isLeaving = false }: OrderCardProps) {
  const { requirement } = order;
  const borderClass = isMet ? 'border-weld' : isLeaving ? 'border-dashed border-madder' : 'border-slate-line';
  return (
    <div className={`flex flex-col rounded-sm border bg-slate-deep p-1 ${borderClass}`}>
      <div className="flex items-baseline justify-between px-0.5 text-[11px]">
        <span className={isMet ? 'text-weld' : 'text-chalk-soft'}>{statusLabel(isMet, isLeaving)}</span>
        <span className="font-extrabold text-chalk">{order.points}</span>
      </div>
      <RequirementView requirement={requirement} capacity={capacity} />
    </div>
  );
}

function RequirementView({ requirement, capacity }: { requirement: OrderRequirement; capacity: number }) {
  if (requirement.kind === 'shade') {
    return (
      <div className="mt-0.5 flex h-12 items-center justify-center rounded-[2px] bg-cloth text-xs text-slate-deep">
        {SHADE_NAMES[requirement.shade]}
      </div>
    );
  }
  if (requirement.kind === 'pattern') {
    return (
      <div className="mt-0.5 h-12 overflow-hidden rounded-[2px] bg-cloth">
        <Stripes bands={requirement.pattern} capacity={capacity} compact />
      </div>
    );
  }
  // A bolt: two kin cloths, each matching the pattern, drawn as a joined pair.
  return (
    <div className="mt-0.5 flex h-12 gap-px" aria-label="two cloths that have shared dye, both matching">
      {[0, 1].map((copy) => (
        <div key={copy} className="flex-1 overflow-hidden rounded-[2px] bg-cloth">
          <Stripes bands={requirement.pattern} capacity={capacity} compact />
        </div>
      ))}
    </div>
  );
}
