import type { GameRecord } from './play.ts';

export interface ScoreSummary {
  games: number;
  mean: number;
  sd: number;
  winRate: number;
}

export function summarizeScores(records: readonly GameRecord[]): ScoreSummary {
  const scores = records.map((record) => record.score);
  return {
    games: records.length,
    mean: mean(scores),
    sd: standardDeviation(scores),
    winRate: mean(records.map((record) => (record.isWin ? 1 : 0))),
  };
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: readonly number[]): number {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

/** Difference of means in units of the reference group's SD. */
export function effectSize(better: readonly GameRecord[], worse: readonly GameRecord[], reference: readonly GameRecord[]): number {
  const referenceSd = standardDeviation(reference.map((record) => record.score));
  return (summarizeScores(better).mean - summarizeScores(worse).mean) / referenceSd;
}

export interface DecisionDensity {
  closeShare: number;
  trivialShare: number;
  delta: number;
}

export function decisionDensity(planner: readonly GameRecord[]): DecisionDensity {
  const delta = 0.25 * standardDeviation(planner.map((record) => record.score));
  const decisions = planner.flatMap((record) => record.decisions);
  const searched = decisions.filter((decision) => decision.topGap !== null && decision.distinctCount > 1);
  const isTrivial = (decision: (typeof decisions)[number]) =>
    decision.distinctCount <= 1 || (decision.valueSpread !== null && decision.valueSpread < delta / 4);
  return {
    closeShare: mean(searched.map((decision) => ((decision.topGap as number) < delta ? 1 : 0))),
    trivialShare: mean(decisions.map((decision) => (isTrivial(decision) ? 1 : 0))),
    delta,
  };
}

/** The order category that earned this game the most points (labels in orderLabels.ts). */
export function strategyLabel(record: GameRecord): string {
  const pointsByLabel = new Map<string, number>();
  for (const shipment of record.shipments) {
    pointsByLabel.set(shipment.category, (pointsByLabel.get(shipment.category) ?? 0) + shipment.points);
  }
  let best = 'none';
  let bestPoints = 0;
  for (const [label, points] of pointsByLabel) {
    if (points > bestPoints) {
      best = label;
      bestPoints = points;
    }
  }
  return best;
}

export interface Diversity {
  labelShares: Record<string, number>;
  topShare: number;
  normalizedEntropy: number;
}

export function strategicDiversity(planner: readonly GameRecord[], categoryCount: number): Diversity {
  const wins = planner.filter((record) => record.isWin);
  const counts = new Map<string, number>();
  for (const record of wins) {
    const label = strategyLabel(record);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const shares = [...counts.values()].map((count) => count / Math.max(1, wins.length));
  const entropy = -shares.reduce((sum, share) => sum + (share > 0 ? share * Math.log(share) : 0), 0);
  return {
    labelShares: Object.fromEntries([...counts].map(([label, count]) => [label, count / wins.length])),
    topShare: Math.max(0, ...shares),
    normalizedEntropy: entropy / Math.log(categoryCount),
  };
}

export function quantile(values: readonly number[], fraction: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

/** A target the Planner beats about 65 % of the time, so tension is measured where wins and losses both happen. */
export function calibratedTarget(planner: readonly GameRecord[]): number {
  return quantile(planner.map((record) => record.score), 0.35);
}

/** Area under the ROC curve for "score so far at this point of the game predicts reaching `target`". */
export function tensionAuc(planner: readonly GameRecord[], gameFraction: number, target: number): number {
  const points = planner.map((record) => {
    const index = Math.min(record.decisions.length - 1, Math.floor(record.decisions.length * gameFraction));
    return { predictor: record.decisions[index].scoreBefore, isWin: record.score >= target };
  });
  return rocAuc(points);
}

function rocAuc(points: readonly { predictor: number; isWin: boolean }[]): number {
  const wins = points.filter((point) => point.isWin);
  const losses = points.filter((point) => !point.isWin);
  if (wins.length === 0 || losses.length === 0) return NaN;
  let favourable = 0;
  for (const win of wins) {
    for (const loss of losses) {
      if (win.predictor > loss.predictor) favourable += 1;
      else if (win.predictor === loss.predictor) favourable += 0.5;
    }
  }
  return favourable / (wins.length * losses.length);
}

/** Mean weighted-Jaccard distance between games' profiles of what they shipped. */
export function runVariety(records: readonly GameRecord[]): number {
  const profiles = records.map((record) => {
    const profile = new Map<string, number>();
    for (const shipment of record.shipments) profile.set(shipment.orderKey, (profile.get(shipment.orderKey) ?? 0) + 1);
    return profile;
  });
  const distances: number[] = [];
  for (let a = 0; a < profiles.length; a++) {
    for (let b = a + 1; b < profiles.length; b++) {
      let shared = 0;
      let combined = 0;
      for (const key of new Set([...profiles[a].keys(), ...profiles[b].keys()])) {
        const countA = profiles[a].get(key) ?? 0;
        const countB = profiles[b].get(key) ?? 0;
        shared += Math.min(countA, countB);
        combined += Math.max(countA, countB);
      }
      distances.push(combined === 0 ? 0 : 1 - shared / combined);
    }
  }
  return mean(distances);
}

export interface Pacing {
  meanDecisions: number;
  coefficientOfVariation: number;
  meanDistinctChoices: number;
  meanLookChanges: number;
  meanMemoryChanges: number;
}

export function pacing(records: readonly GameRecord[]): Pacing {
  const lengths = records.map((record) => record.decisions.length);
  const decisions = records.flatMap((record) => record.decisions);
  return {
    meanDecisions: mean(lengths),
    coefficientOfVariation: standardDeviation(lengths) / mean(lengths),
    meanDistinctChoices: mean(decisions.map((decision) => decision.distinctCount)),
    meanLookChanges: mean(decisions.map((decision) => decision.lookChanges)),
    meanMemoryChanges: mean(decisions.map((decision) => decision.memoryChanges)),
  };
}
