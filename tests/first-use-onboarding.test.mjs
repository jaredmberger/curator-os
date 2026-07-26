import assert from 'node:assert/strict';
import { buildStorageDiagnostics, renderFirstUseOnboarding } from '../src/ui/first-use-onboarding.js';

const memory = new Map();
const storage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); }
};
const recordService = { all() { return [{ id: 'ship.olympic', title: 'RMS Olympic' }]; } };

const diagnostics = buildStorageDiagnostics(recordService, storage);
assert.equal(diagnostics.storageAvailable, true);
assert.equal(diagnostics.recordCount, 1);
assert.ok(diagnostics.storageBytes > 0);
assert.equal(diagnostics.hasSnapshot, false);

storage.setItem('curatoros.snapshot.latest', '{}');
const withSnapshot = buildStorageDiagnostics(recordService, storage);
assert.equal(withSnapshot.hasSnapshot, true);

const html = renderFirstUseOnboarding(withSnapshot);
assert.match(html, /CuratorOS local-first alpha/);
assert.match(html, /Browser storage: available/);
assert.match(html, /Canonical records: 1/);
assert.match(html, /not deployed automatically/);

console.log('First-use onboarding tests passed.');
