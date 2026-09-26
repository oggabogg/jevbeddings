import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BM25, metrics, topK, aggregate, wilson, pairedBootstrap } from '../study/math.js';
import { parseCSV, digest, normalizeText } from '../study/data.js';
import { BANKING_SCHEMA } from '../study/schema.js';
import { BROAD_QUERIES, CONTROL_CASES } from '../study/queries.js';

test('BANKING schema and supplemental queries match their pre-test freezes', () => {
  const frozen = JSON.parse(readFileSync('study/frozen.json', 'utf8'));
  const queries = JSON.parse(readFileSync('study/frozen-queries.json', 'utf8'));
  assert.equal(digest(JSON.stringify(BANKING_SCHEMA)), frozen.schema_sha256);
  assert.equal(digest(readFileSync('study/PROTOCOL.md')), frozen.protocol_sha256);
  assert.equal(digest(JSON.stringify({ broad_queries: BROAD_QUERIES, control_cases: CONTROL_CASES })), queries.queries_sha256);
  assert.equal(BANKING_SCHEMA.features.length, 34); assert.equal(BROAD_QUERIES.length, 100);
  assert.equal(new Set(BROAD_QUERIES.map(q => q.group)).size, 25);
  const ids = new Set(BANKING_SCHEMA.features.map(f => f.id));
  for (const q of BROAD_QUERIES) for (const id of Object.keys(q.requirements.weights)) assert.ok(ids.has(id));
  for (const c of CONTROL_CASES) { assert.ok(ids.has(c.negative)); for (const id of Object.keys(c.weights)) assert.ok(ids.has(id)); }
});
test('CSV parser preserves quoted commas, quotes, CRLF and embedded newlines', () => {
  const rows = parseCSV('text,category\r\n"A, \"\"quoted\"\" message",one\r\n"two\nlines",two\r\n');
  assert.deepEqual(rows, [{ row: 0, text: 'A, "quoted" message', label: 'one' }, { row: 1, text: 'two\nlines', label: 'two' }]);
  assert.equal(normalizeText(' HELLO\n  there '), 'hello there');
});
test('BM25 uses train-only frequencies and gives exact hand-calculated scores', () => {
  const bm = new BM25(['cash cash card', 'card cash', 'transfer']);
  const s = bm.score('cash');
  const idf = Math.log(1 + (3 - 2 + 0.5) / (2 + 0.5));
  const expected = idf * 2 * 2.2 / (2 + 1.2 * (0.25 + 0.75 * 3 / 2));
  assert.ok(Math.abs(s[0] - expected) < 1e-12); assert.equal(s[2], 0);
  assert.deepEqual(bm.score('cash cash'), bm.score('cash'));
});
test('full-rank MRR, Hit@5 and true document Recall@5 are distinct', () => {
  const scores = Float64Array.from([9, 8, 7, 6, 5, 4, 3, 2]);
  const a = metrics(scores, i => i === 4 || i === 7, 2, 5);
  assert.equal(a.hit5, 1); assert.equal(a.recall5, 0.5); assert.equal(a.precision5, 0.2); assert.equal(a.mrr, 0.2);
  const b = metrics(scores, i => i === 7, 1, 5); assert.equal(b.hit5, 0); assert.equal(b.mrr, 0.125);
  const excluded = metrics(scores, i => i === 4, 1, 5, i => i !== 4); assert.equal(excluded.mrr, 0); assert.equal(excluded.recall5, 0);
});
test('topK matches a full deterministic sort with ties and candidate constraints', () => {
  const scores = Float64Array.from({ length: 1000 }, (_, i) => (i * 371 % 101) / 100);
  const expected = [...scores.keys()].filter(i => i % 3).sort((a, b) => scores[b] - scores[a] || a - b).slice(0, 10);
  assert.deepEqual(topK(scores, 10, i => i % 3), expected);
  assert.deepEqual(topK(new Float64Array(12), 5), [0, 1, 2, 3, 4]);
});
test('Wilson and paired bootstrap are deterministic and handle perfect ties', () => {
  const interval = wilson(50, 100); assert.ok(interval[0] < 0.5 && interval[1] > 0.5);
  assert.deepEqual(pairedBootstrap([0, 1, 1], [0, 1, 1], 100).ci95, [0, 0]);
  assert.equal(aggregate([metrics([1], () => true, 1)]).top1, 1);
});
test('dropping one contribution equals direct ablation up to numerical precision', () => {
  const q = [0.1, 0.8, 0.5], d = [0.3, 0.6, 0.9], w = [0.7, 1.2, 1.8];
  const total = q.reduce((s, v, i) => s + v * d[i] * w[i], 0);
  for (let removed = 0; removed < q.length; removed++) {
    const direct = q.reduce((s, v, i) => s + (i === removed ? 0 : v * d[i] * w[i]), 0);
    assert.ok(Math.abs(total - q[removed] * d[removed] * w[removed] - direct) < 1e-12);
  }
});
