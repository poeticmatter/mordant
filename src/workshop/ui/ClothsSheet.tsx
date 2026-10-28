import type { WorkshopState } from '../engine.ts';
import { Swatch } from './Swatch.tsx';

const PLACES = ['drawn this round', 'in the deck', 'in the quilt'] as const;

function placeOf(game: WorkshopState, clothId: number): (typeof PLACES)[number] {
  if (game.cloths[clothId].isQuilted) return 'in the quilt';
  return game.bench.includes(clothId) ? 'drawn this round' : 'in the deck';
}

/** Every cloth with its pattern so far. The deck is shuffled each round: you know what's in it, not the order. */
export function ClothsSheet({ game, onClose }: { game: WorkshopState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-deep/80 sm:items-center" role="dialog" aria-modal aria-label="Your cloths">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-slate p-4 sm:rounded-lg">
        <h2 className="text-xl font-extrabold">Your cloths</h2>
        {PLACES.map((place) => {
          const here = game.cloths.filter((cloth) => placeOf(game, cloth.id) === place);
          if (here.length === 0) return null;
          return (
            <section key={place} className="mt-4">
              <h3 className="font-semibold">{place[0].toUpperCase() + place.slice(1)}</h3>
              <ul className="mt-2 grid grid-cols-5 gap-2">
                {here.map((cloth) => (
                  <li key={cloth.id}>
                    <Swatch cloth={cloth} size={game.config.clothSize} label={`Cloth ${cloth.id + 1}`} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          Back to the workshop
        </button>
      </div>
    </div>
  );
}
