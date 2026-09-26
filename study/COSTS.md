# Costs: the provider dashboard and the study logs

After the first publication, I added a screenshot of JEV's usage dashboard to document the project's total usage. The image was supplied on September 26, 2026, and is preserved without editing in [jevbeddings-usage-2026-09-26.png](results/jevbeddings-usage-2026-09-26.png). A machine-readable transcription is available in [provider-usage.json](results/provider-usage.json).

The selected project filter is “JEVbeddings,” the period is “Last 7 days,” and the charts use hourly aggregation. I do not have an export with exact period boundaries or the provider's time zone.

| Measure | Dashboard value |
| --- | ---: |
| Cost (USD) | 2.0765 |
| Input tokens | 49,439,654 |
| Total tokens | 57,833,096 |
| Requests | 13,232 |

The dashboard footnote says “Estimated at $0.042/MTok input · Free output.” The amount is therefore described as **the cost shown in the JEV dashboard**, not an amount paid or invoiced. Multiplying the displayed input usage by this rate gives USD 2.076465468, which rounds to the dashboard's USD 2.0765.

## Relationship to the study's own logs

The saved study calls contain 49,252,004 input tokens, 8,361,371 output tokens, and 13,183 completed logical calls. One call required an additional attempt. The estimated cost of the recorded input usage was USD 2.068584168, rounded to USD 2.0686.

The dashboard shows 187,650 more input tokens and 48 more requests than the study's 13,184 recorded attempts. Subtracting input from total tokens gives 8,393,442 other tokens in the dashboard, 32,071 more than the logs' output tokens. This last figure is calculated from the dashboard totals, not a separately displayed output-usage figure.

The project dashboard covers more usage than the saved study calls. I have not reconciled it call by call, so I do not know which requests explain the difference. I am not changing the original logs, results, or evaluation calculations to make them match the dashboard.

The screenshot and transcription are included in the package's SHA-256 inventory. This detects subsequent file changes; it does not independently authenticate the screenshot's origin.
