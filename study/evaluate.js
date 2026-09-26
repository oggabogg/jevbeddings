import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { BANKING_SCHEMA } from './schema.js';
import { BROAD_QUERIES, CONTROL_CASES } from './queries.js';
import { loadSplit, normalizeText, digest } from './data.js';
import { BM25, metrics, topK, aggregate, mean, percentile, pairedBootstrap } from './math.js';

const started = performance.now();
const out = 'study/results'; mkdirSync(out, { recursive: true });
const db = new DatabaseSync('data/banking77/study.sqlite', { readOnly: true });
const frozen = JSON.parse(readFileSync('study/frozen.json', 'utf8'));
if (digest(JSON.stringify(BANKING_SCHEMA)) !== frozen.schema_sha256) throw new Error('Frozen schema mismatch');
const train = loadSplit('train'), test = loadSplit('test'), features = BANKING_SCHEMA.features;
const n = train.length, dimensions = features.length;
const trainRows = db.prepare("SELECT row_id,features FROM vectors WHERE split='train' ORDER BY row_id").all();
const testRows = db.prepare("SELECT row_id,features FROM vectors WHERE split='test' ORDER BY row_id").all();
const interpretations = new Map(db.prepare('SELECT id,interpretation FROM query_results').all().map(r => [r.id, JSON.parse(r.interpretation)]));
if (trainRows.length !== 10003 || testRows.length !== 3080 || interpretations.size !== 100) throw new Error('Full extraction must finish before headline evaluation');
const matrix = new Float64Array(n * dimensions), queries = new Float64Array(test.length * dimensions), norms = new Float64Array(n), df = new Float64Array(dimensions);
for (const [rows, target] of [[trainRows, matrix], [testRows, queries]]) for (const row of rows) {
  const values = JSON.parse(row.features);
  features.forEach((f, j) => {
    const value = values[f.id]; if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid stored feature');
    target[row.row_id * dimensions + j] = value;
  });
}
for (let i = 0; i < n; i++) for (let j = 0; j < dimensions; j++) {
  const v = matrix[i * dimensions + j]; norms[i] += v * v; if (v >= 0.5) df[j]++;
}
for (let i = 0; i < n; i++) norms[i] = Math.sqrt(norms[i]);
const weights = Float64Array.from(df, count => Math.log((n + 1) / (count + 1)));
const weightReport = features.map((f, j) => ({ feature: f.id, family: f.family, df: df[j], threshold: 0.5, global_weight: weights[j],
  mean_value: mean(Array.from({ length: n }, (_, i) => matrix[i * dimensions + j])),
  zero_count: Array.from({ length: n }, (_, i) => matrix[i * dimensions + j]).filter(v => v === 0).length }));
writeFileSync(`${out}/feature-weights.json`, JSON.stringify(weightReport, null, 2));
const bm25 = new BM25(train.map(r => r.text));
const labelCounts = new Map(); for (const row of train) labelCounts.set(row.label, (labelCounts.get(row.label) ?? 0) + 1);
const trainTexts = new Set(train.map(r => normalizeText(r.text))), testTexts = new Set();
const leakage = { train_duplicate_extra_rows: n - trainTexts.size, test_duplicate_extra_rows: 0, test_train_overlap_rows: [] };
test.forEach(r => { const normalized = normalizeText(r.text); if (trainTexts.has(normalized)) leakage.test_train_overlap_rows.push(r.row); if (testTexts.has(normalized)) leakage.test_duplicate_extra_rows++; testTexts.add(normalized); });
const overlap = new Set(leakage.test_train_overlap_rows);
const methods = ['bm25','cosine','dot','weighted'];
const runs = Object.fromEntries(methods.map(m => [m, []]));
const masks = [...new Set(features.map(f => f.family))].map(family => ({ id: `minus_family_${family}`, remove: features.map((f, i) => f.family === family ? i : -1).filter(i => i >= 0) }))
  .concat(features.map((f, i) => ({ id: `minus_feature_${f.id}`, remove: [i] })));
const ablations = Object.fromEntries(masks.map(mask => [mask.id, { top1: 0, hit5: 0, removed_features: mask.remove.map(i => features[i].id), by_query: [] }]));
const timings = Object.fromEntries(methods.map(m => [m, []]));
const contributions = new Float64Array(n * dimensions);
const predictions = [];

