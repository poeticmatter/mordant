import type { OrderSpec } from './orders.ts';
import { DYES, SHADE, type Shade } from './shades.ts';

export interface RulesConfig {
  version: string;
  rackWidth: number;
  rackHeight: number;
  clothsPerDye: number;
  memoryCapacity: number;
  handSize: number;
  seasons: number;
  displaySize: number;
  orderCatalogue: readonly OrderSpec[];
  targetScore: number;
  /** Ablation switch: when false, every cloth is reset to its base dye at each season start. */
  carriesMemoryBetweenSeasons: boolean;
  /** Inspections an unfilled order survives before it is withdrawn; null = it waits forever. */
  orderLifetimeInspections: number | null;
  /** When true, each cloth takes at most one stripe per season (from the first neighbour hung after it). */
  soaksOncePerSeason: boolean;
}

function shadeOrder(shade: Shade, points: number, copies: number): OrderSpec {
  return { requirement: { kind: 'shade', shade }, points, copies };
}

const V1_ORDERS: readonly OrderSpec[] = [
  shadeOrder(SHADE.red, 1, 2),
  shadeOrder(SHADE.yellow, 1, 2),
  shadeOrder(SHADE.blue, 1, 2),
  shadeOrder(SHADE.deepRed, 3, 2),
  shadeOrder(SHADE.deepYellow, 3, 2),
  shadeOrder(SHADE.deepBlue, 3, 2),
  shadeOrder(SHADE.orange, 2, 3),
  shadeOrder(SHADE.green, 2, 3),
  shadeOrder(SHADE.purple, 2, 3),
  shadeOrder(SHADE.brown, 2, 3),
];

/** v2: every full three-stripe sequence (4 pts) plus "ends in X then Y" (2 pts, two copies). */
function buildStripeOrders(): OrderSpec[] {
  const specs: OrderSpec[] = [];
  for (const first of DYES) {
    for (const second of DYES) {
      specs.push({ requirement: { kind: 'pattern', pattern: [null, first, second] }, points: 2, copies: 2 });
      for (const third of DYES) {
        specs.push({ requirement: { kind: 'pattern', pattern: [first, second, third] }, points: 4, copies: 1 });
      }
    }
  }
  return specs;
}

export const RULES_V1: RulesConfig = {
  version: 'v1',
  rackWidth: 4,
  rackHeight: 3,
  clothsPerDye: 6,
  memoryCapacity: 3,
  handSize: 3,
  seasons: 4,
  displaySize: 4,
  orderCatalogue: V1_ORDERS,
  targetScore: 20,
  carriesMemoryBetweenSeasons: true,
  orderLifetimeInspections: null,
  soaksOncePerSeason: false,
};

export const RULES_V2: RulesConfig = {
  ...RULES_V1,
  version: 'v2',
  orderCatalogue: buildStripeOrders(),
};

/** v3: more orders than anyone can fill; unfilled ones are withdrawn after two inspections. */
export const RULES_V3: RulesConfig = {
  ...RULES_V2,
  version: 'v3',
  displaySize: 8,
  orderLifetimeInspections: 2,
};

/** v4: a cloth soaks one stripe per season, so its history is built across seasons. */
export const RULES_V4: RulesConfig = {
  ...RULES_V3,
  version: 'v4',
  soaksOncePerSeason: true,
};

/** v5 (wild idea #3): bolts, two kin cloths ending in the same two stripes, for 6. */
function buildBoltOrders(): OrderSpec[] {
  return DYES.flatMap((first) =>
    DYES.map((second): OrderSpec => ({ requirement: { kind: 'bolt', pattern: [null, first, second] }, points: 6, copies: 1 })),
  );
}

export const RULES_V5: RulesConfig = {
  ...RULES_V4,
  version: 'v5',
  orderCatalogue: [...buildStripeOrders(), ...buildBoltOrders()],
  // From v5 sims: Greedy (35 ± 7) reaches this ~25 % of the time, the Planner (51 ± 4) nearly always.
  targetScore: 40,
};

/** The ruleset the playable UI uses. */
export const CURRENT_RULES: RulesConfig = RULES_V5;

export const RULESETS: Record<string, RulesConfig> = {
  v1: RULES_V1,
  v2: RULES_V2,
  v3: RULES_V3,
  v4: RULES_V4,
  v5: RULES_V5,
};
