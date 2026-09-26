import { validateRequirements } from './query.js';

const compare = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b,
  '>': (a, b) => a > b, '<': (a, b) => a < b, '=': (a, b) => a === b };

export function scoreDocument(document, requirements, schema) {
  const filterChecks = requirements.filters.map(filter => {
    const value = document.features[filter.feature] ?? null;
    return { ...filter, document_value: value, passed: value !== null && compare[filter.operator](value, filter.value),
      reason: value === null ? 'Feature was not evaluated; a hard constraint cannot be verified.' : 'Evaluated constraint.' };
  });
  if (filterChecks.some(check => !check.passed)) return null;
  let positive = 0, penalty = 0, denominator = 0, observedPositive = 0;
  const why = [], missing = [];
  for (const feature of schema.features) {
    const q = requirements.weights[feature.id] ?? 0;
    if (q === 0) continue;
    const weight = feature.global_weight;
    if (q > 0) denominator += weight * q;
    const value = document.features[feature.id] ?? null;
    if (value === null) {
      missing.push(feature.id);
      why.push({ feature: feature.id, document_value: null, query_weight: q, global_weight: weight,
        contribution: null, kind: 'missing' });
      continue;
    }
    const magnitude = weight * Math.abs(q) * value;
    if (q > 0) { positive += magnitude; observedPositive += weight * q; } else penalty += magnitude;
    why.push({ feature: feature.id, document_value: value, query_weight: q, global_weight: weight,
      contribution: q > 0 ? magnitude : -magnitude, kind: q > 0 ? 'positive' : 'penalty' });
  }
  const raw = positive - penalty;
  const normalized = denominator > 0 ? raw / denominator : null;
  return { ...document, raw_score: raw, normalized_score: normalized,
    relevance_score: normalized ?? raw, score_basis: denominator > 0 ? 'normalized' : 'raw_no_positive_weights',
    positive_relevance: positive, negative_penalty: penalty, normalization_denominator: denominator,
    positive_weight_coverage: denominator > 0 ? observedPositive / denominator : null,
    missing_features: missing, why, filter_checks: filterChecks };
}

export function rankDocuments(documents, input, schema, limit = 20) {
  const requirements = validateRequirements(input, schema);
  const scored = documents.map(d => scoreDocument(d, requirements, schema)).filter(Boolean);
  // A shared query denominator preserves ranking. Stable IDs break ties, never hidden features.
  scored.sort((a, b) => b.relevance_score - a.relevance_score || a.id.localeCompare(b.id));
  return { results: scored.slice(0, limit), matched_count: scored.length,
    filtered_count: documents.length - scored.length,
    missing_value_policy: 'Skip unavailable contributions; keep the full positive-query denominator. Unknown hard-filter values fail. Missing penalties are not imputed; inspect coverage.',
    zero_denominator_policy: 'normalized_score is null; rank by raw score (penalties only, or stable ID for filter-only queries).' };
}
