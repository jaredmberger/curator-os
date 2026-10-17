# Watchtower → Stewardship technical triage

Search Intelligence's current Watchtower detector emits `top10-enter`, `top10-exit`, `rank-rise`, `rank-drop`, `impression-surge`, `new-query` and `query-top10`. These are **ranking observations**, not proven indexing faults or editorial errors.

This PR introduces a strict allowlist for potential future technical event classes (`indexing-blocked`, `robots-blocked`, `fetch-error`, `canonical-mismatch`, `sitemap-error`). Unknown types are isolated and never automatically promoted.

The existing authenticated service binding is reused. The Human Review Queue now shows a **read-only technical triage companion section**. It does **not** ingest Watchtower signals into the persistent editorial cases KV collection: review decisions, deduplication and archival workflows remain undisturbed. This avoids false case lifecycle transitions due to Watchtower snapshot windows or missing observation days.

Technical events, if present in the upstream response, carry supporting page, type, snapshot date and detail plus a link to Search Intelligence. No Search Console API duplication, additional tokens, editorial edits, or robots/indexing changes.

No currently implemented Watchtower event types fall into the technical allowlist, so **zero technical candidates is the expected initial result**. This does not imply the site has no indexing problems. A later PR should implement first-class technical detector evidence and review persistence only when such signals and lifecycle contracts exist.

Test: `node tests/watchtower-triage.test.mjs`. Confirm Search Visibility still shows Watchtower events; confirm the Human Review Queue reports rank/technical counts and its saved cases and decisions remain intact.
