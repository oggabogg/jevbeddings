import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BANKING_SCHEMA } from './schema.js';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const path = 'study/frozen.json';
const current = { schema_sha256: hash(JSON.stringify(BANKING_SCHEMA)), protocol_sha256: hash(readFileSync('study/PROTOCOL.md')) };
if (existsSync(path)) {
  const frozen = JSON.parse(readFileSync(path, 'utf8'));
  if (Object.entries(current).some(([key, value]) => frozen[key] !== value)) throw new Error('Frozen study configuration changed. Use a new study version.');
  console.log(JSON.stringify(frozen));
} else {
  const frozen = { frozen_at: new Date().toISOString(), ...current, feature_count: BANKING_SCHEMA.features.length, test_data_seen: false };
  writeFileSync(path, JSON.stringify(frozen, null, 2), { flag: 'wx' }); console.log(JSON.stringify(frozen));
}
