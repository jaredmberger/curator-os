import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadCanonicalGlobal(path, name) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  globalThis[name] = Function(`${source}\nreturn ${name};`)();
}

loadCanonicalGlobal('../src/core/database.js', 'CuratorDatabase');
loadCanonicalGlobal('../src/core/storage.js', 'CuratorStorage');
loadCanonicalGlobal('../src/core/relationships.js', 'CuratorRelationships');

const { RecordService } = await import('../src/ui/collection-catalog-shell.js');
const { RecordAuthoringController, renderCreateRecordDialog, renderStructuredAuthoringDialog } = await import('../src/ui/record-authoring-dialogs.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const records = new RecordService({ storage: new MemoryStorage() });
const controller = new RecordAuthoringController(records);

const createValues = new Map([
  ['id', 'ship.test-liner'],
  ['type', 'ship'],
  ['title', 'Test Liner'],
  ['summary', 'A catalog authoring test record.'],
  ['status', 'draft'],
  ['confidence', 'tentative'],
  ['tags', 'test, liner']
]);

globalThis.FormData = class {
  constructor(form) { this.form = form; }
  get(name) { return this.form.get(name) ?? null; }
};

const created = controller.createFromForm(createValues);
assert.equal(created.id, 'ship.test-liner');
assert.equal(records.get('ship.test-liner').title, 'Test Liner');
assert.deepEqual(records.get('ship.test-liner').tags, ['test', 'liner']);

const structuredValues = new Map([
  ['relationships', JSON.stringify({ target: 'ship.other', relationship: 'sister_of', confidence: 'probable', sourceIds: [], note: '' })],
  ['sources', JSON.stringify({ id: 'source.test', title: 'Test source', type: 'archive' })],
  ['media', JSON.stringify({ id: 'media.test', title: 'Test image', type: 'image' })],
  ['notes', JSON.stringify({ body: 'Curatorial note', kind: 'curatorial' })]
]);

records.create({ id: 'ship.other', type: 'ship', title: 'Other Ship' });
controller.updateStructuredFromForm('ship.test-liner', structuredValues);
const updated = records.get('ship.test-liner');
assert.equal(updated.relationships[0].target, 'ship.other');
assert.equal(updated.sources[0].title, 'Test source');
assert.equal(updated.media[0].title, 'Test image');
assert.equal(updated.notes[0].body, 'Curatorial note');

assert.match(renderCreateRecordDialog(), /Create record/);
assert.match(renderStructuredAuthoringDialog(updated), /Structured authoring/);
assert.match(renderStructuredAuthoringDialog(updated), /Test source/);

console.log('Record authoring dialog tests passed.');
