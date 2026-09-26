import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { INITIAL_SCHEMA, validateFeature } from './schema.js';
import { assert, knownKeys, number, text } from './validation.js';

export class Store {
  constructor(path = './data/retrieval.sqlite') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS schemas (version INTEGER PRIMARY KEY, definition TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, source TEXT NOT NULL, external_id TEXT, title TEXT NOT NULL, body TEXT NOT NULL,
        created_at TEXT NOT NULL, indexed_at TEXT, schema_version INTEGER, provenance TEXT NOT NULL DEFAULT 'unindexed',
        UNIQUE(source, external_id));
      CREATE TABLE IF NOT EXISTS document_features (
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        feature_id TEXT NOT NULL, value REAL CHECK(value IS NULL OR (value>=0 AND value<=1)),
        schema_version INTEGER NOT NULL REFERENCES schemas(version), jev_version TEXT, processing_timestamp TEXT NOT NULL,
        PRIMARY KEY(document_id, feature_id));
      CREATE INDEX IF NOT EXISTS feature_values ON document_features(feature_id, value);
      CREATE TABLE IF NOT EXISTS jev_calls (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, metadata TEXT NOT NULL);`);
    if (!this.db.prepare('SELECT version FROM schemas LIMIT 1').get()) {
      this.db.prepare('INSERT INTO schemas VALUES (?, ?, ?)').run(1, JSON.stringify(INITIAL_SCHEMA), new Date().toISOString());
    }
  }
  close() { this.db.close(); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  schema() { return JSON.parse(this.db.prepare('SELECT definition FROM schemas ORDER BY version DESC LIMIT 1').get().definition); }
  schemaHistory() { return this.db.prepare('SELECT version, created_at FROM schemas ORDER BY version').all(); }
  addFeature(input) {
    const feature = validateFeature(input);
    return this.transaction(() => {
      const current = this.schema();
      assert(!current.features.some(f => f.id === feature.id), 'Feature ID already exists; semantic definitions are immutable.', 409);
      assert(current.features.length < 30, 'MVP supports at most 30 explicit features');
      const schema = { version: current.version + 1, features: [...current.features, { ...feature, schema_version: current.version + 1 }] };
      this.db.prepare('INSERT INTO schemas VALUES (?, ?, ?)').run(schema.version, JSON.stringify(schema), new Date().toISOString());
      return schema;
    });
  }
  updateWeights(weights) {
    const current = this.schema();
    const ids = new Set(current.features.map(f => f.id));
    for (const [id, weight] of Object.entries(weights)) { assert(ids.has(id), `Unknown feature: ${id}`); number(weight, 0, 100, id); }
    const schema = { version: current.version + 1,
      features: current.features.map(f => ({ ...f, global_weight: weights[f.id] ?? f.global_weight })) };
    this.db.prepare('INSERT INTO schemas VALUES (?, ?, ?)').run(schema.version, JSON.stringify(schema), new Date().toISOString());
    return schema;
  }
  createDocument(input) {
    knownKeys(input, ['id', 'source', 'external_id', 'title', 'body', 'created_at'], 'document');
    const id = input.id ?? randomUUID();
    text(id, 'document.id', 128); assert(/^[\w.-]+$/.test(id), 'Document ID must use letters, numbers, underscores, dots, or hyphens');
    const source = input.source ?? 'manual'; text(source, 'source', 200);
    text(input.title, 'title', 500); text(input.body, 'body', 60000);
    if (input.external_id != null) text(input.external_id, 'external_id', 500);
    const created = input.created_at ?? new Date().toISOString();
    text(created, 'created_at', 64); assert(Number.isFinite(Date.parse(created)), 'Invalid created_at timestamp');
    assert(!this.db.prepare('SELECT id FROM documents WHERE id=? OR (source=? AND external_id=?)').get(id, source, input.external_id ?? null), 'Document already exists', 409);
    this.db.prepare('INSERT INTO documents(id,source,external_id,title,body,created_at) VALUES(?,?,?,?,?,?)')
      .run(id, source, input.external_id ?? null, input.title, input.body, created);
    return this.document(id);
  }
  document(id) {
    const doc = this.db.prepare('SELECT * FROM documents WHERE id=?').get(id);
    assert(doc, 'Document not found', 404, 'not_found');
    const rows = this.db.prepare('SELECT * FROM document_features WHERE document_id=?').all(id);
    const features = Object.fromEntries(this.schema().features.map(f => [f.id, null]));
    for (const row of rows) features[row.feature_id] = row.value;
    return { ...doc, features, feature_metadata: rows.map(({ document_id, value, ...row }) => row) };
  }
  documents() {
    // Two scans avoid an N+1 query pattern for the 100–1000 document MVP.
    const defaults = Object.fromEntries(this.schema().features.map(f => [f.id, null]));
    const docs = this.db.prepare('SELECT * FROM documents ORDER BY id').all().map(d => ({ ...d, features: { ...defaults } }));
    const byId = new Map(docs.map(d => [d.id, d]));
    for (const row of this.db.prepare('SELECT document_id,feature_id,value FROM document_features').all()) byId.get(row.document_id).features[row.feature_id] = row.value;
    return docs;
  }
  saveFeatures(id, values, schema, metadata, provenance = 'jev') {
    const ids = new Set(schema.features.map(f => f.id));
    for (const [key, value] of Object.entries(values)) { assert(ids.has(key), `Unknown feature: ${key}`); if (value !== null) number(value, 0, 1, key); }
    return this.transaction(() => {
      this.document(id);
      const now = new Date().toISOString();
      const statement = this.db.prepare(`INSERT INTO document_features VALUES(?,?,?,?,?,?)
        ON CONFLICT(document_id,feature_id) DO UPDATE SET value=excluded.value,schema_version=excluded.schema_version,
        jev_version=excluded.jev_version,processing_timestamp=excluded.processing_timestamp`);
      for (const [key, value] of Object.entries(values)) statement.run(id, key, value, schema.version, metadata.model ?? null, now);
      const updated = this.document(id);
      const complete = schema.features.every(f => updated.features[f.id] !== null);
      this.db.prepare('UPDATE documents SET indexed_at=?,schema_version=?,provenance=? WHERE id=?')
        .run(now, complete ? schema.version : updated.schema_version, provenance, id);
      return this.document(id);
    });
  }
  recordCall(metadata) { this.db.prepare('INSERT INTO jev_calls(created_at,metadata) VALUES(?,?)').run(new Date().toISOString(), JSON.stringify(metadata)); }
  stats() {
    const calls = this.db.prepare('SELECT metadata FROM jev_calls').all().map(row => JSON.parse(row.metadata));
    const summarize = purpose => {
      const selected = calls.filter(c => c.purpose === purpose);
      return { calls: selected.length, successful_calls: selected.filter(c => c.success).length,
        input_tokens: selected.reduce((sum, c) => sum + (c.usage?.input_tokens ?? 0), 0),
        estimated_cost_usd: selected.length && selected.every(c => c.estimated_cost_usd !== null && c.estimated_cost_usd !== undefined)
          ? selected.reduce((sum, c) => sum + c.estimated_cost_usd, 0) : null,
        known_response_cost_usd: selected.reduce((sum, c) => sum + (c.estimated_cost_usd ?? 0), 0),
        latency_ms: selected.reduce((sum, c) => sum + c.latency_ms, 0),
        cost_note: 'Configured-rate estimates only. Failed or retried calls may have additional unreported charges.' };
    };
    return { documents: this.db.prepare('SELECT COUNT(*) AS n FROM documents').get().n,
      indexed_documents: this.db.prepare('SELECT COUNT(*) AS n FROM documents WHERE indexed_at IS NOT NULL').get().n,
      schema_version: this.schema().version, indexing: summarize('index'), query_processing: summarize('query') };
  }
}