for (let qi = 0; qi < test.length; qi++) {
  const query = queries.subarray(qi * dimensions, (qi + 1) * dimensions);
  const dot = new Float64Array(n), weightedRaw = new Float64Array(n), cosine = new Float64Array(n), weighted = new Float64Array(n);
  const qNorm = Math.sqrt(query.reduce((s, v) => s + v * v, 0)), denominator = query.reduce((s, v, j) => s + v * weights[j], 0);
  const vectorStarted = performance.now();
  for (let i = 0; i < n; i++) {
    let raw = 0, wr = 0;
    for (let j = 0; j < dimensions; j++) {
      const product = query[j] * matrix[i * dimensions + j]; raw += product;
      const contribution = product * weights[j]; wr += contribution; contributions[j * n + i] = contribution;
    }
    dot[i] = raw; weightedRaw[i] = wr; weighted[i] = denominator ? wr / denominator : 0;
    cosine[i] = qNorm && norms[i] ? raw / (qNorm * norms[i]) : 0;
  }
  const sharedVectorTime = performance.now() - vectorStarted;
  const bmStarted = performance.now(), lexical = bm25.score(test[qi].text), bmTime = performance.now() - bmStarted;
  const scores = { bm25: lexical, cosine, dot, weighted };
  const relevant = i => train[i].label === test[qi].label;
  const prediction = { row: qi, text: test[qi].text, label: test[qi].label, train_text_overlap: overlap.has(qi), methods: {} };
  for (const method of methods) {
    const rankingStarted = performance.now();
    const result = metrics(scores[method], relevant, labelCounts.get(test[qi].label), 10);
    const ms = performance.now() - rankingStarted + (method === 'bm25' ? bmTime : sharedVectorTime);
    timings[method].push(ms);
    runs[method].push({ ...result, row: qi, label: test[qi].label });
    prediction.methods[method] = { top: result.top.map(i => ({ row: i, label: train[i].label, score: scores[method][i] })), first_relevant_rank: result.first_relevant_rank };
  }
  predictions.push(prediction);
  for (const mask of masks) {
    const scores = new Float64Array(n);
    // Removing contributions preserves the full representation and requires no new model calls.
    for (let i = 0; i < n; i++) {
      let value = weightedRaw[i]; for (const j of mask.remove) value -= contributions[j * n + i];
      scores[i] = Math.max(0, value); // Guard only subtraction roundoff at exact zero.
    }
    const best = topK(scores, 5); const top1 = relevant(best[0]) ? 1 : 0, hit5 = best.some(relevant) ? 1 : 0;
    ablations[mask.id].top1 += top1; ablations[mask.id].hit5 += hit5;
    ablations[mask.id].by_query.push({ top1, hit5 });
  }
  if ((qi + 1) % 100 === 0) console.log(`E1/E2/E5: ${qi + 1}/${test.length}`);
}

const summaries = {}, noOverlap = {}, perIntent = {}, confusion = {};
for (const method of methods) {
  summaries[method] = aggregate(runs[method]); noOverlap[method] = aggregate(runs[method].filter(r => !overlap.has(r.row)));
  const labels = [...labelCounts.keys()].sort();
  perIntent[method] = Object.fromEntries(labels.map(label => [label, aggregate(runs[method].filter(r => r.label === label))]));
  summaries[method].macro_top1 = mean(labels.map(label => perIntent[method][label].top1));
  summaries[method].latency_ms = { median: percentile(timings[method], 0.5), p95: percentile(timings[method], 0.95), mean: mean(timings[method]) };
  const pairs = new Map();
  for (const p of predictions) { const predicted = p.methods[method].top[0].label; if (predicted !== p.label) { const key = `${p.label} -> ${predicted}`; pairs.set(key, (pairs.get(key) ?? 0) + 1); } }
  confusion[method] = [...pairs.entries()].map(([pair, count]) => ({ pair, count })).sort((a, b) => b.count - a.count);
}
const paired = {};
for (let a = 0; a < methods.length; a++) for (let b = a + 1; b < methods.length; b++) {
  const first = methods[a], second = methods[b];
  paired[`${first}_minus_${second}`] = pairedBootstrap(runs[first].map(r => r.top1), runs[second].map(r => r.top1));
}
for (const result of Object.values(ablations)) {
  result.top1 /= test.length; result.hit5 /= test.length;
  result.top1_delta = result.top1 - summaries.weighted.top1; result.hit5_delta = result.hit5 - summaries.weighted.hit5;
}
writeFileSync(`${out}/e1-predictions.jsonl`, predictions.map(p => JSON.stringify(p)).join('\n') + '\n');
const examples = [
  ...predictions.filter(p => p.methods.weighted.top[0].label !== p.label).slice(0, 10),
  ...predictions.filter(p => p.methods.weighted.top[0].label === p.label).slice(0, 10),
].map(p => {
  const document = p.methods.weighted.top[0], q = queries.subarray(p.row * dimensions, (p.row + 1) * dimensions);
  const denominator = q.reduce((sum, value, j) => sum + value * weights[j], 0);
  const contributions = features.map((f, j) => ({ feature: f.id, family: f.family, query_value: q[j],
    document_value: matrix[document.row * dimensions + j], global_weight: weights[j],
    raw_contribution: q[j] * matrix[document.row * dimensions + j] * weights[j] }));
  contributions.sort((a, b) => b.raw_contribution - a.raw_contribution);
  return { test_row: p.row, query: p.text, expected_label: p.label, document_row: document.row,
    document: train[document.row].text, retrieved_label: document.label, correct: document.label === p.label,
    relevance_score: document.score, denominator, contributions };
});
writeFileSync(`${out}/explanations.json`, JSON.stringify(examples, null, 2));
writeFileSync(`${out}/e5-ablation-per-query.json`, JSON.stringify(ablations));
const ablationSummary = Object.fromEntries(Object.entries(ablations).map(([id, { by_query, ...rest }]) => [id, rest]));

