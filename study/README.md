# jevbeddings: a JEV-only retrieval study on BANKING77

Read the [Norwegian study manuscript](STUDIE-NO.md) for the narrative, mathematical methods, results, and limitations. The [technical report](results/REPORT.md) retains the detailed generated tables.

Scientific question: how much useful retrieval information can 34 named semantic properties preserve across 77 closely related banking intents?

This study is separate from the 18-feature support demo. Its live document extraction, query fixtures, ranking code, and results are reproducible. Only JEV performs inference. BM25, cosine, dot product, global weighting, and statistical analysis are ordinary code.

## Files

- `PROTOCOL.md`: frozen design, metrics, leakage controls, hypotheses and limitations.
- `schema.js`, `frozen.json`: 34 properties in four families and their pre-test fingerprints.
- `queries.js`, `query-fixtures.json`, `frozen-queries.json`: 100 supplemental searches in 25 semantic groups plus eight controllability cases.
- `data.js`, `prepare.js`: official data downloader, pinned commit, CSV parser and fingerprints.
- `run.js`: resumable live JEV extraction with bounded concurrency, rate and estimated cost.
- `math.js`, `evaluate.js`: lexical baseline, exact retrieval metrics, ablations and comparisons.
- `results/progress.json`: live extraction state and measured expenditure.
- `results/results.json`: full evaluation once all vectors and queries are complete.
- `results/e1-predictions.jsonl`: per-test-query retrieval outcomes.
- `results/e3-queries.json`: supplemental query results and label groups.
- `results/e3-interpretations.json`: original JEV query decisions.
- `results/e5-ablation-per-query.json`: paired ablation outcomes.
- `results/REPORT.md`: readable study report, generated after evaluation.

## Verify the saved study without an API key

See [evidence and provenance](ETTERPROVBARHET.md) for exactly what is preserved, the limits of local timestamps/API logs, and what must accompany a GitHub upload. Extract the complete `results/banking77-reproduction.zip` into an empty directory first if the ignored dataset/database files are absent.

```sh
node study/verify-evidence.js
node study/reproduce.js
node --test
```

Node 24 is required. No API key, network download, or external npm package is needed. Full evaluation runs on a copy and compares all non-timing results plus seven exact output files, without overwriting original evaluation results. It writes `results/reproduction-audit.json`; verify the original manifest before this new report changes its timestamp.

## Run or resume a live extraction

Requires Node 24 and a TypeSafe key in `.env`; no external packages.

```sh
node study/freeze.js
node study/prepare.js
node study/freeze-queries.js
node --env-file-if-exists=.env study/run.js
node study/evaluate.js
node study/audit.js
node study/diagnose.js
node study/report.js
node --test
```

The freeze commands verify existing hashes and fail if definitions changed. Running extraction again resumes missing rows; it does not pay to replace completed rows. Evaluation refuses incomplete data. Test data is downloaded only after the training extraction and the supplemental-query freeze. Labels never appear in the JEV requests.

`audit.js` checks every text/score row and independently full-sorts 31 fixed queries across all four methods. `diagnose.js` is explicitly post-hoc descriptive analysis of repeatedly retrieved documents and feature magnitudes; it does not change the method. `node study/serve.js` serves the report locally at port 3212. `node study/bundle.js` creates a reproducibility archive after the audit using Windows tar (or bsdtar), including public dataset files and the extraction database, excluding `.env`.

The extraction database is `data/banking77/study.sqlite`. It stores each named feature vector, typed JEV answers, actual model version, token usage, timestamps and per-call cost estimates. No credentials are stored in the artifacts. Document request reconstruction uses the pinned input row plus the frozen schema's questions; query requests use the frozen query fixtures and interpreter. Keep `.env` out of exported study bundles.

Ranking metric definitions matter: Hit@5 means any same-intent document among five. Recall@5 divides the number of relevant retrieved documents by *all* same-intent corpus documents. Query-normalized weighted dot product has the same ordering as its unnormalized numerator; global feature weights, not normalization, change rankings.

The study does not evaluate black-box embeddings and cannot establish that they have been replaced. E3/E4 labels are relevance proxies, not independent document-level relevance judgments. BANKING77's intent labels also do not supply feature-level probability calibration labels.

## Attribution

BANKING77: Iñigo Casanueva, Tadas Temčinas, Daniela Gerz, Matthew Henderson and Ivan Vulić (2020), *Efficient Intent Detection with Dual Sentence Encoders*, Proceedings of the 2nd Workshop on NLP for ConvAI, pp. 38–45. [Paper](https://aclanthology.org/2020.nlp4convai-1.5/), [dataset repository](https://github.com/PolyAI-LDN/task-specific-datasets).

Data license: CC-BY-4.0, retained at `data/banking77/LICENSE`. Pinned source commit: `57ec275d8078af65b7731c2a98be812d844a6d6b`. Messages and labels are redistributed only with attribution. Our feature definitions, derived numerical outputs, query grouping and retrieval evaluation are separate additions; no original labels are corrected based on model predictions.
