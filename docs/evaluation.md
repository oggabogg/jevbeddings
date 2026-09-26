# Initial live evaluation — 2026-09-26

Runtime: Node 24.19.0. Model: `jev-1.13.0`. Schema: 18 support/email features, v1. Query interpreter: `intent-v2-confidence-gate`.

Actual JEV calls evaluated 30 synthetic support messages and eight natural-language queries. Values were persisted in SQLite. No other model or semantic retrieval service was used. The live smoke check returned `duplicate_charge = 0.97` for the explicit duplicate-charge example.

## Retrieval

| Variant | Precision@5 | Recall@5 | MRR | nDCG@5 |
| --- | ---: | ---: | ---: | ---: |
| Unweighted | 0.500 | 0.722 | 0.875 | 0.862 |
| Weighted | 0.525 | 0.753 | 0.875 | 0.867 |
| Filters + weighted | 0.525 | 0.753 | 0.875 | 0.867 |

One query required review because JEV proposed uncertain extra hard constraints. It is counted as zero retrieval in these aggregates. The other seven queries placed a judged relevant document first. Several queries have fewer than five relevant documents, which limits their attainable Precision@5. This tiny fixture set does not show an aggregate gain from hard filters over weighted ranking.

Before the confidence gate, JEV interpreted “praise from customers without messages needing a reply” as excluding urgency and complaints as well as replies, and requiring praise as a hard constraint. Those extra filter decisions had confidence below 0.8. The gate now holds uncertain constraints for inspection instead of silently filtering the collection. It also exposes the original decisions; it does not pretend to repair their semantics. The same query missed the requested customer weight, illustrating that ordinary preferences can also be misinterpreted.

## Feature diagnostics

The full report includes all 18 features and reliability buckets. At the provisional 0.5 decision threshold, weaker features on this set included:

| Feature | Accuracy | Precision | Recall |
| --- | ---: | ---: | ---: |
| Bug report | 0.800 | 0.400 | 1.000 |
| Complaint | 0.867 | 0.556 | 1.000 |
| Account access | 0.933 | 0.600 | 1.000 |
| Time-sensitive | 0.933 | 0.800 | 1.000 |

These false positives warrant reviewing definitions and collecting independent labels. No post-hoc mapping or feature weighting has been tuned against this small evaluation set. High scores on the remaining features are not evidence that they are well calibrated in production.

## Latency and estimated cost

- Initial indexing: 30 JEV calls, 61,798 input tokens, approximately 8.61 seconds summed call latency, estimated **$0.00260**.
- First eight-query run: 56,091 input tokens, approximately 2.58 seconds summed call latency, estimated **$0.00236**.
- Queries were rerun after adding the confidence gate; document features were reused. Cumulative accounting in the report includes both query runs.
- Local weighted scoring took approximately 0.08 ms per query for this 30-document set; this excludes JEV query interpretation and HTTP/UI overhead.

Estimates use a configured rate of $0.042 per million input tokens from the [official model reference](https://docs.typesafe.ai/models), checked 2026-09-26. They exclude any provider charges for responses that were not observed and are not billing records.

## Limits of this evidence

The dataset is authored and synthetic, the judgments are provisional, and it is much too small for broad quality or probability-calibration claims. The implementation is tested for 1000-document ranking, but the recorded live benchmark contains 30 documents. The next meaningful evaluation is an independently human-labeled set of real support messages and search queries, with separate development and held-out splits.

The JSON artifact is `reports/benchmark-live.json`; it includes schema definitions, query decisions, scores, per-feature diagnostics, and call accounting. The offline report is explicitly labeled as a mathematical fixture check and must not be presented as JEV quality evidence.
