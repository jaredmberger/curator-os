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
const {
  StructuredRecordAuthoringService,
  parseStructuredList,
  stringifyStructuredList
} = await import('../src/ui/structured-record-authoring.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
const records = new RecordService({ storage });
const authoring = new StructuredRecordAuthoringService(records);

const company = authoring.createRecord({
  id: 'company.white-star-line',
  type: 'company',
  title: 'White Star Line',
  status: 'published',
  metadata: { confidence: 'verified' }
});
assert.equal(company.id, 'company.white-star-line');

const ship = authoring.createRecord({
  id: 'ship.olympic',
  type: 'ship',
  title: 'RMS Olympic',
  tags: ['White Star Line']
});
assert.equal(ship.status, 'draft');

const related = authoring.updateRelationships('ship.olympic', [{
  target: 'company.white-star-line',
  relationship: 'operated_by',
  confidence: 'verified',
  sourceIds: ['source.builder-records']
}]);
assert.equal(related.relationships[0].target, 'company.white-star-line');

const sourced = authoring.updateSources('ship.olympic', [{
  id: 'source.builder-records',
  title: 'Builder records',
  type: 'archive'
}]);
assert.equal(sourced.sources[0].title, 'Builder records');

const media = authoring.updateMedia('ship.olympic', [{
  id: 'media.olympic-profile',
  title: 'Olympic profile',
  type: 'image',
  alt: 'RMS Olympic at sea'
}]);
assert.equal(media.media[0].alt, 'RMS Olympic at sea');

const noted = authoring.updateNotes('ship.olympic', ['Check launch-date citation.']);
assert.equal(noted.notes[0].kind, 'curatorial');

assert.throws(
  () => authoring.removeRecord('company.white-star-line'),
  /incoming relationship/,
  'prevents deletion while linked records remain'
);
assert.equal(authoring.removeRecord('ship.olympic'), true);
assert.equal(authoring.removeRecord('company.white-star-line'), true);

const values = [{ id: 'one', title: 'One' }, { id: 'two', title: 'Two' }];
assert.deepEqual(parseStructuredList(stringifyStructuredList(values)), values);

const reloaded = new RecordService({ storage });
assert.equal(reloaded.all().length, 0, 'persists structured creates and removals');

console.log('Structured record authoring tests passed.');
