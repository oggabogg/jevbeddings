# Frozen protocol: interpretable JEV retrieval on BANKING77

Created 2026-09-26 before obtaining or inspecting official test messages. This is a locally timestamped protocol, not a public preregistration. The schema and protocol are SHA-256 fingerprinted by `study/freeze.js`; all subsequent extraction verifies these hashes. No changes based on test results are permitted for this run. Corrections to implementation bugs must be logged separately.

## Question and constraints

Can 34 explicit banking properties retain useful intent-level and broad retrieval information, with directly controllable positive and negative preferences? The outcome may favor BM25 or cosine. JEV is the only inference model. BM25, cosine, arithmetic weights, and statistics are deterministic code. No other model, dense embedding service, learned reranker, or 77-way label classifier is permitted.

Feature definitions are based on the user's proposed property families and general banking concepts. Some features naturally correspond to individual BANKING77 topics; there is no claim of taxonomy blindness. The full 77 labels are never sent to JEV and are not the feature dimensions.

## Data and leakage controls

Use all 10,003 official training rows as retrieval documents and all 3,080 official test rows as E1/E2 query messages. Pin the source repository commit, record file SHA-256 values and row counts, and preserve the official split. JEV sees only message text and fixed property questions, never intent labels, retrieved labeled examples, or test statistics.

Retain duplicates in the primary official-split evaluation. Also report performance after excluding test queries whose lowercased, whitespace-normalized text occurs in training. Report duplicate counts and within-test duplicates. Labels are used only to construct relevance judgments, evaluate results, and design the supplemental broad-query groups. No supervised fitting or hyperparameter tuning is performed.

## E1/E2: intent reconstruction and ranking comparison

Apply the SAME frozen Noul feature extractor to every training and test message. Query feature values are property evidence here, not interpreted search-importance values. This is distinct from E3/E4 explicit requirements.

Compare four methods over the identical train corpus:

1. BM25: lowercase Unicode letter/number tokens, no stemming or stop-word list; k1=1.2, b=0.75; document frequency from training only; repeated query terms counted once. Positive Robertson IDF `log(1+(N-df+0.5)/(df+0.5))`.
2. Cosine of the named features, only in this research comparator. Define zero-vector score as 0.
3. Ordinary dot product, without normalization.
4. Weighted relevance: `sum(w_i*q_i*d_i) / sum(w_i*q_i)` with 0 for a zero denominator. `w_i=log((N+1)/(df_i+1))`, where df counts training values >=0.5. Weights are unsupervised and derived from training only. All weights and frequencies are published.

Dividing a dot product by a query-only denominator cannot change its ranking. Any difference between ordinary dot and weighted relevance is therefore caused by the global weights, not the display normalization. Cosine changes the ranking by normalizing documents. No version is selected or tuned using test performance. Exact score ties are broken by stable original row index.

Primary metrics: Top-1/Precision@1, Hit@5 (at least one same-intent result in five), true document Recall@5 (retrieved same-intent documents divided by all same-intent training documents), full-ranking MRR, and binary nDCG@10. Do NOT call Hit@5 true Recall@5. Include Precision@5, macro Top-1 across intents, per-intent counts, Wilson 95% intervals for hit rates, and paired deterministic bootstrap intervals for differences in Top-1. Full ranks use every candidate, not a top-K approximation.

## E3: broader semantic retrieval

Author 25 semantic groups with four fixed paraphrases each (100 queries), mapping each group to explicit existing training intent labels. Freeze these before inspecting test messages or retrieval outputs. Judgments are label-derived proxy relevance, not document-level human search judgments. Paraphrases in a group are correlated and must not be treated as 100 independent semantic tasks.

Each group also has explicit named positive feature weights. Compare BM25 on each phrase, JEV interpreted natural-language requirements, and manual explicit requirements on the stored JEV document features. Natural-language interpretation reuses the app's fixed Choice rubric, coverage diagnostics, and uncertain-filter handling. Report strict results and review/unsupported rates rather than silently discarding queries requiring review. Manual requirements measure representation/scoring independently of interpretation errors. Report Precision@10, Recall@10, Hit@10, nDCG@10, MRR, and per-group results.

## E4: controllability

Define fixed cases with a positive query, an unwanted property, and label-derived unwanted intent groups. Compare the positive-only query against penalty strengths 0.25, 0.5, and 1, plus a hard filter on the unwanted feature <=0.2. At least six cases, including withdrawal problems excluding declined withdrawals and card transactions excluding pending transactions.

Measure unwanted-label rate in the top 10, desired-label Precision@10 and Recall@10, known-feature hard-filter violations, candidate survival, and rank changes. Mechanically verify that a document's raw score never increases as its penalty weight increases and that hard-filtered results satisfy the numerical constraint. Report semantic failures separately: a correct numeric filter may still admit an unwanted intent when JEV's feature prediction is wrong.

No comparison against embeddings is made. Controllability over our own features does not establish superiority over untested systems.

## E5: ablation

For weighted relevance, remove each of the four feature families and each of the 34 individual features. Reuse the same frozen outputs; do not call JEV again. Keep remaining global weights fixed. Report Top-1 and Hit@5 changes; full-system metrics are from E1. These are descriptive post-evaluation diagnostics, not a method-selection loop.

## Operational plan

Use resumable SQLite storage keyed by split/row and schema hash, plus per-call metadata and typed answers. Checkpoint every successful request. Bounded worker concurrency and start rate must stay below the documented provider limit. Initially cap at 8 concurrent requests and 15 starts/second. Stop on persistent errors, leaving a resumable database. Use a local estimated-cost ceiling of USD 5 for this study; record that unobserved failed attempts could still have been charged. Start with a train-only smoke batch to check response types and cost, without changing definitions based on scores.

Record actual model IDs, timestamps, usage, estimated cost, latency percentiles, wall time, and complete/missing row counts. No incomplete extraction may produce headline full-test metrics. Runtime cost/throughput settings can change without changing scientific methodology.

## Reporting and limits

Publish a readable report plus JSON/CSV results, per-query predictions, confusion summaries, weights, feature distributions, query fixtures, protocol/schema fingerprints, dataset attribution, and reproduction commands. Discuss information lost by the small schema, correlated features, model errors, benchmark contamination, proxy judgments, uncertain interpretation, and the single-domain scope.

BANKING77 intent labels are not ground-truth annotations for each semantic property. Do not call feature-versus-intent agreement a calibration evaluation. True feature calibration requires a separately human-labeled feature set and is not claimed here. Do not claim that this study proves replacement of black-box embeddings because no such model is evaluated.

Sources: [official dataset](https://github.com/PolyAI-LDN/task-specific-datasets), [Casanueva et al. 2020](https://aclanthology.org/2020.nlp4convai-1.5/), [JEV API](https://docs.typesafe.ai/api), [JEV model limits](https://docs.typesafe.ai/models).
