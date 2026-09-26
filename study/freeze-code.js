import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { digest } from './data.js';
const files = ['study/run.js','study/data.js','study/math.js','study/evaluate.js','study/AMENDMENTS.md','src/jev.js','src/query.js'];
const fingerprints = Object.fromEntries(files.map(file => [file, digest(readFileSync(file))]));
const path = 'study/frozen-code.json';
if (existsSync(path)) {
  const prior = JSON.parse(readFileSync(path, 'utf8'));
  for (const file of files) if (prior.files[file] !== fingerprints[file]) throw new Error(`Study code changed: ${file}`);
  console.log('Study code fingerprints verified');
} else {
  const progress = JSON.parse(readFileSync('study/results/progress.json', 'utf8'));
  writeFileSync(path, JSON.stringify({ frozen_at: new Date().toISOString(), test_vectors_at_freeze: progress.counts.test ?? 0, files: fingerprints }, null, 2), { flag: 'wx' });
  console.log('Study code fingerprints written');
}
