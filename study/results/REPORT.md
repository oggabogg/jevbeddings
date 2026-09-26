# jevbeddings — BANKING77: interpretable retrieval with JEV

**Completed:** 2026-09-26T17:18:04.384Z. **Model:** jev-1.13.0. **Scope:** 10,003 documents, 3,080 test queries, 34 named features, 100 supplemental queries, eight controllability tests, and 38 ablations.

## Main findings

The best Top-1 result in this study was **JEV + cosine: 83.67 %**. The best JEV feature method was **JEV + cosine: 83.67 %**. BM25 achieved 80.10 %. This is retrieval against the entire training set, not direct classification among 77 labels.

Weighted relevance achieved 28.02 % Top-1 and 49.81 % Hit@5. Cosine achieved 83.67 % Top-1. The difference between them is -55.65 percentage points. The experiment therefore does not support a general assumption that preserving magnitude always improves retrieval; the result must be assessed for this particular schema and task.

For the broader, composite queries, Precision@10 was **83.20 % with explicit feature requirements**, **68.00 % with JEV-interpreted requirements**, and **49.70 % with BM25**. The representation therefore appears substantially more useful for explicit feature requirements than the weak dot-product intent-retrieval performance alone would suggest. This applies to the study's predefined proxy tasks.

The controllability tests confirm numerical control but provide limited evidence of improved semantic filtering: 7 of 8 already had zero unwanted labels in the top ten before penalties. In two cases, precision for desired results fell under a strong penalty.

The JEV dashboard showed **USD 2.0765** for the Jevbeddings project. The dashboard labels the amount “Estimated”; it is not an invoice. The 13,183 recorded study calls separately give a log-based estimate of USD 2.0686. No other models or embedding services were used. All 13,083 official texts were assessed.

## How the study was conducted

