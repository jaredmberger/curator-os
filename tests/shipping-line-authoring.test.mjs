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
const { ShippingLineAuthoringController, renderShippingLineAuthoringDialog } = await import('../src/ui/shipping-line-authoring.js');

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
const controller = new ShippingLineAuthoringController(service);

const createForm = new Map([
  ['id', 'company.test-line'],
  ['title', 'Test Line'],
  ['summary', 'A dedicated shipping-line authoring test.'],
  ['country', 'United Kingdom'],
  ['headquarters', 'Liverpool'],
  ['founded', '1900'],
  ['ceased', '1950'],
  ['parentCompany', 'Parent Co.'],
  ['successor', 'Successor Line'],
  ['routeFocus', 'North Atlantic'],
  ['houseFlag', 'Red flag with white emblem'],
  ['lineNotes', 'Test notes'],
  ['status', 'review'],
  ['confidence', 'probable'],
  ['tags', 'Shipping line, Transatlantic']
]);

const created = controller.createFromForm(createForm);
assert.equal(created.type, 'company');
assert.equal(created.data.country, 'United Kingdom');
assert.equal(created.data.routeFocus, 'North Atlantic');
assert.deepEqual(created.tags, ['Shipping line', 'Transatlantic']);

const updateForm = new Map(createForm);
updateForm.set('title', 'Updated Test Line');
updateForm.set('headquarters', 'London');
const updated = controller.updateFromForm(created.id, updateForm);
assert.equal(updated.id, created.id);
assert.equal(updated.title, 'Updated Test Line');
assert.equal(updated.data.headquarters, 'London');

const dialog = renderShippingLineAuthoringDialog({ record: updated });
assert.match(dialog, /Edit shipping line/);
assert.match(dialog, /data-edit-shipping-line-form/);
assert.match(dialog, /readonly/);
assert.match(dialog, /North Atlantic/);

console.log('Shipping line authoring tests passed.');
