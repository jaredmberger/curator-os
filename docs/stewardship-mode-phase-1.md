# CuratorOS Stewardship Mode — Phase 1 inventory and contract

Status: **proposal, documentation only** · 2026-10-13

## Purpose

Provide a single evidence-first **read-only** view of institutional and operational health without changing OceanLiners.net, canonical Ship Records, research state, Cloudflare settings, or advertising. This is not a new crawler, a new system of record, or a claim that monitoring has proved historical accuracy.

CuratorOS is in the v1.0.0-rc.1 feature-freeze period. This file defines an interface and incremental implementation plan; it enables no feature, scheduled work, or network call.

## Existing authorities (avoid duplication)

| Domain | Existing authority | Evidence to consume in a later phase |
| --- | --- | --- |
| Operational health, monitoring freshness, deployment integrity | `jaredmberger/ops` | Operational state, briefing, diagnostics; monitor freshness and incident correlation |
| Link reachability, redirects, crawl issues | `jaredmberger/site-health` | Versioned findings export and scan timestamp |
| Metadata, structure, accessibility, editorial standards | `jaredmberger/curator-integrity` | Rule findings, exceptions, timestamp, scope |
| Ship-guide key-fact heuristics | `Ocean-Liner-Curator/scripts/historical-consistency-monitor.py` | Read-only report, eligible field count, scan version |
| Research contextual links | `Ocean-Liner-Curator/tools/search/research-connectivity-audit.mjs` | Audit metrics and editorial candidate worklist, not authoritative link recommendations |
| Institutional research history and canonical facts | `jaredmberger/curator-os` | Existing Project Records, evidence/conflicts, research history and human review workflow |

Integration is a **future proposal** where a verified read contract is absent. A repo's existence does not establish that its API is currently available, authenticated, or compatible.

## Candidate normalized finding contract (future work)

A record should include:
- `source_system`, `source_finding_id`, `schema_version`, `rule_id`
- `observed_at`, `collected_at`, `scan_id`, `source_url_or_path`
- `scope` and `subject` (URL, asset, service, ship record, or tool)
- `severity` (info, notice, warning, error), `confidence` (confirmed, heuristic, unknown)
- `state` (active, cleared, stale, unavailable) with explicit reason
- `evidence` and `source_detail_url`, when safe to expose to the operator
- `recommended_review`, **never** an automatically executable editorial mutation.

Stable identity: `source_system + source_finding_id`. Where the upstream system lacks a stable ID, define and test a deterministic per-source composite key before importing. Deduplicate repeated snapshots, retain the source timestamp, and never infer resolution from an absent or failed scan.

## Safeguards

1. **No writes:** no mutation of live site, GitHub content, canonical records, Cloudflare settings, ads, or indexing configuration.
2. **Staleness first:** distinguish `healthy` from `stale`, `unavailable`, and `not_checked`. Report age and last verified success.
3. **Uncertainty preserved:** a heuristic historical conflict is a review candidate, not an established factual error. A clean scan is not a proof of historical truth.
4. **Ownership:** the source tool retains responsibility for its findings and resolution criteria. Do not generate duplicate Error Bus incidents.
5. **Security:** use existing authenticated internal surfaces; do not expose operational tokens, private URLs, export secrets, raw KV records, or researcher notes publicly.
6. **No SEO variability:** do not alter redirects, canonical tags, robots, sitemaps, navigation, ship guides, titles, or metadata during the recovery observation window.
7. **Opt-in rollout:** ship a local fixture-based aggregator first. No production scheduler or dashboard until an explicit review.
8. **Historical baseline:** correlate operational observations with changes in search performance, but never claim causation from timing alone.

## Phased delivery

### Phase 1 — this PR
- Inventory existing authorities and propose normalized finding fields.
- Document non-goals and safeguards.
- No runtime, dependency, workflow, Pages Function, routing, or UI changes.

### Phase 2 — fixture-only validation
- Build a deterministic local parser/normalizer against **sanitized** sample payloads from individual tools.
- Unit-test stale, missing, failed, cleared, duplicated and contradictory findings.
- Verify that no upstream connector calls, writes, or secrets are required for test execution.

### Phase 3 — read-only adapters after contract verification
- Verify schema, authentication, pagination, freshness, rate limits, and source ownership individually.
- Respect existing storage and recovery boundaries; do not copy full research records into an unnecessary cache.
- Fail visibly as unavailable rather than reporting an invented green status.

### Phase 4 — review surface (after release freeze)
- Show source, evidence, last successful check, severity, and human-review disposition.
- Link to the authoritative tool and existing research-review workflow rather than creating shadow records.
- Preserve a manual disable/rollback path.

## Acceptance and stopping rule

- The feature is an observer, not a corrective agent.
- A missing or stale upstream source cannot appear healthy.
- At least one test each for: stale source, unavailable source, duplicate finding, resolved upstream finding, heuristic historical claim, and partial source coverage.
- No production write endpoint, schedule, new public route, or public website changes.
- Stop expanding scope if the proposed aggregator duplicates an existing authoritative Ops feature; link to that feature instead.

## Known investigations before implementation

- Determine whether Ops `/api/briefing`, `/api/operational-state`, and `/api/diagnostics` already satisfy the operational portion.
- Verify the current Site Health findings schema and export access policy.
- Verify Curator Integrity's export schema and exception handling.
- Confirm how archival scan results can be accessed without exposing private research state.
- Define a shared source freshness matrix using each monitor's actual cadence; do not assume one universal freshness threshold.
