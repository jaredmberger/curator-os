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
const { PhotoMediaAuthoringController, renderPhotoMediaAuthoringDialog } = await import('../src/ui/photo-media-authoring.js');

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
service.create({ id: 'source.photo-archive', type: 'source', title: 'Photo archive' });
service.create({ id: 'object.menu', type: 'object', title: 'Menu' });

const controller = new PhotoMediaAuthoringController(service);
const form = new Map([
  ['id', 'photo.olympic-profile'],
  ['title', 'RMS Olympic profile view'],
  ['summary', 'A starboard profile photograph of RMS Olympic.'],
  ['mediaType', 'photograph'],
  ['date', '1911'],
  ['creator', 'Unknown photographer'],
  ['depictedSubject', 'ship.olympic'],
  ['associatedRecord', 'object.menu'],
  ['sourceRecord', 'source.photo-archive'],
  ['rights', 'Reference use only'],
  ['attribution', 'Courtesy of the photo archive'],
  ['caption', 'RMS Olympic underway.'],
  ['altText', 'RMS Olympic seen in profile at sea'],
  ['url', 'https://example.com/olympic.jpg'],
  ['mediaNotes', 'Catalog test record.'],
  ['status', 'review'],
  ['confidence', 'probable'],
  ['tags', 'Photographic reference, RMS Olympic']
]);

const created = controller.createFromForm(form);
assert.equal(created.type, 'photo');
assert.equal(created.data.mediaType, 'photograph');
assert.equal(created.data.altText, 'RMS Olympic seen in profile at sea');
assert.equal(created.relationships.length, 3);
assert.deepEqual(created.relationships.map((item) => item.relationship).sort(), ['associated_with', 'depicts', 'sourced_from']);

service.update(created.id, {
  relationships: [...created.relationships, {
    target: 'ship.other',
    relationship: 'compares_with',
    confidence: 'tentative',
    sourceIds: [],
    note: ''
  }]
});

const editForm = new Map(form);
editForm.set('caption', 'Updated caption.');
editForm.set('associatedRecord', '');
const updated = controller.updateFromForm(created.id, editForm);
assert.equal(updated.data.caption, 'Updated caption.');
assert.equal(updated.relationships.some((item) => item.relationship === 'associated_with'), false);
assert.equal(updated.relationships.some((item) => item.relationship === 'compares_with'), true);

const dialog = renderPhotoMediaAuthoringDialog({ records: service.all(), record: updated });
assert.match(dialog, /Edit photo or media/);
assert.match(dialog, /Rights/);
assert.match(dialog, /Attribution/);
assert.match(dialog, /Alt text/);
assert.match(dialog, /source\.photo-archive/);
assert.match(dialog, /readonly/);

console.log('Photo and media authoring tests passed.');
