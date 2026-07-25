export const SyncStates = Object.freeze({
  LOCAL_ONLY: 'local-only',
  CONNECTED: 'connected',
  SYNCING: 'syncing',
  CONFLICTED: 'conflicted',
  OFFLINE: 'offline'
});

export const SyncComparison = Object.freeze({
  EQUAL: 'equal',
  LOCAL_AHEAD: 'local-ahead',
  REMOTE_AHEAD: 'remote-ahead',
  DIVERGED: 'diverged',
  UNRELATED: 'unrelated'
});

export function canonicalizeDatabase(database) {
  CuratorDatabase.assertDatabase(database);
  const records = CuratorDatabase.clone(database.records)
    .map(sortRecordCollections)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: database.schemaVersion,
    records
  };
}

export function fingerprintDatabase(database) {
  const canonical = canonicalizeDatabase(database);
  return fnv1a(JSON.stringify(canonical));
}

export function compareSyncState({ localDatabase, remoteEnvelope, metadata = {} }) {
  CuratorDatabase.assertDatabase(localDatabase);
  if (!remoteEnvelope) return SyncComparison.LOCAL_AHEAD;

  const remoteDatabase = CuratorDatabase.createDatabase(remoteEnvelope.records || []);
  CuratorDatabase.assertDatabase(remoteDatabase);

  const localFingerprint = fingerprintDatabase(localDatabase);
  const remoteFingerprint = fingerprintDatabase(remoteDatabase);
  if (localFingerprint === remoteFingerprint) return SyncComparison.EQUAL;

  const lastRevision = metadata.lastRevision || null;
  const lastLocalFingerprint = metadata.lastLocalFingerprint || null;
  const remoteRevision = remoteEnvelope.revision || null;
  const parentRevision = remoteEnvelope.parentRevision || null;

  if (!lastRevision) return SyncComparison.UNRELATED;

  const localChanged = !lastLocalFingerprint || localFingerprint !== lastLocalFingerprint;
  const remoteChanged = remoteRevision !== lastRevision;

  if (localChanged && remoteChanged) return SyncComparison.DIVERGED;
  if (localChanged && !remoteChanged) return SyncComparison.LOCAL_AHEAD;
  if (!localChanged && remoteChanged) {
    return parentRevision === lastRevision || !parentRevision
      ? SyncComparison.REMOTE_AHEAD
      : SyncComparison.UNRELATED;
  }

  return SyncComparison.UNRELATED;
}

function sortRecordCollections(record) {
  const clone = CuratorDatabase.clone(record);
  clone.tags = [...(clone.tags || [])].sort();
  clone.relationships = [...(clone.relationships || [])].sort(compareJson);
  clone.sources = [...(clone.sources || [])].sort(compareJson);
  clone.media = [...(clone.media || [])].sort(compareJson);
  clone.notes = [...(clone.notes || [])].sort(compareJson);
  return clone;
}

function compareJson(a, b) {
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
