'use strict';
const $ = id => document.getElementById(id);
let schema, health;
const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
const fmt = value => value === null || value === undefined ? 'unknown' : value.toFixed(3);
const label = id => schema?.features.find(f => f.id === id)?.description || id;
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed'); return data;
}
function message(text = '', error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
async function busy(action, pending) {
  const buttons = [...document.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true); message(pending);
  try { await action(); } catch (error) { message(error.message, true); }
  finally { buttons.forEach(b => b.disabled = false); if (health?.demo) $('search-button').disabled = true; }
}
function row(name, value) { const r = el('div', undefined, 'weight-row'); r.append(el('span', name), el('b', value)); return r; }
function renderInterpretation(q) {
  const root = $('interpretation'); root.replaceChildren();
  for (const [id, weight] of Object.entries(q.weights)) if (weight !== 0) {
    const r = row(label(id), `${weight > 0 ? '+' : ''}${weight.toFixed(2)}`);
    r.title = `${q.explanation?.[id] || 'Explicit weight'}${q.decisions?.[id] ? ` Confidence: ${fmt(q.decisions[id].confidence)}` : ''}`; root.append(r);
  }
  for (const f of q.filters) root.append(el('div', `MUST: ${label(f.feature)} ${f.operator} ${f.value}`, 'query-filter'));
  if (q.unknown_concepts?.length) root.append(el('p', q.unknown_concepts.map(c => c.reason).join(' '), 'small'));
  for (const u of q.uncertain_requirements ?? []) root.append(el('p', `${label(u.feature)}: ${u.reason} Confidence ${fmt(u.confidence)}.`, 'small'));
  const details = el('details'); details.append(el('summary', 'Full interpretation JSON'));
  const pre = el('pre', JSON.stringify(q, null, 2), 'json-detail'); details.append(pre); root.append(details);
  $('requirements').value = JSON.stringify({ weights: q.weights, filters: q.filters }, null, 2);
}
function renderResults(data) {
  renderInterpretation(data.query_interpretation);
  $('result-count').textContent = String(data.matched_count ?? 0);
  $('latency').textContent = `${data.results.length} shown · ${Math.round(data.latency_ms)} ms`;
  const root = $('results'); root.replaceChildren();
  if (!data.results.length) root.append(el('div', data.message || 'No documents passed these constraints. Check the collection and missing features.', 'empty'));
  for (const [i, result] of data.results.entries()) {
    const card = el('article', undefined, 'result-card');
    const top = el('div', undefined, 'result-top'), title = el('div');
    title.append(el('div', `${String(i + 1).padStart(2, '0')} / ${result.id}`, 'result-rank'));
    const button = el('button', result.title, 'result-title'); button.onclick = () => inspect(result.id); title.append(button);
    const score = el('div', fmt(result.relevance_score), 'score'); score.append(el('small', result.score_basis === 'normalized' ? 'RELEVANCE' : 'RAW SCORE')); top.append(title, score); card.append(top);
    card.append(el('p', result.body.length > 280 ? result.body.slice(0, 280) + '…' : result.body, 'result-body'));
    const chips = el('div', undefined, 'chips');
    result.why.filter(w => w.contribution !== null && w.contribution !== 0).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 5).forEach(w => chips.append(el('span', `${label(w.feature)} ${w.contribution >= 0 ? '+' : ''}${fmt(w.contribution)}`, `chip${w.kind === 'penalty' ? ' negative' : ''}`)));
    card.append(chips);
    const details = el('details'); details.append(el('summary', 'Why this ranked here'));
    const stats = el('div', undefined, 'score-stats');
    stats.append(el('span', `Positive ${fmt(result.positive_relevance)}`), el('span', `Penalty −${fmt(result.negative_penalty)}`), el('span', `Raw ${fmt(result.raw_score)}`), el('span', `Denominator ${fmt(result.normalization_denominator)}`)); details.append(stats);
    const table = el('table', undefined, 'score-table'); const thead = el('thead'), tr = el('tr');
    ['Feature', 'Value', 'Query', 'Global', 'Contribution'].forEach(t => tr.append(el('th', t))); thead.append(tr); table.append(thead);
    const tbody = el('tbody'); result.why.forEach(w => { const r = el('tr'); [label(w.feature), fmt(w.document_value), fmt(w.query_weight), fmt(w.global_weight), fmt(w.contribution)].forEach(t => r.append(el('td', t))); tbody.append(r); }); table.append(tbody); details.append(table);
    for (const f of result.filter_checks) details.append(el('p', `Passed: ${label(f.feature)} ${fmt(f.document_value)} ${f.operator} ${f.value}`, 'small'));
    details.append(el('p', `Observed positive-weight coverage: ${result.positive_weight_coverage === null ? 'n/a' : Math.round(result.positive_weight_coverage * 100) + '%'}. ${result.missing_features.length ? 'Unknown: ' + result.missing_features.join(', ') : 'All requested features were evaluated.'}`, 'small muted'));
    details.append(el('p', `Source: ${result.provenance} · document schema v${result.schema_version ?? 'incomplete'}`, 'small muted'));
    card.append(details); root.append(card);
  }
  message(data.status === 'ok' ? `${data.filtered_count} documents excluded by hard filters. ${data.unindexed_documents} await indexing.` : data.message, data.status !== 'ok');
}
async function search(explicit = false) {
  await busy(async () => {
    const payload = explicit ? { requirements: JSON.parse($('requirements').value), limit: 20 } : { query: $('query').value, limit: 20, allow_partial: $('allow-partial').checked };
    renderResults(await api('/search', payload));
  }, explicit ? 'Calculating feature contributions…' : 'JEV is interpreting your search…');
}
async function refreshDocuments() {
  const data = await api('/documents'); $('document-list').replaceChildren();
  for (const doc of data.documents) {
    const r = el('div', undefined, 'document-row'), button = el('button', doc.title, 'text-button'); button.onclick = () => inspect(doc.id);
    r.append(button, el('span', doc.indexed_at ? `v${doc.schema_version ?? 'partial'} · ${doc.provenance}` : 'Awaiting indexing')); $('document-list').append(r);
  }
  if (!data.documents.length) $('document-list').append(el('p', 'No documents yet. Add a support message below or use the bulk import command.', 'small muted'));
}
async function inspect(id) {
  try {
    const doc = await api(`/documents/${encodeURIComponent(id)}/features`);
    $('dialog-title').textContent = doc.title;
    $('dialog-meta').textContent = `${doc.id} · ${doc.provenance} · schema ${doc.schema_version ?? 'not indexed'}`;
    $('dialog-body').textContent = doc.body; $('dialog-features').replaceChildren();
    for (const feature of schema.features) {
      const r = row(label(feature.id), fmt(doc.features[feature.id]));
      const metadata = doc.feature_metadata.find(m => m.feature_id === feature.id);
      r.title = `${feature.id}: ${feature.definition}\n${metadata ? `Evaluated with ${metadata.jev_version ?? 'manual fixture'} at schema v${metadata.schema_version}` : 'Not evaluated'}`;
      $('dialog-features').append(r);
    }
    $('document-dialog').showModal();
  } catch (error) { message(error.message, true); }
}
async function init() {
  try {
    [schema, health] = await Promise.all([api('/features'), api('/health')]);
    $('connection').textContent = health.demo ? 'OFFLINE FIXTURES' : health.jev_configured ? `JEV CONNECTED · ${health.model}` : 'JEV KEY REQUIRED';
    $('schema-version').textContent = `v${schema.version}`;
    $('schema-note').textContent = `${schema.features.length} named dimensions · values from 0 to 1`;
    for (const feature of schema.features) {
      const d = el('details', undefined, 'feature-row'), s = el('summary'); s.append(el('span', feature.description), el('span', `×${feature.global_weight}`));
      d.append(s, el('p', feature.definition), el('code', feature.id), el('p', feature.question)); $('feature-list').append(d);
    }
    if (health.demo || !health.jev_configured) {
      $('mode-banner').hidden = false;
      $('mode-banner').textContent = health.demo ? 'Offline demonstration · These 30 synthetic documents use authored feature values, not JEV predictions. Open the explicit requirements editor to explore ranking.' : 'Add TYPESAFE_API_KEY to your local .env file and restart the server to index and search with JEV.';
    }
    if (health.demo) { $('search-button').disabled = true; $('add-document').hidden = true; $('index-all').hidden = true; document.querySelector('.advanced').open = true; }
    await refreshDocuments();
  } catch (error) { message(error.message, true); }
}
$('search-form').onsubmit = event => { event.preventDefault(); search(); };
$('run-explicit').onclick = () => search(true);
$('refresh-docs').onclick = () => busy(async () => { await refreshDocuments(); message(); }, 'Refreshing collection…');
$('close-dialog').onclick = () => $('document-dialog').close();
$('document-form').onsubmit = event => { event.preventDefault(); busy(async () => {
  const doc = await api('/documents', { title: $('doc-title').value, body: $('doc-body').value });
  $('document-form').reset(); await refreshDocuments();
  await api(`/documents/${doc.id}/index`, {}); await refreshDocuments(); message('Document saved and indexed with JEV.');
}, 'Saving and evaluating the document with JEV…'); };
$('index-all').onclick = () => busy(async () => {
  const result = await api('/index', {}); await refreshDocuments();
  message(result.errors.length ? result.errors[0].message : 'All missing features have been evaluated.', result.errors.length > 0);
}, 'JEV is evaluating missing features. Completed documents are saved as indexing proceeds…');
init();
