# Staging-only Stewardship operator verification

**EXPERIMENT. DO NOT MERGE INTO MAIN.** This branch deploys a preview-only route at `/api/stewardship-auth-test`. It never accesses Ops, data stores, or sensitive data, and only returns a constant sentinel to a cryptographically verified approved operator.

Default state is HTTP 404: `STAGING_STEWARDSHIP_AUTH_TEST_ENABLED` must equal literal `true` in the **preview** environment, plus all three deployment-owned settings from #265: `STEWARDSHIP_ACCESS_ISSUER`, `STEWARDSHIP_ACCESS_AUDIENCE`, `STEWARDSHIP_OPERATOR_EMAIL`. Configure these only through authorized Cloudflare preview settings, not in Git. The issuer must be the real Cloudflare Access team's issuer, audience must be the *preview's* Access application AUD, and email must be an approved operator; do not guess these.

## Acceptance checks
1. Before enabling, GET returns disabled (may be intercepted by outer Access).
2. Enable *preview only* after a security review; with authenticated approved operator the result is `200` and `kind=stewardship-auth-test`.
3. Anonymous request to the Pages preview returns Access challenge or denial, **not** a sentinel.
4. Logged-in but unauthorized identity, invalid/expired JWT, missing/wrong audience, missing keys, or certificate outage deny.
5. Turn switch off, verify 404, restore only when authorized.

Note: Cloudflare Access preview-host protection is an *outer* boundary, while the cryptographic assertion verification here is the *inner* boundary. Passing offline tests alone does not establish live authentication correctness. Do not merge this experiment, and do not enable draft #262 or attach operational data as part of these tests.
