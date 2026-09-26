# What the material documents

This overview was written after the original run on September 26, 2026. It distinguishes reproducible results from historical claims supported only by local records.

## The results can be recalculated

The reproduction package contains the original texts, saved model assessments, questions, ranking code, and results. A reader can recalculate the results without an API key or paying for new model calls.

| Claim or part of the study | Preserved evidence | What it can verify |
| --- | --- | --- |
| All of BANKING77 was used | `data/banking77/train.csv`, `test.csv`, `manifest.json`, pinned source commit | Texts, labels, 10,003 documents, 3,080 test queries, and source fingerprints |
| 34 features per message | `study/schema.js`, the `vectors` table in `study.sqlite` | All 444,822 feature values, their typed answers, and text fingerprints |
| Main results and uncertainty intervals | `study/math.js`, `evaluate.js`, `results.json`, `e1-predictions.jsonl` | All rankings, retrieval metrics, per-category results, duplicate checks, and bootstrap calculations |
| 100 supplemental queries in 25 groups | `queries.js`, `query-fixtures.json`, `e3-interpretations.json`, `e3-queries.json` | Query texts, requirements, model decisions, relevance groups, and all results |
| Eight control cases and 38 ablations | `results.json`, `e5-ablation-per-query.json`, the same code and saved vectors | The calculations and which results change |
| Explanations of individual results | `explanations.json`, `feature-weights.json` | Each feature contribution and the total score |
| Post-hoc analysis of frequently winning documents | `diagnose.js`, `diagnostics.json` | Win frequencies, norms, and counts of strong features |
| Recorded API usage | The `calls`, `vectors`, `query_results`, and `sessions` tables in `study.sqlite` | Locally recorded model name, token usage, call counts, attempts, latency, and timestamps |
| Frozen definitions and methods | `frozen.json`, `frozen-queries.json`, `frozen-code.json`, `PROTOCOL.md`, `AMENDMENTS.md` | Whether the current files match the saved fingerprints |

`study/results/reproduction-audit.json` documents a fresh, complete calculation from the database in a separate working directory. It compares all result fields with the originals except new generation timestamps and local evaluation latency. The original API timestamps, token counts, and API latencies are not excluded from the comparison. Seven derived result files are also compared byte for byte. The original results are not overwritten.

The check uses the original evaluation code. This demonstrates reproducibility but cannot rule out a systematic error in that same code. In addition, `audit.js` uses a separate full sort for 31 fixed test queries and compares the top ten and the rank of the first relevant result across all four methods. This check still shares some code, including the BM25 calculation. It is not external peer review.

## What was saved from the API

For documents, the parsed, typed JEV answers are preserved in `vectors.answers`, together with feature values and metadata. For supplemental queries, choices, probabilities, confidence, derived requirements, and the coverage value are preserved in `query_results`. The call inventory contains 13,183 logical calls and one additional attempt.

Request JSON can be reconstructed from the original text, schema, and saved source code. However, there is no separate original copy of every HTTP request and complete HTTP response. HTTP headers, any provider IDs, and the full response envelope beyond the fields retained by the adapter were not archived. Intermediate failed attempts are not preserved with a complete response for each attempt.

It would be incorrect to present reconstructed requests as network logs captured during the run. The current package does not do that.

## What local logs do not prove

The database is a detailed local record of the experiment. However, local files and timestamps can, in principle, be modified. Neither the database nor the JSON files contain signed receipts from TypeSafe that an external reader can authenticate.

The package therefore documents how the results follow from the saved JEV assessments. It does not independently prove that every answer came from the provider at the stated time. Similarly, the local freeze files support the described sequence, but they are not an externally attested preregistration or proof that the test material had never been seen before.

SHA-256 checksums detect content changes relative to a particular known checksum. If someone can change both the material and its checksum, the checksum alone is not proof of authenticity. Publication can provide an external reference for what was available from the publication date; it cannot retrospectively give the experiment an earlier, independent timestamp.

Usage figures in the original result files are reported API values stored locally. Their cost estimates are calculated from those values and a stated input price. The package now also includes a [screenshot of the provider's usage dashboard](results/jevbeddings-usage-2026-09-26.png), filtered to the Jevbeddings project: USD 2.0765, 49,439,654 input tokens, 57,833,096 total tokens, and 13,232 requests. The image was added after the first publication. It supports aggregate project usage, but it is not a signed receipt or provider invoice. The dashboard itself labels the cost “Estimated.” The project total has not been reconciled call by call with the study logs; see the [cost note](COSTS.md). Aggregate token counts do not prove the content of each individual answer.

## How a reader can verify the package

Clone this repository, or extract the ZIP into an empty directory. Run the commands from the directory containing `package.json`. Node.js 24 is required; this check needs no external npm packages, API key, or `.env` file.

```sh
node study/verify-evidence.js
node study/reproduce.js
node --test
```

The first command checks the files against the package inventory. The second recalculates all experimental results in `data/reproductions/replay-*`, checks them, and writes a new `study/results/reproduction-audit.json`. It passes no API key to subprocesses and stops if the evaluation code attempts to use `fetch`. This is not a general operating-system network sandbox; the checked evaluation scripts make no model calls.

Run the inventory check before recalculation. The new verification report receives a new timestamp and will therefore differ from the original file checksum. This is expected; retain the published ZIP as the original snapshot.

A new API extraction is a different kind of reproduction. It requires a key and may produce different model assessments. `study/run.js` reuses existing rows. A genuinely fresh extraction must therefore run in a separate copy without the old extraction database, rather than overwriting the experiment.

## What must accompany a GitHub repository

Code, a manuscript, and small result files alone are not enough. The GitHub edition therefore includes the public datasets, SQLite database, `e1-predictions.jsonl`, and `e5-ablation-per-query.json` as ordinary Git files. `.gitignore` excludes local working files and secrets while allowing these named research files.

The complete `study/results/banking77-reproduction.zip` is also tracked and contains the SQLite database, public datasets, and detailed result files. It can accompany the repository or be published as a separate downloadable research package with a clear link from the README. If hosted separately, the package must actually be published alongside the code; a local link is not sufficient.

The package contains `evidence-manifest.json` with SHA-256 hashes for the data, code, and results. The inventory was created after the study and is explicitly labeled with that limitation. `.gitattributes` preserves file bytes on Git checkout so automatic line-ending conversion does not invalidate the checksums.

The API key and `.env` must not be included. ZIP creation uses explicit data directories and excludes `.env`, reproduction working copies, SQLite sidecar files, and temporary lock files. The BANKING77 license and attribution are included. The project's own code does not yet have a selected open-source license; granting reuse rights is a separate decision.

The material is published in the [jevbeddings repository](https://github.com/oggabogg/jevbeddings). Publication does not change the status of the original logs or timestamps. The [publication note](../docs/PUBLICATION.md) describes the contents and pre-upload checks, including the subsequent English documentation edition. The original ZIP retains the Norwegian publication snapshot.

## A precise statement for the study

> I have preserved the data, feature assessments, method code, and per-query results. The results have been recalculated from the saved model assessments without new API calls. Call metadata and timestamps are local records, not independently signed confirmations from the provider.

This describes the strengths of the documentation without attributing evidentiary weight it does not have.
