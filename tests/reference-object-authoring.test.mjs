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
const { ReferenceObjectAuthoringController, renderReferenceObjectAuthoringDialog } = await import('../src/ui/reference-object-authoring.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

globalThis.FormData = class {
  constructor(form) { this.form = form; }
  get(name) { return this.form.get(name) ?? null; }
};

const service = new RecordService({ storage: new MemoryStorage() });
service.create({ id: 'ship.olympic', type: 'ship', title: 'RMS Olympic' });
service.create({ id: 'ship.other', type: 'ship', title: 'Other Ship' });
const controller = new ReferenceObjectAuthoringController(service);

const createForm = new Map([
  ['id', 'object.olympic-menu-1929'],
  ['title', 'RMS Olympic Breakfast Menu'],
  ['summary', 'Breakfast menu dated 2 June 1929.'],
  ['category', 'menu'],
  ['associatedRecord', 'ship.olympic'],
  ['date', '1929-06-02'],
  ['maker', 'White Star Line'],
  ['dimensions', '4-3/4 × 7-1/4 in'],
  ['material', 'paper'],
  ['condition', 'mint'],
  ['provenance', 'Private collection provenance.'],
  ['acquisition', 'Acquired for the Ocean Liner Curator collection.'],
  ['storageLocation', 'Archive box A'],
  ['insuranceNotes', 'Insured collection item.'],
  ['curatorNotes', 'Reference Object RO-0001.'],
  ['status', 'review'],
  ['confidence', 'verified'],
  ['tags', 'Reference object, Menu, RMS Olympic']
]);

const created = controller.createFromForm(createForm);
assert.equal(created.type, 'object');
assert.equal(created.data.category, 'menu');
assert.equal(created.data.associatedRecord, 'ship.olympic');
assert.equal(created.relationships[0].relationship, 'associated_with');
assert.equal(created.relationships[0].target, 'ship.olympic');

service.update(created.id, {
  relationships: [
    ...created.relationships,
    { target: 'source.catalog', relationship: 'documented_by', confidence: 'probable', sourceIds: [], note: '' }
  ]
});

const editForm = new Map(createForm);
editForm.set('associatedRecord', 'ship.other');
editForm.set('condition', 'excellent');
editForm.set('title', 'RMS Olympic Breakfast Menu, 1929');
const updated = controller.updateFromForm(created.id, editForm);
assert.equal(updated.title, 'RMS Olympic Breakfast Menu, 1929');
assert.equal(updated.data.condition, 'excellent');
assert.equal(updated.relationships.find((item) => item.relationship === 'associated_with').target, 'ship.other');
assert.ok(updated.relationships.some((item) => item.relationship === 'documented_by'));
assert.equal(updated.id, 'object.olympic-menu-1929');

const dialog = renderReferenceObjectAuthoringDialog({ records: service.all(), record: updated });
assert.match(dialog, /Edit reference object/);
assert.match(dialog, /Object category/);
assert.match(dialog, /Acquisition details/);
assert.match(dialog, /Storage location/);
assert.match(dialog, /data-edit-reference-object-form/);
assert.match(dialog, /readonly/);
assert.match(dialog, /ship\.olympic/);

console.log('Reference object authoring tests passed.');
