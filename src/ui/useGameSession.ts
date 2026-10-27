import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RulesConfig } from '../engine/config.ts';
import { applyMove, type GameState, type Move } from '../engine/game.ts';
import { startLog, withEvent, withFinalScore, withMove, type GameLog } from './gameLog.ts';
import { inspectionAfter, randomSeed, replayGame, soakedBy, type InspectionReport } from './session.ts';
import { loadLogs, saveLogs } from './storage.ts';

export interface LastHang {
  move: Move;
  soakedClothIds: number[];
}

interface SessionState {
  logs: GameLog[];
  game: GameState;
  lastHang: LastHang | null;
  inspection: InspectionReport | null;
}

function resumeOrStart(config: RulesConfig): SessionState {
  const logs = loadLogs();
  const current = logs[logs.length - 1];
  if (current && current.finalScore === null && current.rules === config.version) {
    try {
      const game = replayGame(current.seed, current.moves.map((entry) => entry.move), config);
      return { logs, game, lastHang: null, inspection: null };
    } catch (error) {
      console.warn(`Saved game (seed ${current.seed}) no longer replays under ${config.version}; starting fresh.`, error);
    }
  }
  return startFresh(config, logs, randomSeed());
}

function startFresh(config: RulesConfig, logs: GameLog[], seed: number): SessionState {
  const withoutUnfinished = logs.filter((log) => log.finalScore !== null || log.moves.length > 0);
  return {
    logs: [...withoutUnfinished, startLog(config.version, seed)],
    game: replayGame(seed, [], config),
    lastHang: null,
    inspection: null,
  };
}

function replaceCurrentLog(logs: GameLog[], log: GameLog): GameLog[] {
  return [...logs.slice(0, -1), log];
}

export function useGameSession(config: RulesConfig) {
  const [session, setSession] = useState<SessionState>(() => resumeOrStart(config));
  const [selectedClothId, setSelectedClothId] = useState<number | null>(null);
  const [previewCell, setPreviewCell] = useState<number | null>(null);

  useEffect(() => saveLogs(session.logs), [session.logs]);

  const currentLog = session.logs[session.logs.length - 1];

  const hang = useCallback((move: Move) => {
    setSession((previous) => {
      const next = applyMove(previous.game, move);
      let log = withMove(previous.logs[previous.logs.length - 1], move);
      if (next.isOver) log = withFinalScore(log, next.score);
      return {
        logs: replaceCurrentLog(previous.logs, log),
        game: next,
        lastHang: { move, soakedClothIds: soakedBy(previous.game, move.cell) },
        inspection: inspectionAfter(previous.game, move, next),
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
  }, []);

  /** First tap on a peg previews the hang, a second tap on the same peg commits it. */
  const tapPeg = useCallback(
    (cell: number) => {
      if (selectedClothId === null || session.game.rack[cell] !== null) return;
      if (previewCell === cell) {
        hang({ clothId: selectedClothId, cell });
        return;
      }
      setPreviewCell(cell);
    },
    [hang, previewCell, selectedClothId, session.game.rack],
  );

  const confirmPreview = useCallback(() => {
    if (selectedClothId !== null && previewCell !== null) hang({ clothId: selectedClothId, cell: previewCell });
  }, [hang, previewCell, selectedClothId]);

  const dismissInspection = useCallback(() => {
    setSession((previous) => ({ ...previous, inspection: null, lastHang: null }));
  }, []);

  const newGame = useCallback(
    (seed: number = randomSeed()) => {
      setSession((previous) => startFresh(config, previous.logs, seed));
      setSelectedClothId(null);
      setPreviewCell(null);
    },
    [config],
  );

  const preview = useMemo(
    () => (selectedClothId !== null && previewCell !== null ? { clothId: selectedClothId, cell: previewCell } : null),
    [previewCell, selectedClothId],
  );

  return {
    game: session.game,
    logs: session.logs,
    currentLog,
    lastHang: session.lastHang,
    inspection: session.inspection,
    selectedClothId,
    preview,
    selectCloth,
    tapPeg,
    confirmPreview,
    dismissInspection,
    newGame,
    recordEvent,
  };
}
