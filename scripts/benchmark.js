import { mkdirSync, writeFileSync } from 'node:fs';
import { Store } from '../src/store.js';
import { JevClient } from '../src/jev.js';
import { RetrievalService } from '../src/service.js';
import { interpretQuery } from '../src/query.js';
import { rankDocuments } from '../src/scoring.js';
import { calibrationMetrics, retrievalMetrics } from '../src/evaluation.js';
import { documents, benchmarkQueries, seedFixtures } from '../fixtures/support.js';

const live = process.argv.includes('--live');
const store = new Store(live ? './data/benchmark-live.sqlite' : ':memory:');
try {
  if (!live) seedFixtures(store);
  const client = new JevClient({ onCall: call => store.recordCall(call) });
  const service = new RetrievalService(store, client);
  if (live) {
    const known = new Set(store.documents().map(d => d.id));
    for (const { positive, ...d } of documents) if (!known.has(d.id)) store.createDocument(d);
    const indexing = await service.backfill();
    if (indexing.errors.length) throw new Error(indexing.errors[0].message);
  }
  const schema = store.schema(), corpus = store.documents(), runs = [];
  for (const query of benchmarkQueries) {
    const interpretation = live ? await interpretQuery(client, query.query, schema) : { ...query.requirements, unknown_concepts: [], uncertain_requirements: [] };
    for (const variant of ['unweighted', 'weighted', 'filters_weighted']) {
      const weights = variant === 'unweighted'
        ? Object.fromEntries(Object.entries(interpretation.weights).map(([id, w]) => [id, Math.sign(w)])) : interpretation.weights;
      const variantSchema = variant === 'unweighted' ? { ...schema, features: schema.features.map(f => ({ ...f, global_weight: 1 })) } : schema;
      const started = performance.now();
      const ranked = interpretation.unknown_concepts.length || interpretation.uncertain_requirements.length ? { results: [] } : rankDocuments(corpus,
        { weights, filters: variant === 'filters_weighted' ? interpretation.filters : [] }, variantSchema, corpus.length);
      const ids = ranked.results.map(d => d.id);
      runs.push({ query_id: query.id, query: query.query, variant, needs_review: Boolean(interpretation.unknown_concepts.length || interpretation.uncertain_requirements.length), ...retrievalMetrics(ids, query.relevant, 5),
        ranking_latency_ms: performance.now() - started, query_latency_ms: interpretation.metadata?.latency_ms ?? null,
        query_cost_usd: interpretation.metadata?.estimated_cost_usd ?? null, results: ids.slice(0, 5), interpretation });
    }
  }
  const summary = Object.fromEntries(['unweighted', 'weighted', 'filters_weighted'].map(variant => {
    const rows = runs.filter(r => r.variant === variant);
    return [variant, Object.fromEntries(['precision_at_k','recall_at_k','reciprocal_rank','ndcg_at_k','ranking_latency_ms'].map(metric => {
      const valid = rows.filter(r => r[metric] !== null);
      return [metric === 'reciprocal_rank' ? 'mrr' : metric, valid.length ? valid.reduce((s, r) => s + r[metric], 0) / valid.length : null];
    }))];
  }));
  const calibration = Object.fromEntries(schema.features.map(f => [f.id, calibrationMetrics(documents.map(d => ({
    label: d.positive.includes(f.id) ? 1 : 0, score: corpus.find(c => c.id === d.id).features[f.id],
  })))]));
  const report = { mode: live ? 'live_jev' : 'manual_fixture_math_check', generated_at: new Date().toISOString(),
    dataset: 'synthetic_support_v1', limitations: '30 authored synthetic examples with provisional labels; not independent human validation or evidence of production quality. Offline fixtures only verify deterministic mechanics. MRR uses the full ranking. Latency and query costs are shared across ranking variants.',
    k: 5, schema, summary, calibration, runs, costs: store.stats() };
  mkdirSync('reports', { recursive: true });
  const path = `reports/benchmark-${live ? 'live' : 'fixtures'}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode: report.mode, summary, report: path, costs: report.costs }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { store.close(); }
