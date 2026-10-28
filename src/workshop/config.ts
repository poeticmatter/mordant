import type { WorkshopConfig } from './engine.ts';

/**
 * v11 (playtest feedback on v10): dyes cover instead of mixing, and the quilt is replaced by four random
 * commissions for patterned sheets. v9 (quilt, thread grid) and v10 (quilt, exact shapes, mixing) are in
 * git history. Numbers are first guesses, not tuned.
 */
export const RULES_V11: WorkshopConfig = {
  version: 'v11',
  clothCount: 6,
  clothSize: 12,
  benchSize: 36,
  handSize: 4,
  rounds: 8,
  commissionCount: 4,
  starThresholds: [0.7, 0.85, 0.95],
};
