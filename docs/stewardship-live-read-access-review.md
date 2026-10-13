# Stewardship Mode — read-only access review

Date: 2026-10-13. **Decision: no live integration yet.** This note is derived from repository code inspection, not live endpoint testing. The Stewardship Offline Tests workflow and Stable Keel both passed on PR #255 (runs 38465250892 and 38465248601).

## Verified existing bridge

CuratorOS `functions/api/ops-health.js` is a fixed-route, GET-only, read-only Cloudflare service-binding bridge using `env.CURATOR_OPS.fetch`. Its allowlist is intentionally limited to:
- `/api/public-site-journey`
- `/api/browser-search-journey`
- `/api/self-test`

It allows no arbitrary user-selected URL, header, cookie, or write method forwarding. Responses are reduced to availability, state, checkedAt, reason and stale, with a five-second per-check timeout, no-store and noindex response headers. This is a precedent, **not** authorization to extend it or expose new data.

Curator Ops `src/operational-state.js` documents `GET /api/operational-state` and its persisted snapshot with generatedAt, summary, sources and findings. It also has a POST check-now route that must not be proxied by Stewardship Mode. The operational-state payload includes raw source data and evidence; direct browser exposure or blind JSON pass-through would unnecessarily broaden access.

Curator Integrity `src/index-v1.2.js` implements `GET /api/integrity-snapshot`. Its snapshot is partial, with `problemPages` capped at 25. Site Health's findings.json v1 export schema exists, but authenticated/current access and a complete successful scan contract still require verification. Disaster recovery exports must **never** be repurposed as a monitoring API.

## Explicit production access gates

1. Verify operator authentication/authorization in CuratorOS and the target service, plus whether the current same-origin bridge is exposed to unauthenticated browsers. A noindex header is **not** an access control.
2. Verify any new upstream reads are strictly allowlisted GETs over existing service bindings, with timeout, no redirect following, no raw credentials/user headers, and no write capabilities.
3. Specify a narrow server-side projection that avoids raw `sources[].data`, full `findings[].evidence`, private errors, tokens, KV keys or researcher notes. Never pass the entire Ops snapshot directly to the client.
4. Require source-specific max age, a real last-success marker, and explicit unknown/unavailable/partial status. Ops freshness states must remain authoritative; never invent a fresh value because the bridge request succeeded.
5. Confirm stable IDs and resolution semantics with real sanitized fixtures and tests. A missing row is not a resolved incident; an incremental or capped result is not complete.
6. Add denied-method, upstream-auth-error, non-JSON, redirect, timeout, stale, partial and sensitive-payload-redaction tests before wiring any Pages Function.
7. Avoid a new scheduler, error escalation, persistent database, or duplicate incident grouping. Link to Ops for authoritative investigation.
8. Keep live UI/API behind an explicit release gate after RC feature freeze, with reversible deployment and no public OceanLiners.net changes.

## Recommended sequence

- **Next:** Validate the existing Ops bridge's actual access boundary and decide whether a separate operator-only projection is even appropriate.
- **Then:** Design and test a pure `projectSafeOperationalState` function using sanitized fixtures. This function should discard unspecified fields by construction, without making any fetch.
- **Only after security review:** consider wiring an allowlisted GET-only binding from a private operator surface; keep all source adapters offline otherwise.

No production API, UI, schedule, ad, sitemap, canonical, redirect, public page or ship guide changes are authorized by this review.
