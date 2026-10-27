// Mulberry32. The whole generator state is one uint32 so it can live inside the
// immutable game state and make every game exactly replayable from its seed.

export interface RandomDraw {
  value: number;
  nextRngState: number;
}

export function nextRandom(rngState: number): RandomDraw {
  const nextRngState = (rngState + 0x6d2b79f5) >>> 0;
  let mixed = nextRngState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  return { value, nextRngState };
}

export interface ShuffleResult<T> {
  items: T[];
  nextRngState: number;
}

export function shuffle<T>(items: readonly T[], rngState: number): ShuffleResult<T> {
  const shuffled = items.slice();
  let state = rngState;
  for (let i = shuffled.length - 1; i > 0; i--) {
    const draw = nextRandom(state);
    state = draw.nextRngState;
    const j = Math.floor(draw.value * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { items: shuffled, nextRngState: state };
}

/** Mutable generator for bots and simulations, which are not part of game state. */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    const draw = nextRandom(this.state);
    this.state = draw.nextRngState;
    return draw.value;
  }

  int(exclusiveMax: number): number {
    return Math.floor(this.next() * exclusiveMax);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  shuffleInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}
