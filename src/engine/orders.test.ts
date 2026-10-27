import { describe, expect, it } from 'vitest';
import { bestAssignment, patternAccepts, type Order, type RackView } from './orders.ts';
import { BLUE, RED, SHADE, YELLOW, type Dye } from './shades.ts';

const CAPACITY = 3;

function strangers(memories: (Dye[] | null)[]): RackView {
  return { memories, kinMasks: memories.map(() => 0) };
}

function patternOrder(id: number, pattern: (Dye | null)[], points: number): Order {
  return { id, requirement: { kind: 'pattern', pattern }, points };
}

function boltOrder(id: number, pattern: (Dye | null)[], points: number): Order {
  return { id, requirement: { kind: 'bolt', pattern }, points };
}

describe('patternAccepts', () => {
  it('matches a full sequence oldest to newest', () => {
    expect(patternAccepts([BLUE, YELLOW, RED], [BLUE, YELLOW, RED])).toBe(true);
  });

  it('rejects the same dyes in a different order', () => {
    expect(patternAccepts([BLUE, YELLOW, RED], [RED, YELLOW, BLUE])).toBe(false);
  });

  it('aligns a wildcard pattern to the newest dyes of a short memory', () => {
    expect(patternAccepts([null, YELLOW, RED], [YELLOW, RED])).toBe(true);
  });

  it('rejects a fixed stripe the cloth has never received', () => {
    expect(patternAccepts([BLUE, YELLOW, RED], [YELLOW, RED])).toBe(false);
  });
});

describe('bestAssignment', () => {
  it('gives a contested cloth to the order worth more', () => {
    const orders = [patternOrder(0, [null, YELLOW, RED], 2), patternOrder(1, [BLUE, YELLOW, RED], 4)];
    const result = bestAssignment(orders, strangers([[BLUE, YELLOW, RED]]), CAPACITY);
    expect(result.pegMaskByOrder).toEqual([0, 0b1]);
  });

  it('routes cloths so both orders are filled when possible', () => {
    const orders: Order[] = [
      { id: 0, requirement: { kind: 'shade', shade: SHADE.red }, points: 1 },
      { id: 1, requirement: { kind: 'shade', shade: SHADE.deepRed }, points: 3 },
    ];
    expect(bestAssignment(orders, strangers([[RED, RED, RED], [RED]]), CAPACITY).points).toBe(4);
  });

  it('ignores empty pegs', () => {
    const orders: Order[] = [{ id: 0, requirement: { kind: 'shade', shade: SHADE.blue }, points: 1 }];
    expect(bestAssignment(orders, strangers([null, null]), CAPACITY).points).toBe(0);
  });
});

describe('bolts', () => {
  const pair: (Dye[] | null)[] = [[BLUE, RED], [YELLOW, RED]];

  it('take two matching cloths that are kin', () => {
    const view: RackView = { memories: pair, kinMasks: [0b10, 0b01] };
    expect(bestAssignment([boltOrder(0, [null, null, RED], 6)], view, CAPACITY).pegMaskByOrder).toEqual([0b11]);
  });

  it('refuse two matching cloths that never shared dye', () => {
    expect(bestAssignment([boltOrder(0, [null, null, RED], 6)], strangers(pair), CAPACITY).points).toBe(0);
  });

  it('beat two single orders that would split the pair for less', () => {
    const orders = [boltOrder(0, [null, null, RED], 6), patternOrder(1, [null, BLUE, RED], 2), patternOrder(2, [null, YELLOW, RED], 2)];
    const view: RackView = { memories: pair, kinMasks: [0b10, 0b01] };
    expect(bestAssignment(orders, view, CAPACITY).points).toBe(6);
  });
});
