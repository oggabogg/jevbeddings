import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { JevClient } from '../src/jev.js';
import { interpretQuery } from '../src/query.js';
import { BANKING_SCHEMA } from './schema.js';
import { BROAD_QUERIES, CONTROL_CASES } from './queries.js';
import { downloadData, loadSplit, digest } from './data.js';

const directory = 'data/banking77';
mkdirSync(directory, { recursive: true }); mkdirSync('study/results', { recursive: true });
const frozen = JSON.parse(readFileSync('study/frozen.json', 'utf8'));
const frozenQueries = JSON.parse(readFileSync('study/frozen-queries.json', 'utf8'));
if (frozen.schema_sha256 !== digest(JSON.stringify(BANKING_SCHEMA)) || frozen.protocol_sha256 !== digest(readFileSync('study/PROTOCOL.md')) ||
  frozenQueries.queries_sha256 !== digest(JSON.stringify({ broad_queries: BROAD_QUERIES, control_cases: CONTROL_CASES })) ||
  frozenQueries.interpreter_sha256 !== digest(readFileSync('src/query.js'))) throw new Error('Frozen configuration has changed');
const lockPath = `${directory}/run.lock`;
if (existsSync(lockPath)) {
  const prior = JSON.parse(readFileSync(lockPath, 'utf8'));
  let alive = false; try { process.kill(prior.pid, 0); alive = true; } catch {}
  if (alive) throw new Error(`Study is already running as PID ${prior.pid}`);
  unlinkSync(lockPath);
}
writeFileSync(lockPath, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }), { flag: 'wx' });
const db = new DatabaseSync(`${directory}/study.sqlite`);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS vectors(split TEXT NOT NULL,row_id INTEGER NOT NULL,text_sha256 TEXT NOT NULL,features TEXT NOT NULL,answers TEXT NOT NULL,metadata TEXT NOT NULL,PRIMARY KEY(split,row_id));
  CREATE TABLE IF NOT EXISTS query_results(id TEXT PRIMARY KEY,interpretation TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS calls(id INTEGER PRIMARY KEY,split TEXT,row_id TEXT,metadata TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY,started_at TEXT NOT NULL,ended_at TEXT,status TEXT);`);
for (const [key, value] of Object.entries({ schema_hash: frozen.schema_sha256, query_hash: frozenQueries.queries_sha256, model: 'jev-1.13.0' })) {
  const previous = db.prepare('SELECT value FROM metadata WHERE key=?').get(key);
  if (previous && previous.value !== value) throw new Error(`Incompatible extraction database: ${key}`);
  db.prepare('INSERT OR IGNORE INTO metadata VALUES(?,?)').run(key, value);
}
db.prepare('INSERT OR IGNORE INTO metadata VALUES(?,?)').run('initial_adapter_sha256', digest(readFileSync('src/jev.js')));
const session = db.prepare('INSERT INTO sessions(started_at,status) VALUES(?,?)').run(new Date().toISOString(), 'running').lastInsertRowid;
let stopped = false, failure = null, nextStart = 0, doneSession = 0;
const started = Date.now(), ceiling = 5, intervalMs = 67, concurrency = 8;
let cost = db.prepare('SELECT metadata FROM calls').all().reduce((sum, r) => sum + (JSON.parse(r.metadata).estimated_cost_usd ?? 0), 0);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const counts = () => Object.fromEntries(db.prepare('SELECT split,COUNT(*) n FROM vectors GROUP BY split').all().map(r => [r.split, r.n]));
function status(state = 'running', extra = {}) {
  const result = { state, pid: process.pid, updated_at: new Date().toISOString(), counts: counts(),
    interpreted_queries: db.prepare('SELECT COUNT(*) n FROM query_results').get().n,
    total_document_target: 13083, total_query_target: 100, completed_this_session: doneSession,
    elapsed_session_seconds: (Date.now() - started) / 1000, estimated_cost_usd: cost, estimated_cost_ceiling_usd: ceiling,
    schema_sha256: frozen.schema_sha256, ...extra };
  writeFileSync('study/results/progress.tmp', JSON.stringify(result, null, 2)); renameSync('study/results/progress.tmp', 'study/results/progress.json');
  console.log(JSON.stringify(result)); return result;
}
const questions = Object.fromEntries(BANKING_SCHEMA.features.map(f => [f.id, { type: 'noul', instructions: f.question,
  criteria: { true: f.definition, false: 'The message does not satisfy the property as defined.' } }]));
function clientFor(split, row) {
  return new JevClient({ model: 'jev-1.13.0', inputPrice: 0.042, onCall: metadata => {
    db.prepare('INSERT INTO calls(split,row_id,metadata) VALUES(?,?,?)').run(split, String(row), JSON.stringify(metadata));
    cost += metadata.estimated_cost_usd ?? 0;
    if (cost >= ceiling) { stopped = true; failure = 'Estimated USD 5 cost ceiling reached'; }
  } });
}
async function throttle() {
  const target = Math.max(Date.now(), nextStart); nextStart = target + intervalMs;
  if (target > Date.now()) await wait(target - Date.now());
}
async function execute(items, fn) {
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (!stopped && cursor < items.length) {
      const item = items[cursor++]; await throttle(); if (stopped) break;
      try { await fn(item); doneSession++; if (doneSession % 100 === 0) status(); }
      catch (error) { stopped = true; failure = error.message; }
    }
  }));
  if (failure) throw new Error(failure);
}
async function extract(split, rows) {
  const existing = new Map(db.prepare('SELECT row_id,text_sha256 FROM vectors WHERE split=?').all(split).map(r => [r.row_id, r.text_sha256]));
  for (const row of rows) if (existing.has(row.row) && existing.get(row.row) !== digest(row.text)) throw new Error('Text changed for cached row');
  await execute(rows.filter(row => !existing.has(row.row)), async row => {
    const result = await clientFor(split, row.row).evaluate({ message: row.text }, questions, 'index');
    if (result.metadata.model !== 'jev-1.13.0') throw new Error('Unexpected model version');
    const features = Object.fromEntries(BANKING_SCHEMA.features.map(f => [f.id, result.answers[f.id].noul]));
    db.prepare('INSERT INTO vectors VALUES(?,?,?,?,?,?)').run(split, row.row, digest(row.text), JSON.stringify(features), JSON.stringify(result.answers), JSON.stringify(result.metadata));
  });
}
process.on('SIGINT', () => { stopped = true; }); process.on('SIGTERM', () => { stopped = true; });
try {
  status();
  const train = loadSplit('train');
  // Deterministic spread across training only. This checks transport and budget, not schema quality.
  const smoke = Array.from({ length: 32 }, (_, i) => train[Math.floor(i * train.length / 32)]);
  await extract('train', smoke);
  const sampleCalls = db.prepare("SELECT metadata FROM vectors WHERE split='train'").all().map(r => JSON.parse(r.metadata));
  const projected = sampleCalls.reduce((s, r) => s + r.estimated_cost_usd, 0) / sampleCalls.length * 13083;
  status('running', { estimated_full_extraction_usd: projected });
  if (projected > ceiling) throw new Error(`Projected extraction exceeds the USD ${ceiling} ceiling`);
  if (!stopped) await extract('train', train);
  if (!stopped) {
    await downloadData({ includeTest: true });
    await extract('test', loadSplit('test'));
  }
  if (!stopped) {
    const known = new Set(db.prepare('SELECT id FROM query_results').all().map(r => r.id));
    await execute(BROAD_QUERIES.filter(q => !known.has(q.id)), async q => {
      const interpretation = await interpretQuery(clientFor('broad_query', q.id), q.query, BANKING_SCHEMA);
      db.prepare('INSERT INTO query_results VALUES(?,?)').run(q.id, JSON.stringify(interpretation));
    });
  }
  const final = status(stopped ? 'interrupted' : 'extraction_complete');
  db.prepare('UPDATE sessions SET ended_at=?,status=? WHERE id=?').run(new Date().toISOString(), final.state, session);
} catch (error) {
  status('failed', { error: error.message });
  db.prepare('UPDATE sessions SET ended_at=?,status=? WHERE id=?').run(new Date().toISOString(), 'failed', session); process.exitCode = 1;
} finally { db.close(); unlinkSync(lockPath); }
