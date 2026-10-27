import type { RulesConfig } from '../engine/config.ts';
import {
  applyMove,
  clothShade,
  createGame,
  distinctLegalMoves,
  isWin,
  legalMoves,
  type GameState,
  type Move,
} from '../engine/game.ts';
import { Random } from '../engine/rng.ts';
import type { Bot, Decision } from '../bots/types.ts';
import { orderCategory, orderKey } from './orderLabels.ts';

export interface DecisionRecord {
  season: number;
  scoreBefore: number;
  legalCount: number;
  distinctCount: number;
  /** Best minus second-best expected final score, when the bot searched. */
  topGap: number | null;
  /** Best minus worst expected final score among evaluated moves. */
  valueSpread: number | null;
  /** Cloths on the rack whose shade (what the player sees at a glance) changed. */
  shadeChanges: number;
  /** Cloths whose dye memory changed at all. */
  memoryChanges: number;
}

export interface ShipmentRecord {
  orderKey: string;
  category: string;
  points: number;
  season: number;
}

export interface GameRecord {
  seed: number;
  botName: string;
  score: number;
  isWin: boolean;
  decisions: DecisionRecord[];
  shipments: ShipmentRecord[];
  moves: Move[];
}

export function playGame(seed: number, config: RulesConfig, bot: Bot): GameRecord {
  const rng = new Random(seed ^ 0x9e3779b9);
  let state = createGame(seed, config);
  const decisions: DecisionRecord[] = [];
  const moves: Move[] = [];
  while (!state.isOver) {
    const decision = bot.decide(state, rng);
    const next = applyMove(state, decision.move);
    decisions.push(recordDecision(state, next, decision));
    moves.push(decision.move);
    state = next;
  }
  return {
    seed,
    botName: bot.name,
    score: state.score,
    isWin: isWin(state),
    decisions,
    shipments: state.shipments.map(({ order, points, season }) => ({
      orderKey: orderKey(order),
      category: orderCategory(order),
      points,
      season,
    })),
    moves,
  };
}

function recordDecision(before: GameState, after: GameState, decision: Decision): DecisionRecord {
  const evaluations = decision.evaluations ?? [];
  const values = evaluations.map((evaluation) => evaluation.value);
  return {
    season: before.season,
    scoreBefore: before.score,
    legalCount: legalMoves(before).length,
    distinctCount: distinctLegalMoves(before).length,
    topGap: evaluations.length >= 2 ? evaluations[0].value - evaluations[1].value : null,
    valueSpread: values.length >= 2 ? Math.max(...values) - Math.min(...values) : null,
    ...countVisibleChanges(before, after, decision.move),
  };
}

function countVisibleChanges(before: GameState, after: GameState, move: Move) {
  // Compare cloths that were on the rack before the move. After an inspection the
  // rack is cleared, so compare cloth memories directly rather than rack cells.
  let shadeChanges = 0;
  let memoryChanges = 0;
  for (const clothId of before.rack) {
    if (clothId === null || clothId === move.clothId) continue;
    const beforeDyes = before.cloths[clothId].dyes.join('');
    const afterDyes = after.cloths[clothId].dyes.join('');
    if (beforeDyes === afterDyes) continue;
    memoryChanges++;
    if (clothShade(before, clothId) !== clothShade(after, clothId)) shadeChanges++;
  }
  return { shadeChanges, memoryChanges };
}
