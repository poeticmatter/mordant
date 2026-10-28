import { BROWN, UNDYED, type Mix, type Patch, type WorkshopState } from './engine.ts';
import { turnedGrid } from './geometry.ts';

export interface QuiltScore {
  /** Pairs of touching threads across seams that share a dyed colour. */
  seams: number;
  /** Squares showing at least the configured number of dyed colours. */
  colourfulSquares: number;
  total: number;
}

function isScoringColour(mix: Mix): boolean {
  return mix !== UNDYED && mix !== BROWN;
}

/** Threads of a patch as they lie in the quilt. */
export function patchThreads(state: WorkshopState, patch: Patch): Mix[] {
  return turnedGrid(state.cloths[patch.clothId].threads, state.config.threads, patch.turns);
}

function seamMatches(first: readonly Mix[], second: readonly Mix[]): number {
  return first.filter((mix, index) => isScoringColour(mix) && mix === second[index]).length;
}

function column(threads: readonly Mix[], size: number, index: number): Mix[] {
  return Array.from({ length: size }, (_, row) => threads[row * size + index]);
}

function row(threads: readonly Mix[], size: number, index: number): Mix[] {
  return threads.slice(index * size, (index + 1) * size);
}

/** Matching thread pairs along every seam between two sewn squares. */
export function seamScore(state: WorkshopState, quilt: readonly (Patch | null)[] = state.quilt): number {
  const { quiltWidth, quiltHeight, threads: size } = state.config;
  const sewn = quilt.map((patch) => (patch === null ? null : patchThreads(state, patch)));
  let matches = 0;
  for (let slot = 0; slot < quilt.length; slot++) {
    const here = sewn[slot];
    if (here === null) continue;
    const x = slot % quiltWidth;
    const right = x < quiltWidth - 1 ? sewn[slot + 1] : null;
    const below = slot + quiltWidth < quiltWidth * quiltHeight ? sewn[slot + quiltWidth] : null;
    if (right) matches += seamMatches(column(here, size, size - 1), column(right, size, 0));
    if (below) matches += seamMatches(row(here, size, size - 1), row(below, size, 0));
  }
  return matches;
}

export function colourCount(threads: readonly Mix[]): number {
  return new Set(threads.filter(isScoringColour)).size;
}

export function scoreQuilt(state: WorkshopState, quilt: readonly (Patch | null)[] = state.quilt): QuiltScore {
  const seams = seamScore(state, quilt);
  const colourfulSquares = quilt.filter(
    (patch) => patch !== null && colourCount(state.cloths[patch.clothId].threads) >= state.config.colourfulMinimum,
  ).length;
  return { seams, colourfulSquares, total: seams + colourfulSquares * state.config.colourfulBonus };
}
