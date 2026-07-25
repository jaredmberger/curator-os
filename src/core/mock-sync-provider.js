import { fingerprintDatabase, compareSyncState, SyncComparison, SyncStates } from './sync-state.js';

export class LocalMockSyncProvider {
  constructor(options = {}) {
    this.storage = options.storage || globalThis.localStorage;
    this.storageKey = options.storageKey || 'curatoros.mock-sync.remote';
    this.identity = null;
  }

  async connect() {
    this.identity = { id: 'local-mock-user', displayName: 'Local Mock Account' };
    return this.identity;
  }

  async disconnect() {
    this.identity = null;
  }

  async status() {
    return {
      state: this.identity ? SyncStates.CONNECTED : SyncStates.LOCAL_ONLY,
      identity: this.identity
    };
  }

  async pull() {
    const stored = this.storage?.getItem?.(this.storageKey);
    return stored ? JSON.parse(stored) : null;
  }

  async push(database, metadata = {}) {
    if (!this.identity) throw new Error('Connect the mock sync provider before uploading.');
    CuratorDatabase.assertDatabase(database);
    const previous = await this.pull();
    const revision = `mock-${Date.now()}`;
    const envelope = {
      format: 'curatoros-sync-envelope',
      formatVersion: 1,
      schemaVersion: database.schemaVersion,
      databaseId: metadata.databaseId || 'default',
      revision,
      parentRevision: previous?.revision || null,
      updatedAt: new Date().toISOString(),
      updatedBy: this.identity.id,
      records: CuratorDatabase.clone(database.records)
    };
    this.storage?.setItem?.(this.storageKey, JSON.stringify(envelope));
    return envelope;
  }

  async compare(localDatabase, metadata = {}) {
    const remoteEnvelope = await this.pull();
    return {
      comparison: compareSyncState({ localDatabase, remoteEnvelope, metadata }),
      remoteEnvelope,
      localFingerprint: fingerprintDatabase(localDatabase)
    };
  }

  async clearRemote() {
    this.storage?.removeItem?.(this.storageKey);
  }
}

export { SyncComparison };
