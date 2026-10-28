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

const SMALL_BUTTON = 'rounded-sm border border-slate-line px-2.5 py-2 text-sm disabled:opacity-35';

export function WorkshopApp() {
  const session = useWorkshopSession(RULES_V12);
  const { game } = session;
  const [view, setView] = useState<View>(() => (session.logs.at(-1)?.moves.length ? 'game' : 'rules'));

  function open(next: View) {
    session.recordEvent(`open-${next}`);
    setView(next);
  }

  if (view === 'rules') {
    return (
      <div className="mx-auto max-w-lg px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
        <WorkshopRules config={game.config} par={game.puzzle.par} onClose={() => setView('game')} />
      </div>
    );
  }

  // The whole puzzle fits one phone screen: header, cards and controls take what they need, the bench the rest.
  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col gap-2 overflow-hidden px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">Selvedge</h1>
        <p className="flex-1 text-chalk-soft">
          Spray <span className="text-lg font-extrabold text-chalk">{game.strokes}</span>, par {game.puzzle.par}
        </p>
        <button type="button" onClick={() => open('menu')} className="rounded-sm border border-slate-line px-3 py-1.5">
          Menu
        </button>
      </header>

      <ClothCards session={session} />
      <div className="min-h-0 flex-1">
        <Bench game={game} layout={session.layout} selectedClothId={session.selectedClothId} onSelect={session.select} onMove={session.moveTo} />
      </div>
      <PlacementControls session={session} />
      <SprayBar session={session} />

      {game.isSolved && <SolvedSheet session={session} />}
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

/**
 * One card per cloth: the cloth now, and what it must include (any way round; hatched means anything).
 * Tapping a card picks the cloth up onto the bench. A gold edge marks cloths on the bench.
 */
function ClothCards({ session }: { session: WorkshopSession }) {
  const { game, selectedClothId } = session;
  return (
    <ul aria-label="Your cloths and what each must include" className="grid grid-cols-4 gap-1.5">
      {game.cloths.map((cloth) => {
        const isDone = isClothDone(game, cloth.id);
        const isOnBench = session.isOnBench(cloth.id);
        const isSelected = cloth.id === selectedClothId;
        return (
          <li key={cloth.id}>
            <button
              type="button"
              onClick={() => session.pickUp(cloth.id)}
              aria-pressed={isSelected}
              aria-label={`Cloth ${cloth.id + 1}, ${isOnBench ? 'on the bench' : 'off the bench'}, ${isDone ? 'done' : `${Math.round(progressOf(game, cloth.id) * 100)}%`}`}
              className={`w-full rounded-sm border-2 p-1 ${isOnBench ? 'border-hemp' : 'border-transparent'} ${isSelected ? 'bg-slate-raised outline-2 outline-chalk' : 'bg-slate-deep'}`}
            >
              <div className="grid grid-cols-2 gap-0.5">
                <Swatch cloth={cloth} size={game.config.clothSize} />
                <ObjectiveIcon objective={game.puzzle.objectives[cloth.id]} />
              </div>
              <p className={`mt-0.5 text-center text-[11px] leading-tight ${isDone ? 'font-semibold text-weld' : 'text-chalk-soft'}`}>
                {isDone ? 'Done ✓' : `${Math.round(progressOf(game, cloth.id) * 100)}%`}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Always shown, so the screen doesn't jump; enabled when a cloth on the bench is selected. */
function PlacementControls({ session }: { session: WorkshopSession }) {
  const clothId = session.selectedClothId;
  const isActive = clothId !== null && session.isOnBench(clothId);
  const act = (action: (id: number) => void) => () => clothId !== null && action(clothId);
  return (
    <div className="flex gap-1.5">
      <button type="button" disabled={!isActive} onClick={act((id) => session.rotate(id, -1))} className={SMALL_BUTTON} aria-label="Turn left 15 degrees">
        ⟲ 15°
      </button>
      <button type="button" disabled={!isActive} onClick={act((id) => session.rotate(id, 1))} className={SMALL_BUTTON} aria-label="Turn right 15 degrees">
        ⟳ 15°
      </button>
      <button type="button" disabled={!isActive} onClick={act(session.bringToTop)} className={SMALL_BUTTON}>
        On top
      </button>
      <button type="button" disabled={!isActive} onClick={act(session.takeOff)} className={`${SMALL_BUTTON} ml-auto`}>
        Off the bench
      </button>
    </div>
  );
}

function SprayBar({ session }: { session: WorkshopSession }) {
  const [dye, setDye] = useState<Dye | null>(null);
  const chosen = DYE_BUTTONS.find((button) => button.dye === dye);
  return (
    <div className="flex items-center gap-1.5">
      {DYE_BUTTONS.map((button) => (
        <button
          key={button.dye}
          type="button"
          onClick={() => setDye(button.dye)}
          aria-pressed={dye === button.dye}
          className={`rounded-sm px-3 py-2.5 font-semibold ${button.className} ${dye === button.dye ? 'outline-3 outline-offset-1 outline-chalk' : 'opacity-75'}`}
        >
          {button.name}
        </button>
      ))}
      <button
        type="button"
        disabled={chosen === undefined || session.layout.length === 0 || session.game.isSolved}
        onClick={() => dye !== null && session.spray(dye)}
        className="flex-1 rounded-sm border border-weld px-2 py-2.5 font-semibold text-weld disabled:opacity-35"
      >
        Spray
      </button>
      <button type="button" onClick={session.startOver} className="px-1 text-sm text-chalk-soft underline underline-offset-2">
        Restart
      </button>
    </div>
  );
}

function SolvedSheet({ session }: { session: WorkshopSession }) {
  const { game } = session;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center" role="dialog" aria-label="Puzzle solved">
      <section className="w-full max-w-lg rounded-t-lg border-t-2 border-weld bg-slate p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <h2 className="text-3xl font-extrabold">{parName(scoreToPar(game))}</h2>
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
    </div>
  );
}
