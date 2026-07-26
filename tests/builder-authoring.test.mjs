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
const { BuilderAuthoringController, renderBuilderAuthoringDialog } = await import('../src/ui/builder-authoring.js');

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
const controller = new BuilderAuthoringController(service);
const form = new Map([
  ['id', 'company.test-builder'],
  ['title', 'Test Builder'],
  ['summary', 'A dedicated builder authoring test.'],
  ['city', 'Belfast'],
  ['country', 'United Kingdom'],
  ['founded', '1900'],
  ['closed', '1980'],
  ['yard', 'Test Yard'],
  ['parentCompany', 'Parent Co.'],
  ['builderNotes', 'Curatorial builder notes.'],
  ['status', 'review'],
  ['confidence', 'probable'],
  ['tags', 'Shipbuilder, Belfast']
]);

const created = controller.createFromForm(form);
assert.equal(created.type, 'company');
assert.equal(created.data.city, 'Belfast');
assert.equal(created.data.yard, 'Test Yard');
assert.deepEqual(created.tags, ['Shipbuilder', 'Belfast']);

const updateForm = new Map(form);
updateForm.set('title', 'Updated Builder');
updateForm.set('city', 'Glasgow');
updateForm.set('confidence', 'verified');
const updated = controller.updateFromForm(created.id, updateForm);
assert.equal(updated.title, 'Updated Builder');
assert.equal(updated.data.city, 'Glasgow');
assert.equal(updated.metadata.confidence, 'verified');

const createDialog = renderBuilderAuthoringDialog();
const editDialog = renderBuilderAuthoringDialog({ record: updated });
assert.match(createDialog, /Create builder/);
assert.match(createDialog, /data-create-builder-form/);
assert.match(editDialog, /Edit builder/);
assert.match(editDialog, /data-edit-builder-form/);
assert.match(editDialog, /Updated Builder/);

console.log('Builder authoring tests passed.');
