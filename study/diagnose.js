// Descriptive post-hoc analysis only. Does not tune or rerun any retrieval method.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadSplit } from './data.js';
import { mean } from './math.js';
const db = new DatabaseSync('data/banking77/study.sqlite', { readOnly: true });
const train = loadSplit('train');
const rows = db.prepare("SELECT row_id,features FROM vectors WHERE split='train' ORDER BY row_id").all();
const profiles = rows.map(r => {
  const features = JSON.parse(r.features), values = Object.values(features);
  return { norm: Math.hypot(...values), mass: values.reduce((a, b) => a + b, 0), active: values.filter(v => v >= 0.5).length, features };
});
const predictions = readFileSync('study/results/e1-predictions.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const report = JSON.parse(readFileSync('study/results/results.json', 'utf8'));
const methods = {};
for (const method of ['bm25','cosine','dot','weighted']) {
  const winners = predictions.map(p => p.methods[method].top[0].row), counts = new Map();
  for (const row of winners) counts.set(row, (counts.get(row) ?? 0) + 1);
  const hubs = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  methods[method] = { mean_winner_norm: mean(winners.map(i => profiles[i].norm)), mean_winner_feature_mass: mean(winners.map(i => profiles[i].mass)),
    mean_winner_active_features: mean(winners.map(i => profiles[i].active)), distinct_winners: counts.size,
    top10_hub_share: hubs.reduce((s, [, count]) => s + count, 0) / winners.length,
    most_frequent_winners: hubs.map(([row, count]) => ({ row, count, label: train[row].label, text: train[row].text, ...profiles[row] })) };
}
const baselines = report.e4.filter(r => r.strength === 0);
const result = { post_hoc: true, generated_at: new Date().toISOString(), no_tuning: true,
  corpus_mean_norm: mean(profiles.map(p => p.norm)), corpus_mean_mass: mean(profiles.map(p => p.mass)),
  corpus_mean_active_features: mean(profiles.map(p => p.active)), methods,
  e4_cases_without_unwanted_baseline_top10: baselines.filter(c => c.unwanted_rate_at_10 === 0).length,
  e4_cases: baselines.length,
  e4_precision_decreases_at_max_penalty: baselines.filter(c => report.e4.find(r => r.case === c.case && r.strength === 1).precision_at_k < c.precision_at_k).map(c => c.case),
  interpretation: 'High winner norm and repeated winner documents are descriptive evidence consistent with feature-mass bias. This is not a causal proof or a tuned correction.' };
writeFileSync('study/results/diagnostics.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, methods: Object.fromEntries(Object.entries(methods).map(([m, { most_frequent_winners, ...v }]) => [m, v])) }, null, 2)); db.close();
