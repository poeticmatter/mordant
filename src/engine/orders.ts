import { DEEP_OFFSET, isPlainPrimary, shadeOf, type Dye, type Shade } from './shades.ts';

/** A stripe pattern is read oldest → newest and aligned to the cloth's newest dye. `null` = any. */
export type StripePattern = readonly (Dye | null)[];

export type OrderRequirement =
  | { kind: 'shade'; shade: Shade }
  | { kind: 'pattern'; pattern: StripePattern }
  /** Two cloths that have shared dye with each other (kin), both matching `pattern`. */
  | { kind: 'bolt'; pattern: StripePattern };

export interface Order {
  id: number;
  requirement: OrderRequirement;
  points: number;
}

/** An order on display, stamped with the season it was revealed in (for expiry). */
export interface PostedOrder extends Order {
  postedSeason: number;
}

export function postOrder(order: Order, season: number): PostedOrder {
  return { ...order, postedSeason: season };
}

export interface OrderSpec {
  requirement: OrderRequirement;
  points: number;
  copies: number;
}

export function buildOrderDeck(catalogue: readonly OrderSpec[]): Order[] {
  const deck: Order[] = [];
  for (const spec of catalogue) {
    for (let copy = 0; copy < spec.copies; copy++) {
      deck.push({ id: deck.length, requirement: spec.requirement, points: spec.points });
    }
  }
  return deck;
}

export function shadeAccepts(orderShade: Shade, clothShade: Shade): boolean {
  if (isPlainPrimary(orderShade)) {
    return clothShade === orderShade || clothShade === orderShade + DEEP_OFFSET;
  }
  return clothShade === orderShade;
}

export function patternAccepts(pattern: StripePattern, dyes: readonly Dye[]): boolean {
  const offset = dyes.length - pattern.length;
  for (let stripe = 0; stripe < pattern.length; stripe++) {
    const wanted = pattern[stripe];
    if (wanted === null) continue;
    const index = offset + stripe;
    if (index < 0 || dyes[index] !== wanted) return false;
  }
  return true;
}

export function orderAccepts(order: Order, dyes: readonly Dye[], memoryCapacity: number): boolean {
  const { requirement } = order;
  if (requirement.kind === 'shade') return shadeAccepts(requirement.shade, shadeOf(dyes, memoryCapacity));
  return patternAccepts(requirement.pattern, dyes);
}

export function isBolt(order: Order): boolean {
  return order.requirement.kind === 'bolt';
}

/** What inspection looks at: each peg's memory, and which other pegs hold its kin. */
export interface RackView {
  memories: readonly (readonly Dye[] | null)[];
  /** Bit t of kinMasks[s] is set when the cloths on pegs s and t have shared dye. */
  kinMasks: readonly number[];
}

export interface Assignment {
  points: number;
  /** Pegs (as a bitmask) that order i, in display order, takes; 0 when unfilled. */
  pegMaskByOrder: number[];
}

/** Bit s of acceptanceMasks[i] is set when order i accepts the cloth in slot s on its own. Slots must be < 31. */
export function acceptanceMasks(
  display: readonly Order[],
  memories: readonly (readonly Dye[] | null)[],
  memoryCapacity: number,
): number[] {
  return display.map((order) => {
    let mask = 0;
    for (let slot = 0; slot < memories.length; slot++) {
      const dyes = memories[slot];
      if (dyes !== null && orderAccepts(order, dyes, memoryCapacity)) mask |= 1 << slot;
    }
    return mask;
  });
}

/** Every peg set an order could take: single pegs, or kin pairs for bolts. */
export function candidatePegSets(order: Order, acceptanceMask: number, kinMasks: readonly number[]): number[] {
  const sets: number[] = [];
  for (let remaining = acceptanceMask; remaining !== 0; remaining &= remaining - 1) {
    const bit = remaining & -remaining;
    if (!isBolt(order)) {
      sets.push(bit);
      continue;
    }
    const slot = 31 - Math.clz32(bit);
    // Pair each peg only with higher pegs so every pair appears once.
    for (let partners = kinMasks[slot] & acceptanceMask & ~(bit * 2 - 1); partners !== 0; partners &= partners - 1) {
      sets.push(bit | (partners & -partners));
    }
  }
  return sets;
}

export function bestAssignment(display: readonly Order[], view: RackView, memoryCapacity: number): Assignment {
  const masks = acceptanceMasks(display, view.memories, memoryCapacity);
  return assignFromCandidates(display, display.map((order, index) => candidatePegSets(order, masks[index], view.kinMasks)));
}

/**
 * Points-maximising match of orders to peg sets (each cloth fills at most one order).
 * The display holds a handful of orders, so an exhaustive search over bitmasks is
 * exact and cheap enough to run inside every rollout step.
 */
export function assignFromCandidates(display: readonly Order[], candidates: readonly (readonly number[])[]): Assignment {
  const best: Assignment = { points: 0, pegMaskByOrder: display.map(() => 0) };
  const current = best.pegMaskByOrder.slice();

  function search(orderIndex: number, usedMask: number, points: number): void {
    if (orderIndex === display.length) {
      if (points > best.points) {
        best.points = points;
        best.pegMaskByOrder = current.slice();
      }
      return;
    }
    for (const pegs of candidates[orderIndex]) {
      if ((pegs & usedMask) !== 0) continue;
      current[orderIndex] = pegs;
      search(orderIndex + 1, usedMask | pegs, points + display[orderIndex].points);
    }
    current[orderIndex] = 0;
    search(orderIndex + 1, usedMask, points);
  }

  if (candidates.every((sets) => sets.length === 0)) return best;
  search(0, 0, 0);
  return best;
}

/** Points-only variant of `assignFromCandidates` for hot loops. */
export function maxPointsFromCandidates(
  display: readonly Order[],
  candidates: readonly (readonly number[])[],
  orderIndex = 0,
  usedMask = 0,
): number {
  if (orderIndex === display.length) return 0;
  let best = maxPointsFromCandidates(display, candidates, orderIndex + 1, usedMask);
  for (const pegs of candidates[orderIndex]) {
    if ((pegs & usedMask) !== 0) continue;
    const points = display[orderIndex].points + maxPointsFromCandidates(display, candidates, orderIndex + 1, usedMask | pegs);
    if (points > best) best = points;
  }
  return best;
}
