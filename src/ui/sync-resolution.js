import { SyncComparison } from '../core/sync-state.js';

export function resolveSyncComparison({ comparison, localDatabase, remoteEnvelope, recordService, storage = globalThis.localStorage, confirmFn = globalThis.confirm, alertFn = globalThis.alert }) {
  if (!remoteEnvelope) throw new Error('No remote sync envelope is available.');
  const remoteDatabase = CuratorDatabase.createDatabase(remoteEnvelope.records || []);
  CuratorDatabase.assertDatabase(remoteDatabase);
  CuratorDatabase.assertDatabase(localDatabase);

  if (comparison === SyncComparison.EQUAL) {
    alertFn?.('Local and remote databases are already up to date.');
    return { action: 'none' };
  }

  if (comparison === SyncComparison.REMOTE_AHEAD) {
    const confirmed = confirmFn?.(`Download the remote copy with ${remoteDatabase.records.length} record${remoteDatabase.records.length === 1 ? '' : 's'}? Your current local database will first be saved as a recovery snapshot.`);
    if (!confirmed) return { action: 'cancelled' };
    saveRecoverySnapshot(storage, localDatabase, 'before-remote-download');
    recordService.replace(remoteDatabase.records);
    return { action: 'used-remote', envelope: remoteEnvelope };
  }

  if (comparison === SyncComparison.DIVERGED || comparison === SyncComparison.UNRELATED) {
    return { action: 'review-required', choices: ['keep-local', 'use-remote', 'export-both'] };
  }

  return { action: 'keep-local' };
}

export function applyConflictChoice({ choice, localDatabase, remoteEnvelope, recordService, storage = globalThis.localStorage, downloadJson }) {
  if (!remoteEnvelope) throw new Error('No remote sync envelope is available.');
  const remoteDatabase = CuratorDatabase.createDatabase(remoteEnvelope.records || []);
  CuratorDatabase.assertDatabase(remoteDatabase);
  CuratorDatabase.assertDatabase(localDatabase);

  if (choice === 'keep-local') return { action: 'keep-local' };

  if (choice === 'use-remote') {
    saveRecoverySnapshot(storage, localDatabase, 'before-conflict-remote');
    recordService.replace(remoteDatabase.records);
    return { action: 'used-remote', envelope: remoteEnvelope };
  }

  if (choice === 'export-both') {
    if (typeof downloadJson !== 'function') throw new Error('A download function is required to export both databases.');
    downloadJson({ schemaVersion: localDatabase.schemaVersion, records: localDatabase.records }, 'curatoros-local-conflict-copy.json');
    downloadJson(remoteEnvelope, 'curatoros-remote-conflict-copy.json');
    return { action: 'exported-both' };
  }

  throw new Error(`Unknown conflict choice: ${choice}`);
}

function saveRecoverySnapshot(storage, database, label) {
  storage?.setItem?.(`curatoros.snapshot.${label}`, JSON.stringify({
    createdAt: new Date().toISOString(),
    schemaVersion: database.schemaVersion,
    records: CuratorDatabase.clone(database.records)
  }));
}
