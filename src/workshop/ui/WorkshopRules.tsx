import type { WorkshopConfig } from '../engine.ts';

/** Rules as a normal page (not an overlay), so it reflows and zooms like any web page on a phone. */
export function WorkshopRules({ config, par, onClose }: { config: WorkshopConfig; par: number; onClose: () => void }) {
  return (
    <article className="text-[17px] leading-relaxed">
      <h2 className="text-3xl font-extrabold">How it works</h2>
      <p className="mt-3">
        A puzzle in the dye workshop. You have {config.clothCount} blank cloths, and each must end up including a
        pattern. Do it in as few sprays as you can: this puzzle's par is {par}.
      </p>

      <h3 className="mt-6 text-xl font-semibold">The bench</h3>
      <ul className="mt-1 list-disc space-y-1 pl-6">
        <li>Tap a cloth's card to pick it up: it goes on top, in the middle of the bench. Cards with a gold edge are on the bench.</li>
        <li>Drag it to move it. The buttons under the bench turn it 15°, put it on top, or take it off the bench.</li>
        <li>A cloth lying on another keeps the dye off it, exactly to its edge.</li>
      </ul>

      <h3 className="mt-6 text-xl font-semibold">Spraying</h3>
      <p className="mt-1">
        Choose red, yellow or blue and spray. Every cloth on the bench takes the dye wherever you can see it from above;
        it covers whatever colour was there. Cloths off the bench are untouched, so a finished cloth is safe off the bench.
      </p>

      <h3 className="mt-6 text-xl font-semibold">What a cloth must include</h3>
      <p className="mt-1">
        Each card shows the cloth as it is now (left) and the regions it must include (right): halves, corners,
        stripes, the centre, in a colour (bare cloth counts as a colour). Hatched parts can be anything. The picture may be
        turned or flipped any way. A region counts once {Math.round(config.metThreshold * 100)}% of it is the right colour;
        the card shows how close the cloth is.
      </p>

      <h3 className="mt-6 text-xl font-semibold">Score</h3>
      <p className="mt-1">
        Like minigolf: sprays against par. One under is a birdie, one over a bogey. Start over whenever you like.
      </p>

      <button type="button" onClick={onClose} className="mt-8 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
        To the workshop
      </button>
    </article>
  );
}
