import type { GameState } from '../engine/game.ts';
import { ClothSwatch } from './ClothSwatch.tsx';
import { clothName } from './dyeLook.ts';

interface HandProps {
  game: GameState;
  selectedClothId: number | null;
  onSelect: (clothId: number) => void;
}

export function Hand({ game, selectedClothId, onSelect }: HandProps) {
  return (
    <section aria-label="Your hand" className="grid grid-cols-4 gap-2">
      {game.hand.map((clothId) => {
        const cloth = game.cloths[clothId];
        const isSelected = clothId === selectedClothId;
        return (
          <button
            key={clothId}
            type="button"
            onClick={() => onSelect(clothId)}
            aria-pressed={isSelected}
            aria-label={`Pick up ${clothName(clothId)}`}
            className={`h-28 rounded-sm p-1 transition-transform ${isSelected ? '-translate-y-2 bg-slate-raised outline-2 outline-weld' : 'bg-slate-deep'}`}
          >
            <ClothSwatch clothId={clothId} dyes={cloth.dyes} capacity={game.config.memoryCapacity} />
          </button>
        );
      })}
      <div className="flex h-28 flex-col items-center justify-center rounded-sm border border-slate-line text-center text-xs text-chalk-soft">
        <span className="text-2xl font-extrabold text-chalk">{game.drawPile.length}</span>
        in the basket
      </div>
    </section>
  );
}
