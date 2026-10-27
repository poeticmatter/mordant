import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyMove, completedCount, type HangMove, type SelvedgeConfig, type SelvedgeMove, type SelvedgeState } from '../selvedge/engine.ts';
import { startLog, withEvent, withFinalScore, withMove, type GameLog } from './gameLog.ts';
import { inspectionAfter, randomSeed, replayGame, touchedBy, type InspectionReport } from './session.ts';
import { loadLogs, saveLogs } from './storage.ts';

interface SessionState {
  logs: GameLog[];
  game: SelvedgeState;
  /** Cloths stained by the last hang, so they can flash once. */
  justTouched: number[];
  inspection: InspectionReport | null;
}

function resumeOrStart(config: SelvedgeConfig): SessionState {
  const logs = loadLogs();
  const current = logs[logs.length - 1];
  if (current && current.finalScore === null && current.rules === config.version) {
    try {
      const game = replayGame(current.seed, current.moves.map((entry) => entry.move), config);
      return { logs, game, justTouched: [], inspection: null };
    } catch (error) {
      console.warn(`Saved game (seed ${current.seed}) no longer replays under ${config.version}; starting fresh.`, error);
    }
  }
  return startFresh(config, logs, randomSeed());
}

function startFresh(config: SelvedgeConfig, logs: GameLog[], seed: number): SessionState {
  const keptLogs = logs.filter((log) => log.finalScore !== null || log.moves.length > 0);
  return { logs: [...keptLogs, startLog(config.version, seed)], game: replayGame(seed, [], config), justTouched: [], inspection: null };
}

function replaceCurrentLog(logs: GameLog[], log: GameLog): GameLog[] {
  return [...logs.slice(0, -1), log];
}

export function useGameSession(config: SelvedgeConfig) {
  const [session, setSession] = useState<SessionState>(() => resumeOrStart(config));
  const [selectedClothId, setSelectedClothId] = useState<number | null>(null);
  const [previewCell, setPreviewCell] = useState<number | null>(null);

  useEffect(() => saveLogs(session.logs), [session.logs]);

  const play = useCallback((move: SelvedgeMove) => {
    setSession((previous) => {
      const next = applyMove(previous.game, move);
      let log = withMove(previous.logs[previous.logs.length - 1], move);
      if (next.isOver) log = withFinalScore(log, completedCount(next));
      return {
        logs: replaceCurrentLog(previous.logs, log),
        game: next,
        justTouched: move.kind === 'hang' ? touchedBy(previous.game, move.cell) : [],
        inspection: inspectionAfter(previous.game, next),
      };
    });
    setSelectedClothId(null);
    setPreviewCell(null);
  }, []);

  const recordEvent = useCallback((kind: string) => {
    setSession((previous) => ({
      ...previous,
      logs: replaceCurrentLog(previous.logs, withEvent(previous.logs[previous.logs.length - 1], kind)),
    }));
  }, []);

  const selectCloth = useCallback((clothId: number) => {
    setSelectedClothId((current) => (current === clothId ? null : clothId));
    setPreviewCell(null);
  }, []);

  /**
   * Tapping an empty peg only previews; hanging always takes the "Hang it" button.
   * Playtest 2: tap-again-to-hang turned an accidental double tap into a hang.
   */
  const tapPeg = useCallback(
    (cell: number) => {
      if (selectedClothId === null || session.game.rack[cell] !== null) return;
      setPreviewCell(cell);
    },
    [selectedClothId, session.game.rack],
  );

  const preview = useMemo<HangMove | null>(
    () => (selectedClothId !== null && previewCell !== null ? { kind: 'hang', clothId: selectedClothId, cell: previewCell } : null),
    [previewCell, selectedClothId],
  );

  return {
    game: session.game,
    logs: session.logs,
    currentLog: session.logs[session.logs.length - 1],
    justTouched: session.justTouched,
    inspection: session.inspection,
    selectedClothId,
    preview,
    selectCloth,
    tapPeg,
    hangPreview: () => preview && play(preview),
    setAsideSelected: () => selectedClothId !== null && play({ kind: 'setAside', clothId: selectedClothId }),
    inspectNow: () => play({ kind: 'inspect' }),
    dismissInspection: () => setSession((previous) => ({ ...previous, inspection: null, justTouched: [] })),
    newGame: (seed: number = randomSeed()) => {
      setSession((previous) => startFresh(config, previous.logs, seed));
      setSelectedClothId(null);
      setPreviewCell(null);
    },
    recordEvent,
  };
}
