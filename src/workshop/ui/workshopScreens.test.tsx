import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RED } from '../../engine/shades.ts';
import { formatLogForExport, parseExportedMoves, startLog, withMove } from '../../ui/gameLog.ts';
import { RULES_V10 } from '../config.ts';
import { applyMove, createGame, type WorkshopMove } from '../engine.ts';
import { Bench } from './Bench.tsx';
import { ClothsSheet } from './ClothsSheet.tsx';
import { QuiltView } from './QuiltView.tsx';
import { workshopMoveCodec } from './workshopMoveCodec.ts';
import { WorkshopRules } from './WorkshopRules.tsx';

const noop = () => {};

describe('workshop screens', () => {
  it('draws each laid-out cloth on the bench', () => {
    const game = createGame(1, RULES_V10);
    const layout = game.bench.slice(0, 2).map((clothId, index) => ({ clothId, x: 12 + index * 6, y: 18, rotation: index * 3 }));
    const html = renderToStaticMarkup(<Bench game={game} layout={layout} selectedClothId={null} onSelect={noop} onMove={noop} />);
    expect(html.match(/aria-label="Cloth \d+"/g)?.length).toBe(2);
  });

  it('offers the free quilt squares while sewing', () => {
    const game = createGame(1, RULES_V10);
    const html = renderToStaticMarkup(<QuiltView game={game} draft={{ clothId: game.bench[0], slot: null, turns: 0 }} onChooseSlot={noop} />);
    expect(html.match(/Empty quilt square/g)?.length).toBe(RULES_V10.quiltWidth * RULES_V10.quiltHeight);
  });

  it('lists the deck in the cloths sheet', () => {
    expect(renderToStaticMarkup(<ClothsSheet game={createGame(1, RULES_V10)} onClose={noop} />)).toContain('In the deck');
  });

  it('names the round count in the rules', () => {
    expect(renderToStaticMarkup(<WorkshopRules config={RULES_V10} onClose={noop} />)).toContain(`Over ${RULES_V10.rounds} rounds`);
  });
});

describe('workshop logs', () => {
  it('replay to the exact game that was played', () => {
    const start = createGame(55, RULES_V10);
    const [first, second] = start.bench;
    const moves: WorkshopMove[] = [
      { kind: 'spray', dye: RED, layout: [{ clothId: first, x: 15, y: 18, rotation: 0 }, { clothId: second, x: 21, y: 16, rotation: 5 }] },
      { kind: 'quilt', clothId: first, slot: 4, turns: 3 },
      { kind: 'endRound' },
    ];
    const log = moves.reduce((current, move) => withMove(current, move), startLog<WorkshopMove>(RULES_V10.version, 55));
    const replayed = parseExportedMoves(formatLogForExport([log], workshopMoveCodec), workshopMoveCodec).reduce(applyMove, createGame(55, RULES_V10));
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(moves.reduce(applyMove, start)));
  });
});
