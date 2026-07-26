import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadCanonicalGlobal(path, name) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  globalThis[name] = Function(`${source}\nreturn ${name};`)();
}

loadCanonicalGlobal('../src/core/database.js', 'CuratorDatabase');

const { SyncComparison } = await import('../src/core/sync-state.js');
const { resolveSyncComparison, applyConflictChoice } = await import('../src/ui/sync-resolution.js');

const record = (id, title = id) => ({ id, type: 'ship', title, summary: '', status: 'draft', tags: [], relationships: [], sources: [], media: [], notes: [], metadata: { confidence: 'unknown' } });
const localDatabase = CuratorDatabase.createDatabase([record('ship.local')]);
const remoteEnvelope = { revision: 'remote-2', databaseId: 'default', records: [record('ship.remote')] };
const replaced = [];
const storage = new Map();
const storageAdapter = { setItem(key, value) { storage.set(key, value); } };

const remoteResult = resolveSyncComparison({
  comparison: SyncComparison.REMOTE_AHEAD,
  localDatabase,
  remoteEnvelope,
  recordService: { replace(records) { replaced.push(records); } },
  storage: storageAdapter,
  confirmFn: () => true,
  alertFn: () => {}
});
assert.equal(remoteResult.action, 'used-remote');
assert.equal(replaced[0][0].id, 'ship.remote');
assert.ok(storage.has('curatoros.snapshot.before-remote-download'));

const reviewResult = resolveSyncComparison({
  comparison: SyncComparison.DIVERGED,
  localDatabase,
  remoteEnvelope,
  recordService: { replace() {} },
  storage: storageAdapter,
  confirmFn: () => true,
  alertFn: () => {}
});
assert.equal(reviewResult.action, 'review-required');
assert.deepEqual([...reviewResult.choices], ['keep-local', 'use-remote', 'export-both']);

const downloads = [];
const exportResult = applyConflictChoice({
  choice: 'export-both',
  localDatabase,
  remoteEnvelope,
  recordService: { replace() {} },
  storage: storageAdapter,
  downloadJson(payload, filename) { downloads.push({ payload, filename }); }
});
assert.equal(exportResult.action, 'exported-both');
assert.equal(downloads.length, 2);

console.log('Sync resolution tests passed.');