import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RULES_V2 } from '../engine/config.ts';
import { applyMove, createGame, legalMoves, type GameState } from '../engine/game.ts';
import { Board } from './Board.tsx';
import { DeckSheet } from './DeckSheet.tsx';
import { InspectionSheet } from './InspectionSheet.tsx';
import { MenuSheet } from './MenuSheet.tsx';
import { RulesSheet } from './RulesSheet.tsx';
import { inspectionAfter, type InspectionReport } from './session.ts';
import { startLog, withMove } from './gameLog.ts';

const noop = () => {};

function playUntilFirstInspection(seed: number): { game: GameState; report: InspectionReport } {
  let game = createGame(seed, RULES_V2);
  for (;;) {
    const move = legalMoves(game)[0];
    const next = applyMove(game, move);
    const report = inspectionAfter(game, move, next);
    game = next;
    if (report) return { game, report };
  }
}

describe('screens render from real game states', () => {
  it('draws the board mid-season with a previewed hang', () => {
    let game = createGame(3, RULES_V2);
    for (let step = 0; step < 5; step++) game = applyMove(game, legalMoves(game)[0]);
    const preview = legalMoves(game)[0];
    const html = renderToStaticMarkup(
      <Board game={game} selectedClothId={preview.clothId} preview={preview} lastHang={null} onSelectCloth={noop} onTapPeg={noop} onConfirm={noop} />,
    );
    expect(html).toContain('Hang it');
  });

  it('reports the first inspection with its shipments and points', () => {
    const { game, report } = playUntilFirstInspection(8);
    const html = renderToStaticMarkup(<InspectionSheet report={report} game={game} onContinue={noop} />);
    expect(html).toContain('Season 1 inspection');
  });

  it('lists every cloth with its whereabouts', () => {
    const html = renderToStaticMarkup(<DeckSheet game={createGame(1, RULES_V2)} onClose={noop} />);
    expect(html.match(/in the basket/g)?.length).toBe(15);
  });

  it('shows rules with the target and season count', () => {
    const html = renderToStaticMarkup(<RulesSheet config={RULES_V2} onClose={noop} />);
    expect(html).toContain(`Reach ${RULES_V2.targetScore} points`);
  });

  it('shows the seed in the menu', () => {
    const game = createGame(77, RULES_V2);
    const log = withMove(startLog('v2', 77), legalMoves(game)[0]);
    const html = renderToStaticMarkup(
      <MenuSheet seed={77} logs={[log]} onNewGame={noop} onOpenRules={noop} onOpenDeck={noop} onClose={noop} />,
    );
    expect(html).toContain('Seed 77');
  });
});
