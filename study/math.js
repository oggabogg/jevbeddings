export function tokenize(text) { return [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])]; }
export class BM25 {
  constructor(texts, k1 = 1.2, b = 0.75) {
    this.n = texts.length; this.k1 = k1; this.b = b; this.index = new Map(); this.lengths = new Float64Array(texts.length);
    for (let i = 0; i < texts.length; i++) {
      const tokens = texts[i].toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      this.lengths[i] = tokens.length; const counts = new Map();
      for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
      for (const [token, tf] of counts) { if (!this.index.has(token)) this.index.set(token, []); this.index.get(token).push([i, tf]); }
    }
    this.average = this.lengths.reduce((a, b) => a + b, 0) / this.n || 1;
  }
  score(query) {
    const scores = new Float64Array(this.n);
    for (const term of tokenize(query)) {
      const postings = this.index.get(term); if (!postings) continue;
      const idf = Math.log(1 + (this.n - postings.length + 0.5) / (postings.length + 0.5));
      for (const [index, tf] of postings) scores[index] += idf * tf * (this.k1 + 1) /
        (tf + this.k1 * (1 - this.b + this.b * this.lengths[index] / this.average));
    }
    return scores;
  }
}
export const SCORE_EPSILON = 1e-12;
export function topK(scores, k = 10, eligible) {
  const best = [];
  for (let index = 0; index < scores.length; index++) {
    if (eligible && !eligible(index)) continue;
    const last = best.at(-1);
    if (best.length >= k && scores[index] <= scores[last] + SCORE_EPSILON) continue;
    let position = best.length;
    while (position > 0 && scores[index] > scores[best[position - 1]] + SCORE_EPSILON) position--;
    best.splice(position, 0, index); if (best.length > k) best.pop();
  }
  return best;
}
export function metrics(scores, relevant, relevantCount, k = 10, eligible) {
  const top = topK(scores, Math.max(k, 5), eligible);
  let first = -1, candidateCount = 0;
  for (let i = 0; i < scores.length; i++) if (!eligible || eligible(i)) {
    candidateCount++;
    if (relevant(i) && (first < 0 || scores[i] > scores[first] + SCORE_EPSILON)) first = i;
  }
  let rank = 0;
  if (first >= 0) {
    rank = 1;
    for (let i = 0; i < scores.length; i++) if ((!eligible || eligible(i)) &&
      (scores[i] > scores[first] + SCORE_EPSILON || (Math.abs(scores[i] - scores[first]) <= SCORE_EPSILON && i < first))) rank++;
  }
  const hits = n => top.slice(0, n).filter(relevant).length;
  const dcg = top.slice(0, k).reduce((s, i, rank) => s + (relevant(i) ? 1 / Math.log2(rank + 2) : 0), 0);
  const ideal = Array.from({ length: Math.min(k, relevantCount) }, (_, i) => 1 / Math.log2(i + 2)).reduce((a, b) => a + b, 0);
  return { top1: top.length && relevant(top[0]) ? 1 : 0, hit5: hits(5) > 0 ? 1 : 0,
    precision5: hits(5) / 5, recall5: relevantCount ? hits(5) / relevantCount : null,
    hit_at_k: hits(k) > 0 ? 1 : 0, precision_at_k: hits(k) / k, recall_at_k: relevantCount ? hits(k) / relevantCount : null,
    mrr: rank ? 1 / rank : 0, ndcg_at_k: ideal ? dcg / ideal : null,
    first_relevant_rank: rank || null, candidate_count: candidateCount, top };
}
export const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function wilson(success, n) {
  if (!n) return [null, null]; const z = 1.959963984540054, p = success / n;
  const divisor = 1 + z * z / n, center = (p + z * z / (2 * n)) / divisor;
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / divisor;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}
export function aggregate(rows) {
  const keys = ['top1','hit5','precision5','recall5','hit_at_k','precision_at_k','recall_at_k','mrr','ndcg_at_k'];
  const summary = { n: rows.length, ...Object.fromEntries(keys.map(k => [k, mean(rows.map(r => r[k]).filter(v => v !== null))])) };
  summary.top1_ci95 = wilson(rows.reduce((s, r) => s + r.top1, 0), rows.length);
  summary.hit5_ci95 = wilson(rows.reduce((s, r) => s + r.hit5, 0), rows.length);
  return summary;
}
export function pairedBootstrap(a, b, repetitions = 2000, seed = 20260926) {
  if (a.length !== b.length || !a.length) throw new Error('Paired vectors required');
  let state = seed >>> 0;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const differences = a.map((value, i) => value - b[i]), samples = [];
  for (let j = 0; j < repetitions; j++) {
    let sum = 0; for (let i = 0; i < a.length; i++) sum += differences[Math.floor(random() * a.length)];
    samples.push(sum / a.length);
  }
  samples.sort((a, b) => a - b);
  return { difference: mean(differences), ci95: [samples[Math.floor(repetitions * 0.025)], samples[Math.floor(repetitions * 0.975)]], repetitions, seed };
}
export function percentile(values, p) { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor((sorted.length - 1) * p)] : null; }
