# Search Visibility (native CuratorOS)

A read-only native chart and table live at `/search-visibility.html`.
Metrics are stored in existing `CURATOROS_RECORDS` KV binding under `search-visibility-v1`, not mixed with historical editorial findings.

Authentication: GET uses existing `STEWARDSHIP_REVIEW_TOKEN` (entered only in the browser). POST ingest uses a **new, separate production secret** `SEARCH_VISIBILITY_INGEST_TOKEN`, which must be configured on the Cloudflare Pages project. Do not use a token in browser JavaScript or commit credentials.

POST `https://curator-os.pages.dev/api/search-visibility` with the ingest token in `Authorization: Bearer ...`, JSON like:

```json
{"property":"sc-domain:oceanliners.net","source":"data-bloo-export","rows":[
{"date":"20260918","clicks":24,"impressions":2757,"average_position":8.6275}
]}
```

Permitted `source`: `data-bloo-export`, `google-search-console-api`, `verified-manual-import`. Accepted rows merge by reporting date and remain limited to the most recent 800 dates.

**Important:** Data Bloo is accessible to the assistant through a connected app, but its connector does **not** automatically grant GitHub Actions or Cloudflare Pages permission to query the service. This PR creates a secure storage and presentation endpoint, not an autonomous feed. It initially displays "No stored Search Console data" until the first authenticated import. Do not claim the chart is live or automatically refreshed.

We have verified the abrupt Search Console visibility break around September 24, 2026 separately. Keep search-performance and URL Inspection signals distinct: neither traffic trends nor average position alone prove an indexing error or manual action.

Consider direct Google Search Console API credentials or an explicitly supported Data Bloo export pipeline for scheduled ingestion. Restrict ingest privileges; monitor freshness and test the ability to reject wrong-property or invalid data.
