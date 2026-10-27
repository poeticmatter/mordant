import { BLUE, RED, YELLOW } from '../engine/shades.ts';
import type { SelvedgeConfig } from '../selvedge/engine.ts';
import { ClothTile, CommissionTile } from './ClothTile.tsx';

function Pair({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="mt-3 flex items-center gap-4">
      <div className="flex w-36 shrink-0 gap-1">{children}</div>
      <figcaption className="text-base text-chalk-soft">{caption}</figcaption>
    </figure>
  );
}

/** Rules as a normal page (not an overlay), so it reflows and zooms like any web page on a phone. */
export function RulesPage({ config, onClose }: { config: SelvedgeConfig; onClose: () => void }) {
  const commissionCount = config.fixedEdgesPerCommission.length;
  return (
    <article className="text-[17px] leading-relaxed">
      <h2 className="text-3xl font-extrabold">How it works</h2>
      <p className="mt-3">
        Fill all {commissionCount} commissions in the pattern book within {config.seasons} seasons. Each wants a cloth of
        one colour with particular stains on particular edges.
      </p>

      <h3 className="mt-6 text-xl font-semibold">Cloths that touch stain each other</h3>
      <p className="mt-1">
        Each cloth has its own colour (the centre) and four edges (the frame). Hang a cloth on an empty peg: wherever it
        touches another cloth, both touching edges take the other cloth's colour.
      </p>
      <Pair caption="A red cloth hung beside a blue one: the red gets a blue edge, the blue gets a red edge.">
        <div className="w-16">
          <ClothTile body={RED} edges={[null, BLUE, null, null]} size="small" />
        </div>
        <div className="w-16">
          <ClothTile body={BLUE} edges={[null, null, null, RED]} size="small" />
        </div>
      </Pair>
      <p className="mt-3">
        A new stain covers the old one. Edges against the rack's frame, or next to an empty peg, aren't touched.
      </p>

      <h3 className="mt-6 text-xl font-semibold">Inspection</h3>
      <p className="mt-1">
        The season ends when the rack is full, when your hand runs out, or when you press <strong>Inspect now</strong>.
        Every cloth that matches an open commission fills it and leaves. Dashed sides of a commission take anything.
      </p>
      <Pair caption="This commission wants a yellow cloth with a red top edge. The other sides don't matter.">
        <div className="w-16">
          <CommissionTile body={YELLOW} edges={[RED, null, null, null]} />
        </div>
      </Pair>

      <h3 className="mt-6 text-xl font-semibold">Stains last</h3>
      <p className="mt-1">
        Cloths that don't leave go back in the basket with their stains, and you draw them again next season. A cloth
        hung in a corner keeps the two edges facing the frame exactly as they are.
      </p>

      <button type="button" onClick={onClose} className="mt-8 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
        Back to the rack
      </button>
    </article>
  );
}