function requirementScores(requirements, useGlobal = true) {
  const scores = new Float64Array(n); let denominator = 0;
  const active = Object.entries(requirements.weights).filter(([, w]) => w !== 0).map(([id, q]) => {
    const j = features.findIndex(f => f.id === id); if (j < 0) throw new Error(`Unknown study feature ${id}`);
    const weight = useGlobal ? weights[j] : 1; if (q > 0) denominator += weight * q; return [j, q * weight];
  });
  for (let i = 0; i < n; i++) { let total = 0; for (const [j, coefficient] of active) total += coefficient * matrix[i * dimensions + j]; scores[i] = denominator ? total / denominator : total; }
  const comparisons = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b, '=': (a, b) => a === b };
  const filters = requirements.filters.map(f => ({ ...f, j: features.findIndex(feature => feature.id === f.feature) }));
  return { scores, eligible: i => filters.every(f => comparisons[f.operator](matrix[i * dimensions + f.j], f.value)) };
}
const broad = [];
for (const q of BROAD_QUERIES) {
  const relevant = i => q.relevant_labels.includes(train[i].label), relevantCount = train.filter((_, i) => relevant(i)).length;
  const interpretation = interpretations.get(q.id);
  const noRequirements = !Object.values(interpretation.weights).some(w => w !== 0) && !interpretation.filters.length;
  const review = interpretation.unknown_concepts.length > 0 || interpretation.uncertain_requirements.length > 0 || noRequirements;
  const manual = requirementScores(q.requirements), interpreted = requirementScores(interpretation);
  for (const method of ['bm25','manual_features','jev_interpreted']) {
    const blocked = method === 'jev_interpreted' && review;
    const scores = method === 'bm25' ? bm25.score(q.query) : method === 'manual_features' ? manual.scores : interpreted.scores;
    const eligible = blocked ? () => false : method === 'bm25' ? undefined : method === 'manual_features' ? manual.eligible : interpreted.eligible;
    const result = metrics(scores, relevant, relevantCount, 10, eligible);
    broad.push({ id: q.id, group: q.group, query: q.query, method, needs_review: blocked, ...result,
      top_labels: result.top.map(i => train[i].label) });
  }
}
const broadSummary = Object.fromEntries(['bm25','manual_features','jev_interpreted'].map(method => [method, {
  ...aggregate(broad.filter(r => r.method === method)),
  review_count: broad.filter(r => r.method === method && r.needs_review).length,
  groups: Object.fromEntries([...new Set(BROAD_QUERIES.map(q => q.group))].map(group => [group, aggregate(broad.filter(r => r.method === method && r.group === group))])),
}]));

