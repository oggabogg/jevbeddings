import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SCHEMA } from '../src/schema.js';
import { JevClient } from '../src/jev.js';
import { rankDocuments } from '../src/scoring.js';
import { validateRequirements, interpretQuery, INTENTS } from '../src/query.js';
import { Store } from '../src/store.js';
import { RetrievalService } from '../src/service.js';
import { calibrationMetrics, retrievalMetrics, piecewiseCalibration } from '../src/evaluation.js';
import { createApp } from '../src/server.js';
import { seedFixtures, documents } from '../fixtures/support.js';

const schema = INITIAL_SCHEMA;
const doc = (id, features) => ({ id, features });
const rank = (docs, weights, filters = [], customSchema = schema) => rankDocuments(docs, { weights, filters }, customSchema);
const response = answers => ({ model: 'jev-1.13.0', answers, usage: { input_tokens: 100, output_tokens: 10 } });
const fakeFetch = transform => async (_url, options) => {
  const request = JSON.parse(options.body);
  const answers = Object.fromEntries(Object.entries(request.questions).map(([id, q]) => [id, q.type === 'noul'
    ? { type: 'noul', noul: 0.75 }
    : { type: 'choice', choice: 'irrelevant', confidence: 0.9, probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === 'irrelevant' ? 1 : 0])) }]));
  return Response.json(transform ? transform(response(answers), request) : response(answers));
};
const fakeClient = transform => new JevClient({ apiKey: 'test-only', fetchImpl: fakeFetch(transform), sleepImpl: async () => {}, inputPrice: 0.042 });

