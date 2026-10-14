# Stewardship Ops — production release gate

## Status
The proposed `GET /api/stewardship-ops` route is **disabled by default**. A merge would deploy dormant route code, not activate live status access. Production enablement is a separate, explicit decision.

## Controls implemented
- Strict `STEWARDSHIP_OPS_READ_ENABLED === 'true'` gate, checked before authorization and before any Ops fetch
- Signed Cloudflare Access JWT verification using a trusted Access issuer and audience, with an explicit operator email allowlist
- Deployment-owned configuration: `STEWARDSHIP_ACCESS_ISSUER`, `STEWARDSHIP_ACCESS_AUDIENCE`, `STEWARDSHIP_OPERATOR_EMAIL`
- Fixed GET-only `CURATOR_OPS` service-binding request to `/api/operational-state`, redirect blocking, bounded timeout and source freshness checks
- Strict allowlist projection; no raw messages, evidence, secret tokens or upstream diagnostics in the response
- Generic failed-closed responses, no caching, no indexing

## Staging evidence and limitations
Staging experiment #267 demonstrated an authorized live read returning a sanitized report, anonymous denial, and successful switch-off rollback. #267 was closed **without merging**. Earlier operator verification #266 was also closed without merging. The production host/application Access configuration is distinct from Pages preview protection; its exact route and Access application audience must be verified independently.

## Before production enablement
1. Ensure this PR's Cloudflare Pages deployment compiles, especially the three imported Access helper modules. Offline CI alone is insufficient.
2. Verify `curator.oceanliners.net/api/stewardship-ops` is covered by the identity-protected Access application, with no overlapping bypass (including wildcard/precedence review).
3. Keep the production feature switch absent while merging any approved code. Confirm an authorized request returns `404 disabled`.
4. Separately configure production issuer, **production application's** audience (not Pages preview AUD), and private authorized operator email. Ensure the upstream service binding is still `CURATOR_OPS -> ops (production)`.
5. Test authenticated operator, anonymous, disallowed identity/service token, upstream errors and freshness; keep source data sanitized. Explicitly approve switch-on only after verification.
6. Roll back by setting `STEWARDSHIP_OPS_READ_ENABLED` to `false` or removing it, redeploy, then verify `404 disabled`. Disable immediately on access-control or projection anomalies.

No data writes, scheduler, KV mutation, OceanLiners.net changes, or SEO changes belong to this release.
