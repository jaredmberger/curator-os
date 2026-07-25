import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadCanonicalGlobal(path, name) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  globalThis[name] = Function(`${source}\nreturn ${name};`)();
}

loadCanonicalGlobal('../src/core/database.js', 'CuratorDatabase');

const { LocalMockSyncProvider } = await import('../src/core/mock-sync-provider.js');
const { SyncComparison } = await import('../src/core/sync-state.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const storage = new MemoryStorage();
const provider = new LocalMockSyncProvider({ storage });
const database = CuratorDatabase.createDatabase([
  CuratorDatabase.createRecord({ id: 'ship.test', type: 'ship', title: 'Test Ship' })
]);

assert.equal((await provider.status()).state, 'local-only');
await provider.connect();
assert.equal((await provider.status()).state, 'connected');

const initial = await provider.compare(database, {});
assert.equal(initial.comparison, SyncComparison.LOCAL_AHEAD);

const envelope = await provider.push(database);
assert.equal(envelope.records.length, 1);
assert.ok(envelope.revision.startsWith('mock-'));

const equal = await provider.compare(database, {
  lastRevision: envelope.revision,
  lastLocalFingerprint: initial.localFingerprint
});
assert.equal(equal.comparison, SyncComparison.EQUAL);

await provider.clearRemote();
assert.equal(await provider.pull(), null);

console.log('Mock sync provider tests passed.');
