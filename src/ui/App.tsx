import { useState } from 'react';
import { CURRENT_RULES } from '../engine/config.ts';
import { Board } from './Board.tsx';
import { DeckSheet } from './DeckSheet.tsx';
import { InspectionSheet } from './InspectionSheet.tsx';
import { MenuSheet } from './MenuSheet.tsx';
import { RulesSheet } from './RulesSheet.tsx';
import { useGameSession } from './useGameSession.ts';

type Overlay = 'none' | 'menu' | 'rules' | 'deck';

export function App() {
  const session = useGameSession(CURRENT_RULES);
  const { game } = session;
  const [overlay, setOverlay] = useState<Overlay>(() => (session.currentLog.moves.length === 0 ? 'rules' : 'none'));

  function openOverlay(next: Overlay) {
    session.recordEvent(`open-${next}`);
    setOverlay(next);
  }

  const isAwaitingInspection = session.inspection !== null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
      <header className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Mordant</h1>
        <p className="flex-1 text-sm text-chalk-soft">
          {game.isOver ? 'Final' : `Season ${game.season + 1} of ${game.config.seasons}`}
        </p>
        <p className="text-right leading-none">
          <span className="text-2xl font-extrabold">{game.score}</span>
          <span className="text-sm text-chalk-soft"> / {game.config.targetScore}</span>
        </p>
        <button
          type="button"
          onClick={() => openOverlay('menu')}
          className="rounded-sm border border-slate-line px-3 py-1.5 text-sm"
        >
          Menu
        </button>
      </header>

      {game.isOver && !isAwaitingInspection ? (
        <FinalTally score={game.score} target={game.config.targetScore} seed={game.seed} onMenu={() => openOverlay('menu')} onNewGame={() => session.newGame()} />
      ) : (
        <Board
          game={game}
          selectedClothId={session.selectedClothId}
          preview={session.preview}
          lastHang={session.lastHang}
          onSelectCloth={session.selectCloth}
          onTapPeg={session.tapPeg}
          onConfirm={session.confirmPreview}
        />
      )}

      <p className="mt-auto pt-6 text-center text-xs text-chalk-soft">
        Seed {game.seed} · rules {game.config.version}
      </p>

      {session.inspection && <InspectionSheet report={session.inspection} game={game} onContinue={session.dismissInspection} />}
      {overlay === 'rules' && (
        <RulesSheet config={game.config} onClose={() => setOverlay('none')} />
      )}
      {overlay === 'deck' && <DeckSheet game={game} onClose={() => setOverlay('none')} />}
      {overlay === 'menu' && (
        <MenuSheet
          seed={game.seed}
          logs={session.logs}
          onNewGame={(seed) => {
            session.newGame(seed);
            setOverlay('none');
          }}
          onOpenRules={() => openOverlay('rules')}
          onOpenDeck={() => openOverlay('deck')}
          onClose={() => setOverlay('none')}
        />
      )}
    </div>
  );
}

interface FinalTallyProps {
  score: number;
  target: number;
  seed: number;
  onMenu: () => void;
  onNewGame: () => void;
}

function FinalTally({ score, target, seed, onMenu, onNewGame }: FinalTallyProps) {
  const isWin = score >= target;
  return (
    <section className="flex flex-col items-start gap-3 py-8">
      <h2 className="text-4xl font-extrabold">{isWin ? 'The house prospers.' : 'Short of the mark.'}</h2>
      <p className="text-chalk-soft">
        {score} points against a target of {target} (seed {seed}).
      </p>
      <div className="mt-2 flex w-full gap-2">
        <button type="button" onClick={onMenu} className="flex-1 rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          Copy the log
        </button>
        <button type="button" onClick={onNewGame} className="flex-1 rounded-sm bg-slate-raised py-3 font-semibold">
          Play again
        </button>
      </div>
    </section>
  );
}
