import { readFileSync } from 'node:fs';
import { Store } from '../src/store.js';
import { JevClient } from '../src/jev.js';
import { RetrievalService } from '../src/service.js';
import { documents } from '../fixtures/support.js';

const source = process.argv[2];
if (!source) { console.error('Usage: npm run import -- <documents.json | --sample> [--index]'); process.exit(1); }
const input = source === '--sample' ? documents.map(({ positive, ...d }) => d) : JSON.parse(readFileSync(source, 'utf8'));
if (!Array.isArray(input) || input.length > 1000) throw new Error('Provide an array of at most 1000 documents');
const store = new Store(process.env.DB_PATH || './data/retrieval.sqlite');
try {
  const existing = new Set(store.documents().map(d => d.id));
  let imported = 0;
  store.transaction(() => { for (const doc of input) if (!existing.has(doc.id)) { store.createDocument(doc); imported++; } });
  console.log(`Imported ${imported} documents. Existing IDs were left intact.`);
  if (process.argv.includes('--index')) {
    const service = new RetrievalService(store, new JevClient({ onCall: call => store.recordCall(call) }));
    const result = await service.backfill();
    console.log(JSON.stringify({ evaluated_documents: result.completed.filter(d => d.evaluated_features.length).length, errors: result.errors, stats: store.stats() }, null, 2));
    if (result.errors.length) process.exitCode = 1;
  }
} finally { store.close(); }
