import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const DATA_COMMIT = '57ec275d8078af65b7731c2a98be812d844a6d6b';
export const digest = text => createHash('sha256').update(text).digest('hex');
export const normalizeText = text => text.toLowerCase().replace(/\s+/g, ' ').trim();
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); if (row.some(v => v)) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const header = rows.shift();
  if (header.join(',') !== 'text,category') throw new Error(`Unexpected CSV header: ${header}`);
  return rows.map((values, index) => { if (values.length !== 2) throw new Error(`Bad CSV row ${index}`); return { row: index, text: values[0], label: values[1] }; });
}
export function loadSplit(split) {
  const bytes = readFileSync(`data/banking77/${split}.csv`);
  const manifest = JSON.parse(readFileSync('data/banking77/manifest.json', 'utf8'));
  if (digest(bytes) !== manifest.files[`${split}.csv`].sha256) throw new Error('Dataset fingerprint mismatch');
  const rows = parseCSV(bytes.toString('utf8'));
  if (rows.length !== (split === 'train' ? 10003 : 3080)) throw new Error(`Unexpected ${split} count`);
  return rows;
}
export async function downloadData({ includeTest = false } = {}) {
  mkdirSync('data/banking77', { recursive: true });
  const base = `https://raw.githubusercontent.com/PolyAI-LDN/task-specific-datasets/${DATA_COMMIT}`;
  const manifestPath = 'data/banking77/manifest.json';
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { source_commit: DATA_COMMIT,
    source: 'https://github.com/PolyAI-LDN/task-specific-datasets', license: 'CC-BY-4.0', files: {} };
  const files = ['train.csv', 'categories.json', ...(includeTest ? ['test.csv'] : [])];
  for (const file of files) {
    const path = `data/banking77/${file}`;
    if (existsSync(path)) {
      if (manifest.files[file]?.sha256 !== digest(readFileSync(path))) throw new Error(`Existing file fingerprint mismatch: ${file}`);
      continue;
    }
    const response = await fetch(`${base}/banking_data/${file}`, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Dataset HTTP ${response.status}: ${file}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(path, bytes); manifest.files[file] = { sha256: digest(bytes), bytes: bytes.length, downloaded_at: new Date().toISOString() };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  if (!existsSync('data/banking77/LICENSE')) {
    const response = await fetch(`${base}/LICENSE`);
    if (!response.ok) throw new Error('Could not fetch dataset license');
    writeFileSync('data/banking77/LICENSE', await response.text());
  }
  return manifest;
}
