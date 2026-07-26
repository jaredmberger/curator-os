import assert from 'node:assert/strict';
import { buildImportPlan, applyImportPlan, summarizeImportPlan } from '../src/core/import-merge-planner.js';

const local = [
  { id: 'ship.olympic', type: 'ship', title: 'RMS Olympic', status: 'published' },
  { id: 'company.white-star-line', type: 'company', title: 'White Star Line', status: 'review' }
];

const incoming = [
  { id: 'ship.olympic', type: 'ship', title: 'RMS Olympic', status: 'published' },
  { id: 'company.white-star-line', type: 'company', title: 'Oceanic Steam Navigation Company', status: 'review' },
  { id: 'ship.titanic', type: 'ship', title: 'RMS Titanic', status: 'review' }
];

const keepLocal = buildImportPlan(local, incoming, { selectedTypes: ['ship', 'company'], resolution: 'keep-local' });
assert.equal(keepLocal.add.length, 1);
assert.equal(keepLocal.identical.length, 1);
assert.equal(keepLocal.conflicts.length, 1);
assert.deepEqual(summarizeImportPlan(keepLocal), { added: 1, identical: 1, conflicts: 1, skipped: 0 });
const kept = applyImportPlan(local, keepLocal);
assert.equal(kept.find((record) => record.id === 'company.white-star-line').title, 'White Star Line');
assert.ok(kept.some((record) => record.id === 'ship.titanic'));

const useIncoming = buildImportPlan(local, incoming, { selectedTypes: ['company'], resolution: 'use-incoming' });
const replaced = applyImportPlan(local, useIncoming);
assert.equal(replaced.find((record) => record.id === 'company.white-star-line').title, 'Oceanic Steam Navigation Company');
assert.equal(replaced.some((record) => record.id === 'ship.titanic'), false);

const shipOnly = buildImportPlan(local, incoming, { selectedTypes: ['ship'], resolution: 'keep-local' });
assert.equal(shipOnly.conflicts.length, 0);
assert.equal(shipOnly.add.length, 1);
assert.equal(shipOnly.identical.length, 1);

console.log('import merge planner tests passed');
