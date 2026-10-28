import type { Patch, WorkshopState } from '../engine.ts';
import { scoreQuilt, type QuiltScore } from '../scoring.ts';
import { Swatch } from './Swatch.tsx';
import type { QuiltDraft } from './useWorkshopSession.ts';

interface QuiltViewProps {
  game: WorkshopState;
  draft: QuiltDraft | null;
  onChooseSlot: (slot: number) => void;
}

/** The quilt as it would be with the draft sewn in, so slots and turns can be tried before committing. */
export function quiltWithDraft(game: WorkshopState, draft: QuiltDraft | null): (Patch | null)[] {
  if (draft === null || draft.slot === null) return game.quilt;
  return game.quilt.map((patch, slot) => (slot === draft.slot ? { clothId: draft.clothId, turns: draft.turns } : patch));
}

export function QuiltView({ game, draft, onChooseSlot }: QuiltViewProps) {
  const shown = quiltWithDraft(game, draft);
  return (
    <section aria-label="Quilt">
      <div className="grid gap-[2px] rounded-sm bg-hemp/40 p-[2px]" style={{ gridTemplateColumns: `repeat(${game.config.quiltWidth}, minmax(0, 1fr))` }}>
        {shown.map((patch, slot) => {
          const isFree = game.quilt[slot] === null;
          const isDraftSlot = draft?.slot === slot;
          if (patch !== null) {
            return (
              <button
                key={slot}
                type="button"
                disabled={!isDraftSlot}
                onClick={() => onChooseSlot(slot)}
                className={isDraftSlot ? 'outline-2 outline-offset-1 outline-weld' : ''}
              >
                <Swatch
                  cloth={game.cloths[patch.clothId]}
                  size={game.config.clothSize}
                  turns={patch.turns}
                  label={isDraftSlot ? 'This cloth, sewn here' : `Quilt square ${slot + 1}`}
                />
              </button>
            );
          }
          return (
            <button
              key={slot}
              type="button"
              disabled={draft === null || !isFree}
              onClick={() => onChooseSlot(slot)}
              aria-label={`Empty quilt square ${slot + 1}`}
              className={`aspect-square w-full ${draft !== null ? 'border-2 border-dashed border-weld bg-weld/10' : 'bg-slate-deep'}`}
            />
          );
        })}
      </div>
    </section>
  );
}

export function ScoreLine({ score, label }: { score: QuiltScore; label: string }) {
  return (
    <p className="text-sm text-chalk-soft">
      {label}: <span className="font-semibold text-chalk">{score.total}</span> ({score.seams} matching seam stitches, {score.colourfulSquares} colourful{' '}
      {score.colourfulSquares === 1 ? 'square' : 'squares'})
    </p>
  );
}

export function draftGain(game: WorkshopState, draft: QuiltDraft | null): number | null {
  if (draft === null || draft.slot === null) return null;
  return scoreQuilt(game, quiltWithDraft(game, draft)).total - scoreQuilt(game).total;
}
