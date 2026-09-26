import { assert, integer } from './validation.js';
import { interpretQuery, validateRequirements } from './query.js';
import { rankDocuments } from './scoring.js';

export class RetrievalService {
  constructor(store, client) { this.store = store; this.client = client; }
  async index(id, { feature_ids, force = false } = {}) {
    const schema = this.store.schema();
    const document = this.store.document(id);
    assert(typeof force === 'boolean', 'force must be a boolean');
    if (feature_ids !== undefined) {
      assert(Array.isArray(feature_ids) && feature_ids.length > 0, 'feature_ids must be a nonempty array');
      const known = new Set(schema.features.map(f => f.id));
      for (const name of feature_ids) assert(known.has(name), `Unknown feature: ${name}`);
    }
    const features = schema.features.filter(f => (!feature_ids || feature_ids.includes(f.id)) && (force || document.features[f.id] === null));
    if (!features.length) return { document, evaluated_features: [], metadata: null };
    const questions = Object.fromEntries(features.map(f => [f.id, { type: 'noul', instructions: f.question,
      criteria: { true: f.definition, false: 'The document does not satisfy the property as defined.' } }]));
    const response = await this.client.evaluate({ title: document.title, body: document.body, source: document.source }, questions, 'index');
    const values = Object.fromEntries(features.map(f => [f.id, response.answers[f.id].noul]));
    const saved = this.store.saveFeatures(id, values, schema, response.metadata);
    return { document: saved, evaluated_features: Object.keys(values), metadata: response.metadata };
  }
  async backfill(feature_ids) {
    // Validate before any calls, including when the database is empty.
    if (feature_ids !== undefined) {
      assert(Array.isArray(feature_ids) && feature_ids.length > 0, 'feature_ids must be a nonempty array');
      const ids = new Set(this.store.schema().features.map(f => f.id));
      for (const id of feature_ids) assert(ids.has(id), `Unknown feature: ${id}`);
    }
    const completed = [], errors = [];
    for (const doc of this.store.documents()) {
      try { const result = await this.index(doc.id, { feature_ids }); completed.push({ id: doc.id, evaluated_features: result.evaluated_features }); }
      catch (error) { errors.push({ id: doc.id, message: error.message, code: error.code }); break; }
    }
    return { completed, errors, resumable: true };
  }
  async search({ query, requirements, limit = 20, allow_partial = false }) {
    const start = performance.now();
    integer(limit, 1, 100, 'limit');
    assert(typeof allow_partial === 'boolean', 'allow_partial must be a boolean');
    assert((query !== undefined) !== (requirements !== undefined), 'Provide exactly one of query or requirements');
    const schema = this.store.schema();
    const interpretation = requirements !== undefined
      ? { ...validateRequirements(requirements, schema), schema_version: schema.version, unknown_concepts: [], uncertain_requirements: [], explanation_source: 'explicit user requirements' }
      : await interpretQuery(this.client, query, schema);
    if ((interpretation.unknown_concepts.length || interpretation.uncertain_requirements.length) && !allow_partial) return {
      status: 'needs_review', query_interpretation: interpretation, results: [],
      message: 'This request contains unsupported concepts or uncertain hard constraints. Review the interpreted requirements, narrow the request, or explicitly allow a partial search.', latency_ms: performance.now() - start,
    };
    const active = Object.values(interpretation.weights).some(w => w !== 0) || interpretation.filters.length > 0;
    if (!active) return { status: 'no_requirements', query_interpretation: interpretation, results: [],
      message: 'No supported search requirements were selected.', latency_ms: performance.now() - start };
    const docs = this.store.documents();
    const candidates = docs.filter(d => d.indexed_at !== null);
    const ranked = rankDocuments(candidates, { weights: interpretation.weights, filters: interpretation.filters }, schema, limit);
    return { status: 'ok', query_interpretation: interpretation, ...ranked,
      unindexed_documents: docs.length - candidates.length, latency_ms: performance.now() - start };
  }
}
