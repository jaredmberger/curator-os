# Stewardship Review Queue (initial integration)

The existing CuratorOS Stewardship Dashboard links to **/stewardship-review.html**.
The queue uses Cloudflare KV binding `CURATOROS_RECORDS` under
`stewardship-review-queue-v1`, separately from canonical ship/research records.

## Required deployment configuration

Configure **two different Cloudflare Pages environment secrets** (do not commit values):

- `STEWARDSHIP_REVIEW_TOKEN`: operator access to GET findings and POST individual review decisions.
- `STEWARDSHIP_INGEST_TOKEN`: machine access to POST `action: ingest` snapshots.

Without these secrets the endpoint fails closed with 401. The ingestion secret must not be entered in the browser. These are bearer tokens, so Cloudflare Access or equivalent access restrictions and secret rotation remain recommended.

## Ingestion contract

`POST /api/stewardship-review` with `Authorization: Bearer <ingest token>`:

```json
{"action":"ingest","snapshot":{"auditHealth":"complete","findings":[
 {"id":"0123456789abcdef0123","type":"canonical:canonical-route-not-found",
  "scope":"ships/example.html","severity":"review","description":"Check canonical",
  "evidence":{"canonical":"/invalid"}}],"errors":[]}}
```

The upstream GitHub workflow still needs a separately configured secret and a POST delivery step. Until that is connected, the dashboard correctly shows no ingested findings. Do not claim it is fully populated by scheduled audits.

## Review contract

GET uses the review token. POST a review requires the current `version`, finding `id`, action `acknowledged|investigate|deferred|dismissed`, nonempty `reviewer` and nonempty `reason`. Mismatched versions receive 409 and require reload.

The dashboard never edits ship guides or publishes historical conclusions.
When a previous finding disappears, it is marked `not-observed` (not historically verified).
When a scan is incomplete it is `unverified`; earlier review decisions are preserved.

## Operational limits

Cloudflare KV is eventually consistent and does not support atomic compare-and-swap.
The version check mitigates stale forms but does not prevent truly simultaneous writes;
serial ingestion and reviewer writes, or migrate to Durable Objects/D1 before multiple concurrent editors use this queue.
Reviews currently store the latest decision, not an immutable event history.
Snapshot payloads should be size-limited by the upstream ingestion workflow as well.
No Error Bus incidents are created for ordinary editorial observations.
