import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { BANKING_SCHEMA } from './schema.js';
import { loadSplit, digest } from './data.js';
import { BM25 } from './math.js';

const report = JSON.parse(readFileSync('study/results/results.json', 'utf8'));
const predictions = readFileSync('study/results/e1-predictions.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const db = new DatabaseSync('data/banking77/study.sqlite', { readOnly: true });
const train = loadSplit('train'), test = loadSplit('test'), ids = BANKING_SCHEMA.features.map(f => f.id);
const weights = JSON.parse(readFileSync('study/results/feature-weights.json', 'utf8')).map(f => f.global_weight);
const vectors = {};
for (const split of ['train','test']) {
  const rows = db.prepare('SELECT * FROM vectors WHERE split=? ORDER BY row_id').all(split);
  const source = split === 'train' ? train : test;
  assert.equal(rows.length, source.length);
  vectors[split] = rows.map((row, index) => {
    assert.equal(row.row_id, index); assert.equal(row.text_sha256, digest(source[index].text));
    const metadata = JSON.parse(row.metadata); assert.equal(metadata.model, 'jev-1.13.0');
    const features = JSON.parse(row.features), answers = JSON.parse(row.answers);
    for (const id of ids) { assert.equal(features[id], answers[id].noul); assert.ok(Number.isFinite(features[id])); }
    return ids.map(id => features[id]);
  });
}
const bm25 = new BM25(train.map(r => r.text));
const rows = Array.from({ length: 31 }, (_, i) => Math.floor(i * test.length / 31));
let comparisons = 0;
for (const qi of rows) {
  const q = vectors.test[qi], denominator = q.reduce((s, v, j) => s + v * weights[j], 0), qNorm = Math.hypot(...q);
  const lexical = bm25.score(test[qi].text);
  for (const method of ['bm25','dot','cosine','weighted']) {
    // Independent full-sort reference, rather than the optimized top-K/rank-count algorithm.
    const scores = vectors.train.map((d, i) => {
      if (method === 'bm25') return lexical[i];
      const dot = q.reduce((s, v, j) => s + v * d[j], 0);
      if (method === 'dot') return dot;
      if (method === 'cosine') { const norm = Math.hypot(...d); return qNorm && norm ? dot / (qNorm * norm) : 0; }
      return denominator ? q.reduce((s, v, j) => s + v * d[j] * weights[j], 0) / denominator : 0;
    });
    const full = train.map((_, i) => i).sort((a, b) => Math.abs(scores[a] - scores[b]) <= 1e-12 ? a - b : scores[b] - scores[a]);
    const stored = predictions[qi].methods[method];
    assert.deepEqual(full.slice(0, 10), stored.top.map(r => r.row), `Top-10 mismatch ${qi}/${method}`);
    assert.equal(full.findIndex(i => train[i].label === test[qi].label) + 1, stored.first_relevant_rank, `MRR mismatch ${qi}/${method}`);
    comparisons++;
  }
}
for (const control of report.e4) { assert.equal(control.monotonic_violations, 0); assert.equal(control.hard_filter_violations, 0); }
for (const family of ['entity','event','user_intent','state']) assert.ok(report.e5[`minus_family_${family}`]);
assert.equal(Object.keys(report.e5).length, 38);
assert.equal(report.e3.bm25.n, 100); assert.equal(report.e1_e2.bm25.n, 3080);
const result = { checked_at: new Date().toISOString(), passed: true, vector_rows_verified: 13083,
  full_sort_reference_queries: rows.length, ranking_comparisons: comparisons, checked_methods: ['bm25','cosine','dot','weighted'],
  checks: ['Every row matches its official text fingerprint', 'Every saved score equals its typed JEV answer', 'Pinned response model identities',
    'Independent full-sort top-10 and exact first-relevant ranks', 'No numeric control violations', 'Complete experiment counts'] };
writeFileSync('study/results/audit.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2)); db.close();
