import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BLUE, RED } from '../../engine/shades.ts';
import { formatLogForExport, parseExportedMoves, startLog, withMove } from '../../ui/gameLog.ts';
import { RULES_V12 } from '../config.ts';
import { applyMove, createGame, type WorkshopMove } from '../engine.ts';
import { Bench } from './Bench.tsx';
import { ObjectiveIcon } from './ObjectiveIcon.tsx';
import { workshopMoveCodec } from './workshopMoveCodec.ts';
import { WorkshopRules } from './WorkshopRules.tsx';

const noop = () => {};

describe('workshop screens', () => {
  it('draws each laid-out cloth on the bench', () => {
    const game = createGame(1, RULES_V12);
    const layout = [0, 1].map((clothId, index) => ({ clothId, x: 12 + index * 6, y: 18, rotation: index * 3 }));
    const html = renderToStaticMarkup(<Bench game={game} layout={layout} selectedClothId={null} onSelect={noop} onMove={noop} />);
    expect(html.match(/aria-label="Cloth \d+"/g)?.length).toBe(2);
  });

  it('describes what a cloth must include', () => {
    const game = createGame(1, RULES_V12);
    expect(renderToStaticMarkup(<ObjectiveIcon objective={game.puzzle.objectives[0]} />)).toMatch(/Must include a (red|yellow|blue|bare) /);
  });

  it('names the par in the rules', () => {
    expect(renderToStaticMarkup(<WorkshopRules config={RULES_V12} par={3} onClose={noop} />)).toContain('par is 3');
  });
});

describe('workshop logs', () => {
  it('replay to the exact game that was played', () => {
    const start = createGame(55, RULES_V12);
    const moves: WorkshopMove[] = [
      { kind: 'spray', dye: RED, layout: [{ clothId: 0, x: 15, y: 18, rotation: 0 }, { clothId: 2, x: 21, y: 16, rotation: 5 }] },
      { kind: 'spray', dye: BLUE, layout: [{ clothId: 3, x: 18, y: 18, rotation: 3 }] },
    ];
    const log = moves.reduce((current, move) => withMove(current, move), startLog<WorkshopMove>(RULES_V12.version, 55));
    const replayed = parseExportedMoves(formatLogForExport([log], workshopMoveCodec), workshopMoveCodec).reduce(applyMove, createGame(55, RULES_V12));
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(moves.reduce(applyMove, start)));
  });
});
