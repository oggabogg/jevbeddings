import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve('.');
const manifest = JSON.parse(readFileSync('study/results/evidence-manifest.json', 'utf8'));
let checked = 0;
for (const [file, entry] of Object.entries(manifest.files)) {
  const target = resolve(file);
  assert.ok(target.startsWith(root + sep), `Path escapes evidence directory: ${file}`);
  assert.ok(!file.split(/[\\/]/).includes('.env'), 'Credential file in inventory');
  assert.ok(existsSync(target), `Missing evidence file: ${file}`);
  const bytes = readFileSync(target);
  assert.equal(bytes.length, entry.bytes, `Size mismatch: ${file}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `Hash mismatch: ${file}`);
  checked++;
}
console.log(JSON.stringify({ passed: true, files_verified: checked,
  note: 'Matches this local inventory; does not independently authenticate API origin or historical timestamps.' }));
