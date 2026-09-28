# CuratorOS Security Boundaries

This document records the intended trust boundary for operator-facing and machine-facing CuratorOS services.

## Principles

- Public read-only health/status surfaces may remain unauthenticated when they expose only bounded operational state.
- Any endpoint that mutates durable state or triggers privileged external actions must fail closed when its credential is absent.
- Recovery exports must fail closed and require their dedicated recovery credential.
- Operator history and retained evidence are private operational data, not public status surfaces.
- Browser `Origin` checks are CORS/request-origin controls, not authentication.
- Browser-facing operator tools should use Cloudflare Access rather than embedding shared secrets in JavaScript or URLs.
- Secret values never belong in GitHub. The recovery manifest inventories secret names and separately records non-secret deployment variables such as credential identifiers.

## Machine-write boundaries

### Research Capture

`POST /api/capture` requires `CAPTURE_TOKEN` through `X-Curator-Capture-Key`.

The route must return 503 when `CAPTURE_TOKEN` is not configured.

`GET /api/recent` is also private and uses the same header.

### Curator Verify

`POST /api/verify` and `GET /api/recent` require `VERIFY_WRITE_KEY` through `x-curator-verify-key`.

Public `GET /api/status` remains a bounded read-only health surface.

### Curator Ops

Hardware heartbeats and security-event writes require `OPS_WRITE_KEY` through `x-curator-ops-key`.

### Error Bus

Network write/reporting paths use `ERROR_REPORT_KEY`; independent verification calls use `VERIFY_WRITE_KEY`.

### Page Studio

Publishing uses the server-side `GITHUB_TOKEN`, repository allow-listing, payload validation, and origin restrictions.

The production publishing Worker must additionally be protected by Cloudflare Access. `Origin` validation alone is not an authentication boundary.

## Browser/operator boundaries

The following human-facing surfaces should be protected by Cloudflare Access at deployment:

- Research Capture inbox (`/` and `/recent`)
- Page Studio publishing Worker hostname

Do not put operator secrets in query strings, frontend configuration, browser storage, or committed source.

## Recovery inventory

`recovery/infrastructure.json` is the canonical machine-readable inventory of secret names and service bindings required to reconstruct the environment.

A recovery procedure must recreate the listed secrets and Access policies before privileged write paths are considered production-ready.