const controls = [];
for (const c of CONTROL_CASES) {
  const j = features.findIndex(f => f.id === c.negative); const relevant = i => c.desired.includes(train[i].label);
  const count = train.filter((_, i) => relevant(i)).length;
  let previous;
  for (const strength of [0, 0.25, 0.5, 1, 'hard_filter']) {
    const requirements = { weights: { ...c.weights }, filters: [] };
    if (strength === 'hard_filter') requirements.filters.push({ feature: c.negative, operator: '<=', value: 0.2 });
    else if (strength !== 0) requirements.weights[c.negative] = -strength;
    const { scores, eligible } = requirementScores(requirements);
    const result = metrics(scores, relevant, count, 10, eligible);
    let monotonicViolations = 0;
    if (previous && strength !== 'hard_filter') for (let i = 0; i < n; i++) if (scores[i] > previous[i] + 1e-12) monotonicViolations++;
    const hardViolations = strength === 'hard_filter' ? result.top.filter(i => matrix[i * dimensions + j] > 0.2).length : 0;
    controls.push({ case: c.id, query: c.query, negative_feature: c.negative, strength, ...result,
      unwanted_rate_at_10: result.top.filter(i => c.unwanted.includes(train[i].label)).length / 10,
      unwanted_fraction_returned: result.top.length ? result.top.filter(i => c.unwanted.includes(train[i].label)).length / result.top.length : null,
      monotonic_violations: monotonicViolations, hard_filter_violations: hardViolations,
      top_results: result.top.map(i => ({ row: i, label: train[i].label, score: scores[i], negative_feature_value: matrix[i * dimensions + j] })) });
    previous = scores;
  }
}

const callRows = db.prepare('SELECT split,metadata FROM calls').all().map(r => ({ split: r.split, ...JSON.parse(r.metadata) }));
const costSummary = Object.fromEntries(['train','test','broad_query'].map(split => {
  const calls = callRows.filter(c => c.split === split);
  return [split, { calls: calls.length, successful: calls.filter(c => c.success).length,
    input_tokens: calls.reduce((s, c) => s + (c.usage?.input_tokens ?? 0), 0), estimated_cost_usd: calls.reduce((s, c) => s + (c.estimated_cost_usd ?? 0), 0),
    median_latency_ms: percentile(calls.map(c => c.latency_ms), 0.5), p95_latency_ms: percentile(calls.map(c => c.latency_ms), 0.95),
    failed_calls: calls.filter(c => !c.success).length, retry_attempts: calls.reduce((s, c) => s + Math.max(0, (c.attempts ?? 1) - 1), 0) }];
}));
const report = { generated_at: new Date().toISOString(), complete: true, model: 'jev-1.13.0', train_count: n, test_count: test.length, dimensions,
  frozen, frozen_queries: JSON.parse(readFileSync('study/frozen-queries.json', 'utf8')),
  dataset: JSON.parse(readFileSync('data/banking77/manifest.json', 'utf8')), leakage,
  e1_e2: summaries, e1_no_train_overlap: noOverlap, paired_top1_differences: paired, per_intent: perIntent, confusions: confusion,
  e3: broadSummary, e4: controls, e5: ablationSummary, costs: costSummary,
  extraction_sessions: db.prepare('SELECT * FROM sessions').all(), evaluation_wall_seconds: (performance.now() - started) / 1000,
  timing_note: 'Vector methods share one fused pass, so each includes the whole shared vector pass; timings are descriptive, not isolated speed benchmarks. Scores within 1e-12 are treated as arithmetic ties and use original row order.',
  limitations: ['Single public English dataset; prior JEV exposure unknown.', '34 features omit distinctions in 77 labels; some overlap and correlate.',
    'E3/E4 judgments derive from intent groups rather than human search judgments.', 'E3 paraphrases are correlated within 25 groups; do not use query-level confidence intervals for population claims.',
    'No external embedding baseline was run; no replacement claim can be established.', 'No independently human-labeled feature probabilities; calibration is not established.'] };
writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
writeFileSync(`${out}/e3-queries.json`, JSON.stringify(broad, null, 2));
writeFileSync(`${out}/e3-interpretations.json`, JSON.stringify(Object.fromEntries(interpretations), null, 2));
writeFileSync(`${out}/e1-summary.csv`, 'method,top1,hit5,precision5,recall5,mrr,ndcg10\n' + methods.map(m => [m, summaries[m].top1, summaries[m].hit5, summaries[m].precision5, summaries[m].recall5, summaries[m].mrr, summaries[m].ndcg_at_k].join(',')).join('\n') + '\n');
console.log(JSON.stringify({ e1_e2: summaries, e3: Object.fromEntries(Object.entries(broadSummary).map(([k, { groups, ...v }]) => [k, v])), costs: costSummary, leakage, evaluation_seconds: report.evaluation_wall_seconds }, null, 2));
db.close();
