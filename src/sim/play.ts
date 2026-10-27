import { Random } from '../engine/rng.ts';
import type { Bot, Decision, GameAdapter, ShipmentRecord } from '../bots/types.ts';

export interface DecisionRecord {
  season: number;
  scoreBefore: number;
  legalCount: number;
  distinctCount: number;
  /** Best minus second-best expected final score, when the bot searched. */
  topGap: number | null;
  /** Best minus worst expected final score among evaluated moves. */
  valueSpread: number | null;
  /** Cards on the table whose at-a-glance look changed. */
  lookChanges: number;
  /** Cards whose memory changed at all. */
  memoryChanges: number;
}

export interface GameRecord<M = unknown> {
  seed: number;
  botName: string;
  score: number;
  isWin: boolean;
  decisions: DecisionRecord[];
  shipments: ShipmentRecord[];
  moves: M[];
}

export interface CreateGame<S> {
  (seed: number): S;
}

export function playGame<S, M>(adapter: GameAdapter<S, M>, createGame: CreateGame<S>, seed: number, bot: Bot<S, M>): GameRecord<M> {
  const rng = new Random(seed ^ 0x9e3779b9);
  let state = createGame(seed);
  const decisions: DecisionRecord[] = [];
  const moves: M[] = [];
  while (!adapter.isOver(state)) {
    const decision = bot.decide(state, rng);
    const next = adapter.applyMove(state, decision.move);
    decisions.push(recordDecision(adapter, state, next, decision));
    moves.push(decision.move);
    state = next;
  }
  return {
    seed,
    botName: bot.name,
    score: adapter.score(state),
    isWin: adapter.isWin(state),
    decisions,
    shipments: adapter.shipments(state),
    moves,
  };
}

function recordDecision<S, M>(adapter: GameAdapter<S, M>, before: S, after: S, decision: Decision<M>): DecisionRecord {
  const evaluations = decision.evaluations ?? [];
  const values = evaluations.map((evaluation) => evaluation.value);
  return {
    season: adapter.season(before),
    scoreBefore: adapter.score(before),
    legalCount: adapter.legalMoves(before).length,
    distinctCount: adapter.distinctMoves(before).length,
    topGap: evaluations.length >= 2 ? evaluations[0].value - evaluations[1].value : null,
    valueSpread: values.length >= 2 ? Math.max(...values) - Math.min(...values) : null,
    ...adapter.visibleChanges(before, after),
  };
}
