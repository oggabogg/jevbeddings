// Post-study verification only. Never calls JEV or overwrites the original results.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BANKING_SCHEMA } from './schema.js';
import { BROAD_QUERIES, CONTROL_CASES } from './queries.js';

const root = process.cwd();
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const hashText = value => createHash('sha256').update(value).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const frozen = json('study/frozen.json'), code = json('study/frozen-code.json'), queries = json('study/frozen-queries.json');
assert.equal(hashText(JSON.stringify(BANKING_SCHEMA)), frozen.schema_sha256);
assert.equal(sha('study/PROTOCOL.md'), frozen.protocol_sha256);
assert.equal(hashText(JSON.stringify({ broad_queries: BROAD_QUERIES, control_cases: CONTROL_CASES })), queries.queries_sha256);
assert.equal(sha('src/query.js'), queries.interpreter_sha256);
for (const [file, digest] of Object.entries(code.files)) assert.equal(sha(file), digest, `Frozen file changed: ${file}`);

mkdirSync('data/reproductions', { recursive: true });
const directory = mkdtempSync(resolve('data/reproductions/replay-'));
const inputs = ['package.json', 'study/schema.js', 'study/queries.js', 'study/data.js', 'study/math.js',
  'study/evaluate.js', 'study/audit.js', 'study/diagnose.js', 'study/frozen.json', 'study/frozen-queries.json',
  'data/banking77/train.csv', 'data/banking77/test.csv', 'data/banking77/categories.json',
  'data/banking77/manifest.json', 'data/banking77/study.sqlite'];
const fingerprints = Object.fromEntries(inputs.map(file => [file, sha(file)]));
for (const file of inputs) {
  const target = join(directory, file); mkdirSync(dirname(target), { recursive: true }); copyFileSync(file, target);
}
// The evaluator imports data.js, but must never call its download function.
writeFileSync(join(directory, 'offline.mjs'), 'globalThis.fetch = () => { throw new Error("Network fetch forbidden during offline replay"); };\n');
const environment = { ...process.env };
delete environment.TYPESAFE_API_KEY; delete environment.JEV_API_KEY;
delete environment.NODE_OPTIONS;
for (const script of ['evaluate', 'audit', 'diagnose']) {
  console.log(`Offline replay: ${script}`);
  const result = spawnSync(process.execPath, ['--import', './offline.mjs', `study/${script}.js`], {
    cwd: directory, env: environment, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
  });
  writeFileSync(join(directory, `${script}.stdout.txt`), result.stdout ?? '');
  writeFileSync(join(directory, `${script}.stderr.txt`), result.stderr ?? '');
  if (result.status !== 0) throw new Error(`${script} failed. Inspect ${directory}: ${result.error?.message ?? result.stderr}`);
}

// Only newly measured local evaluation time and generation timestamps may differ.
// Stored API latencies, timestamps, usage and session metadata MUST match.
function semanticResult(value) {
  const copy = structuredClone(value);
  delete copy.generated_at; delete copy.evaluation_wall_seconds;
  for (const method of Object.values(copy.e1_e2)) delete method.latency_ms;
  return copy;
}
assert.deepEqual(semanticResult(json(join(directory, 'study/results/results.json'))), semanticResult(json('study/results/results.json')));
const artifacts = ['e1-predictions.jsonl', 'e1-summary.csv', 'e3-queries.json', 'e3-interpretations.json',
  'e5-ablation-per-query.json', 'feature-weights.json', 'explanations.json'];
const comparisons = {};
for (const name of artifacts) {
  const original = `study/results/${name}`, replay = join(directory, original);
  assert.equal(sha(replay), sha(original), `Artifact differs: ${name}`);
  comparisons[name] = { exact_bytes_match: true, sha256: sha(original) };
}
const oldDiagnostics = json('study/results/diagnostics.json');
const newDiagnostics = json(join(directory, 'study/results/diagnostics.json'));
delete oldDiagnostics.generated_at; delete newDiagnostics.generated_at;
assert.deepEqual(newDiagnostics, oldDiagnostics);
for (const [file, digest] of Object.entries(fingerprints)) assert.equal(sha(file), digest, `Input changed during replay: ${file}`);
const audit = json(join(directory, 'study/results/audit.json'));
const report = {
  verified_at: new Date().toISOString(), passed: true, node_version: process.version, platform: process.platform,
  scope: 'Full deterministic evaluation of saved JEV outputs; not an independent attestation of API origin.',
  api_calls: 0, api_credentials_passed: false, fetch_disabled: true,
  original_results_overwritten: false, replay_directory: relative(root, directory).replaceAll('\\', '/'),
  input_sha256: fingerprints, original_results_sha256: sha('study/results/results.json'),
  all_non_timing_result_fields_match: true,
  excluded_comparison_fields: ['results.generated_at', 'results.evaluation_wall_seconds', 'results.e1_e2.*.latency_ms', 'diagnostics.generated_at'],
  exact_artifact_matches: comparisons, diagnostic_metrics_match: true, independent_sort_audit: audit,
};
writeFileSync('study/results/reproduction-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, exact_artifacts: artifacts.length, full_result_metrics_match: true,
  api_calls: 0, report: 'study/results/reproduction-audit.json' }));
