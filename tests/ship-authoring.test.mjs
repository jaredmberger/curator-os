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
const { ShipAuthoringController, renderShipAuthoringDialog } = await import('../src/ui/ship-authoring.js');

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
service.create({ id: 'company.builder', type: 'company', title: 'Builder Co.' });
service.create({ id: 'company.operator', type: 'company', title: 'Operator Co.' });
service.create({ id: 'company.operator-two', type: 'company', title: 'Second Operator' });

const controller = new ShipAuthoringController(service);
const form = new Map([
  ['id', 'ship.test-ship'],
  ['title', 'Test Ship'],
  ['summary', 'A dedicated ship authoring test.'],
  ['builder', 'company.builder'],
  ['operator', 'company.operator'],
  ['yardNumber', '123'],
  ['launchDate', '1911-05-31'],
  ['maidenVoyage', '1912-04-10'],
  ['fate', 'Preserved'],
  ['grossTonnage', '45,000 GRT'],
  ['length', '882 ft'],
  ['beam', '92 ft'],
  ['speed', '21 knots'],
  ['status', 'review'],
  ['confidence', 'probable'],
  ['tags', 'test, liner']
]);

const created = controller.createFromForm(form);
assert.equal(created.type, 'ship');
assert.equal(created.data.builder, 'company.builder');
assert.equal(created.data.yardNumber, '123');
assert.equal(created.relationships.length, 2);
assert.equal(created.relationships[0].relationship, 'built_by');
assert.equal(created.relationships[1].relationship, 'operated_by');
assert.deepEqual(created.tags, ['test', 'liner']);

service.update(created.id, {
  relationships: [...created.relationships, {
    target: 'ship.other',
    relationship: 'sister_of',
    confidence: 'verified',
    sourceIds: [],
    note: ''
  }]
});

const editForm = new Map([
  ['id', 'ship.test-ship'],
  ['title', 'Test Ship Revised'],
  ['summary', 'Updated through the ship workflow.'],
  ['builder', 'company.builder'],
  ['operator', 'company.operator-two'],
  ['yardNumber', '124'],
  ['launchDate', '1911-06-01'],
  ['maidenVoyage', '1912-04-11'],
  ['fate', 'Scrapped'],
  ['grossTonnage', '46,000 GRT'],
  ['length', '883 ft'],
  ['beam', '93 ft'],
  ['speed', '22 knots'],
  ['status', 'published'],
  ['confidence', 'verified'],
  ['tags', 'test, revised']
]);

const updated = controller.updateFromForm(created.id, editForm);
assert.equal(updated.title, 'Test Ship Revised');
assert.equal(updated.data.operator, 'company.operator-two');
assert.equal(updated.data.yardNumber, '124');
assert.equal(updated.relationships.filter((item) => item.relationship === 'operated_by').length, 1);
assert.equal(updated.relationships.find((item) => item.relationship === 'operated_by').target, 'company.operator-two');
assert.equal(updated.relationships.find((item) => item.relationship === 'sister_of').target, 'ship.other');
assert.equal(updated.metadata.confidence, 'verified');

const createDialog = renderShipAuthoringDialog({ records: service.all() });
const editDialog = renderShipAuthoringDialog({ records: service.all(), record: updated });
assert.match(createDialog, /Create ship/);
assert.match(createDialog, /company\.builder/);
assert.match(createDialog, /data-create-ship-form/);
assert.match(createDialog, /Maiden voyage/);
assert.match(editDialog, /Edit ship/);
assert.match(editDialog, /data-edit-ship-form/);
assert.match(editDialog, /Test Ship Revised/);
assert.match(editDialog, /company\.operator-two/);
assert.match(editDialog, /readonly/);

console.log('Ship authoring tests passed.');
