import { useState } from 'react';
import { BLUE, RED, YELLOW, type Dye } from '../../engine/shades.ts';
import { formatLogForExport } from '../../ui/gameLog.ts';
import { MenuSheet } from '../../ui/MenuSheet.tsx';
import { RULES_V12 } from '../config.ts';
import { isClothDone, parName, progressOf, scoreToPar } from '../engine.ts';
import { Bench } from './Bench.tsx';
import { ObjectiveIcon } from './ObjectiveIcon.tsx';
import { Swatch } from './Swatch.tsx';
import { useWorkshopSession, type WorkshopSession } from './useWorkshopSession.ts';
import { workshopMoveCodec } from './workshopMoveCodec.ts';
import { WorkshopRules } from './WorkshopRules.tsx';

type View = 'game' | 'rules' | 'menu';

const DYE_BUTTONS: { dye: Dye; name: string; className: string }[] = [
  { dye: RED, name: 'Red', className: 'bg-madder text-cloth' },
  { dye: YELLOW, name: 'Yellow', className: 'bg-weld text-slate-deep' },
  { dye: BLUE, name: 'Blue', className: 'bg-woad text-cloth' },
];

export function WorkshopApp() {
  const session = useWorkshopSession(RULES_V12);
  const { game } = session;
  const [view, setView] = useState<View>(() => (session.logs.at(-1)?.moves.length ? 'game' : 'rules'));

  function open(next: View) {
    session.recordEvent(`open-${next}`);
    setView(next);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
      <header className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Selvedge</h1>
        <p className="flex-1 text-chalk-soft">
          Spray <span className="text-xl font-extrabold text-chalk">{game.strokes}</span>, par {game.puzzle.par}
        </p>
        <button type="button" onClick={() => open('menu')} className="rounded-sm border border-slate-line px-3 py-2">
          Menu
        </button>
      </header>

      {view === 'rules' ? <WorkshopRules config={game.config} par={game.puzzle.par} onClose={() => setView('game')} /> : <Workshop session={session} />}

      <p className="mt-auto pt-6 text-center text-xs text-chalk-soft">
        Puzzle {game.seed}, rules {game.config.version}
      </p>

      {view === 'menu' && (
        <MenuSheet
          seed={game.seed}
          exportText={formatLogForExport(session.logs, workshopMoveCodec)}
          finishedCount={session.logs.filter((log) => log.finalScore !== null).length}
          onNewGame={(seed) => {
            session.newPuzzle(seed);
            setView('game');
          }}
          onOpenRules={() => open('rules')}
          onClose={() => setView('game')}
        />
      )}
    </div>
  );
}

function Workshop({ session }: { session: WorkshopSession }) {
  const { game, layout, selectedClothId } = session;
  return (
    <div className="flex flex-col gap-4">
      {game.isSolved && <SolvedBanner session={session} />}
      <ClothCards session={session} />
      <Bench game={game} layout={layout} selectedClothId={selectedClothId} onSelect={session.select} onMove={session.moveTo} />
      {selectedClothId !== null && session.isOnBench(selectedClothId) && <PlacementControls session={session} clothId={selectedClothId} />}
      {!game.isSolved && <SprayBar session={session} />}
    </div>
  );
}

/** Each cloth beside what it must include. Tap to pick it up (it goes on top of the bench). */
function ClothCards({ session }: { session: WorkshopSession }) {
  const { game, selectedClothId } = session;
  return (
    <section aria-label="Your cloths and what each must include">
      <ul className="grid grid-cols-2 gap-2">
        {game.cloths.map((cloth) => {
          const isDone = isClothDone(game, cloth.id);
          const isSelected = cloth.id === selectedClothId;
          return (
            <li key={cloth.id}>
              <button
                type="button"
                onClick={() => session.pickUp(cloth.id)}
                aria-pressed={isSelected}
                className={`flex w-full flex-col gap-1 rounded-sm p-2 text-left ${isSelected ? 'bg-slate-raised outline-2 outline-chalk' : 'bg-slate-deep'}`}
              >
                <div className="grid grid-cols-2 gap-1.5">
                  <Swatch cloth={cloth} size={game.config.clothSize} label={`Cloth ${cloth.id + 1}`} />
                  <ObjectiveIcon objective={game.puzzle.objectives[cloth.id]} />
                </div>
                <p className="flex justify-between text-xs">
                  <span className="text-chalk-soft">{session.isOnBench(cloth.id) ? 'on the bench' : 'off the bench'}</span>
                  <span className={isDone ? 'font-semibold text-weld' : 'text-chalk-soft'}>{isDone ? 'Done ✓' : `${Math.round(progressOf(game, cloth.id) * 100)}%`}</span>
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-xs text-chalk-soft">
        Left: the cloth now. Right: what it must include, any way round; hatched means anything. Done at {Math.round(game.config.metThreshold * 100)}%.
      </p>
    </section>
  );
}

function PlacementControls({ session, clothId }: { session: WorkshopSession; clothId: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => session.rotate(clothId, -1)} className="rounded-sm border border-slate-line px-3 py-2">
        Turn left 15°
      </button>
      <button type="button" onClick={() => session.rotate(clothId, 1)} className="rounded-sm border border-slate-line px-3 py-2">
        Turn right 15°
      </button>
      <button type="button" onClick={() => session.bringToTop(clothId)} className="rounded-sm border border-slate-line px-3 py-2">
        Put on top
      </button>
      <button type="button" onClick={() => session.takeOff(clothId)} className="rounded-sm border border-slate-line px-3 py-2">
        Take off the bench
      </button>
    </div>
  );
}

function SprayBar({ session }: { session: WorkshopSession }) {
  const { layout } = session;
  const [dye, setDye] = useState<Dye | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DYE_BUTTONS.map((button) => (
        <button
          key={button.dye}
          type="button"
          onClick={() => setDye(button.dye)}
          aria-pressed={dye === button.dye}
          className={`rounded-sm px-4 py-3 font-semibold ${button.className} ${dye === button.dye ? 'outline-3 outline-offset-2 outline-chalk' : 'opacity-80'}`}
        >
          {button.name}
        </button>
      ))}
      <button
        type="button"
        disabled={dye === null || layout.length === 0}
        onClick={() => dye !== null && session.spray(dye)}
        className="rounded-sm border border-weld px-4 py-3 font-semibold text-weld disabled:opacity-40"
      >
        Spray
      </button>
      <button type="button" onClick={session.startOver} className="ml-auto text-sm text-chalk-soft underline underline-offset-2">
        Start over
      </button>
    </div>
  );
}

function SolvedBanner({ session }: { session: WorkshopSession }) {
  const { game } = session;
  const relative = scoreToPar(game);
  return (
    <section className="rounded-sm border border-weld p-3">
      <h2 className="text-3xl font-extrabold">{parName(relative)}</h2>
      <p className="text-chalk-soft">
        All four done in {game.strokes} {game.strokes === 1 ? 'spray' : 'sprays'}, par {game.puzzle.par}.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => session.newPuzzle()} className="flex-1 rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          Next puzzle
        </button>
        <button type="button" onClick={session.startOver} className="flex-1 rounded-sm bg-slate-raised py-3 font-semibold">
          Play it again
        </button>
      </div>
    </section>
  );
}
