import { useCallback, useEffect, useState } from 'react';
import type { Dye } from '../../engine/shades.ts';
import { startLog, withEvent, withFinalScore, withMove, type GameLog } from '../../ui/gameLog.ts';
import { randomSeed } from '../../ui/session.ts';
import { LOG_KEYS, loadLogs, saveLogs } from '../../ui/storage.ts';
import { applyMove, createGame, type WorkshopConfig, type WorkshopMove, type WorkshopState } from '../engine.ts';
import { ROTATION_STEPS, type Placement } from '../geometry.ts';
import { scoreQuilt } from '../scoring.ts';

type Log = GameLog<WorkshopMove>;

interface SessionState {
  logs: Log[];
  game: WorkshopState;
  /** Cloths laid on the bench this round, bottom first. Committed only when sprayed. */
  layout: Placement[];
}

/** A cloth on its way into the quilt: where it would go and how it would be turned. */
export interface QuiltDraft {
  clothId: number;
  slot: number | null;
  turns: number;
}

function replayGame(seed: number, moves: readonly WorkshopMove[], config: WorkshopConfig): WorkshopState {
  return moves.reduce((state, move) => applyMove(state, move), createGame(seed, config));
}

/** The layout a replayed game ended its last move with: the sprayed one, if this round was sprayed. */
function layoutAfter(moves: readonly WorkshopMove[], game: WorkshopState): Placement[] {
  if (!game.hasSprayed) return [];
  const lastSpray = moves.filter((move) => move.kind === 'spray').at(-1);
  return lastSpray?.kind === 'spray' ? lastSpray.layout.filter((placement) => game.bench.includes(placement.clothId)) : [];
}

function startFresh(config: WorkshopConfig, logs: Log[], seed: number): SessionState {
  const keptLogs = logs.filter((log) => log.finalScore !== null || log.moves.length > 0);
  return { logs: [...keptLogs, startLog<WorkshopMove>(config.version, seed)], game: createGame(seed, config), layout: [] };
}

function resumeOrStart(config: WorkshopConfig): SessionState {
  const logs = loadLogs<WorkshopMove>(LOG_KEYS.workshop);
  const current = logs.at(-1);
  if (current && current.finalScore === null && current.rules === config.version) {
    try {
      const moves = current.moves.map((entry) => entry.move);
      const game = replayGame(current.seed, moves, config);
      return { logs, game, layout: layoutAfter(moves, game) };
    } catch (error) {
      console.warn(`Saved workshop game (seed ${current.seed}) no longer replays under ${config.version}; starting fresh.`, error);
    }
  }
  return startFresh(config, logs, randomSeed());
}

function replaceCurrentLog(logs: Log[], log: Log): Log[] {
  return [...logs.slice(0, -1), log];
}

const BENCH_CENTRE_SHARE = 0.5;

export function useWorkshopSession(config: WorkshopConfig) {
  const [session, setSession] = useState<SessionState>(() => resumeOrStart(config));
  const [selectedClothId, setSelectedClothId] = useState<number | null>(null);
  const [quiltDraft, setQuiltDraft] = useState<QuiltDraft | null>(null);

  useEffect(() => saveLogs(LOG_KEYS.workshop, session.logs), [session.logs]);

  const play = useCallback((move: WorkshopMove) => {
    setSession((previous) => {
      const game = applyMove(previous.game, move);
      let log = withMove(previous.logs[previous.logs.length - 1], move);
      if (game.isOver) log = withFinalScore(log, scoreQuilt(game).total);
      const layout =
        move.kind === 'endRound' ? [] : move.kind === 'quilt' ? previous.layout.filter((placement) => placement.clothId !== move.clothId) : previous.layout;
      return { logs: replaceCurrentLog(previous.logs, log), game, layout };
    });
    setSelectedClothId(null);
    setQuiltDraft(null);
  }, []);

  /** The layout stays movable after spraying, so you can pull cloths apart to see what each got. */
  const updateLayout = useCallback((change: (layout: Placement[]) => Placement[]) => {
    setSession((previous) => ({ ...previous, layout: change(previous.layout) }));
  }, []);

  const centre = Math.round(config.benchSize * BENCH_CENTRE_SHARE);

  return {
    game: session.game,
    logs: session.logs,
    layout: session.layout,
    selectedClothId,
    quiltDraft,
    select: setSelectedClothId,
    /** Puts a cloth from the tray on top of the pile, in the middle of the bench. */
    layOut: (clothId: number) => {
      updateLayout((layout) => [...layout.filter((placement) => placement.clothId !== clothId), { clothId, x: centre, y: centre, rotation: 0 }]);
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
    spray: (dye: Dye) => play({ kind: 'spray', dye, layout: session.layout }),
    endRound: () => play({ kind: 'endRound' }),
    startQuilting: (clothId: number) => setQuiltDraft({ clothId, slot: null, turns: 0 }),
    chooseSlot: (slot: number) => setQuiltDraft((draft) => (draft === null ? null : { ...draft, slot })),
    turnDraft: () => setQuiltDraft((draft) => (draft === null ? null : { ...draft, turns: (draft.turns + 1) % 4 })),
    cancelQuilting: () => setQuiltDraft(null),
    sewDraft: () => quiltDraft !== null && quiltDraft.slot !== null && play({ kind: 'quilt', clothId: quiltDraft.clothId, slot: quiltDraft.slot, turns: quiltDraft.turns }),
    newGame: (seed: number = randomSeed()) => {
      setSession((previous) => startFresh(config, previous.logs, seed));
      setSelectedClothId(null);
      setQuiltDraft(null);
    },
    recordEvent: (kind: string) =>
      setSession((previous) => ({ ...previous, logs: replaceCurrentLog(previous.logs, withEvent(previous.logs[previous.logs.length - 1], kind)) })),
  };
}

export type WorkshopSession = ReturnType<typeof useWorkshopSession>;
