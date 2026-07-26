import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadCanonicalGlobal(path, name) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  globalThis[name] = Function(`${source}\nreturn ${name};`)();
}

loadCanonicalGlobal('../src/core/database.js', 'CuratorDatabase');

const {
  SyncComparison,
  canonicalizeDatabase,
  fingerprintDatabase,
  compareSyncState
} = await import('../src/core/sync-state.js');

const timestamp = '2026-07-25T00:00:00.000Z';
const metadata = { created: timestamp, updated: timestamp, confidence: 'unknown' };

const local = CuratorDatabase.createDatabase([
  { id: 'ship.b', type: 'ship', title: 'B', tags: ['two', 'one'], metadata },
  { id: 'ship.a', type: 'ship', title: 'A', metadata }
]);

const reordered = CuratorDatabase.createDatabase([
  { id: 'ship.a', type: 'ship', title: 'A', metadata },
  { id: 'ship.b', type: 'ship', title: 'B', tags: ['one', 'two'], metadata }
]);

assert.deepEqual(canonicalizeDatabase(local), canonicalizeDatabase(reordered));
assert.equal(fingerprintDatabase(local), fingerprintDatabase(reordered));

const localFingerprint = fingerprintDatabase(local);
const equalEnvelope = {
  revision: 'r1',
  parentRevision: 'r0',
  records: reordered.records
};

assert.equal(compareSyncState({
  localDatabase: local,
  remoteEnvelope: equalEnvelope,
  metadata: { lastRevision: 'r1', lastLocalFingerprint: localFingerprint }
}), SyncComparison.EQUAL);

const changedLocal = CuratorDatabase.createDatabase([
  ...local.records,
  { id: 'ship.c', type: 'ship', title: 'C', metadata }
]);

assert.equal(compareSyncState({
  localDatabase: changedLocal,
  remoteEnvelope: equalEnvelope,
  metadata: { lastRevision: 'r1', lastLocalFingerprint: localFingerprint }
}), SyncComparison.LOCAL_AHEAD);

const remoteAhead = {
  revision: 'r2',
  parentRevision: 'r1',
  records: [...local.records, { id: 'ship.remote', type: 'ship', title: 'Remote', metadata }]
};

assert.equal(compareSyncState({
  localDatabase: local,
  remoteEnvelope: remoteAhead,
  metadata: { lastRevision: 'r1', lastLocalFingerprint: localFingerprint }
}), SyncComparison.REMOTE_AHEAD);

assert.equal(compareSyncState({
  localDatabase: changedLocal,
  remoteEnvelope: remoteAhead,
  metadata: { lastRevision: 'r1', lastLocalFingerprint: localFingerprint }
}), SyncComparison.DIVERGED);

assert.equal(compareSyncState({
  localDatabase: local,
  remoteEnvelope: { revision: 'r9', parentRevision: 'r8', records: remoteAhead.records },
  metadata: { lastRevision: 'r1', lastLocalFingerprint: localFingerprint }
}), SyncComparison.UNRELATED);

console.log('Sync state tests passed.');