import type { WorkshopConfig } from '../engine.ts';

/** Rules as a normal page (not an overlay), so it reflows and zooms like any web page on a phone. */
export function WorkshopRules({ config, onClose }: { config: WorkshopConfig; onClose: () => void }) {
  const [oneStar, twoStars, threeStars] = config.starThresholds.map((threshold) => Math.round(threshold * 100));
  return (
    <article className="text-[17px] leading-relaxed">
      <h2 className="text-3xl font-extrabold">How it works</h2>
      <p className="mt-3">
        You have {config.clothCount} blank cloths and {config.commissionCount} commissions, each a picture of the cloth a
        customer wants. Over {config.rounds} rounds, dye patterns into your cloths and deliver one to each commission.
      </p>

      <h3 className="mt-6 text-xl font-semibold">Each round</h3>
      <ol className="mt-1 list-decimal space-y-1 pl-6">
        <li>Draw {config.handSize} cloths.</li>
        <li>
          Lay any of them on the bench: tap one to put it down, drag to move it, turn it in 15° steps. A cloth you put down
          later lies on top.
        </li>
        <li>
          Spray one dye: red, yellow or blue. Everything you can see from above takes the dye and covers whatever colour was
          there. Whatever lies under another cloth stays as it was. Afterwards you can drag cloths apart to look.
        </li>
        <li>Deliver any cloth that's ready, at any time in the round.</li>
        <li>End the round. Cloths you haven't delivered are shuffled back with their patterns.</li>
      </ol>

      <h3 className="mt-6 text-xl font-semibold">Commissions</h3>
      <p className="mt-1">
        Select a cloth and every open commission shows how well it matches right now. Tap one to deliver: the cloth leaves
        the game and the commission is scored.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>
          <strong>Quilt blocks</strong> want that picture in those colours (bare cloth counts as a colour), turned or flipped
          any way.
        </li>
        <li>
          <strong>Mostly one colour</strong> wants that dye over at least half the cloth.
        </li>
        <li>
          <strong>Mirror image</strong> wants the cloth to look the same reflected across a straight line through its middle,
          in at least two colours.
        </li>
        <li>
          <strong>Kept apart</strong> wants two dyes, each on a fifth of the cloth or more, never touching.
        </li>
      </ul>
      <p className="mt-2">
        Stars: {oneStar}% match for ★, {twoStars}% for ★★, {threeStars}% for ★★★. The game ends when every commission is
        delivered or after round {config.rounds}.
      </p>

      <button type="button" onClick={onClose} className="mt-8 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
        To the workshop
      </button>
    </article>
  );
}
