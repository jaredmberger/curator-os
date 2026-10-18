# Historical Research Agent → CuratorOS: durable evidence intake

Status: **design proposal only; no production ingestion**.

## Existing boundaries

- The Ocean Liner Curator Actions workflow produces `<ship>.md`, `<ship>.evidence.json`, and a static read-only `research-review.html`; GitHub retains artifacts for 30 days.
- CuratorOS already has `CURATOROS_RECORDS` Cloudflare KV and `/api/research-state`. That route stores a synchronized browser-state snapshot under `research-state`. **Do not insert agent data into that snapshot:** browser synchronization may overwrite newer evidence and it is not a per-claim archive.
- CuratorOS is in a release-candidate freeze; changes to production storage/API need separate, tested approval.
- Research registers contain **unverified model output**, not approved canonical Ship Record facts.

## Proposed write path (later PR)

1. Keep the read-only manual evidence viewer available.
2. Add a **separate** endpoint `POST /api/research-agent/import` secured by a service-specific bearer token stored in a Cloudflare secret, and verify that the request also passes existing application/network access policies. Never accept a token in a URL query string or expose it in the browser.
3. In the research GitHub Actions workflow, add an opt-in, isolated importer job using an Actions secret with narrowly scoped permission. No import on every run until a dry-run and error path are proven.
4. Validate entire input, not only the JSON shape: `schema_version===1`, ship guide identifier pattern, maximum file and claim count, maximum field lengths, source URL scheme, expected enums, number of entries, and required claim fields. Reject HTML/script-protocol URLs.
5. Compute a stable **idempotency key** using an explicit versioned digest of normalized vessel guide, claim content, and source URL. Re-imports must not create duplicate claims; revisions should preserve the prior version and history.
6. Write a distinct `research-agent/claim/v1/<claimId>` KV record per claim and a separate, bounded guide index. Persist original run ID, import timestamp, dossier reference and source register digest. Retain the raw evidence register or its exact contents for auditability, subject to retention requirements.
7. Set every imported claim status to `unverified_pending_editorial_review` with `independently_verified=false`. Ignore/reject any incoming attempt to set `verified`, `approved`, or canonical record fields.
8. Require a separate authenticated editorial-review API for status changes with reviewer identity, timestamp, decision, notes, source verification and explicit before/after audit events. These editorial APIs do not publish to Ship Records. Promotion is a different gated workflow.

## KV consistency and safety

Cloudflare KV is not a transactionally consistent database. Avoid a single read–modify–write shared index as the sole source of truth; simultaneous workers could lose updates. Use immutable or idempotent keys per claim plus a controlled index rebuild mechanism. If strict sequential review decisions are required, use a transactional store or Durable Object for the approval log rather than last-write-wins KV.

Treat incoming agent data as untrusted. Apply rate limits, access control, request-size ceilings and explicit content-type checks. The existence of a Cloudflare Access policy must be verified in the target deployment; `noindex` does not protect APIs. Do not log bearer tokens or full source documents.

## Rollout gate

- [ ] Verify Cloudflare Access for the real CuratorOS hostname and all `/api/research-agent/*` routes.
- [ ] Confirm secret management and caller identity; token never available in client JavaScript.
- [ ] Add tests for malformed input, spoofed review statuses, duplication, concurrent imports, partial failures and stale revisions.
- [ ] Confirm KV binding, storage quota/retention and backup/export/recovery behavior.
- [ ] Confirm importer is disabled by default and has a clear manual rollback/disable path.
- [ ] Verify that imported claims display in the Research Review interface without editing canonical Ship Records.
- [ ] Validate `npm run check` and test iPad Safari behavior before a production release.

## Immediate usage

Until an importer passes these gates, download the Actions artifact before its 30-day expiration and preserve a copy of the Markdown dossier plus structured JSON in an appropriately access-controlled research archive. The existing CuratorOS viewer can open `*.evidence.json` locally without server writes.
