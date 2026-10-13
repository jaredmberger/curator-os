# Stewardship operator verification — offline JWT primitive

This PR adds a **pure, currently unconnected verifier**. It does not enable or attach the protected endpoint from draft PR #262, change production settings, or obtain the real operator's email or Cloudflare team's keys.

`verifyStewardshipAccessJwt(jwt, policy, jwks)` validates an RS256 signature against **trusted** JWK material; checks a fixed Cloudflare Access issuer, application audience, token times, and an explicit human operator email allowlist. It rejects no-signature/other algorithms, unsigned email headers, service-token-like identities without email, key-discovery headers, unknown keys, and malformed or expired tokens.

Do not derive `policy` or `jwks` from incoming JWT claims, HTTP parameters, or unverified headers. A separate adapter must securely acquire the **actual application's audience**, **actual team domain**, **approved operator identity**, and Cloudflare Access keys from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, with controlled key rotation and failure-closed behavior. The request assertion is `Cf-Access-Jwt-Assertion`; it is untrusted until cryptographically verified.

## Release gates
1. Review this cryptographic primitive and passing tests in isolation.
2. Design a deployment-compatible authorization adapter and key retrieval/rotation under an independently reviewed PR; never treat `env.STEWARDSHIP_OPERATOR_AUTHZ` as automatically provisioned by Pages.
3. Stage and test verified operator, outsider, anonymous, service-token, expired/forged JWT and key rotation cases.
4. Only with explicit release approval, activate the bridge in a protected environment. Keep PR #262 draft and its feature switch OFF.

Reference: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
