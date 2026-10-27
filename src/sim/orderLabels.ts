import type { Order } from '../engine/orders.ts';
import { isDeepPrimary, isPlainPrimary, SHADE, SHADE_NAMES } from '../engine/shades.ts';

const DYE_LETTERS = ['R', 'Y', 'B'];

/** Stable identity of what an order asks for, ignoring which copy it is. */
export function orderKey(order: Order): string {
  const { requirement } = order;
  if (requirement.kind === 'shade') return SHADE_NAMES[requirement.shade];
  const prefix = requirement.kind === 'bolt' ? 'bolt:' : '';
  return prefix + requirement.pattern.map((dye) => (dye === null ? '?' : DYE_LETTERS[dye])).join('');
}

/**
 * Strategy categories, fixed before looking at any distribution (see journal M8).
 * Shade orders: primaries / deep / secondaries / brown.
 * Stripe orders: mono (one dye three times) / sequence (three fixed, mixed) / partial (has a wildcard).
 * Bolt orders (v5, added with the orders themselves): bolt.
 */
export function orderCategory(order: Order): string {
  const { requirement } = order;
  if (requirement.kind === 'shade') {
    if (isPlainPrimary(requirement.shade)) return 'primaries';
    if (isDeepPrimary(requirement.shade)) return 'deep';
    return requirement.shade === SHADE.brown ? 'brown' : 'secondaries';
  }
  if (requirement.kind === 'bolt') return 'bolt';
  if (requirement.pattern.includes(null)) return 'partial';
  return new Set(requirement.pattern).size === 1 ? 'mono' : 'sequence';
}

export function categoryCount(orders: readonly Order[]): number {
  return new Set(orders.map(orderCategory)).size;
}
