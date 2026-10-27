import { describe, expect, it } from 'vitest';
import { RULES_V2 } from '../engine/config.ts';
import { createGame, legalMoves } from '../engine/game.ts';
import { formatLogForExport, startLog, withFinalScore, withMove } from './gameLog.ts';
import { replayGame } from './session.ts';

function parseExportedMoves(text: string) {
  return text
    .split('\n')
    .filter((line) => line.startsWith('m '))
    .map((line) => {
      const [, clothId, cell] = line.split(' ');
      return { clothId: Number(clothId), cell: Number(cell) };
    });
}

describe('exported logs', () => {
  it('replay to the exact game that was played', () => {
    let game = createGame(4242, RULES_V2);
    let log = startLog('v2', 4242);
    while (!game.isOver) {
      const move = legalMoves(game)[legalMoves(game).length - 1];
      log = withMove(log, move);
      game = replayGame(4242, log.moves.map((entry) => entry.move), RULES_V2);
    }
    const exported = formatLogForExport([withFinalScore(log, game.score)]);
    const replayed = replayGame(4242, parseExportedMoves(exported), RULES_V2);
    expect(replayed.score).toBe(game.score);
  });

  it('records the seed and final score in the header', () => {
    const exported = formatLogForExport([withFinalScore(startLog('v2', 9), 31)]);
    expect(exported.split('\n')[0]).toContain('seed=9');
  });
});
