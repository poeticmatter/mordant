import type { WorkshopConfig } from './engine.ts';

/**
 * v12 (the playtester's puzzle direction): four cloths, one objective each, par from a generated game
 * of one spray per dye. v9–v11 (quilt, then commissions) are in git history.
 */
export const RULES_V12: WorkshopConfig = {
  version: 'v12',
  clothCount: 4,
  clothSize: 12,
  benchSize: 36,
  metThreshold: 0.9,
  cleanShare: 0.97,
  featuresPerObjective: 2,
  plainObjectivesAllowed: 1,
};
