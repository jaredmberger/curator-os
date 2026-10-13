# Stewardship Access trusted key provider (offline only)

The Access JWT verifier merged in #263 is now paired with an **unwired** factory, `createStewardshipOperatorAuthorizer`. This factory accepts only trusted, explicitly supplied issuer, application audience and operator email allowlist. It requests JWKS exclusively at the derived Cloudflare Access team URL, rejects redirects/invalid responses, bounds resource usage and returns false for any unverified assertion.

This file is **not an authentication boundary by itself** and is **not bound to the Pages runtime**. Until a reviewed runtime adapter is implemented and production Access policies are mapped, #262's endpoint remains disabled and no real user identity is being tested.

Before wiring: independently verify current Cloudflare Access application audience and team issuer; select/store operator identities privately; review genuine Access JWKS response and key rotation; verify cookie/token behavior and duplicate-header handling; then test staging operator, outsider, service token, forged/expired JWT, missing key server and rollback. Never take identity policy or JWK URLs from the caller.

This PR changes no production bindings, routes or public website content.
