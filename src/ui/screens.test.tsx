import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RULES_V6 } from '../selvedge/config.ts';
import { applyMove, createGame, legalMoves, type HangMove, type SelvedgeState } from '../selvedge/engine.ts';
import { Board } from './Board.tsx';
import { formatLogForExport, parseExportedMoves, startLog, withFinalScore, withMove } from './gameLog.ts';
import { RulesPage } from './RulesPage.tsx';
import { inspectionAfter, replayGame, type InspectionReport } from './session.ts';
import { ClothsSheet, FinalTally, InspectionSheet } from './Sheets.tsx';

const noop = () => {};

function firstHang(state: SelvedgeState): HangMove {
  return legalMoves(state).find((move): move is HangMove => move.kind === 'hang')!;
}

function playUntilFirstInspection(seed: number): { game: SelvedgeState; report: InspectionReport } {
  let game = createGame(seed, RULES_V6);
  for (;;) {
    const next = applyMove(game, firstHang(game));
    const report = inspectionAfter(game, next);
    game = next;
    if (report) return { game, report };
  }
}

describe('screens render from real game states', () => {
  it('offers to hang a previewed cloth', () => {
    let game = createGame(3, RULES_V6);
    for (let step = 0; step < 4; step++) game = applyMove(game, firstHang(game));
    const preview = firstHang(game);
    const html = renderToStaticMarkup(
      <Board game={game} selectedClothId={preview.clothId} preview={preview} onSelectCloth={noop} onTapPeg={noop} onHang={noop} onInspectNow={noop} onShowCloths={noop} />,
    );
    expect(html).toContain('Hang it');
  });

  it('offers an early inspection once something is hung', () => {
    const game = applyMove(createGame(3, RULES_V6), firstHang(createGame(3, RULES_V6)));
    const html = renderToStaticMarkup(
      <Board game={game} selectedClothId={null} preview={null} onSelectCloth={noop} onTapPeg={noop} onHang={noop} onInspectNow={noop} onShowCloths={noop} />,
    );
    expect(html).toContain('Inspect now');
  });

  it('reports the first inspection', () => {
    const { game, report } = playUntilFirstInspection(8);
    expect(renderToStaticMarkup(<InspectionSheet report={report} game={game} onContinue={noop} />)).toContain('Season 1 inspection');
  });

  it('lists the cloths in hand and in the basket', () => {
    const html = renderToStaticMarkup(<ClothsSheet game={createGame(1, RULES_V6)} onClose={noop} />);
    expect(html).toContain('In the basket');
  });

  it('names the rules goal with the book size and seasons', () => {
    const html = renderToStaticMarkup(<RulesPage config={RULES_V6} onClose={noop} />);
    expect(html).toContain(`Fill all ${RULES_V6.fixedEdgesPerCommission.length} commissions`);
  });

  it('lists what was left when the book is unfinished', () => {
    let game = createGame(2, RULES_V6);
    while (!game.isOver) game = applyMove(game, firstHang(game));
    const html = renderToStaticMarkup(<FinalTally game={game} onMenu={noop} onNewGame={noop} />);
    expect(html).toMatch(/These were left|The book is complete/);
  });
});

describe('exported logs', () => {
  it('replay to the exact game that was played, early inspections included', () => {
    let game = createGame(4242, RULES_V6);
    let log = startLog(RULES_V6.version, 4242);
    while (!game.isOver) {
      const moves = legalMoves(game);
      const move = game.seasonHangs.length === 3 && moves.some((m) => m.kind === 'inspect') ? { kind: 'inspect' as const } : moves[moves.length - 1];
      log = withMove(log, move);
      game = applyMove(game, move);
    }
    const exported = formatLogForExport([withFinalScore(log, 0)]);
    expect(JSON.stringify(replayGame(4242, parseExportedMoves(exported), RULES_V6))).toBe(JSON.stringify(game));
  });
});
