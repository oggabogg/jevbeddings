# jevbeddings

An experiment with named features for semantic retrieval, using JEV as the only model.

**[Read the study](study/STUDY.md)** · [Evidence and provenance](study/EVIDENCE.md) · [Website edition (Norwegian)](https://fredrikskauen.no/no/eksperimenter/jevbeddings/)

This repository contains the complete BANKING77 experiment: 10,003 documents, 3,080 test queries, 34 features, saved JEV assessments, and per-query results. Code and data are stored as ordinary Git files, so you can reproduce the calculations immediately after cloning. No API key or new model calls are required.

## Reproduce the results

Install Node.js 24 or later, then run:

```sh
git clone https://github.com/oggabogg/jevbeddings.git
cd jevbeddings
node study/verify-evidence.js
node --test
node study/reproduce.js
```

No npm packages need installing. Run the inventory check first: reproduction writes a new verification report with a new timestamp. All calculations run on a separate copy; the original ranking results are not overwritten. GitHub Actions runs the same checks without an API key.

## Find the material

| Material | Location |
| --- | --- |
| Methods, frozen definitions, and questions | [study/](study/README.md) |
| Original texts and data license | [data/banking77/](data/banking77/) |
| Saved JEV answers and call metadata | [study.sqlite](data/banking77/study.sqlite) |
| Results and confidence intervals | [results.json](study/results/results.json) |
| Every test query | [e1-predictions.jsonl](study/results/e1-predictions.jsonl) |
| Supplemental queries, ablations, and explanations | [study/results/](study/results/) |
| Cost evidence and dashboard screenshot | [COSTS.md](study/COSTS.md) |
| Original archive published with the Norwegian study | [banking77-reproduction.zip](study/results/banking77-reproduction.zip) |
| Publication record and content checks | [PUBLICATION.md](docs/PUBLICATION.md) |

JEV with cosine retrieved a correct first result for **83.67%** of queries, compared with **80.10%** for BM25. The difference was 3.57 percentage points, with a paired 95% bootstrap interval of 1.92–5.26. JEV with ordinary or weighted dot product performed worse. These findings apply to this dataset and setup; the study does not compare against conventional embedding models.

The material shows how the results follow from the saved answers. Local logs, checksums, and timestamps are not signed confirmations from the provider or a public preregistration.

BANKING77 was released by Casanueva and colleagues under [CC-BY-4.0](data/banking77/LICENSE), with attribution in the [study documentation](study/README.md#attribution). The project's own code does not yet have a separate reuse license.

Repository documentation and generated reports are in English. The original ZIP remains an unchanged historical snapshot and includes Norwegian prose; the website edition is also in Norwegian.

---

# Support demo and development

This section describes the separate 18-feature prototype. The BANKING77 study above uses 34 features.

A working support-message retrieval prototype: JEV produces 18 named semantic features, SQLite stores their values, and deterministic weighted scoring ranks documents. JEV is the only model. There are no embeddings, vector databases, learned rankers, or other AI service dependencies.

## Run

Requires **Node.js 24 or later**. No packages need installing; the application uses built-in HTTP, fetch, SQLite, and test modules.

```powershell
# Windows: finds Node 24, including the runtime bundled with Codex.
powershell -File scripts/start.ps1
```

Or, with Node 24 on PATH:

```sh
cp .env.example .env
# Set TYPESAFE_API_KEY in .env. Never put the key in browser code.
npm start
```

Open [http://127.0.0.1:3210](http://127.0.0.1:3210). Keep your API key in your local `.env` file. Do not commit it.

If Windows reports `bad option: --env-file-if-exists` or cannot find `node:sqlite`, an older system Node is taking precedence. Use `scripts/start.ps1` or Node 24 explicitly.

### Load documents

```sh
# Import authored sample texts and ask JEV to evaluate them.
npm run import -- --sample --index
# Import up to 1000 records from your own JSON array.
npm run import -- documents.json --index
```

```json
[
  {
    "id": "ticket_101",
    "source": "support",
    "external_id": "101",
    "title": "Charged twice",
    "body": "Our enterprise subscription was charged twice. Please refund it today."
  }
]
```

Import leaves existing IDs intact. Indexing saves one complete document at a time, skips already evaluated features, stops on provider errors, and can be resumed with the same command. Input text is sent to the official JEV service. The browser also supports adding and indexing an individual document.

### Offline demonstration

```sh
npm run demo
# Windows alternative: powershell -File scripts/start.ps1 -Demo
```

Open [http://127.0.0.1:3211](http://127.0.0.1:3211). This isolated, read-only, in-memory demo uses **authored binary feature fixtures, not model predictions**. Use the explicit requirements editor. Natural-language interpretation is disabled; there is no model fallback.

## Verified JEV integration

The adapter follows [TypeSafe's official HTTP contract](https://docs.typesafe.ai/api), checked 2026-09-26:

- `POST https://api.typesafe.ai/v1/systemone`, server-side Bearer authentication.
- Request: `{state, model, questions}`; one shared document and a map of typed questions.
- Each document property uses `type: "noul"`, `instructions`, and yes/no criteria. The returned `answers[id].noul` is stored directly, without rounding or vector normalization.
- Query intent uses closed-set `choice` questions. Confidence stays separate from importance.
- The response supplies model identity and token usage. A call cannot save partial feature values if validation fails.
- Pinned model: `jev-1.13.0`. JEV identifiers are checked in both request configuration and responses. The endpoint cannot be redirected to another service.

JEV returns typed decisions, **not free-form prose or arbitrary JSON generation**. Code assembles the requirements and explanation templates. A Noul coverage question reports unsupported concepts; because JEV cannot write the unsupported concept's name, the diagnostic preserves the entire original query and explicitly identifies it as `scope: "whole_query"`.

The official [model reference](https://docs.typesafe.ai/models) documents token-based context limits, not the small per-request question limits advertised by unrelated JEV gateways. This MVP sends all 18 document questions together, or 18 intent questions plus one coverage question. Long inputs are rejected by the service rather than silently truncated.

Requests have timeouts, bounded exponential retries with jitter, Retry-After handling, and strict finite numeric validation. Authentication and validation failures are not retried. Usage estimates use the configured input-token rate; they are not invoices. Failed/ambiguous attempts can incur costs not present in a successful response.

## Project structure

```text
src/
  jev.js          Official JEV HTTP adapter and typed response validation
  schema.js       Stable feature definitions, questions, ranges, initial weights
  query.js        JEV choices → weights, constraints, uncertainty diagnostics
  store.js        SQLite persistence, schema snapshots, named feature values
  scoring.js      Weighted contributions, explicit penalties, normalization
  service.js      Indexing, incremental backfill, retrieval orchestration
  evaluation.js  Retrieval metrics, reliability buckets, deterministic calibration
  server.js       Local HTTP API and static browser application
public/           Search, requirement inspection, score breakdowns, feature viewer
fixtures/         Synthetic texts, provisional feature labels, graded query judgments
scripts/          Import, live smoke check, benchmark, offline demo, Windows launcher
test/             Mathematical, integration, provider-contract, and API tests
data/             Ignored SQLite databases
reports/          Ignored live responses and benchmark reports
```

## Ranking contract

For each known document value `d`, query weight `q`, and nonnegative global weight `w`:

```text
positive_relevance = Σ(q > 0) w × q × d
negative_penalty   = Σ(q < 0) w × |q| × d
raw_score          = positive_relevance − negative_penalty
denominator        = Σ(q > 0) w × q
normalized_score   = raw_score / denominator, or null when denominator = 0
```

`relevance_score` uses normalized score when defined, otherwise raw score. Penalties can make normalized scores negative; results are not clipped. Negative-only queries rank by least penalty. Filter-only queries tie at zero and use stable document ID ordering. An empty/no-requirements query returns no results and a diagnostic. Zero-valued document vectors are valid.

**Missing policy:** missing or null values make no contribution, but are never converted to evaluated zero. The positive-query denominator stays fixed as specified, so missing evidence receives no positive credit. Missing negative evidence incurs no invented penalty. Both are exposed in `missing_features` and the contribution list; positive-weight coverage is also shown. A missing value fails a hard filter, even an exclusion filter. Entirely unindexed documents are excluded and counted separately.

Every result includes the complete named vector, raw and normalized scores, positive relevance, negative penalties, per-feature signed contributions with global/query weights, passed filter checks, and missing-value diagnostics. No semantic candidate-generation shortcut is used; all indexed documents are considered.

### Query intent

| JEV choice | Weight | Hard filter |
| --- | ---: | --- |
| requested | +1.0 | none |
| preferred | +0.6 | none |
| weak | +0.3 | none |
| irrelevant | 0 | none |
| avoid | −0.5 | none |
| exclude | 0 | value ≤ 0.2 |
| require | +1.0 | value ≥ 0.8 |

These are explicit product mappings, not probabilities. A hard-filter choice with confidence below 0.8 is held in `uncertain_requirements`, not applied. By default the search then returns `needs_review`. `allow_partial: true` uses the supported weights and confident filters, with the unresolved items still visible. Alternatively, edit and submit explicit requirements. This gate does not guarantee correct interpretation: JEV can still make confident mistakes. Thresholds need domain validation.

Natural-language exact dates, entity names, numerical thresholds, and grouped OR logic are outside this MVP. The coverage check attempts to flag these; it is also a model judgment. The explicit requirements API supports precise numeric thresholds over existing features.

## HTTP API

This is a **local, single-user MVP** bound to `127.0.0.1`. It has no remote authentication or tenant separation. Host/origin checks, JSON-only writes, a request-size cap, and a restrictive content policy protect the local UI. Do not expose the service publicly as-is.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Configuration status, counts, JEV latency/usage/cost totals |
| POST | `/documents` | Save one document; does not call JEV yet |
| POST | `/documents/bulk` | Atomically save `{"documents": [...]}` (up to 1000, 8 MiB) |
| GET | `/documents` | List metadata |
| GET | `/documents/:id` | Full document and features |
| POST | `/documents/:id/index` | Evaluate missing features; optional `feature_ids`, `force` |
| POST | `/index` | Resumable indexing of missing features across the collection |
| POST | `/search` | Natural-language query OR explicit requirements |
| GET | `/documents/:id/features` | Full feature vector and per-feature provenance |
| GET | `/features` | Active schema and version history |
| POST | `/features` | Add one feature and create a new schema version |
| POST | `/features/weights` | Version a manual global-weight change |
| POST | `/features/backfill` | Evaluate missing features, optionally limited to `feature_ids` |

Search request:

```json
{"query":"urgent billing problems from enterprise customers","limit":20}
```

Explicit requirements bypass interpretation, but use the same validated scorer:

```json
{
  "requirements": {
    "weights": {"about_billing":1,"urgent":0.8,"is_newsletter":-0.5},
    "filters": [{"feature":"is_customer","operator":">=","value":0.8}]
  },
  "limit":20
}
```

Filters support `>=`, `<=`, `>`, `<`, and `=`. Unknown feature IDs, nonfinite numbers, and out-of-range values are rejected. Limit is 1–100. A raw HTTP body can contain only one of `query` or `requirements`.

## Add a feature without reindexing everything

POST this to `/features`:

```json
{
  "id":"delivery_delay",
  "description":"Delivery delay",
  "definition":"The document reports a delivery arriving after a promised date.",
  "question":"Does the document report a delivery arriving after its promised date?",
  "type":"probability",
  "value_range":[0,1],
  "global_weight":1
}
```

Then POST `{"feature_ids":["delivery_delay"]}` to `/features/backfill`. Existing values and their extraction versions stay intact. The document's schema version advances when all features in the target schema are evaluated. A partially backfilled document retains its last complete version (or null if never complete); individual values always record their extraction schema version and JEV model. Global weighting changes create a schema snapshot without calling JEV or rewriting extraction provenance.

Semantic definitions are immutable for an existing ID. To change a feature's meaning, introduce a new ID. This MVP supports additions up to 30 features and manual global-weight revisions; it does not silently reinterpret old stored values or implement feature removal. Information-based weights are deliberately deferred until a stronger baseline is available.

## Evaluation

```sh
npm test
npm run smoke:live
npm run benchmark             # offline mathematical fixtures, zero API calls
npm run benchmark -- --live   # live JEV extraction + query interpretation
```

Tests include the required cosine counterexample (`[0,0,0,0.1]` versus `[0,0,0,1]`), 1000-document ranking, signed contributions, null/zero distinctions, undefined normalization, strict constraints, schema additions, partial-write prevention, provider retries/validation, uncertain-query handling, and an end-to-end HTTP flow.

Benchmark reports compare unweighted, weighted, and filters-plus-weighted scoring on the same JEV features/interpretations. They report Precision@5, Recall@5, full-ranking MRR, nDCG@5, ranking/query latency, input tokens, and separate indexing/query cost estimates. `needs_review` queries count as zero retrieval rather than being dropped. Calibration diagnostics include per-feature accuracy, precision, recall, false-positive/negative rates, Brier score, and ten reliability buckets; undefined rates are null. Optional monotonic piecewise calibration is implemented as an explicit utility and is **not applied** to stored values or ranking.

The fixture labels and query judgments are authored synthetic examples with at least one positive and negative for each feature. They are not independent human annotations. Use real, independently labeled development and held-out sets before making quality or calibration claims. If fitting a calibration mapping, fit on development data only, then evaluate on a separate held-out split.

See [the initial live evaluation](docs/evaluation.md) for measured results, known model errors, and limitations. Reports contain cumulative database call accounting; repeated live benchmarks reuse indexed documents but incur new query calls.
