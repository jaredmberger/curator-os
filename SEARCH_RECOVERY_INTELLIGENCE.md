# Native search recovery intelligence

The Search Visibility page now calculates pre-collapse (September 18–23), initial post-collapse (September 24–30), and rolling seven-day impression averages from stored **real** Google Search Console reporting rows. Full baseline windows are required to avoid partial averages. Recent-versus-previous comparisons require 14 consecutive reporting dates.

A significant 7-day gain candidate requires >=50% improvement and an absolute recent average >=100 impressions/day. Significant decline candidate requires >=30% decrease. These thresholds are operational heuristics, not indications of Google penalties, manual actions, indexing coverage, or proven recovery. Displayed progression toward the pre-drop impression level is a ratio, not a prediction.

Freshness flags when the most recent Google reporting date is more than six days old or stored ingestion occurred more than 48 hours earlier. Stale data suppresses trend milestone signals; it does not alter the underlying observations. Daily GSC ingestion already runs through the separate Sync Search Visibility workflow.

No historical corrections, source edits, or alerting are performed by this PR. Operators still review GSC data quality and any actionable findings. Pure calculation tests cover baseline, improvement, missing dates, and stale ingestion.

To test locally: `node tests/search-recovery-analysis.test.mjs`.
