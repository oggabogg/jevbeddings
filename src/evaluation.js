import { assert, number } from './validation.js';

const safeDivide = (a, b) => b === 0 ? null : a / b;
export function retrievalMetrics(rankedIds, relevance, k = 10) {
  const ids = [...new Set(rankedIds)].slice(0, k);
  const relevant = Object.entries(relevance).filter(([, grade]) => grade > 0);
  const hits = ids.filter(id => (relevance[id] ?? 0) > 0).length;
  const first = rankedIds.findIndex(id => (relevance[id] ?? 0) > 0);
  const gain = (grade, i) => (2 ** grade - 1) / Math.log2(i + 2);
  const dcg = ids.reduce((sum, id, i) => sum + gain(relevance[id] ?? 0, i), 0);
  const ideal = relevant.map(([, grade]) => grade).sort((a, b) => b - a).slice(0, k).reduce((sum, grade, i) => sum + gain(grade, i), 0);
  return { precision_at_k: hits / k, recall_at_k: safeDivide(hits, relevant.length),
    reciprocal_rank: first < 0 ? 0 : 1 / (first + 1), ndcg_at_k: safeDivide(dcg, ideal) };
}

export function calibrationMetrics(samples, threshold = 0.5, bucketCount = 10) {
  number(threshold, 0, 1, 'threshold');
  assert(Number.isInteger(bucketCount) && bucketCount > 0, 'Invalid bucket count');
  let tp = 0, tn = 0, fp = 0, fn = 0, brier = 0;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({ lower: i / bucketCount, upper: (i + 1) / bucketCount, count: 0, sum_score: 0, positives: 0 }));
  const evaluated = samples.filter(s => s.score !== null && s.score !== undefined);
  for (const { score, label } of evaluated) {
    number(score, 0, 1, 'score'); assert(label === 0 || label === 1, 'Labels must be binary');
    if (score >= threshold) { if (label) tp++; else fp++; } else { if (label) fn++; else tn++; }
    brier += (score - label) ** 2;
    const bucket = buckets[Math.min(bucketCount - 1, Math.floor(score * bucketCount))];
    bucket.count++; bucket.sum_score += score; bucket.positives += label;
  }
  return { evaluated: evaluated.length, missing: samples.length - evaluated.length, threshold,
    positives: tp + fn, negatives: tn + fp, true_positive: tp, true_negative: tn, false_positive: fp, false_negative: fn,
    accuracy: safeDivide(tp + tn, evaluated.length), precision: safeDivide(tp, tp + fp), recall: safeDivide(tp, tp + fn),
    false_positive_rate: safeDivide(fp, fp + tn), false_negative_rate: safeDivide(fn, fn + tp), brier_score: safeDivide(brier, evaluated.length),
    reliability_buckets: buckets.map(({ sum_score, positives, ...b }) => ({ ...b,
      mean_score: safeDivide(sum_score, b.count), observed_positive_rate: safeDivide(positives, b.count) })) };
}

// Optional, explicitly configured deterministic calibration. Never fit on the evaluation split.
export function piecewiseCalibration(value, points) {
  number(value, 0, 1, 'calibration input');
  assert(Array.isArray(points) && points.length >= 2, 'At least two calibration points are required');
  points.forEach(([x, y], i) => {
    number(x, 0, 1, 'calibration x'); number(y, 0, 1, 'calibration y');
    if (i) assert(x > points[i - 1][0] && y >= points[i - 1][1], 'Calibration mapping must be monotonic');
  });
  assert(points[0][0] === 0 && points.at(-1)[0] === 1, 'Calibration mapping must cover [0,1]');
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    if (value <= x1) return y0 + (value - x0) / (x1 - x0) * (y1 - y0);
  }
}
