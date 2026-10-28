import { useState } from 'react';
import { BLUE, RED, YELLOW, type Dye } from '../../engine/shades.ts';
import { formatLogForExport } from '../../ui/gameLog.ts';
import { MenuSheet } from '../../ui/MenuSheet.tsx';
import { RULES_V10 } from '../config.ts';
import { scoreQuilt } from '../scoring.ts';
import { Bench } from './Bench.tsx';
import { ClothsSheet } from './ClothsSheet.tsx';
import { draftGain, QuiltView, ScoreLine } from './QuiltView.tsx';
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
  const session = useWorkshopSession(RULES_V10);
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
        <p className="flex-1 text-chalk-soft">{game.isOver ? 'Finished' : `Round ${game.round + 1} of ${game.config.rounds}`}</p>
        <p className="text-right">
          <span className="text-2xl font-extrabold">{scoreQuilt(game).total}</span>
          <span className="text-chalk-soft"> points</span>
        </p>
        <button type="button" onClick={() => open('menu')} className="rounded-sm border border-slate-line px-3 py-2">
          Menu
        </button>
      </header>

      {view === 'rules' ? (
        <WorkshopRules config={game.config} onClose={() => setView('game')} />
      ) : game.isOver ? (
        <FinalQuilt session={session} onMenu={() => open('menu')} />
      ) : (
        <Workshop session={session} />
      )}

      <p className="mt-auto pt-6 text-center text-xs text-chalk-soft">
        Seed {game.seed}, rules {game.config.version}
      </p>

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
  const { game, layout, selectedClothId, quiltDraft } = session;
  const [dye, setDye] = useState<Dye | null>(null);
  const isOnBench = (clothId: number) => layout.some((placement) => placement.clothId === clothId);
  const selectedIsLaidOut = selectedClothId !== null && isOnBench(selectedClothId);

  return (
    <div className="flex flex-col gap-4">
      <Bench
        game={game}
        layout={layout}
        selectedClothId={selectedClothId}
        onSelect={session.select}
        onMove={session.moveTo}
      />

      {selectedClothId !== null && quiltDraft === null && (
        <div className="flex flex-wrap gap-2">
          {selectedIsLaidOut && (
            <>
              <button type="button" onClick={() => session.rotate(selectedClothId, -1)} className="rounded-sm border border-slate-line px-3 py-2">
                Turn left 15°
              </button>
              <button type="button" onClick={() => session.rotate(selectedClothId, 1)} className="rounded-sm border border-slate-line px-3 py-2">
                Turn right 15°
              </button>
              <button type="button" onClick={() => session.bringToTop(selectedClothId)} className="rounded-sm border border-slate-line px-3 py-2">
                Put on top
              </button>
              <button type="button" onClick={() => session.takeOff(selectedClothId)} className="rounded-sm border border-slate-line px-3 py-2">
                Take off the bench
              </button>
            </>
          )}
          <button type="button" onClick={() => session.startQuilting(selectedClothId)} className="rounded-sm border border-weld px-3 py-2 font-semibold text-weld">
            Sew into the quilt
          </button>
        </div>
      )}

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

      {quiltDraft === null && (game.hasSprayed ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-40 flex-1 text-chalk-soft">Sprayed. Move the cloths around to see what each got, sew any finished one into the quilt, then end the round.</p>
          <button type="button" onClick={session.endRound} className="rounded-sm bg-weld px-5 py-3 font-semibold text-slate-deep">
            End the round
          </button>
        </div>
      ) : (
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
      ))}

      <QuiltSection session={session} />
    </div>
  );
}

function QuiltSection({ session }: { session: WorkshopSession }) {
  const { game, quiltDraft } = session;
  const gain = draftGain(game, quiltDraft);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">Quilt</h2>
      {quiltDraft !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-40 flex-1">{quiltDraft.slot === null ? 'Tap an empty square.' : `Sewn here: ${gain !== null && gain >= 0 ? '+' : ''}${gain} points.`}</p>
          {quiltDraft.slot !== null && (
            <>
              <button type="button" onClick={session.turnDraft} className="rounded-sm border border-slate-line px-3 py-2">
                Turn it
              </button>
              <button type="button" onClick={session.sewDraft} className="rounded-sm bg-weld px-4 py-2 font-semibold text-slate-deep">
                Sew it in
              </button>
            </>
          )}
          <button type="button" onClick={session.cancelQuilting} className="rounded-sm border border-slate-line px-3 py-2">
            Cancel
          </button>
        </div>
      )}
      <QuiltView game={game} draft={quiltDraft} onChooseSlot={session.chooseSlot} />
      <ScoreLine score={scoreQuilt(game)} label="Quilt so far" />
    </section>
  );
}

function FinalQuilt({ session, onMenu }: { session: WorkshopSession; onMenu: () => void }) {
  const { game } = session;
  return (
    <section className="flex flex-col gap-3 py-4">
      <h2 className="text-4xl font-extrabold">{game.quilt.every((patch) => patch !== null) ? 'The quilt is finished.' : 'Out of rounds.'}</h2>
      <QuiltView game={game} draft={null} onChooseSlot={() => {}} />
      <ScoreLine score={scoreQuilt(game)} label="Final score" />
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
