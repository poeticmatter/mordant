import { useState } from 'react';
import { RULES_V8 } from '../selvedge/tags/config.ts';
import { shippedCount } from '../selvedge/tags/engine.ts';
import { Board } from './Board.tsx';
import { formatLogForExport } from './gameLog.ts';
import { MenuSheet } from './MenuSheet.tsx';
import { RulesPage } from './RulesPage.tsx';
import { tagsMoveCodec } from './tagsMoveCodec.ts';
import { ClothsSheet, FinalTally, InspectionSheet } from './Sheets.tsx';
import { useGameSession } from './useGameSession.ts';

type View = 'game' | 'rules' | 'menu' | 'cloths';

export function App() {
  const session = useGameSession(RULES_V8);
  const { game } = session;
  const [view, setView] = useState<View>(() => (session.currentLog.moves.length === 0 ? 'rules' : 'game'));

  function open(next: View) {
    session.recordEvent(`open-${next}`);
    setView(next);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
      <header className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Selvedge</h1>
        <p className="flex-1 text-chalk-soft">{game.isOver ? 'Finished' : `Season ${game.season + 1} of ${game.config.seasons}`}</p>
        <p className="text-right">
          <span className="text-2xl font-extrabold">{shippedCount(game)}</span>
          <span className="text-chalk-soft"> of {game.config.shipTarget} shipped</span>
        </p>
        <button type="button" onClick={() => open('menu')} className="rounded-sm border border-slate-line px-3 py-2">
          Menu
        </button>
      </header>

      {view === 'rules' ? (
        <RulesPage config={game.config} onClose={() => setView('game')} />
      ) : game.isOver && !session.inspection ? (
        <FinalTally game={game} onMenu={() => open('menu')} onNewGame={() => session.newGame()} />
      ) : (
        <Board
          game={game}
          selectedClothId={session.selectedClothId}
          preview={session.preview}
          onSelectCloth={session.selectCloth}
          onTapPeg={session.tapPeg}
          onTurn={session.turnPreview}
          onHang={session.hangPreview}
          onSetAside={session.setAsideSelected}
          onInspectNow={session.inspectNow}
          onShowCloths={() => open('cloths')}
        />
      )}

      <p className="mt-auto pt-6 text-center text-xs text-chalk-soft">
        Seed {game.seed}, rules {game.config.version}
      </p>

      {session.inspection && <InspectionSheet report={session.inspection} game={game} onContinue={session.dismissInspection} />}
      {view === 'cloths' && <ClothsSheet game={game} onClose={() => setView('game')} />}
      {view === 'menu' && (
        <MenuSheet
          seed={game.seed}
          exportText={formatLogForExport(session.logs, tagsMoveCodec)}
          finishedCount={session.logs.filter((log) => log.finalScore !== null).length}
          deckShortcut={{ label: 'Your cloths', onOpen: () => open('cloths') }}
          onNewGame={(seed) => {
            session.newGame(seed);
            setView('game');
          }}
          onOpenRules={() => open('rules')}
          onClose={() => setView('game')}
        />
      )}
    </div>
  );
}
