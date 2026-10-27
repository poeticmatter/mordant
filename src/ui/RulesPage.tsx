import { BLUE, RED, YELLOW } from '../engine/shades.ts';
import { BROWN, mixOf, type ClothLook, type TagsConfig } from '../selvedge/tags/engine.ts';
import { ClothTile } from './ClothTile.tsx';

const PLAIN_RED = mixOf(RED);
const PLAIN_BLUE = mixOf(BLUE);
const PURPLE = mixOf(RED) | mixOf(BLUE);
const ORANGE = mixOf(RED) | mixOf(YELLOW);

const RED_BESIDE_BLUE: ClothLook = { body: RED, tag: [PLAIN_RED, PLAIN_RED, ORANGE, PURPLE], edges: [PLAIN_RED, PURPLE, PLAIN_RED, PLAIN_RED] };
const BLUE_BESIDE_RED: ClothLook = { body: BLUE, tag: [PLAIN_BLUE, PLAIN_BLUE, PLAIN_BLUE, PURPLE], edges: [PLAIN_BLUE, PLAIN_BLUE, PLAIN_BLUE, PURPLE] };
const SPOILED_RED: ClothLook = { body: RED, tag: [PLAIN_RED, PLAIN_RED, ORANGE, PURPLE], edges: [PLAIN_RED, BROWN, PLAIN_RED, ORANGE] };

function Example({ caption, looks }: { caption: string; looks: readonly ClothLook[] }) {
  return (
    <figure className="mt-3 flex items-center gap-4">
      <div className="flex w-36 shrink-0 gap-1">
        {looks.map((look, index) => (
          <div key={index} className="w-16">
            <ClothTile look={look} size="small" />
          </div>
        ))}
      </div>
      <figcaption className="text-base text-chalk-soft">{caption}</figcaption>
    </figure>
  );
}

/** Rules as a normal page (not an overlay), so it reflows and zooms like any web page on a phone. */
export function RulesPage({ config, onClose }: { config: TagsConfig; onClose: () => void }) {
  const clothCount = config.clothsPerDye * 3;
  return (
    <article className="text-[17px] leading-relaxed">
      <h2 className="text-3xl font-extrabold">How it works</h2>
      <p className="mt-3">
        Your deck is {clothCount} cloths. Each carries a tag: the colours its customer wants on its four edges. Ship{' '}
        {config.shipTarget} of them within {config.seasons} seasons.
      </p>

      <h3 className="mt-6 text-xl font-semibold">Touching cloths mix their dyes</h3>
      <p className="mt-1">
        A cloth's centre is its own colour; its frame shows what each edge has become. Every edge starts plain, in the
        cloth's own colour. Hang a cloth on an empty peg: wherever it touches another cloth, both touching edges mix the
        two colours.
      </p>
      <Example caption="Red hung beside blue: the edges they share both turn purple." looks={[RED_BESIDE_BLUE, BLUE_BESIDE_RED]} />
      <p className="mt-3">
        Red and yellow make orange, yellow and blue make green. Edges against the rack's frame, beside an empty peg or
        beside a cloth of the same colour stay as they are.
      </p>

      <h3 className="mt-6 text-xl font-semibold">Tags</h3>
      <p className="mt-1">
        The chips under a cloth are its tag: one per edge, on any sides. A filled chip is an edge the cloth already has.
        Plain chips mean edges the customer wants left plain. The blue cloth above is ready: one purple edge, three plain.
      </p>

      <h3 className="mt-6 text-xl font-semibold">Dye only builds up</h3>
      <p className="mt-1">
        Edges never lose colour. A third dye on a mixed edge turns it brown, and nobody wants brown. A cloth with more
        edges of a colour than its tag asks for, or any brown edge, is spoiled for good. It can still dye others.
      </p>
      <Example caption="Spoiled: a brown edge. It wanted one purple and one orange." looks={[SPOILED_RED]} />
      {config.allowsTurning && (
        <p className="mt-3">
          Cloths are square: after picking a peg, press <strong>Turn it</strong> to choose which edge faces which way.
        </p>
      )}

      <h3 className="mt-6 text-xl font-semibold">Inspection</h3>
      <p className="mt-1">
        The season ends when the rack is full, when your hand runs out, or when you press <strong>Inspect now</strong>.
        Every cloth whose four edges match its tag ships and leaves the deck. The rest go back in the basket with their
        colours, and you draw them again next season.
      </p>

      {config.allowsSettingAside && (
        <>
          <h3 className="mt-6 text-xl font-semibold">Setting a cloth aside</h3>
          <p className="mt-1">
            Instead of hanging the cloth you picked, you can set it aside for good and draw another. It never comes back.
          </p>
        </>
      )}

      <button type="button" onClick={onClose} className="mt-8 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
        Back to the rack
      </button>
    </article>
  );
}
