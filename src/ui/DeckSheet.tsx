import type { GameState } from '../engine/game.ts';
import { ClothSwatch } from './ClothSwatch.tsx';
import { clothName } from './dyeLook.ts';

interface DeckSheetProps {
  game: GameState;
  onClose: () => void;
}

function whereIs(game: GameState, clothId: number): string {
  if (game.cloths[clothId].isShipped) return 'shipped';
  if (game.hand.includes(clothId)) return 'in hand';
  if (game.rack.includes(clothId)) return 'on the rack';
  return 'in the basket';
}

const PLACE_ORDER = ['in hand', 'on the rack', 'in the basket', 'shipped'];

/** Every cloth you own and where it is. The basket's order stays hidden. */
export function DeckSheet({ game, onClose }: DeckSheetProps) {
  const cloths = game.cloths
    .map((cloth) => ({ cloth, place: whereIs(game, cloth.id) }))
    .sort((a, b) => PLACE_ORDER.indexOf(a.place) - PLACE_ORDER.indexOf(b.place) || clothName(a.cloth.id).localeCompare(clothName(b.cloth.id)));
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate" role="dialog" aria-modal aria-labelledby="deck-title">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h2 id="deck-title" className="text-2xl font-extrabold">Your cloths</h2>
        <p className="mt-1 text-sm text-chalk-soft">The basket is shuffled; you know what's in it, not the order.</p>
        <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {cloths.map(({ cloth, place }) => (
            <li key={cloth.id} className={`flex flex-col ${place === 'shipped' ? 'opacity-40' : ''}`}>
              <div className="h-24">
                <ClothSwatch clothId={cloth.id} dyes={cloth.dyes} capacity={game.config.memoryCapacity} />
              </div>
              <span className="mt-1 text-center text-[11px] text-chalk-soft">{place}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          Back to the rack
        </button>
      </div>
    </div>
  );
}
