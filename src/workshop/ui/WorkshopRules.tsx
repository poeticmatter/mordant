import type { WorkshopConfig } from '../engine.ts';

/** Rules as a normal page (not an overlay), so it reflows and zooms like any web page on a phone. */
export function WorkshopRules({ config, onClose }: { config: WorkshopConfig; onClose: () => void }) {
  const quiltSize = config.quiltWidth * config.quiltHeight;
  return (
    <article className="text-[17px] leading-relaxed">
      <h2 className="text-3xl font-extrabold">How it works</h2>
      <p className="mt-3">
        Your deck is {config.clothCount} blank cloths. Over {config.rounds} rounds, dye patterns into them and sew them
        into a quilt of {quiltSize} squares.
      </p>

      <h3 className="mt-6 text-xl font-semibold">Each round</h3>
      <ol className="mt-1 list-decimal space-y-1 pl-6">
        <li>Draw {config.handSize} cloths.</li>
        <li>
          Lay any of them on the bench: tap one to put it down, drag to move it, turn it in 15° steps. A cloth you put down
          later lies on top.
        </li>
        <li>
          Spray one dye: red, yellow or blue. Everything you can see from above takes the dye. Whatever is covered by a
          cloth on top stays as it was. Afterwards you can still drag cloths apart to see what each one got.
        </li>
        <li>Sew any cloth you're happy with into the quilt (you can do this at any time in the round).</li>
        <li>End the round. Cloths not in the quilt are shuffled back into the deck with their patterns.</li>
      </ol>

      <h3 className="mt-6 text-xl font-semibold">Dyes mix</h3>
      <p className="mt-1">
        Red and yellow make orange, yellow and blue make green, red and blue make purple. All three make brown. Dye never
        washes out.
      </p>

      <h3 className="mt-6 text-xl font-semibold">The quilt</h3>
      <p className="mt-1">
        A cloth goes into any empty square, turned a quarter at a time, and stays there. The game ends when the quilt is
        full or after round {config.rounds}.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>
          <strong>Seams:</strong> each seam between two squares has {config.stitchesPerSeam} stitches; 1 point for every
          stitch where both sides share a colour. Undyed and brown never count.
        </li>
        <li>
          <strong>Colourful squares:</strong> {config.colourfulBonus} points for each square showing at least{' '}
          {config.colourfulMinimum} different dyed colours.
        </li>
      </ul>

      <button type="button" onClick={onClose} className="mt-8 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
        To the workshop
      </button>
    </article>
  );
}
