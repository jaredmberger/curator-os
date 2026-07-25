# CuratorOS Synchronization Contract

Status: architectural boundary for a future optional authenticated sync layer.

## Purpose

CuratorOS is local-first. Synchronization must extend that model without silently replacing browser data or turning the hosted preview into a server-authoritative application.

This contract defines the minimum behavior expected from any future sync provider.

## Non-negotiable guarantees

1. **Local data remains usable without a network connection.**
2. **No silent replacement.** A remote snapshot may not overwrite the local database without an explicit user decision.
3. **Recoverability first.** CuratorOS must create a local recovery snapshot before applying a remote replacement or merge.
4. **Canonical validation.** Local and remote records must pass the existing CuratorDatabase validation layer before comparison or application.
5. **Provider independence.** The catalog and authoring services must not depend directly on GitHub, Cloudflare, or another vendor-specific API.
6. **Visible synchronization state.** The application must expose whether it is local-only, connected, syncing, conflicted, or offline.
7. **Explicit identity.** Synchronization may begin only after the user intentionally connects an authenticated account.

## Provider interface

A synchronization provider should implement the following conceptual interface:

```js
{
  connect(): Promise<SyncIdentity>,
  disconnect(): Promise<void>,
  status(): Promise<SyncStatus>,
  pull(): Promise<RemoteEnvelope | null>,
  push(envelope, options): Promise<RemoteEnvelope>,
  resolve(conflictResolution): Promise<RemoteEnvelope>
}
```

The provider may use any transport, but the application should interact only through this boundary.

## Sync envelope

Remote state should be exchanged as an envelope rather than as a bare record array.

```json
{
  "format": "curatoros-sync-envelope",
  "formatVersion": 1,
  "schemaVersion": 1,
  "databaseId": "default",
  "revision": "provider-issued-opaque-token",
  "parentRevision": "previous-provider-issued-token",
  "updatedAt": "2026-07-25T00:00:00.000Z",
  "updatedBy": "authenticated-identity",
  "records": []
}
```

The `revision` value is opaque. CuratorOS must not infer ordering from its contents.

## Comparison states

A sync comparison should result in one of these states:

- **equal** — local and remote canonical databases are equivalent.
- **local-ahead** — the local database changed since the last synchronized revision.
- **remote-ahead** — the remote database changed while local state remained unchanged.
- **diverged** — both local and remote databases changed from the last common revision.
- **unrelated** — no common revision is available.

## Default behavior

- `equal`: no action.
- `local-ahead`: offer **Upload local copy**.
- `remote-ahead`: offer **Review and download remote copy**.
- `diverged`: require an explicit conflict-resolution screen.
- `unrelated`: require the user to choose which database becomes the starting point.

CuratorOS must not automatically apply last-write-wins behavior.

## Conflict resolution

The first implementation may resolve conflicts at the whole-database level with these explicit choices:

- Keep local database
- Use remote database
- Export both databases and cancel

Before either replacement choice, CuratorOS must save the current local database as a named recovery snapshot.

A later implementation may add record-level comparison, but it must preserve the same no-silent-replacement guarantee.

## Local sync metadata

Provider metadata should be stored separately from canonical records, for example:

```json
{
  "provider": "example-provider",
  "databaseId": "default",
  "lastRevision": "opaque-token",
  "lastSyncedAt": "2026-07-25T00:00:00.000Z",
  "lastLocalFingerprint": "deterministic-database-fingerprint"
}
```

This metadata is operational state and must not be inserted into individual canonical records.

## Security boundary

- Authentication secrets must never be stored in canonical exports.
- Tokens should use provider-supported secure session storage rather than being embedded in source files or local database records.
- A disconnected CuratorOS installation must continue to open and edit local records normally.
- Export, import, snapshots, and restore remain available whether or not sync is connected.

## Implementation sequence

1. Add provider-neutral sync state and deterministic database fingerprinting.
2. Add a local mock provider and automated comparison tests.
3. Add the sync-status user interface and explicit decision dialogs.
4. Integrate one authenticated provider behind the provider interface.
5. Add optional record-level conflict review only after whole-database conflict behavior is stable.

## Out of scope for the first sync release

- background synchronization without user awareness
- collaborative real-time editing
- automatic field-level merges
- server-authoritative deletion
- silently reconciling conflicting records
