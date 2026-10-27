import { useMemo, useState } from 'react';
import { areKin, inspectionsSeen, pegsOf, rackView, rackViewAfterHang, type GameState, type Move } from '../engine/game.ts';
import { bestAssignment, isBolt, type PostedOrder } from '../engine/orders.ts';
import { clothName, dyeLook } from './dyeLook.ts';
import { Hand } from './Hand.tsx';
import { OrderCard } from './OrderCard.tsx';
import { Rack } from './Rack.tsx';
import { soakedBy } from './session.ts';
import type { LastHang } from './useGameSession.ts';

interface BoardProps {
  game: GameState;
  selectedClothId: number | null;
  preview: Move | null;
  lastHang: LastHang | null;
  onSelectCloth: (clothId: number) => void;
  onTapPeg: (cell: number) => void;
  onConfirm: () => void;
}

export function Board({ game, selectedClothId, preview, lastHang, onSelectCloth, onTapPeg, onConfirm }: BoardProps) {
  const capacity = game.config.memoryCapacity;
  const [tappedClothId, setTappedClothId] = useState<number | null>(null);
  const tappedIsOnRack = tappedClothId !== null && game.rack.includes(tappedClothId);
  // A tapped hung cloth wins; otherwise the cloth in hand is the one whose kin we show.
  const focusedClothId = tappedIsOnRack ? tappedClothId : selectedClothId;
  const view = useMemo(() => {
    const rack = preview ? rackViewAfterHang(game, preview) : rackView(game);
    const occupants = game.rack.slice();
    if (preview) occupants[preview.cell] = preview.clothId;
    const soaked = preview ? soakedBy(game, preview.cell) : (lastHang?.soakedClothIds ?? []);
    const assignment = bestAssignment(game.display, rack, capacity);
    const shippingCells = new Set(assignment.pegMaskByOrder.flatMap(pegsOf));
    return {
      memories: rack.memories,
      occupants,
      freshByClothId: new Map(soaked.map((clothId) => [clothId, 1])),
      assignment,
      shippingCells,
    };
  }, [capacity, game, lastHang, preview]);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Orders" className="grid grid-cols-4 gap-2">
        {game.display.map((order, index) => (
          <OrderCard
            key={order.id}
            order={order}
            capacity={capacity}
            isMet={view.assignment.pegMaskByOrder[index] !== 0}
            isLeaving={isOrderLeaving(game, order)}
          />
        ))}
      </section>
      <p className="-mt-2 text-xs text-chalk-soft">
        At the end of the season these orders would take {view.assignment.points} points from the rack as it stands.
      </p>
      <Rack
        game={game}
        memories={view.memories}
        occupants={view.occupants}
        highlights={{
          previewCell: preview?.cell ?? null,
          freshByClothId: view.freshByClothId,
          shippingCells: view.shippingCells,
          focusedClothId,
          kinCells: kinCellsOf(game, focusedClothId),
        }}
        canHang={selectedClothId !== null}
        onTapPeg={onTapPeg}
        onTapCloth={(clothId) => setTappedClothId((current) => (current === clothId ? null : clothId))}
      />
      {focusedClothId !== null && game.display.some(isBolt) && <KinNote game={game} clothId={focusedClothId} />}
      <ActionHint game={game} selectedClothId={selectedClothId} preview={preview} onConfirm={onConfirm} />
      <Hand game={game} selectedClothId={selectedClothId} onSelect={onSelectCloth} />
    </div>
  );
}

function kinCellsOf(game: GameState, clothId: number | null): Set<number> {
  const cells = new Set<number>();
  if (clothId === null) return cells;
  game.rack.forEach((otherId, cell) => {
    if (otherId !== null && otherId !== clothId && areKin(game, clothId, otherId)) cells.add(cell);
  });
  return cells;
}

/** Bolts need two kin cloths, so say plainly who a cloth has shared dye with and where they are. */
function KinNote({ game, clothId }: { game: GameState; clothId: number }) {
  const kin = game.cloths.filter((other) => other.id !== clothId && !other.isShipped && areKin(game, clothId, other.id));
  const whereIs = (otherId: number) => (game.rack.includes(otherId) ? 'on the rack' : game.hand.includes(otherId) ? 'in hand' : 'in the basket');
  return (
    <p className="-mt-2 text-sm text-chalk-soft">
      {kin.length === 0
        ? `${clothName(clothId)} hasn't shared dye with any cloth you still own.`
        : `${clothName(clothId)} has shared dye with ${kin.map((other) => `${clothName(other.id)} (${whereIs(other.id)})`).join(', ')}.`}
    </p>
  );
}

function isOrderLeaving(game: GameState, order: PostedOrder): boolean {
  const lifetime = game.config.orderLifetimeInspections;
  return lifetime !== null && inspectionsSeen(order, game.season) >= lifetime;
}

interface ActionHintProps {
  game: GameState;
  selectedClothId: number | null;
  preview: Move | null;
  onConfirm: () => void;
}

function ActionHint({ game, selectedClothId, preview, onConfirm }: ActionHintProps) {
  if (preview) {
    const dyes = game.cloths[preview.clothId].dyes;
    const bleed = dyes[dyes.length - 1];
    const soakedCount = soakedBy(game, preview.cell).length;
    return (
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm">
          {soakedCount === 0
            ? `${clothName(preview.clothId)} touches nothing here.`
            : `${clothName(preview.clothId)} bleeds ${dyeLook(bleed).name.toLowerCase()} into ${soakedCount} ${soakedCount === 1 ? 'cloth' : 'cloths'}.`}
        </p>
        <button type="button" onClick={onConfirm} className="rounded-sm bg-weld px-4 py-2 font-semibold text-slate-deep">
          Hang it
        </button>
      </div>
    );
  }
  const message =
    selectedClothId === null
      ? 'Pick up a cloth from your hand.'
      : `Tap an empty peg to see what ${clothName(selectedClothId)} would bleed.`;
  return <p className="min-h-10 text-sm text-chalk-soft">{message}</p>;
}
