# Stewardship Mode — Phase 3 source-contract verification (inventory only)

Date: 2026-10-13. This is a **read-only repository inspection**, not a live endpoint probe, adapter, deployment or completed integration. Phase 2's pure fixture normalizer remains disconnected from production.

## Evidence confirmed from authoritative repositories

| Authority | Confirmed interface | Verified data contract | Next gating question |
| --- | --- | --- | --- |
| Site Health | `docs/findings.schema.json` defines export `findings.json` schema version `1.0` | Root requires `schema`, `schemaVersion`, `generator`, `generatedAt`, `summary`, `findings`. Finding requires `id`, `type`, `severity`, `status`, `pageUrl`, `targetUrl`, `detectedAt`. Severity: `info|warning|broken`; status: `open|reviewing|resolved|ignored`. | Identify authenticated, supported operator-facing **read** route and verify actual export sample, lifecycle semantics and visibility. Do **not** use disaster-recovery export as a monitoring API. |
| Curator Ops | `README.md` documents GET `/api/briefing`, `/api/operational-state`, `/api/diagnostics` and other monitor endpoints. | Monitor state includes persistence/freshness and incident-root correlation conceptually; README does **not** establish a stable JSON field-level schema. Browser journey normally every 15m; stale after 45m. Operational collection every 5m. | Read actual handler shape, auth and per-monitor timestamps before adapting; prefer link-out instead of duplicating Ops incident grouping. |
| Curator Integrity | `README.md` documents categorized crawl findings, exceptions and CSV export. | Export columns, finding IDs, severities, timestamps and freshness are **not yet verified**. | Inspect exporter and read auth before designing adapter. Never infer a cleared issue from missing CSV rows. |
| Historical consistency & research connectivity | Existing Ocean-Liner-Curator read-only scan scripts (Phase 1 inventory). | Script report formats not yet mapped to Phase 2 fixture contract. | Validate the generated artifacts and stable identity rules separately. |

## Mapping candidates, NOT implemented

Site Health could map `id` to `source_finding_id`, `type` to `rule_id`, `detectedAt` to `observed_at`, and `pageUrl`/`targetUrl` to scoped evidence. `broken` severity could conservatively map to `error`, while `warning` and `info` retain their labels. `resolved` could map to `cleared` only after upstream lifecycle semantics are verified; `ignored` is **not necessarily resolved**, and `reviewing` is **not necessarily cleared**. Such states need explicit treatment rather than optimistic coercion.

The Site Health schema provides `generatedAt`, but Phase 2 requires source-specific `checked_at` and `max_age_ms`. Neither an appropriate maximum age nor a reliable "last successful scan" timestamp is verified solely by the schema. Never infer source availability from a parseable stale file.

**No direct API wiring should be merged until** each authority supplies a documented, authorized read route (or explicitly exported safe artifact), a real sampled response, freshness semantics, stable finding IDs, pagination/coverage guarantees, error behavior and security expectations.

## Acceptance for first adapter

1. Create fixture(s) matching an **actual observed schema**, stripped of credentials and private data.
2. Pure adapter maps all lifecycle statuses without hiding uncertain, ignored, reviewing, stale or unavailable states.
3. Provide source-specific tests for a clean complete scan, an incomplete/failed scan, duplicated IDs, out-of-order findings, and vanished findings.
4. No network import, fetch, KV, routing, Pages Function, GitHub Action, crawler, indexing change or writes.
5. If Ops already has a satisfactory view, link to its authoritative page instead of recreating it.

## Release guard

CuratorOS is in an RC stabilization period. This work is documentation-only: no application or public OceanLiners.net changes; no public SEO changes, no new scheduled jobs, no Error Bus mutations, no storage of full research records.
