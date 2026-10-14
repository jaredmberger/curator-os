# Verified upstream heartbeat mapping

Repository inspection of current Worker entrypoints:
- `jaredmberger/site-health` `src/entry-v2.1.js`: `GET /api/ops-health`, hourly scheduled heartbeat minute 27.
- `jaredmberger/curator-integrity` `src/index-v1.4.js`: `GET /api/ops-health`, hourly scheduled heartbeat minute 17.
- Both expose `status` (`healthy`, `stale`, `unknown`), `lastSuccessAt`, `maxAgeMinutes`, `checkedAt`, `stale` and `service`.
- Their heartbeat freshness windows are provided by the respective service (default 180 minutes). They **do not** expose scan finding counts or scan coverage in this endpoint.

`verified-heartbeat-adapters.mjs` validates and projects this already-observed schema into a narrow **heartbeat-only** internal view, stripping `heartbeat.message` and all raw diagnostics. It never fabricates findings or coverage: those values are `null` / `unknown`.

This PR is **offline only**. It adds no new HTTP routes, Worker bindings, Cloudflare secrets, service-to-service calls, dashboard elements, or feature switches. The existing Stewardship source contracts for eventual scan findings remain distinct from heartbeat availability.

For a subsequent, separately reviewed deployment PR: bind the authoritative workers using fixed Cloudflare service bindings; verify request isolation/Access operator auth on the serving endpoint, source health and response bounds; add separate per-source enablement flags, anonymous denial tests and rollback checks. Before relying on report content, inspect real live response shape from each source. Do not expose recovery exports or raw scan findings to the dashboard.
