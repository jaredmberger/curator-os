# Staging-only Curator Ops live-read validation

**DO NOT MERGE this experiment to main.** This branch is based on draft #262, and carries a restricted test suite for the read-only `GET /api/stewardship-ops` handler. The endpoint is disabled unless the **Preview** environment explicitly has `STEWARDSHIP_OPS_READ_ENABLED=true`.

## Deployment preflight verified on 2026-10-13
- The CuratorOS **production** Pages configuration has a `CURATOR_OPS` service binding to Worker `ops` in environment `production`.
- The CuratorOS **preview** Pages configuration currently has **no `CURATOR_OPS` service binding**.
- Preview already has the three Access identity bindings from the previous successful authentication experiment. Their secret values must remain private and must not be committed.
- Never assume that a green Pages deployment validates a live source read.

## Order of acceptance
1. Run offline route tests and Stable Keel. Verify anonymous preview access is protected, as in the previous sentinel.
2. With the read switch absent/off, route must return `404 disabled` to an authenticated operator.
3. If explicitly approved, configure the required `CURATOR_OPS` service binding in Preview. **This is a shared Preview environment setting and can affect other preview deployments; do not add it implicitly.** Scope and assess the consequences before applying.
4. With the Preview switch enabled only after binding review, verify authorized operator gets a fresh `available:true` JSON report containing only the allowed identifiers, state, counts, freshness and correlation roles. If service is unavailable, expect generic `503`; never infer Ops is healthy from that.
5. Confirm an unauthorized/anonymous request cannot read the state and verify the switch can be turned off again to get `404 disabled`.
6. Close this staging PR without merging. Return to #262 for separate production release evaluation.

No real Ops data is committed, stored in CI artifacts, logged, or included in tests. The repository and public OceanLiners.net archive remain unchanged by the experiment.
