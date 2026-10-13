# Stewardship Ops gated read: activation contract

**Default state: disabled.** This is a code-only preparatory change for review, not a production rollout. The endpoint `GET /api/stewardship-ops` requires two independent controls: `STEWARDSHIP_OPS_READ_ENABLED === 'true'` AND an operator authorization binding `STEWARDSHIP_OPERATOR_AUTHZ.authorize(request)` returning literal `true`. No production authorizer is supplied by this PR, and plain identity headers are never trusted.

Security review must first define and implement a real platform-compatible authorizer that verifies signed Access identity and approved operator role, rejecting service-token-only identities unless explicitly approved. An arbitrary Pages environment object or caller-supplied header must never be taken as authorization. Only then can someone separately approve enabling the switch.

The route subsequently uses existing `CURATOR_OPS` service binding with a fixed GET endpoint, redirect blocking, 5-second timeout, 20-minute freshness window, and strict `projectSafeOperationalState` allowlist. Errors return only generic unavailable reasons; no raw upstream data appears.

**Required before enablement:** verify exact production path is not matched by bypass, build real fail-closed verified authorization, test unauthenticated/operator/non-operator/service-token scenarios in staging, confirm secure service bindings and rollback. No new scheduler, KV changes, public site edits, or SEO change. Do not merge solely because CI is green if your release policy does not permit a disabled dormant production route.

## Post-staging authorization integration
The dormant route now directly constructs the verified Access operator guard through `createOperatorAuthorizationFromBindings(env)`. The earlier placeholder `STEWARDSHIP_OPERATOR_AUTHZ` binding is no longer used. This removes any implication that an arbitrary environment object is a trusted authorizer. The route still requires literal `STEWARDSHIP_OPS_READ_ENABLED=true` and valid deployment-owned Access issuer, audience and operator email. Without them, no Curator Ops request occurs.

**Deployment gate remains:** #266's staging authentication sentinel is closed without merge; this route has not yet been exercised against actual sanitized Ops data. No production switch, service binding, preview secret or Access policy has been changed. The first real-data test must use a separate staging-only path and fixed, allowlisted upstream endpoint, including denial and rollback checks.
