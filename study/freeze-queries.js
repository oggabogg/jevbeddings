import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { BROAD_QUERIES, CONTROL_CASES } from './queries.js';
import { loadSplit, digest } from './data.js';
const labels = new Set(loadSplit('train').map(r => r.label));
for (const q of BROAD_QUERIES) for (const label of q.relevant_labels) if (!labels.has(label)) throw new Error(`Unknown label ${label}`);
for (const c of CONTROL_CASES) for (const label of [...c.desired, ...c.unwanted]) if (!labels.has(label)) throw new Error(`Unknown label ${label}`);
const contents = { broad_queries: BROAD_QUERIES, control_cases: CONTROL_CASES };
const current = { queries_sha256: digest(JSON.stringify(contents)), interpreter_sha256: digest(readFileSync('src/query.js')) };
const path = 'study/frozen-queries.json';
if (existsSync(path)) {
  const prior = JSON.parse(readFileSync(path, 'utf8'));
  if (Object.entries(current).some(([key, value]) => prior[key] !== value)) throw new Error('Frozen queries/interpreter changed');
  console.log(JSON.stringify(prior));
} else {
  const frozen = { frozen_at: new Date().toISOString(), ...current, groups: 25, queries: BROAD_QUERIES.length, control_cases: CONTROL_CASES.length, test_data_seen: false };
  writeFileSync(path, JSON.stringify(frozen, null, 2), { flag: 'wx' });
  writeFileSync('study/query-fixtures.json', JSON.stringify(contents, null, 2));
  console.log(JSON.stringify(frozen));
}
