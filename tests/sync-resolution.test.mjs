import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const databaseSource = fs.readFileSync(new URL('../src/core/database.js', import.meta.url), 'utf8');
const syncStateSource = fs.readFileSync(new URL('../src/core/sync-state.js', import.meta.url), 'utf8');
let source = fs.readFileSync(new URL('../src/ui/sync-resolution.js', import.meta.url), 'utf8');

const sandbox = { console, structuredClone, Date, Map, Set };
vm.createContext(sandbox);
vm.runInContext(databaseSource.replaceAll('export ', ''), sandbox);
vm.runInContext(syncStateSource.replaceAll('export ', ''), sandbox);
source = source.replace("import { SyncComparison } from '../core/sync-state.js';\n\n", '').replaceAll('export ', '');
vm.runInContext(source, sandbox);

const record = (id, title = id) => ({ id, type: 'ship', title, summary: '', status: 'draft', tags: [], relationships: [], sources: [], media: [], notes: [], metadata: { confidence: 'unknown' } });
const localDatabase = sandbox.CuratorDatabase.createDatabase([record('ship.local')]);
const remoteEnvelope = { revision: 'remote-2', databaseId: 'default', records: [record('ship.remote')] };
const replaced = [];
const storage = new Map();
const storageAdapter = { setItem(key, value) { storage.set(key, value); } };

const remoteResult = sandbox.resolveSyncComparison({
  comparison: sandbox.SyncComparison.REMOTE_AHEAD,
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

const reviewResult = sandbox.resolveSyncComparison({
  comparison: sandbox.SyncComparison.DIVERGED,
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
const exportResult = sandbox.applyConflictChoice({
  choice: 'export-both',
  localDatabase,
  remoteEnvelope,
  recordService: { replace() {} },
  storage: storageAdapter,
  downloadJson(payload, filename) { downloads.push({ payload, filename }); }
});
assert.equal(exportResult.action, 'exported-both');
assert.equal(downloads.length, 2);

console.log('sync resolution tests passed');