test('magnitude survives: cosine ties A and B, dot product ranks B above A', () => {
  const a = [0, 0, 0, 0.1], b = [0, 0, 0, 1], q = [0, 0, 0, 1];
  const dot = (x, y) => x.reduce((sum, v, i) => sum + v * y[i], 0);
  const cosine = (x, y) => dot(x, y) / (Math.sqrt(dot(x, x)) * Math.sqrt(dot(y, y)));
  assert.equal(cosine(a, q), cosine(b, q)); assert.ok(dot(a, q) < dot(b, q));
  const results = rank([doc('A', { needs_reply: 0.1 }), doc('B', { needs_reply: 1 })], { needs_reply: 1 }).results;
  assert.deepEqual(results.map(r => r.id), ['B', 'A']); assert.equal(results[1].normalized_score, 0.1);
});
test('normalization, global weights, and separate penalties explain exact scores', () => {
  const weighted = { ...schema, features: schema.features.map(f => ({ ...f, global_weight: f.id === 'urgent' ? 2 : 1 })) };
  const result = rank([doc('a', { urgent: 0.8, about_billing: 0.5, is_newsletter: 0.7 })],
    { urgent: 0.5, about_billing: 1, is_newsletter: -1 }, [], weighted).results[0];
  assert.equal(result.positive_relevance, 1.3); assert.equal(result.negative_penalty, 0.7);
  assert.ok(Math.abs(result.raw_score - 0.6) < 1e-10); assert.ok(Math.abs(result.normalized_score - 0.3) < 1e-10);
  assert.equal(result.why.reduce((s, w) => s + w.contribution, 0), result.raw_score);
});
test('missing, zero, negative-only, and filter-only queries have explicit semantics', () => {
  const results = rank([doc('missing', {}), doc('zero', { urgent: 0 })], { urgent: 1 }).results;
  assert.equal(results[0].normalized_score, 0); assert.equal(results[0].why[0].contribution, null);
  assert.deepEqual(results[0].missing_features, ['urgent']); assert.equal(results[1].why[0].contribution, 0);
  const negative = rank([doc('a', { is_newsletter: 0.2 }), doc('b', { is_newsletter: 0.8 })], { is_newsletter: -1 }).results;
  assert.equal(negative[0].normalized_score, null); assert.equal(negative[0].relevance_score, -0.2);
  const filtered = rank([doc('missing', {}), doc('present', { urgent: 0 })], {}, [{ feature: 'urgent', operator: '<=', value: 0.2 }]);
  assert.equal(filtered.results[0].id, 'present'); assert.equal(filtered.filtered_count, 1);
});
test('missing negative preference is visible and not imputed', () => {
  const r = rank([doc('a', { urgent: 1 })], { urgent: 1, is_newsletter: -1 }).results[0];
  assert.equal(r.relevance_score, 1); assert.deepEqual(r.missing_features, ['is_newsletter']);
});
test('all supported hard filter operators work at boundaries', () => {
  for (const operator of ['>=', '<=', '=']) assert.equal(rank([doc('a', { urgent: 0.8 })], {}, [{ feature: 'urgent', operator, value: 0.8 }]).results.length, 1);
  for (const operator of ['>', '<']) assert.equal(rank([doc('a', { urgent: 0.8 })], {}, [{ feature: 'urgent', operator, value: 0.8 }]).results.length, 0);
});
test('invalid weights, IDs, ranges and NaN are rejected', () => {
  for (const weights of [{ made_up: 1 }, { urgent: NaN }, { urgent: 2 }, { urgent: '1' }, { urgent: Infinity }])
    assert.throws(() => validateRequirements({ weights }, schema));
  assert.throws(() => validateRequirements({ weights: {}, filters: [{ feature: 'urgent', operator: 'LIKE', value: 0 }] }, schema));
  assert.throws(() => validateRequirements({ weights: {}, surprise: 1 }, schema));
});
test('schema additions backfill just the new feature and preserve previous values', async () => {
  const store = new Store(':memory:');
  try {
    store.createDocument({ id: 'one', title: 'Test', body: 'Test document' });
    const service = new RetrievalService(store, fakeClient()); await service.index('one');
    const v1 = store.document('one');
    store.addFeature({ id: 'delivery_delay', description: 'Delivery delay', definition: 'A promised delivery arrived late.',
      question: 'Does this document report a late delivery?', type: 'probability', value_range: [0, 1], global_weight: 1 });
    assert.equal(store.document('one').features.delivery_delay, null); assert.equal(store.document('one').schema_version, 1);
    const result = await service.index('one'); assert.deepEqual(result.evaluated_features, ['delivery_delay']);
    assert.equal(result.document.schema_version, 2); assert.equal(result.document.features.urgent, v1.features.urgent);
    assert.equal(result.document.feature_metadata.find(f => f.feature_id === 'urgent').schema_version, 1);
    assert.deepEqual((await service.index('one')).evaluated_features, []);
    assert.throws(() => store.addFeature({ ...schema.features[0] }));
  } finally { store.close(); }
});
test('failed extraction never commits a partial document vector', async () => {
  const store = new Store(':memory:');
  try {
    store.createDocument({ id: 'one', title: 'Test', body: 'Test' });
    const service = new RetrievalService(store, fakeClient(payload => { payload.answers.urgent.noul = 10; return payload; }));
    await assert.rejects(() => service.index('one'), /invalid typed response/);
    assert.equal(store.document('one').indexed_at, null); assert.ok(Object.values(store.document('one').features).every(v => v === null));
  } finally { store.close(); }
});
test('wire request uses official endpoint, shared state and fixed typed questions', async () => {
  let captured;
  const client = new JevClient({ apiKey: 'test', fetchImpl: async (url, options) => {
    captured = { url, ...JSON.parse(options.body), redirect: options.redirect };
    return Response.json(response({ urgent: { type: 'noul', noul: 0.91 } }));
  } });
  await client.evaluate('one document', { urgent: { type: 'noul', instructions: 'Is it urgent?' } }, 'index');
  assert.equal(captured.url, 'https://api.typesafe.ai/v1/systemone'); assert.equal(captured.model, 'jev-1.13.0');
  assert.equal(captured.state, 'one document'); assert.equal(captured.redirect, 'error'); assert.equal(captured.questions.urgent.type, 'noul');
  assert.throws(() => new JevClient({ model: 'other-model' }), /Only JEV/);
});
test('retry transient errors, respect retry-after and do not retry auth errors', async () => {
  let calls = 0; const delays = [];
  const client = new JevClient({ apiKey: 'test', sleepImpl: async ms => delays.push(ms), fetchImpl: async () => {
    calls++; if (calls === 1) return new Response('', { status: 429, headers: { 'retry-after': '1' } });
    return Response.json(response({ urgent: { type: 'noul', noul: 0.9 } }));
  } });
  const result = await client.evaluate('test', { urgent: { type: 'noul' } }, 'index');
  assert.equal(result.metadata.attempts, 2); assert.ok(delays[0] >= 1000);
  let authCalls = 0;
  const auth = new JevClient({ apiKey: 'test', fetchImpl: async () => { authCalls++; return new Response('', { status: 401 }); } });
  await assert.rejects(() => auth.evaluate('test', { urgent: { type: 'noul' } }, 'index'), /401/); assert.equal(authCalls, 1);
});
test('malformed, missing and invented answer fields fail validation', async () => {
  for (const transform of [p => { delete p.answers.urgent; return p; }, p => { p.answers.fake = p.answers.urgent; return p; },
    p => { p.answers.urgent.noul = '0.5'; return p; }, p => { p.model = 'non-jev'; return p; }]) {
    await assert.rejects(() => fakeClient(transform).evaluate('test', { urgent: { type: 'noul' } }, 'index'), /invalid typed response/);
  }
});
test('query Choice confidence is separate from importance and exclusions are hard filters', async () => {
  const client = fakeClient(payload => {
    for (const [id, choice] of [['urgent', 'weak'], ['is_newsletter', 'exclude'], ['is_marketing', 'avoid']]) {
      payload.answers[id] = { type: 'choice', choice, confidence: choice === 'exclude' ? 0.95 : 0.55, probabilities: Object.fromEntries(Object.keys(INTENTS).map(k => [k, k === choice ? 1 : 0])) };
    }
    return payload;
  });
  const q = await interpretQuery(client, 'slightly urgent, exclude newsletters and avoid marketing', schema);
  assert.equal(q.weights.urgent, 0.3); assert.equal(q.decisions.urgent.confidence, 0.55);
  assert.equal(q.weights.is_marketing, -0.5); assert.deepEqual(q.filters, [{ feature: 'is_newsletter', operator: '<=', value: 0.2 }]);
});
test('low-confidence hard constraints do not silently hide results', async () => {
  const store = new Store(':memory:');
  try {
    seedFixtures(store);
    const client = fakeClient(p => {
      p.answers.urgent = { type: 'choice', choice: 'exclude', confidence: 0.6,
        probabilities: Object.fromEntries(Object.keys(INTENTS).map(k => [k, k === 'exclude' ? 0.7 : k === 'irrelevant' ? 0.3 : 0])) };
      return p;
    });
    const service = new RetrievalService(store, client);
    const result = await service.search({ query: 'praise without replies' });
    assert.equal(result.status, 'needs_review'); assert.equal(result.query_interpretation.filters.length, 0);
    assert.equal(result.query_interpretation.uncertain_requirements[0].feature, 'urgent');
  } finally { store.close(); }
});
test('unsupported concepts are reported and partial retrieval requires explicit opt-in', async () => {
  const store = new Store(':memory:');
  try {
    seedFixtures(store);
    const service = new RetrievalService(store, fakeClient(p => {
      p.answers.query_coverage.noul = 0.1;
      p.answers.urgent = { type: 'choice', choice: 'requested', confidence: 1, probabilities: Object.fromEntries(Object.keys(INTENTS).map(k => [k, k === 'requested' ? 1 : 0])) };
      return p;
    }));
    const blocked = await service.search({ query: 'Urgent messages about the moon' });
    assert.equal(blocked.status, 'needs_review'); assert.equal(blocked.results.length, 0);
    assert.equal(blocked.query_interpretation.unknown_concepts[0].scope, 'whole_query');
    assert.equal((await service.search({ query: 'Urgent messages about the moon', allow_partial: true })).status, 'ok');
  } finally { store.close(); }
});
test('retrieval metrics and calibration handle sparse judgments and undefined rates', () => {
  const metrics = retrievalMetrics(['x', 'b', 'a'], { a: 3, b: 1 }, 2);
  assert.equal(metrics.precision_at_k, 0.5); assert.equal(metrics.recall_at_k, 0.5); assert.equal(metrics.reciprocal_rank, 0.5);
  assert.equal(retrievalMetrics(['x', 'y', 'a'], { a: 1 }, 2).reciprocal_rank, 1 / 3);
  const c = calibrationMetrics([{ score: 0.9, label: 1 }, { score: 0.8, label: 0 }, { score: 0.1, label: 1 }, { score: 0, label: 0 }, { score: null, label: 0 }]);
  assert.equal(c.accuracy, 0.5); assert.equal(c.precision, 0.5); assert.equal(c.recall, 0.5); assert.equal(c.missing, 1);
  assert.equal(c.false_positive_rate, 0.5); assert.equal(c.false_negative_rate, 0.5);
  assert.equal(calibrationMetrics([]).accuracy, null);
  assert.equal(piecewiseCalibration(0.75, [[0, 0], [0.5, 0.4], [1, 1]]), 0.7);
});
test('synthetic labeled set has positive and negative examples for all features', () => {
  for (const feature of schema.features) { assert.ok(documents.some(d => d.positive.includes(feature.id)), feature.id); assert.ok(documents.some(d => !d.positive.includes(feature.id)), feature.id); }
});
test('1000 document ranking uses magnitudes and deterministic tie breaking', () => {
  const docs = Array.from({ length: 1000 }, (_, i) => doc(`doc_${String(i).padStart(4, '0')}`, { urgent: i / 999 }));
  const ranked = rank(docs, { urgent: 1 }); assert.equal(ranked.matched_count, 1000); assert.equal(ranked.results[0].id, 'doc_0999');
});
test('API creates, indexes, searches, inspects, rejects invalid input and cross-origin writes', async () => {
  const store = new Store(':memory:'); const server = createApp({ store, client: fakeClient() });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    const create = await post('/documents', { id: 'api_doc', title: '<script>test</script>', body: 'Customer needs help' }); assert.equal(create.status, 201);
    assert.equal((await post('/documents/api_doc/index', {})).status, 200);
    const search = await (await post('/search', { requirements: { weights: { urgent: 1 }, filters: [] } })).json();
    assert.equal(search.results[0].id, 'api_doc'); assert.equal(search.results[0].relevance_score, 0.75);
    const features = await (await fetch(base + '/documents/api_doc/features')).json(); assert.equal(features.feature_metadata.length, 18);
    assert.equal((await post('/search', { requirements: { weights: { unknown: 1 } } })).status, 400);
    assert.equal((await post('/documents', { title: 'bad', body: 'bad' }, { Origin: 'https://attacker.example' })).status, 403);
    assert.equal((await fetch(base + '/')).status, 200);
    assert.equal((await fetch(base + '/.env')).status, 404);
    const bulk = await post('/documents/bulk', { documents: [{ id: 'rollback', title: 'one', body: 'a' }, { id: 'api_doc', title: 'duplicate', body: 'b' }] });
    assert.equal(bulk.status, 409); assert.throws(() => store.document('rollback'));
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});
