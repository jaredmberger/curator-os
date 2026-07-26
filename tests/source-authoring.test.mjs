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
const { SourceAuthoringController, renderSourceAuthoringDialog } = await import('../src/ui/source-authoring.js');

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
const controller = new SourceAuthoringController(service);

const createForm = new Map([
  ['id', 'source.test-archive'],
  ['title', 'Test Archive Record'],
  ['summary', 'A source authoring test record.'],
  ['creator', 'Archive Creator'],
  ['publisher', 'Maritime Archive'],
  ['sourceType', 'archive'],
  ['date', '1910'],
  ['url', 'https://example.com/source'],
  ['identifier', 'CALL-123'],
  ['accessDate', '2026-07-26'],
  ['citation', 'Archive Creator, Test Archive Record, 1910.'],
  ['rights', 'Reference use only.'],
  ['sourceNotes', 'Curatorial note.'],
  ['status', 'review'],
  ['confidence', 'probable'],
  ['tags', 'Primary source, archive']
]);

const created = controller.createFromForm(createForm);
assert.equal(created.type, 'source');
assert.equal(created.data.creator, 'Archive Creator');
assert.equal(created.data.identifier, 'CALL-123');
assert.deepEqual(created.tags, ['Primary source', 'archive']);

const editForm = new Map([
  ['id', 'source.test-archive'],
  ['title', 'Updated Archive Record'],
  ['summary', 'Updated source summary.'],
  ['creator', 'Updated Creator'],
  ['publisher', 'Updated Archive'],
  ['sourceType', 'finding aid'],
  ['date', '1911'],
  ['url', 'https://example.com/updated'],
  ['identifier', 'CALL-456'],
  ['accessDate', '2026-07-27'],
  ['citation', 'Updated citation text.'],
  ['rights', 'Permission required.'],
  ['sourceNotes', 'Updated note.'],
  ['status', 'published'],
  ['confidence', 'verified'],
  ['tags', 'Primary source, finding aid']
]);

const updated = controller.updateFromForm(created.id, editForm);
assert.equal(updated.id, created.id);
assert.equal(updated.title, 'Updated Archive Record');
assert.equal(updated.data.sourceType, 'finding aid');
assert.equal(updated.metadata.confidence, 'verified');

const dialog = renderSourceAuthoringDialog({ record: updated });
assert.match(dialog, /Edit source/);
assert.match(dialog, /data-edit-source-form/);
assert.match(dialog, /Citation text/);
assert.match(dialog, /Identifier or call number/);
assert.match(dialog, /readonly/);

console.log('Source authoring tests passed.');
