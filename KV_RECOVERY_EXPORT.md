# CuratorOS KV Recovery Export

CuratorOS exposes a read-only recovery export for its institutional KV store at:

`/api/recovery-export`

The production CuratorOS application is protected by Cloudflare Access. The recovery endpoint inherits that protection and does not provide any write or restore capability.

## What the export contains

A successful export contains the two required durable keys from `CURATOROS_RECORDS`:

- `project-records`
- `research-state`

The endpoint refuses to create a successful backup if either key is absent, malformed JSON, or structurally invalid. This prevents an empty or damaged KV namespace from being mistaken for a valid backup.

Each export includes:

- export timestamp
- schema version
- Project Records count and version
- Research State version
- SHA-256 digest of the exported data
- the complete JSON payload for both durable keys

The response is sent as a JSON attachment named like:

`curatoros-recovery-2026-09-26T05-00-00-000Z.json`

## iPad / iPhone backup procedure

1. Sign in to CuratorOS through Cloudflare Access.
2. Open `https://curator.oceanliners.net/api/recovery-export`.
3. Save the downloaded JSON file to a durable location outside the CuratorOS application.
4. Keep at least one recent copy outside GitHub and outside Cloudflare.

The endpoint is read-only. Creating a backup cannot change Project Records or Research State.

## Validation

From a clean repository checkout:

```bash
npm run recovery:validate -- /path/to/curatoros-recovery-....json
```

A valid backup reports:

- export timestamp
- Project Records count/version
- Research State version
- matching SHA-256 digest

Validation failure means the file must not be used as a recovery source.

## Restore safety

There is intentionally **no production restore endpoint**.

Restoration is a destructive/write operation and should first be tested against a disposable KV namespace. A restore procedure must:

1. validate the backup
2. confirm its Project Records and Research State versions
3. identify the intended target namespace explicitly
4. write only to a disposable namespace during the drill
5. bind a disposable/test deployment to that namespace
6. verify both keys through the normal CuratorOS APIs
7. only then consider a separately approved production restoration

Never restore into production merely because a new deployment has an empty KV namespace.
