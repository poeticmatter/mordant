import type { Random } from '../../engine/rng.ts';
import {
  canInspectEarly,
  isSpoiled,
  legalMoves,
  rackAfterHang,
  shippingCells,
  tagProgress,
  type ClothLook,
  type HangMove,
  type TagsMove,
  type TagsState,
} from './engine.ts';

function hangMoves(state: TagsState): HangMove[] {
  return legalMoves(state).filter((move): move is HangMove => move.kind === 'hang');
}

function bestByValue(state: TagsState, rng: Random, valueOf: (looks: (ClothLook | null)[]) => number): TagsMove {
  let bestMoves: HangMove[] = [];
  let bestValue = -Infinity;
  for (const move of hangMoves(state)) {
    const value = valueOf(rackAfterHang(state, move));
    if (value > bestValue + 1e-9) {
      bestValue = value;
      bestMoves = [move];
    } else if (Math.abs(value - bestValue) <= 1e-9) {
      bestMoves.push(move);
    }
  }
  return rng.pick(bestMoves);
}

function readyCount(looks: readonly (ClothLook | null)[]): number {
  return shippingCells(looks).length;
}

/** Hangs to maximise cloths that would ship if the rack were inspected now; never inspects early or sets aside. */
export function greedyMove(state: TagsState, rng: Random): TagsMove {
  return bestByValue(state, rng, readyCount);
}

const PARTIAL_PROGRESS_WEIGHT = 0.5;
const SPOIL_PENALTY = 1;

function proxyValue(looks: readonly (ClothLook | null)[]): number {
  let value = readyCount(looks);
  for (const look of looks) {
    if (look === null) continue;
    if (isSpoiled(look)) value -= SPOIL_PENALTY;
    else value += (PARTIAL_PROGRESS_WEIGHT * tagProgress(look)) / look.tag.length;
  }
  return value;
}

/**
 * One hang ahead, colour only: values ships now, then progress towards tags, and avoids spoiling cloths.
 * Drops a spoiled cloth in hand where setting aside is allowed, and inspects rather than make a
 * hang that leaves fewer cloths ready to ship.
 */
export function humanProxyMove(state: TagsState, rng: Random): TagsMove {
  if (state.config.allowsSettingAside) {
    const spoiled = state.hand.find((clothId) => isSpoiled(state.cloths[clothId]));
    if (spoiled !== undefined) return { kind: 'setAside', clothId: spoiled };
  }
  const hang = bestByValue(state, rng, proxyValue);
  if (hang.kind !== 'hang' || !canInspectEarly(state)) return hang;
  const readyNow = readyCount(state.rack.map((clothId) => (clothId === null ? null : state.cloths[clothId])));
  return readyCount(rackAfterHang(state, hang)) < readyNow ? { kind: 'inspect' } : hang;
}
