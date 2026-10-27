import type { TagsConfig } from './engine.ts';

/** v8 (playtest 3): orders on the cloths themselves, mixing dyes, turnable cloths. */
export const RULES_V8: TagsConfig = {
  version: 'v8',
  // 3 × 3 from V8_PROBES: only half the deck fits each season, so the draw matters every season
  // (playtest 3: with room for everything, late seasons became a full-information layout chore).
  rackWidth: 3,
  rackHeight: 3,
  clothsPerDye: 6,
  // Big enough that most tags take more than one season, so carried colour pays off
  // (with [1, 2, 2, 2, 3, 3] the Planner finished tags within a season and carrying didn't help it).
  tagSizes: [2, 2, 3, 3, 3, 4],
  handSize: 3,
  seasons: 3,
  // Planner reaches 13 in 65 % of games; the human-proxy in about 9 % (sims/v8.log).
  shipTarget: 13,
  carriesMemoryBetweenSeasons: true,
  allowsEarlyInspection: true,
  allowsSettingAside: true,
  allowsTurning: true,
};

/** Tuning probes for v8; kept so the journal's numbers can be reproduced. */
export const V8_PROBES: readonly TagsConfig[] = [
  { ...RULES_V8, version: 'v8-4x3', rackWidth: 4 },
  { ...RULES_V8, version: 'v8-4x3-big-tags', rackWidth: 4, tagSizes: [1, 2, 2, 3, 3, 4] },
  { ...RULES_V8, version: 'v8-4x3-no-turning', rackWidth: 4, allowsTurning: false },
  { ...RULES_V8, version: 'v8-no-turning', allowsTurning: false },
  { ...RULES_V8, version: 'v8-big-tags', tagSizes: [2, 3, 3, 3, 4, 4] },
  { ...RULES_V8, version: 'v8-small-tags', tagSizes: [1, 2, 2, 2, 3, 3], shipTarget: 14 },
];
