# Editorial Ledger — Phase 2 storage contract

This change adds **pure, offline, versioned contracts**, not a deployed synchronization service.

- The existing browser-local ledger remains the authoritative working copy for the initial experience.
- A remote envelope carries `contractVersion:1`, `scope:operator-editorial-ledger`, a revision token, an observation timestamp and a validated ledger.
- Mutations are **proposals**, not commands against OceanLiners.net. They require an explicit expected revision and idempotency request identifier.
- A conflicting server revision produces a conflict outcome rather than silently overwriting remote editorial work.
- Merge logic uses candidate identity (exact ship path, kind, evidence wording) and per-decision timestamps. Changed audit evidence starts a separate undecided candidate.
- No API route, cloud binding, new credential, automatic mutation, publication or access-policy change is introduced by this PR.

## Requirements for a future protected persistence PR

1. Define a dedicated CuratorOS-only KV/D1 namespace, separated from archived ship source and snapshot KV.
2. Gate **both** GET and mutation operations behind verified Cloudflare Access operator JWT. Retain signed issuer, exact audience, allowed operator identity and expiry checks; never trust caller-submitted identity.
3. Require a strict bounded request body and schema, verified revision check and conflict responses. A read-modify-write backed by KV alone is **not atomic**; implement compare-and-swap on a transactional backing store (for example D1) or a Durable Object before allowing multi-device writes. The offline optimistic contract is insufficient by itself.
4. Preserve a recoverable, exportable backup and design explicit restore tests. Do not treat an empty remote database as permission to delete a local ledger.
5. Keep user-controlled status and evidence notes distinct from historical certification and never edit, publish or correct an oceanliners.net guide as a side effect.
6. Test auth failure, conflicting revisions, replayed idempotency identifiers, oversized input, stale clients and recovery before enabling writes.

This deliberately defers cloud infrastructure while production authentication stability is being established.