BANKING77 has 77 banking intents and an official train/test split. We used the training set as the retrieval corpus and test messages as queries. Relevance here means that the document and query share the same original label. Sources: the [PolyAI dataset](https://github.com/PolyAI-LDN/task-specific-datasets) and [Casanueva et al. (2020)](https://aclanthology.org/2020.nlp4convai-1.5/).

The schema was frozen at 2026-09-26T16:57:27.642Z, before the test file was downloaded. The 34 dimensions describe objects, events/problems, user goals, and states. JEV received only message text and fixed Noul questions. No intent labels or labeled examples were sent to the model. Some features nevertheless overlap with dataset topics; we do not claim that the domain schema is wholly independent of the taxonomy.

Queries and documents used the same extractor in E1/E2. Query values there are evidence of features, not desired feature weights. E3/E4 instead use explicit search requirements. This distinction matters when applying the results to the product.

BM25 uses only training-set word statistics, with k1=1.2 and b=0.75. Weighted relevance uses w_i=log((N+1)/(df_i+1)), where df_i is the number of training documents with a score of at least 0.5. No parameters were selected using test results. All frequencies and weights are in [feature-weights.json](feature-weights.json).

## E1/E2: all 3,080 test messages

| Method | Top-1 / P@1 | 95% Wilson interval | Hit@5 | P@5 | Recall@5 | MRR | nDCG@10 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BM25 | 80.10 % | 78.65 % – 81.47 % | 93.80 % | 70.34 % | 2.93 % | 0.8611 | 0.6769 |
| JEV + cosine | 83.67 % | 82.32 % – 84.93 % | 93.60 % | 78.44 % | 3.22 % | 0.8802 | 0.7678 |
| JEV + dot product | 25.97 % | 24.46 % – 27.55 % | 49.61 % | 29.99 % | 1.08 % | 0.3715 | 0.3025 |
| JEV + weighted relevance | 28.02 % | 26.46 % – 29.63 % | 49.81 % | 31.86 % | 1.16 % | 0.3863 | 0.3203 |

**Hit@5** means that at least one of five results has the correct intent. **Recall@5** is the number of relevant results among five divided by all relevant documents in the corpus. Since each intent has many training documents, true Recall@5 is naturally much lower than Hit@5. MRR uses the position of the first relevant document in the full ranking; nDCG@10 uses binary relevance.

Normalization by a query-specific constant does not change the ranking. The difference between dot product and weighted relevance therefore comes from global feature weights. Cosine also normalizes documents and can consequently change the ordering. The 0.1 versus 1.0 example demonstrates a mathematical limitation of cosine for certain explicit feature requirements; it does not prove that cosine should lose on every semantic retrieval task.

### Why did dot product perform poorly?

This is a **descriptive analysis conducted after the main result**, without changing the method or making new model calls. We examined how many distinct documents won queries and how many strong features the winners had.

| Method | Distinct top documents | Share of queries won by the ten most frequent documents | Average strong features in the winner |
| --- | --- | --- | --- |
| BM25 | 2383 | 1.46 % | 4.69 |
| JEV + cosine | 2456 | 1.40 % | 4.75 |
| JEV + dot product | 232 | 42.69 % | 10.39 |
| JEV + weighted relevance | 255 | 36.59 % | 10.05 |

The average corpus document has 4.96 features with a value of at least 0.5. Dot product favored winners with 10.39 such features, and just ten documents won 42.69 % of all queries. This is consistent with documents scoring highly across many features gaining a systematic advantage, even when the extra features do not describe the query's intent. It is a documented association, not sufficient causal evidence on its own. Cosine reduces this tendency by normalizing document-vector length. The full analysis and frequently winning documents are in [diagnostics.json](diagnostics.json).

### Paired Top-1 differences

| Comparison (first minus second) | Difference, percentage points | 95% bootstrap interval |
| --- | --- | --- |
| bm25_minus_cosine | -3.57 | -5.26 – -1.92 |
| bm25_minus_dot | 54.12 | 52.08 – 56.20 |
| bm25_minus_weighted | 52.08 | 50.06 – 54.12 |
| cosine_minus_dot | 57.69 | 55.81 – 59.58 |
| cosine_minus_weighted | 55.65 | 53.73 – 57.53 |
| dot_minus_weighted | -2.05 | -3.05 – -0.97 |

Bootstrap: 2,000 paired resamples, fixed seed, no correction for multiple comparisons. The intervals describe variation across this benchmark's messages, not generalization to all banking domains. Complete per-intent results and confusions are in [results.json](results.json).

### Duplicate checks

Normalization: lowercase and collapsed whitespace. We found 4 extra duplicate rows in training, 1 in testing, and 7 test rows whose text appears in training. The main result retains the official split. After removing the overlapping test queries:

| Method | Query count | Top-1 | Hit@5 | MRR |
| --- | --- | --- | --- | --- |
| BM25 | 3073 | 80.05 % | 93.78 % | 0.8608 |
| JEV + cosine | 3073 | 83.63 % | 93.59 % | 0.8799 |
| JEV + dot product | 3073 | 25.97 % | 49.66 % | 0.3716 |
| JEV + weighted relevance | 3073 | 28.05 % | 49.82 % | 0.3866 |

## E3: 100 composite queries

Twenty-five predefined semantic groups have four formulations each. Relevant documents are defined through training-set intent groups. This produces reproducible **proxy judgments**, not independent human judgments of every query–document pair. Formulations within each group are correlated; 100 formulations are not 100 independent retrieval tasks.

| Method | P@10 | Recall@10 | Hit@10 | MRR | nDCG@10 | Needs review |
| --- | --- | --- | --- | --- | --- | --- |
| BM25 | 49.70 % | 1.52 % | 92.00 % | 0.6823 | 0.5110 | 0/100 |
| Explicit feature requirements | 83.20 % | 2.66 % | 92.00 % | 0.8854 | 0.8372 | 0/100 |
| JEV-interpreted query | 68.00 % | 2.12 % | 83.00 % | 0.7000 | 0.6721 | 6/100 |

Explicit feature requirements isolate representation and ranking from interpretation errors. JEV-interpreted queries include both stages. Queries with unsupported concepts, uncertain hard filters, or no active requirements return no results and count as zero in the strict evaluation. They are not removed from the denominator. See [e3-queries.json](e3-queries.json) and [e3-interpretations.json](e3-interpretations.json).

## E4: can we control the results?

| Case | Unwanted in top ten, before | With penalty 1.0 | With hard filter | Desired P@10, before → hard filter | Candidates after hard filter |
| --- | --- | --- | --- | --- | --- |
| withdrawals_no_declines | 0.00 % | 0.00 % | 0.00 % | 100.00 % → 100.00 % | 8675 |
| card_no_pending | 0.00 % | 0.00 % | 0.00 % | 90.00 % → 100.00 % | 3251 |
| transfers_no_fees | 0.00 % | 0.00 % | 0.00 % | 100.00 % → 100.00 % | 8235 |
| topups_no_pending | 0.00 % | 0.00 % | 0.00 % | 100.00 % → 100.00 % | 3251 |
| unrecognized_no_cash | 30.00 % | 0.00 % | 10.00 % | 70.00 % → 70.00 % | 9019 |
| cards_no_delivery | 0.00 % | 0.00 % | 0.00 % | 90.00 % → 90.00 % | 9567 |
| transfers_no_declines | 0.00 % | 0.00 % | 0.00 % | 100.00 % → 100.00 % | 8675 |
| fees_no_cards | 0.00 % | 10.00 % | 0.00 % | 0.00 % → 0.00 % | 4485 |

We tested penalty strengths of 0, 0.25, 0.5, and 1, plus a hard filter <=0.2. Mechanical monotonicity violations: **0**. Numerical hard-filter violations among returned results: **0**. These numbers verify the mathematics, not automatically correct semantics. JEV can assign a low declined score to a document with a declined intent; a numerically correct filter can then still admit it. Desired retrieval quality and candidate attrition are therefore also reported.

In “unrecognized_no_cash,” the unwanted share fell from 30% to 0% with penalty 1.0, while the hard filter still admitted 10%. In “cards_no_delivery,” desired P@10 fell from 90% to 50% with a strong penalty; in “transfers_no_declines,” it fell from 100% to 40%. These results remain unchanged in the report. Many other cases were not very informative because unwanted results were already absent from the top ten. A stronger future controllability evaluation should predefine more difficult contrast cases; this study should not be presented as general proof of superior controllability.

## E5: which features contribute?

All ablations use the same JEV values and remaining global weights. We removed four families and each of the 34 features individually. No new model calls or tuning were performed.

| Removed family | Top-1 | Change, percentage points | Hit@5 |
| --- | --- | --- | --- |
| entity | 14.94 % | -13.08 | 29.58 % |
| event | 21.98 % | -6.04 | 40.84 % |
| user_intent | 23.51 % | -4.51 | 38.41 % |
| state | 29.38 % | 1.36 | 48.05 % |

The ten individual features whose removal produced the largest decrease (or smallest increase) in Top-1:

| Removed feature | Top-1 | Change, percentage points |
| --- | --- | --- |
| is_about_topup | 24.38 % | -3.64 |
| charged_fee | 24.51 % | -3.51 |
| wants_activate | 25.49 % | -2.53 |
| is_about_transfer | 25.55 % | -2.47 |
| is_about_identity_verification | 25.84 % | -2.18 |
| card_not_received | 26.36 % | -1.66 |
| duplicate_transaction | 26.79 % | -1.23 |
| wants_change | 26.85 % | -1.17 |
| expired | 26.88 % | -1.14 |
| wrong_exchange_rate | 27.21 % | -0.81 |

All 38 ablations are in results.json, with paired query outcomes in e5-ablation-per-query.json. Correlations between features mean that a small ablation effect does not prove a feature is useless; another may carry similar information. This is descriptive analysis, not a subsequent schema-optimization loop.

## Concrete errors and correct results

The examples are the first eight errors and first three correct results in official test order for weighted relevance. They were not handpicked to support a conclusion.

| Query | Ground-truth intent | Top-document intent | Top document |
| --- | --- | --- | --- |
| How do I locate my card? | card_arrival | lost_or_stolen_card | I thought I left my card at a restaurant, but they claim not to have it and now I don't have any idea where it is. I'm so worried that someone might be using it fraudulently. Is there any way to look into this? |
| When will I get my card? | card_arrival | card_delivery_estimate | I ordered my card and it isn't here yet. I need it ASAP. When can I expect to get it? |
| Is it normal to have to wait over a week for my new card? | card_arrival | card_delivery_estimate | I ordered my card and it isn't here yet. I need it ASAP. When can I expect to get it? |
| still waiting on my new card | card_arrival | card_delivery_estimate | I ordered my card and it isn't here yet. I need it ASAP. When can I expect to get it? |
| How long should my new card take to arrive? | card_arrival | card_delivery_estimate | I ordered my card and it isn't here yet. I need it ASAP. When can I expect to get it? |
| Why won't my card show up on the app? | card_linking | activate_my_card | How long does it take to activate the card, as it does not look like its working? |
| I would like to reactivate my card. | card_linking | pin_blocked | I blocked my card by mistake, how do I unblock it? |
| Where do I link the new card? | card_linking | getting_virtual_card | I have lost my card, but need to place an online order! How do I get a virtual card instantly? |
| I still have not received my new card, I ordered over a week ago. | card_arrival | card_arrival | I was supposed to receive my new card by now, but it hasn't came in. |
| I ordered a card but it has not arrived. Help please! | card_arrival | card_arrival | 2 weeks ago I ordered my new card.  It isn't here.  What should I do? |
| Is there a way to know when my card will arrive? | card_arrival | card_arrival | I have been waiting over a week. Is the card still coming? |

### Why a particular result ranked first

**Incorrect result:** “How do I locate my card?” → “I thought I left my card at a restaurant, but they claim not to have it and now I don't have any idea where it is. I'm so worried that someone might be using it fraudulently. Is there any way to look into this?”. Ground truth: `card_arrival`; retrieved: `lost_or_stolen_card`.

| Feature | Query value | Document value | Global weight | Raw contribution |
| --- | --- | --- | --- | --- |
| card_not_received | 0.9100 | 0.9000 | 3.5903 | 2.9405 |
| security_concern | 0.4100 | 0.9700 | 2.6218 | 1.0427 |
| is_about_card | 0.9600 | 0.9900 | 0.8913 | 0.8471 |
| missing | 0.8700 | 0.9800 | 0.9635 | 0.8215 |
| wants_status | 0.8200 | 0.7000 | 1.2352 | 0.7090 |
| wants_information | 0.9600 | 0.8700 | 0.4241 | 0.3542 |

The full contribution sum is divided by 9.6414, giving a relevance score of 0.7517. See all 34 contributions for 20 examples in [explanations.json](explanations.json).

**Correct result:** “I still have not received my new card, I ordered over a week ago.” → “I was supposed to receive my new card by now, but it hasn't came in.”. Ground truth: `card_arrival`; retrieved: `card_arrival`.

| Feature | Query value | Document value | Global weight | Raw contribution |
| --- | --- | --- | --- | --- |
| card_not_received | 0.9800 | 0.9800 | 3.5903 | 3.4482 |
| wants_status | 0.9700 | 0.9500 | 1.2352 | 1.1382 |
| missing | 0.9800 | 0.9800 | 0.9635 | 0.9254 |
| is_about_card | 0.9900 | 0.9800 | 0.8913 | 0.8647 |
| pending | 0.9700 | 0.9500 | 0.8986 | 0.8281 |
| incorrect | 0.7800 | 0.8700 | 1.0179 | 0.6907 |

The full contribution sum is divided by 10.8892, giving a relevance score of 0.7533. See all 34 contributions for 20 examples in [explanations.json](explanations.json).


## Costs and runtime

The project dashboard showed USD 2.0765, 49,439,654 input tokens, 57,833,096 total tokens, and 13,232 requests with the “JEVbeddings” / “Last 7 days” filter. See the [screenshot](jevbeddings-usage-2026-09-26.png) and [cost note](../COSTS.md). The project total has not been reconciled call by call with the study logs. The table below retains the original log-based estimates.

| Part | Calls | Input tokens | Est. USD | Median ms | P95 ms | Failures / extra attempts |
| --- | --- | --- | --- | --- | --- | --- |
| train | 10003 | 36,678,663 | 1.5405 | 301.4 | 358.6 | 0 / 1 |
| test | 3080 | 11,290,130 | 0.4742 | 299.9 | 356.3 | 0 / 0 |
| broad_query | 100 | 1,283,211 | 0.0539 | 376.1 | 479.5 | 0 / 0 |

Estimates use USD 0.042 per million input tokens from [JEV's model reference](https://docs.typesafe.ai/models), checked on 2026-09-26. Output tokens have no charge in this estimate. Unobserved failed attempts may still have incurred charges; these figures are not an invoice. Evaluation code took 36.1 seconds locally. Vector-method latencies include a shared computation pass and cannot be interpreted as an isolated speed comparison.

## What we can and cannot conclude

The study measures what this fixed 34-dimensional schema can retrieve, compared with a conventional lexical baseline and alternative mathematical scores. It explicitly shows how each feature can be inspected, weighted, penalized, or used as a filter. The results document both information preserved and distinctions lost.

It does **not** establish that JEV features can generally replace modern embeddings. No external embedding model was run. We do not know whether JEV was previously exposed to BANKING77. The data are English-language and domain-specific; labels and proxy judgments may contain errors or ambiguity. Feature-level probability calibration has not been established either: BANKING77 intent labels are not human ground-truth scores for the 34 features.

The next independent validation should use new, private banking messages with human judgments of both features and retrieval results. A changed feature schema must be evaluated as a new study with a new holdout, not described as an improvement on the same untouched test set.

## Reproducibility and attribution

Verification checked all 13083 text fingerprints and saved JEV values. A separate full sort of the entire corpus for 31 fixed test queries produced exactly the same top ten and first-relevant rank in all 124 method checks. See [audit.json](audit.json). The 25 automated program tests also passed.

See the [protocol](../PROTOCOL.md), [implementation clarifications](../AMENDMENTS.md), [run instructions](../README.md), and [complete machine-readable results](results.json). Dataset commit: `57ec275d8078af65b7731c2a98be812d844a6d6b`. Schema SHA-256: `70781bf302e4d5b4521d38778de2910b352f547fccd8130d37600b299b70aa88`. File checksums are in results.json. The code, implementation of the study design, and report were produced by Codex together with the user; all runtime model assessments came from JEV.

BANKING77 was released by Iñigo Casanueva, Tadas Temčinas, Daniela Gerz, Matthew Henderson, and Ivan Vulić under CC-BY-4.0. Original labels are preserved. This is an independent exploratory study, not an official benchmark submission or a public preregistration.
