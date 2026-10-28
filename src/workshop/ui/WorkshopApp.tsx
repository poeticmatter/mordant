import { useState } from 'react';
import { BLUE, RED, YELLOW, type Dye } from '../../engine/shades.ts';
import { formatLogForExport } from '../../ui/gameLog.ts';
import { MenuSheet } from '../../ui/MenuSheet.tsx';
import { RULES_V11 } from '../config.ts';
import { openCommissions, totalStars } from '../engine.ts';
import { Bench } from './Bench.tsx';
import { ClothsSheet } from './ClothsSheet.tsx';
import { CommissionBoard, DeliverySheet } from './CommissionBoard.tsx';
import { Swatch } from './Swatch.tsx';
import { useWorkshopSession, type WorkshopSession } from './useWorkshopSession.ts';
import { workshopMoveCodec } from './workshopMoveCodec.ts';
import { WorkshopRules } from './WorkshopRules.tsx';

type View = 'game' | 'rules' | 'menu' | 'cloths';

const DYE_BUTTONS: { dye: Dye; name: string; className: string }[] = [
  { dye: RED, name: 'Red', className: 'bg-madder text-cloth' },
  { dye: YELLOW, name: 'Yellow', className: 'bg-weld text-slate-deep' },
  { dye: BLUE, name: 'Blue', className: 'bg-woad text-cloth' },
];

export function WorkshopApp() {
  const session = useWorkshopSession(RULES_V11);
  const { game, pendingDelivery } = session;
  const [view, setView] = useState<View>(() => (session.logs.at(-1)?.moves.length ? 'game' : 'rules'));

  function open(next: View) {
    session.recordEvent(`open-${next}`);
    setView(next);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
      <header className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Selvedge</h1>
        <p className="flex-1 text-chalk-soft">{game.isOver ? 'Finished' : `Round ${game.round + 1} of ${game.config.rounds}`}</p>
        <p className="text-right">
          <span className="text-2xl font-extrabold">{totalStars(game)}</span>
          <span className="text-chalk-soft"> ★</span>
        </p>
        <button type="button" onClick={() => open('menu')} className="rounded-sm border border-slate-line px-3 py-2">
          Menu
        </button>
      </header>

      {view === 'rules' ? (
        <WorkshopRules config={game.config} onClose={() => setView('game')} />
      ) : game.isOver ? (
        <FinalTally session={session} onMenu={() => open('menu')} />
      ) : (
        <Workshop session={session} />
      )}

      <p className="mt-auto pt-6 text-center text-xs text-chalk-soft">
        Seed {game.seed}, rules {game.config.version}
      </p>

      {pendingDelivery && (
        <DeliverySheet game={game} {...pendingDelivery} onConfirm={session.confirmDelivery} onCancel={session.cancelDelivery} />
      )}
      {view === 'cloths' && <ClothsSheet game={game} onClose={() => setView('game')} />}
      {view === 'menu' && (
        <MenuSheet
          seed={game.seed}
          exportText={formatLogForExport(session.logs, workshopMoveCodec)}
          finishedCount={session.logs.filter((log) => log.finalScore !== null).length}
          deckLabel="Your cloths"
          onNewGame={(seed) => {
            session.newGame(seed);
            setView('game');
          }}
          onOpenRules={() => open('rules')}
          onOpenDeck={() => open('cloths')}
          onClose={() => setView('game')}
        />
      )}
    </div>
  );
}

function Workshop({ session }: { session: WorkshopSession }) {
  const { game, layout, selectedClothId } = session;
  const isOnBench = (clothId: number) => layout.some((placement) => placement.clothId === clothId);

  return (
    <div className="flex flex-col gap-4">
      <CommissionBoard game={game} selectedClothId={selectedClothId} onChoose={session.proposeDelivery} />
      {selectedClothId !== null && openCommissions(game).length > 0 && (
        <p className="-mt-2 text-xs text-chalk-soft">Each open commission shows how the selected cloth matches it now. Tap one to deliver.</p>
      )}

      <Bench game={game} layout={layout} selectedClothId={selectedClothId} onSelect={session.select} onMove={session.moveTo} />

      {selectedClothId !== null && isOnBench(selectedClothId) && <PlacementControls session={session} clothId={selectedClothId} />}

      <section aria-label="Drawn this round">
        <h2 className="font-semibold">
          Drawn this round <span className="font-normal text-chalk-soft">tap to lay out or select</span>
        </h2>
        <ul className="mt-2 grid grid-cols-4 gap-2">
          {game.bench.map((clothId) => (
            <li key={clothId}>
              <button
                type="button"
                onClick={() => (isOnBench(clothId) ? session.select(clothId) : session.layOut(clothId))}
                aria-pressed={clothId === selectedClothId}
                className={`w-full rounded-sm p-1.5 ${clothId === selectedClothId ? 'bg-slate-raised outline-2 outline-chalk' : 'bg-slate-deep'}`}
              >
                <Swatch cloth={game.cloths[clothId]} size={game.config.clothSize} label={`Cloth ${clothId + 1}`} />
                <span className="mt-1 block text-xs text-chalk-soft">{isOnBench(clothId) ? 'on the bench' : 'in hand'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <SprayBar session={session} />
    </div>
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
  const { game, layout } = session;
  const [dye, setDye] = useState<Dye | null>(null);
  if (game.hasSprayed) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-40 flex-1 text-chalk-soft">Sprayed. Move cloths apart to see what each got, deliver any that are ready, then end the round.</p>
        <button type="button" onClick={session.endRound} className="rounded-sm bg-weld px-5 py-3 font-semibold text-slate-deep">
          End the round
        </button>
      </div>
    );
  }
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
      <button type="button" onClick={session.endRound} className="ml-auto text-sm text-chalk-soft underline underline-offset-2">
        Skip spraying
      </button>
    </div>
  );
}

function FinalTally({ session, onMenu }: { session: WorkshopSession; onMenu: () => void }) {
  const { game } = session;
  const maxStars = game.commissions.length * 3;
  return (
    <section className="flex flex-col gap-3 py-4">
      <h2 className="text-4xl font-extrabold">
        {totalStars(game)} of {maxStars} stars
      </h2>
      <CommissionBoard game={game} selectedClothId={null} onChoose={() => {}} />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onMenu} className="flex-1 rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          Copy the log
        </button>
        <button type="button" onClick={() => session.newGame()} className="flex-1 rounded-sm bg-slate-raised py-3 font-semibold">
          New game
        </button>
      </div>
    </section>
  );
}
