# Stewardship Mode — Cloudflare Access account audit

Date: 2026-10-13 · Read-only inspection of the connected Cloudflare Access application configuration. **No Cloudflare mutations performed.**

## Verified account configuration

Cloudflare Access lists an application for `curator.oceanliners.net` (account-level Access app ID `8153a0ec-5fac-47e1-b275-8d19d322450b`) with:
- identity-based **allow** policy (precedence 1),
- **Service Auth** non-identity policy (precedence 2),
- a further non-identity service policy (precedence 3).

Separate, more narrowly scoped applications on the same hostname have **bypass** policies for:
- `/api/device/v1/status` and `/api/runtime`;
- `/api/harware-errors-recheck`, `/api/random-ship`, `/api/ship-image*`, and `/api/on-this-day*`;
- `/api/project-records`, `/api/link-map`, `/health`, and `/api/hardware-status`.

These specific paths were read from Access application configuration. They are not a comprehensive proof of effective access for every request, and a bypass is an intentional exception, not operator authentication.

## Implication for Stewardship Mode

A prospective `/api/stewardship-*` route is **not among the reviewed bypass paths**. This is promising, but there is no newly deployed Stewardship route to verify, and its actual Access behavior has not been tested. The presence of an Allow policy or service-auth policy is not itself proof that the route is operator-only.

`functions/api/ops-health.js` has a narrow read-only service bridge, but its handler does not perform a separate per-user authorization check. The offline `ops-safe-projection.mjs` removes unwanted data fields but is not a security boundary.

## Mandatory next gate

1. Confirm the effective Access application match for the exact intended route, including wildcard precedence and any account- or zone-level exceptions.
2. Test unauthenticated access without cookies, authenticated operator access, non-operator access, and service-token behavior in a nonproduction environment. Record expected 401/403 or Access login challenge while ensuring no underlying data is returned.
3. Decide whether the Stewardship route must require a verified *human operator* session rather than an otherwise valid service token; if so, implement an additional verified identity/role assertion in the Pages Function.
4. Prevent broad matching of a future sensitive route by bypass patterns. Do not modify current device/status exceptions as collateral work.
5. Continue keeping Site Health / Integrity reporting partial where applicable and prevent raw upstream Ops evidence or KV records from reaching the browser.
6. Separate authorization of future production activation from this read-only audit. Add a reversible disable gate and deny-by-default tests.

## Current disposition

**No live Stewardship integration authorized.** Continue with offline tests and a staging-only request/response authorization test plan. No user-visible site pages, canonicals, redirects, sitemaps, monitoring cron jobs, Cloudflare policies, or ads have been modified.
