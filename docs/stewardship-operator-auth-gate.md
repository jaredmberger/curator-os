# Stewardship Mode — operator authorization gate

Date: 2026-10-13 · **Decision: do not publish live Stewardship reports yet.**

## Confirmed test milestone

PR #257 head commit `35f0cf7f155a41618577c5c9ea7cf9a01c772983` passed:
- Stewardship Offline Tests workflow run `38465929637`.
- Stable Keel workflow run `38465929447`.

These tests validate the offline projection but do not establish live-service authorization.

## Inspected access surfaces

- `functions/api/ops-health.js` provides a fixed-route read-only Cloudflare service-binding projection, no arbitrary URL/header forwarding, GET-only, bounded timeout, and `no-store`/`noindex` response headers.
- It does **not itself** check the identity or role of the requesting operator.
- Repository inspection did not locate `functions/_middleware.js`; absence of that file does **not** prove Cloudflare Access or another upstream protection is absent.
- `noindex` is not authentication. A same-origin path or service binding is not inherently private from an unauthenticated visitor.
- `tools/stewardship/ops-safe-projection.mjs` is data minimization, **not** an access-control mechanism.

## Required evidence before adding an endpoint

1. Verify deployed Cloudflare Access policy and app coverage for `curator.oceanliners.net` and the precise candidate route, including bypass/public paths; record whether unauthenticated requests are denied.
2. Identify and verify the trusted identity/role assertion reaching Pages Functions. Do not trust client-supplied email or JWT-looking strings without server-side verification or trusted edge enforcement.
3. Establish an explicit operator-only policy, including unauthorized 401/403 behavior, no redirects or credential leakage, and denial for malformed/expired assertions.
4. Confirm service-binding permissions, source response schema, staleness behavior and the projection's rejection of unrecognized upstream fields.
5. Test route-level authorization on a staging/preview environment before any production activation. Keep actual secrets and identifying operator details out of repository fixtures.
6. Require separate approval for production integration after RC stabilization; document a reversible kill switch, no state migrations, and no Error Bus duplication.

## Safe interim options

- Keep all adapters and safe projections offline under the dedicated Stewardship test workflow.
- Continue using the existing canonical Ops UI for operational details; don't create a parallel public dashboard.
- Prepare a fixture-only authorization decision matrix (authorized, unauthenticated, denied role, missing assertion, expired assertion, upstream outage) without implementing a production handler.

## Scope

This review is documentation-only. It does not change application code, Access settings, worker routes, hostnames, credentials, cloud bindings, KV, scheduled jobs, Google Ads, search indexing, or public content.
