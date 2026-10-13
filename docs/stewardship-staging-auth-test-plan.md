# Stewardship Mode — staging authorization verification plan

Date: 2026-10-13. This PR is **offline-only**. There is no deployed Stewardship route or known isolated staging authorization target to test. We must **not** claim effective access enforcement has been demonstrated.

## Prerequisites

1. Identify a nonproduction Cloudflare Pages preview/staging hostname and its effective Access application. Do not assume it inherits the production hostname's policies.
2. Confirm whether the Access application covers the exact proposed path, including path-specific bypass precedences. Review the current configuration immediately before testing because policies can change.
3. Verify if user roles and service tokens should both be admitted. A service-auth policy is not interchangeable with a verified human operator identity.
4. Create a non-sensitive, staging-only endpoint that emits an invariant sentinel, **not any Ops, Site Health, Integrity, research or KV data**. This deployment requires separate explicit approval.

## Staging test matrix (not yet executed)

| Request context | Expected result |
| --- | --- |
| No session/cookies/token | Access challenge or 401/403; never 200 sentinel |
| Expired/tampered user assertion | Denied without sentinel |
| Identity not in operator allowlist | Denied without sentinel |
| Authorized operator | 200 with staging-only sentinel |
| Service credential | Only if explicitly approved for this path; otherwise denied |
| Wrong path casing / trailing segments / percent-encoded route | Cannot bypass intended route protection |
| Existing device/status bypass | Remains functional and isolated; does not grant Stewardship access |
| Upstream auth unavailable | Fail closed, not public fallback |

Log only outcome classes and request context, never real session cookies, tokens or identifying claims.

## Current evidence and limits

- Cloudflare Access account inspection confirms a protected application for `curator.oceanliners.net`, plus separate device/status bypass applications; the reviewed bypass patterns are snapshotted in `tests/stewardship-access-boundary.test.mjs`.
- Those fixture tests check pattern overlap against a **static inspected list only**. They cannot validate Cloudflare Access effective matching, runtime authentication, policy order, future policy edits or URL normalization at the edge.
- Existing CuratorOS `/api/ops-health` GET-only bridge and offline Ops projection are not sufficient substitutes for operator authorization.
- No staging endpoint, authenticated probe, unauthenticated probe, Access policy change, new production route or live source connection is part of this PR.

## Production go/no-go

**NO-GO** until a staging route is explicitly authorized, deployed, and all denied/allowed outcomes verified against the deployed Cloudflare Access boundary. After that, independently review whether the Stewardship route requires an app-level identity check, and keep production rollout separately approved and reversible.

This work does not modify OceanLiners.net, canonical URLs, metadata, indexing, Cloudflare policies, monitoring schedules, production UI, or advertising.
