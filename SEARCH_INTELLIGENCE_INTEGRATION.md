# Search Intelligence → CuratorOS read-only integration

Search Intelligence already runs its own Watchtower snapshots daily and retains page/query performance intelligence. CuratorOS Search Visibility retains its separately authenticated daily sitewide GSC time series, recovery baseline and data-freshness logic.

This integration adds a **read-only authenticated bridge** at `/api/search-intelligence-bridge` to the existing `https://search-intelligence.oceanliners.net/api/watchtower`. It displays the latest snapshot date, retained snapshot count, reporting range and a small list of recent Watchtower observations within the Search Visibility dashboard.

Architecture rules:
- **No duplicate Google API requests** are added. The existing systems keep their own capture cadence.
- **Do not sum/compare Watchtower snapshot totals with the dashboard's daily figures.** Watchtower summarizes an approximately 28-day window of page/query data; the CuratorOS dashboard reports individual settled calendar days.
- Watchtower events are observations, not verified Google penalties or editorial mistakes.
- Do not copy events to the stewardship review queue until event classes and lifecycle semantics are mapped and tested.
- The bridge has a fixed allowlisted upstream hostname and requires `STEWARDSHIP_REVIEW_TOKEN`; browser code never receives an upstream secret.
- Upstream timeout or errors show a clear unavailable state and do not overwrite stored Google performance rows.

Verification: after merging, open `/search-visibility.html` with the review token; confirm existing Search Visibility metrics still display and Watchtower snapshot status appears. If blocked by Cloudflare protection, inspect the proxy response and configure a scoped machine-access rule instead of weakening sitewide security.

No secrets, editors, storage bindings or scheduled jobs are changed by this PR.
