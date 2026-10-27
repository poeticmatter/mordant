import type { SelvedgeConfig } from './engine.ts';

/** v6 (wild-idea round 2): edges stained by neighbours, a pattern book instead of score, early inspection. */
export const RULES_V6: SelvedgeConfig = {
  version: 'v6',
  rackWidth: 4,
  rackHeight: 3,
  clothsPerDye: 6,
  handSize: 3,
  // Chosen from V6_PROBES: the Planner completes the book ~70 % of the time, Greedy never.
  seasons: 3,
  fixedEdgesPerCommission: [2, 2, 3, 3, 3, 4, 4, 4],
  carriesMemoryBetweenSeasons: true,
  allowsEarlyInspection: true,
  allowsSettingAside: false,
};

/** v7 (playtest 2): "discard blue cloths, as soon as I dyed all the blue edges I needed". */
export const RULES_V7: SelvedgeConfig = { ...RULES_V6, version: 'v7', allowsSettingAside: true };

/** Difficulty probes for v6 tuning; kept so the journal's numbers can be reproduced. */
export const V6_PROBES: readonly SelvedgeConfig[] = [
  { ...RULES_V6, version: 'v6-6book-4seasons', fixedEdgesPerCommission: [2, 2, 3, 3, 4, 4], seasons: 4 },
  { ...RULES_V6, version: 'v6-8book-4seasons', seasons: 4 },
  { ...RULES_V6, version: 'v6-6book-3seasons', fixedEdgesPerCommission: [2, 2, 3, 3, 4, 4] },
  { ...RULES_V6, version: 'v6-hard-4seasons', fixedEdgesPerCommission: [3, 3, 3, 4, 4, 4], seasons: 4 },
];
