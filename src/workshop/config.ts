import type { WorkshopConfig } from './engine.ts';

/** v9: the playtester's workshop design, first build. Numbers are first guesses, not tuned. */
export const RULES_V9: WorkshopConfig = {
  version: 'v9',
  clothCount: 12,
  threads: 12,
  benchSize: 36,
  handSize: 4,
  rounds: 8,
  quiltWidth: 3,
  quiltHeight: 3,
  colourfulBonus: 5,
  colourfulMinimum: 3,
};
