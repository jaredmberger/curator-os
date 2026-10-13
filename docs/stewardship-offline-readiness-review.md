# Stewardship Mode — Offline readiness decision

Date: 2026-10-13 · Decision: **not yet approved for live integration**

## Verified
- Offline adapters exist for Site Health v1 findings export, Curator Integrity's bounded incremental snapshot, and Curator Ops operational-state snapshot.
- The normalized report now carries bounded source coverage, distinguishing complete, partial and unknown.
- Stable Keel succeeded on the PR #254 head commit (workflow run 38464773357).
- Inspection of package.json showed the default `npm test` / `npm run check` do **not** invoke `tests/stewardship-*.test.mjs`. Stable Keel alone did not establish this suite passed.

## This PR's validation improvement
- Dedicated, opt-in GitHub Actions workflow for offline Stewardship fixture tests on changes under `tools/stewardship/**`, matching test files, or its workflow.
- Manually dispatchable. Does not alter build, production application, deployment, KV, cron or public website.
- Gate: the dedicated workflow must actually pass before regarding the adapter suite validated; keep future adapter edits within its path filters.

## Blockers to live, read-only integration
1. **Read authorization:** identify and verify a supported operator read path and authentication boundary for each upstream source; do not use disaster-recovery exports as monitoring endpoints.
2. **Source completeness:** Site Health `generatedAt` must not imply a complete or successful scan without verified scan semantics. Curator Integrity `problemPages` remains capped at 25 and its full finding set is unavailable on this endpoint.
3. **Freshness:** do not derive all sources' freshness thresholds from arbitrary examples. Document ownership, expected cadence, last successful check and failed/partial scan semantics for each upstream.
4. **State and identity:** preserve upstream lifecycle states; do not infer issue resolution from an absent row. Validate IDs are stable across scans (especially page-level summary IDs).
5. **Privacy:** ensure no credentials, KV keys, private research notes, or raw error payloads are exposed in browser-readable data; sanitized evidence must be tested with adversarial fixtures.
6. **Security review:** prevent client-side direct access to private monitoring systems; determine whether existing same-origin ops-health binding can be reused without broadening public API exposure.
7. **Governance:** CuratorOS remains in an RC freeze; require explicit approval of any read-only production UI/API after readiness, separate from test-only merges.
8. **Rollback:** feature flag or clean removal with no persistence migration, no auto corrections and no duplicate Error Bus incidents.

## Next step after the dedicated tests pass
Inspect supported read authorization and response semantics source by source. Prefer narrow existing operator surfaces; if no safe contract exists, keep the source marked unavailable rather than inventing a green signal.

**Not in scope:** public ship pages, metadata, robots, canonical links, redirects, sitemap, search index, Google Ads, automatic editorial actions, production monitoring schedules, live API fetches, or database mutations.
