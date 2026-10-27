import type { RulesConfig } from '../engine/config.ts';
import { BLUE, RED, YELLOW } from '../engine/shades.ts';
import { Stripes } from './Stripes.tsx';

interface RulesSheetProps {
  config: RulesConfig;
  onClose: () => void;
}

function Example({ before, after, caption }: { before: (0 | 1 | 2)[]; after: (0 | 1 | 2)[]; caption: string }) {
  return (
    <figure className="flex items-center gap-2">
      <div className="cloth-hem h-16 w-12 overflow-hidden bg-cloth">
        <Stripes bands={before} capacity={3} compact />
      </div>
      <span aria-hidden className="text-chalk-soft">then</span>
      <div className="cloth-hem h-16 w-12 overflow-hidden bg-cloth">
        <Stripes bands={after} capacity={3} freshCount={0} compact />
      </div>
      <figcaption className="flex-1 text-sm text-chalk-soft">{caption}</figcaption>
    </figure>
  );
}

export function RulesSheet({ config, onClose }: RulesSheetProps) {
  const { targetScore, seasons, displaySize, orderLifetimeInspections, soaksOncePerSeason } = config;
  const hasBolts = config.orderCatalogue.some((spec) => spec.requirement.kind === 'bolt');
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate" role="dialog" aria-modal aria-labelledby="rules-title">
      <article className="mx-auto max-w-prose px-4 py-6 leading-relaxed">
        <h2 id="rules-title" className="text-3xl font-extrabold">How to dye</h2>
        <p className="mt-3">
          You run a dye house with 18 cloths. Each cloth remembers the last three dyes that soaked into it, drawn as
          stripes: oldest at the top, newest at the hem.
        </p>

        <h3 className="mt-6 text-lg font-semibold">Hanging</h3>
        <p className="mt-1">
          Pick a cloth from your hand and hang it on an empty peg. A wet cloth bleeds its newest stripe (the one with
          the drip) into every cloth directly above, below, left or right of it. The wet cloth itself does not change.
        </p>
        {soaksOncePerSeason && (
          <p className="mt-2">
            A cloth takes only <strong>one stripe per season</strong>: the first neighbour hung beside it after it decides
            the stripe, and from then on it is marked soaked and ignores further bleeds until next season. So a cloth's
            stripes are written one season at a time.
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2">
          <Example before={[BLUE]} after={[BLUE, RED]} caption="A blue cloth next to a newly hung red one gains a red stripe." />
          <Example
            before={[BLUE, YELLOW, YELLOW]}
            after={[YELLOW, YELLOW, RED]}
            caption="A full cloth loses its oldest stripe to make room."
          />
        </div>

        <h3 className="mt-6 text-lg font-semibold">Orders and inspection</h3>
        <p className="mt-1">
          {displaySize} orders are on display. Each shows the stripes a merchant wants, lined up with the hem; a hatched
          band takes any dye. When the rack is full (or your hand runs out) the season ends: each order takes one
          matching cloth, you score its points, and that cloth leaves for good.
        </p>
        {hasBolts && (
          <p className="mt-2">
            Some orders show two cloths side by side: a <strong>bolt</strong>. It wants two cloths that have shared dye
            with each other at some point in the game (one bled into the other), both ending in the stripes shown. Cloths
            never forget who they've shared dye with. Tap a cloth on the rack to see its kin.
          </p>
        )}
        <p className="mt-2">
          {orderLifetimeInspections === null
            ? 'Filled orders are replaced; unfilled ones wait.'
            : `An order still unfilled after ${orderLifetimeInspections} inspections is withdrawn (it shows "last season" with a red dashed edge). There are more orders than you have cloths, so choose which to chase and which to let go.`}
        </p>
        <p className="mt-2">
          Every other cloth goes back in the basket keeping its stripes, so this season's work becomes next season's
          hand. Orders outlined in yellow would be filled if the season ended now.
        </p>

        <h3 className="mt-6 text-lg font-semibold">Winning</h3>
        <p className="mt-1">
          Play {seasons} seasons. Reach {targetScore} points to win.
        </p>

        <button type="button" onClick={onClose} className="mt-8 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          Back to the rack
        </button>
      </article>
    </div>
  );
}
