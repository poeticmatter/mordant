import type { WorkshopConfig } from './engine.ts';

/** v9: the playtester's workshop design, first build (deployed on a 12 × 12 thread grid; see git history). Numbers are guesses. */
export const RULES_V9: WorkshopConfig = {
  version: 'v9',
  clothCount: 12,
  clothSize: 12,
  benchSize: 36,
  handSize: 4,
  rounds: 8,
  quiltWidth: 3,
  quiltHeight: 3,
  stitchesPerSeam: 12,
  colourfulBonus: 5,
  colourfulMinimum: 3,
  colourfulMinimumShare: 0.02,
};

/**
 * v10 (playtest 5): smooth, exact dye shapes instead of a thread grid, and exactly as many cloths as
 * the quilt has squares, so every cloth you dye ends up in it.
 */
export const RULES_V10: WorkshopConfig = { ...RULES_V9, version: 'v10', clothCount: 9 };
