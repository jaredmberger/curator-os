# Stewardship operator runtime adapter — dormant

This is a **configuration-only bridge** between a future protected Pages Function and the isolated Cloudflare Access JWT verifier (#263) and key provider (#264). It has no route, binding deployment, UI, data access, scheduled job or production effect.

The factory `createOperatorAuthorizationFromBindings(env)` denies by default. It reads exactly three trusted deployment-owned bindings:
- `STEWARDSHIP_ACCESS_ISSUER`: the actual Access team issuer (`https://<team>.cloudflareaccess.com`)
- `STEWARDSHIP_ACCESS_AUDIENCE`: **the specific application's** verified Access AUD tag
- `STEWARDSHIP_OPERATOR_EMAIL`: approved operator email (private environment setting, not committed to GitHub)

Do not populate any of these from incoming HTTP headers, query strings or unverified JWT fields. Missing/malformed configuration produces a deny-only authorizer. The factory validates genuine signed JWTs using the trusted Cloudflare team's JWKS endpoint; it does not authenticate anonymous visitors or authorize service-token-only identities.

**Not ready to activate:** the runtime adapter is not installed in PR #262's endpoint; #262 is still disabled, and its `STEWARDSHIP_OPERATOR_AUTHZ` binding is *not* automatically supplied by this helper. A subsequent PR must explicitly wire a compatible factory into a staging-only route after confirming genuine issuer/AUD values, preview Access behavior, signature/key rotation, and operator policy. Test anonymous, authorized, other user, service token, forged/expired tokens, Access outage and feature-switch rollback in staging before any production change. No site content or SEO changes.
