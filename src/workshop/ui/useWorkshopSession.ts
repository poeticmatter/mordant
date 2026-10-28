import { useCallback, useEffect, useState } from 'react';
import type { Dye } from '../../engine/shades.ts';
import { startLog, withEvent, withFinalScore, withMove, type GameLog } from '../../ui/gameLog.ts';
import { randomSeed } from '../../ui/session.ts';
import { LOG_KEYS, loadLogs, saveLogs } from '../../ui/storage.ts';
import { applyMove, createGame, type WorkshopConfig, type WorkshopMove, type WorkshopState } from '../engine.ts';
import { ROTATION_STEPS, type Placement } from '../geometry.ts';

type Log = GameLog<WorkshopMove>;

interface SessionState {
  logs: Log[];
  game: WorkshopState;
  /** Cloths laid on the bench, bottom first. It stays after a spray, so a similar layout is quick to reuse. */
  layout: Placement[];
}

function startAttempt(config: WorkshopConfig, logs: Log[], seed: number): SessionState {
  const keptLogs = logs.filter((log) => log.finalScore !== null || log.moves.length > 0);
  return { logs: [...keptLogs, startLog<WorkshopMove>(config.version, seed)], game: createGame(seed, config), layout: [] };
}

function resumeOrStart(config: WorkshopConfig): SessionState {
  const logs = loadLogs<WorkshopMove>(LOG_KEYS.workshop);
  const current = logs.at(-1);
  if (current && current.finalScore === null && current.rules === config.version) {
    try {
      const moves = current.moves.map((entry) => entry.move);
      const game = moves.reduce(applyMove, createGame(current.seed, config));
      return { logs, game, layout: moves.at(-1)?.layout ?? [] };
    } catch (error) {
      console.warn(`Saved workshop puzzle (seed ${current.seed}) no longer replays under ${config.version}; starting fresh.`, error);
    }
  }
  return startAttempt(config, logs, randomSeed());
}

function replaceCurrentLog(logs: Log[], log: Log): Log[] {
  return [...logs.slice(0, -1), log];
}

const BENCH_CENTRE_SHARE = 0.5;

export function useWorkshopSession(config: WorkshopConfig) {
  const [session, setSession] = useState<SessionState>(() => resumeOrStart(config));
  const [selectedClothId, setSelectedClothId] = useState<number | null>(null);

  useEffect(() => saveLogs(LOG_KEYS.workshop, session.logs), [session.logs]);

  const updateLayout = useCallback((change: (layout: Placement[]) => Placement[]) => {
    setSession((previous) => ({ ...previous, layout: change(previous.layout) }));
  }, []);

  const centre = Math.round(config.benchSize * BENCH_CENTRE_SHARE);
  const isOnBench = (clothId: number) => session.layout.some((placement) => placement.clothId === clothId);

  return {
    game: session.game,
    logs: session.logs,
    layout: session.layout,
    selectedClothId,
    isOnBench,
    select: setSelectedClothId,
    /** Selects a cloth, putting it on top in the middle of the bench if it isn't laid out yet. */
    pickUp: (clothId: number) => {
      if (!isOnBench(clothId)) updateLayout((layout) => [...layout, { clothId, x: centre, y: centre, rotation: 0 }]);
      setSelectedClothId(clothId);
    },
    moveTo: (clothId: number, x: number, y: number) =>
      updateLayout((layout) => layout.map((placement) => (placement.clothId === clothId ? { ...placement, x, y } : placement))),
    rotate: (clothId: number, steps: number) =>
      updateLayout((layout) =>
        layout.map((placement) =>
          placement.clothId === clothId ? { ...placement, rotation: (((placement.rotation + steps) % ROTATION_STEPS) + ROTATION_STEPS) % ROTATION_STEPS } : placement,
        ),
      ),
    bringToTop: (clothId: number) =>
      updateLayout((layout) => [...layout.filter((placement) => placement.clothId !== clothId), ...layout.filter((placement) => placement.clothId === clothId)]),
    takeOff: (clothId: number) => {
      updateLayout((layout) => layout.filter((placement) => placement.clothId !== clothId));
      setSelectedClothId(null);
    },
    spray: (dye: Dye) =>
      setSession((previous) => {
        const move: WorkshopMove = { kind: 'spray', dye, layout: previous.layout };
        const game = applyMove(previous.game, move);
        let log = withMove(previous.logs[previous.logs.length - 1], move);
        if (game.isSolved) log = withFinalScore(log, game.strokes);
        return { ...previous, logs: replaceCurrentLog(previous.logs, log), game };
      }),
    /** The same puzzle from blank cloths; the abandoned attempt stays in the log. */
    startOver: () => {
      setSession((previous) => startAttempt(config, previous.logs, previous.game.seed));
      setSelectedClothId(null);
    },
    newPuzzle: (seed: number = randomSeed()) => {
      setSession((previous) => startAttempt(config, previous.logs, seed));
      setSelectedClothId(null);
    },
    recordEvent: (kind: string) =>
      setSession((previous) => ({ ...previous, logs: replaceCurrentLog(previous.logs, withEvent(previous.logs[previous.logs.length - 1], kind)) })),
  };
}

export type WorkshopSession = ReturnType<typeof useWorkshopSession>;
