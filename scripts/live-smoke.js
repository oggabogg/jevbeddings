import { mkdirSync, writeFileSync } from 'node:fs';
import { JevClient } from '../src/jev.js';
import { INITIAL_SCHEMA } from '../src/schema.js';
import { interpretQuery } from '../src/query.js';

const client = new JevClient();
try {
  const feature = INITIAL_SCHEMA.features.find(f => f.id === 'duplicate_charge');
  const document = await client.evaluate({ title: 'Charged twice', body: 'I am a paying customer. You charged my monthly subscription twice today. Please refund the duplicate payment.' },
    { [feature.id]: { type: 'noul', instructions: feature.question } }, 'index');
  const query = await interpretQuery(client, 'urgent billing problems from enterprise customers, exclude newsletters', INITIAL_SCHEMA);
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/live-smoke.json', JSON.stringify({ document, query }, null, 2));
  console.log(JSON.stringify({ model: document.metadata.model, duplicate_charge: document.answers.duplicate_charge.noul,
    query_weights: Object.fromEntries(Object.entries(query.weights).filter(([, w]) => w !== 0)), filters: query.filters,
    coverage_probability: query.coverage_probability, report: 'reports/live-smoke.json' }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
