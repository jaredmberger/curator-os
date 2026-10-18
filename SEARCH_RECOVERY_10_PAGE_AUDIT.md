# September search-recovery representative indexing audit

On-demand ten-URL batch using the existing authenticated Cloudflare Service binding to Search Intelligence's Google URL Inspection API. Uses the existing review token. Requires an explicit browser confirmation and **consumes ten URL Inspection requests**.

The selected pages are chosen from a GSC comparison of September 10–23 versus September 27–October 12, 2026, spanning high-impression losses, key hubs, guide pages and a partially visible comparison page. Those date ranges have different lengths; traffic metrics are **not** indexing verdicts.

The browser renders ten returned results and offers copying the complete JSON, including Google verdicts, coverage, canonical, crawl timestamps, error reports, and diagnostic classifications. Paste the JSON into the research conversation for interpretation.

This implementation does not persist evidence, automatically schedule inspections, alter any ship guide, request indexing, change the original stewardship case queue, or infer that a Google ranking decline is an indexing failure.

Interpretation standard: Failed inspections remain unverified; reported canonical differences can be intended. A clean subset does not rule out widespread crawl/indexing issues or ranking-system changes. Document inspected-at separately from Google last-crawl time.
