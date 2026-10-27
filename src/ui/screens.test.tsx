import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RULES_V8 } from '../selvedge/tags/config.ts';
import { applyMove, createGame, legalMoves, type HangMove, type TagsState } from '../selvedge/tags/engine.ts';
import { Board } from './Board.tsx';
import { formatLogForExport, parseExportedMoves, startLog, withFinalScore, withMove } from './gameLog.ts';
import { RulesPage } from './RulesPage.tsx';
import { inspectionAfter, replayGame, type InspectionReport } from './session.ts';
import { ClothsSheet, FinalTally, InspectionSheet } from './Sheets.tsx';

const noop = () => {};

function renderBoard(game: TagsState, selectedClothId: number | null, preview: HangMove | null = null): string {
  return renderToStaticMarkup(
    <Board
      game={game}
      selectedClothId={selectedClothId}
      preview={preview}
      onSelectCloth={noop}
      onTapPeg={noop}
      onTurn={noop}
      onHang={noop}
      onSetAside={noop}
      onInspectNow={noop}
      onShowCloths={noop}
    />,
  );
}

function firstHang(state: TagsState): HangMove {
  return legalMoves(state).find((move): move is HangMove => move.kind === 'hang')!;
}

function playUntilFirstInspection(seed: number): { game: TagsState; report: InspectionReport } {
  let game = createGame(seed, RULES_V8);
  for (;;) {
    const next = applyMove(game, firstHang(game));
    const report = inspectionAfter(game, next);
    game = next;
    if (report) return { game, report };
  }
}

describe('screens render from real game states', () => {
  it('offers to hang a previewed cloth', () => {
    let game = createGame(3, RULES_V8);
    for (let step = 0; step < 4; step++) game = applyMove(game, firstHang(game));
    const preview = firstHang(game);
    expect(renderBoard(game, preview.clothId, preview)).toContain('Hang it');
  });

  it('offers to turn a previewed cloth', () => {
    const game = createGame(3, RULES_V8);
    const preview = firstHang(game);
    expect(renderBoard(game, preview.clothId, preview)).toContain('Turn it');
  });

  it('offers an early inspection once something is hung', () => {
    const game = applyMove(createGame(3, RULES_V8), firstHang(createGame(3, RULES_V8)));
    expect(renderBoard(game, null)).toContain('Inspect now');
  });

  it('keeps the basket behind a button', () => {
    const game = createGame(3, RULES_V8);
    expect(renderBoard(game, null)).toContain(`See the basket (${game.drawPile.length})`);
  });

  it('offers to set a picked cloth aside', () => {
    const game = createGame(3, RULES_V8);
    expect(renderBoard(game, game.hand[0])).toContain('Set aside for good');
  });

  it('reports the first inspection', () => {
    const { game, report } = playUntilFirstInspection(8);
    expect(renderToStaticMarkup(<InspectionSheet report={report} game={game} onContinue={noop} />)).toContain('Season 1 inspection');
  });

  it('lists the cloths in hand and in the basket', () => {
    const html = renderToStaticMarkup(<ClothsSheet game={createGame(1, RULES_V8)} onClose={noop} />);
    expect(html).toContain('In the basket');
  });

  it('names the shipping target and seasons in the rules', () => {
    const html = renderToStaticMarkup(<RulesPage config={RULES_V8} onClose={noop} />);
    expect(html).toContain(`Ship ${RULES_V8.shipTarget} of them within ${RULES_V8.seasons} seasons`);
  });

  it('shows the final tally against the target', () => {
    let game = createGame(2, RULES_V8);
    while (!game.isOver) game = applyMove(game, firstHang(game));
    const html = renderToStaticMarkup(<FinalTally game={game} onMenu={noop} onNewGame={noop} />);
    expect(html).toContain(`the target was ${RULES_V8.shipTarget}`);
  });
});

describe('exported logs', () => {
  it('replay set-aside moves', () => {
    const start = createGame(77, RULES_V8);
    const move = { kind: 'setAside' as const, clothId: start.hand[0] };
    const log = withMove(startLog(RULES_V8.version, 77), move);
    expect(JSON.stringify(replayGame(77, parseExportedMoves(formatLogForExport([log])), RULES_V8))).toBe(JSON.stringify(applyMove(start, move)));
  });

  it('replay to the exact game that was played, turns and early inspections included', () => {
    let game = createGame(4242, RULES_V8);
    let log = startLog(RULES_V8.version, 4242);
    while (!game.isOver) {
      const moves = legalMoves(game);
      const move = game.seasonHangs.length === 3 && moves.some((m) => m.kind === 'inspect') ? { kind: 'inspect' as const } : moves[moves.length - 1 - (game.turn % 3)];
      log = withMove(log, move);
      game = applyMove(game, move);
    }
    const exported = formatLogForExport([withFinalScore(log, 0)]);
    expect(JSON.stringify(replayGame(4242, parseExportedMoves(exported), RULES_V8))).toBe(JSON.stringify(game));
  });
});
