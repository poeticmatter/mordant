import type { GameState, Move } from '../engine/game.ts';
import type { Random } from '../engine/rng.ts';

export interface MoveEvaluation {
  move: Move;
  /** Expected final score as estimated by the bot. */
  value: number;
  samples: number;
}

export interface Decision {
  move: Move;
  /** Present for searching bots; sorted best first. Feeds decision-density metrics. */
  evaluations?: MoveEvaluation[];
}

export interface Bot {
  name: string;
  decide(state: GameState, rng: Random): Decision;
}
