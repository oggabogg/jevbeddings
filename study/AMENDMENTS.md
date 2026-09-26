# Implementation clarifications recorded before test extraction

2026-09-26, while only training vectors were being extracted:

1. Numeric tie handling uses an absolute tolerance of `1e-12` before stable original-row ordering. This prevents subtraction roundoff in ablations from manufacturing a rank difference between mathematically tied values. Stored JEV probabilities and published scores are not rounded. This clarifies the protocol's exact-tie rule; it is not a hyperparameter selected on evaluation results.
2. E3 no-requirements interpretations return no results, matching the application, and are included in the unresolved/review count. Unsupported or uncertain queries also return no strict results, as specified.
3. E4 reports both unwanted exposure divided by 10 and the unwanted fraction among actually returned results. Empty lists have an undefined returned fraction rather than suggesting that zero results prove semantic success.
4. The user explicitly authorized sufficient data collection without reducing scope for costs. The running request budget is expected to be about USD 2, below the initial USD 5 guard. That guard does not limit this full run. If it is reached, it may be increased under this authorization; scientific settings stay frozen.

The original protocol, schema, supplemental queries, and interpreter hashes remain unchanged. No test text, test label outcome, or test retrieval score was examined to make these clarifications.
