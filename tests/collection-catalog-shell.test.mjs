import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadCanonicalGlobal(path, name) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  globalThis[name] = Function(`${source}\nreturn ${name};`)();
}

loadCanonicalGlobal('../src/core/database.js', 'CuratorDatabase');
loadCanonicalGlobal('../src/core/storage.js', 'CuratorStorage');
loadCanonicalGlobal('../src/core/relationships.js', 'CuratorRelationships');

const {
  RecordService,
  DraftService,
  SearchService,
  NavigationService,
  renderRecordCard,
  renderInspector
} = await import('../src/ui/collection-catalog-shell.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const seedRecords = [
  {
    id: 'ship.olympic',
    type: 'ship',
    title: 'RMS Olympic',
    summary: 'Lead ship of the Olympic class.',
    status: 'published',
    tags: ['White Star Line', 'Olympic class'],
    relationships: [{
      target: 'company.white-star-line',
      relationship: 'operated_by',
      confidence: 'verified',
      sourceIds: ['source.builder-records'],
      note: 'Documented in builder and company records.'
    }],
    sources: [{ id: 'source.builder-records', title: 'Builder records', type: 'archive' }],
    media: [],
    notes: [],
    metadata: { confidence: 'verified', reviewed: '2026-07-25' }
  },
  {
    id: 'company.white-star-line',
    type: 'company',
    title: 'White Star Line',
    summary: 'British shipping company.',
    status: 'review',
    tags: ['Shipping line'],
    relationships: [],
    sources: [],
    media: [],
    notes: [],
    metadata: { confidence: 'probable' }
  },
  {
    id: 'source.builder-records',
    type: 'source',
    title: 'Builder records',
    summary: 'Primary shipbuilder documentation.',
    status: 'published',
    tags: ['Primary source'],
    relationships: [],
    sources: [],
    media: [],
    notes: [],
    metadata: { confidence: 'verified' }
  }
];

const storage = new MemoryStorage();
const records = new RecordService({ storage, seedRecords });
const search = new SearchService(records);

assert.equal(records.all().length, 3, 'loads canonical seed records');
assert.equal(search.search().length, 3, 'returns all canonical records without filters');
assert.equal(search.search('olympic').length, 1, 'searches canonical titles and tags');
assert.equal(search.search('', { type: 'ship' }).length, 1, 'filters by canonical type');
assert.equal(search.search('', { status: 'published' }).length, 2, 'filters by canonical status');
assert.equal(search.search('does-not-exist').length, 0, 'returns no false positives');

const olympic = records.get('ship.olympic');
const card = renderRecordCard(olympic, true);
assert.match(card, /RMS Olympic/);
assert.match(card, /is-selected/);
assert.match(card, /ship\.olympic/);
assert.match(card, /verified/);

const relationships = records.resolveRelationships(olympic);
assert.equal(relationships.outgoing[0].targetRecord.title, 'White Star Line');
assert.equal(records.incoming('company.white-star-line')[0].sourceRecord.title, 'RMS Olympic');
assert.equal(records.resolveSources(olympic)[0].title, 'Builder records');

const inspector = renderInspector(olympic, {
  relationships,
  sources: records.resolveSources(olympic),
  editing: true,
  draft: { record: olympic, dirty: false, errors: [] }
});
assert.match(inspector, /Collection Catalog/);
assert.match(inspector, /Provenance summary/);
assert.match(inspector, /White Star Line/);
assert.match(inspector, /Builder records/);
assert.match(inspector, /Linked claims/);
assert.match(inspector, /Edit record|Close editor/);
assert.match(inspector, /All changes saved/);
assert.match(inspector, /Metadata/);

const updated = records.update('ship.olympic', {
  title: 'RMS Olympic — Revised',
  status: 'review',
  metadata: { confidence: 'probable' }
});
assert.equal(updated.title, 'RMS Olympic — Revised');
assert.equal(records.get('ship.olympic').status, 'review');
assert.equal(records.canUndo, true);
assert.equal(records.undo(), true);
assert.equal(records.get('ship.olympic').title, 'RMS Olympic');
assert.equal(records.canRedo, true);
assert.equal(records.redo(), true);
assert.equal(records.get('ship.olympic').title, 'RMS Olympic — Revised');

records.undo();
const drafts = new DraftService(records, { delay: 60000 });
drafts.begin('ship.olympic');
const dirtyDraft = drafts.patch('ship.olympic', { title: 'RMS Olympic edited' });
assert.equal(dirtyDraft.dirty, true);
assert.equal(drafts.save('ship.olympic').title, 'RMS Olympic edited');
assert.equal(records.get('ship.olympic').title, 'RMS Olympic edited');

drafts.begin('ship.olympic');
const invalidDraft = drafts.patch('ship.olympic', { title: '' });
assert.equal(invalidDraft.errors.length > 0, true, 'validates draft while editing');
assert.equal(drafts.save('ship.olympic'), false, 'does not persist invalid draft');
drafts.discard('ship.olympic');
assert.equal(records.get('ship.olympic').title, 'RMS Olympic edited');

const reloaded = new RecordService({ storage });
assert.equal(reloaded.get('ship.olympic').title, 'RMS Olympic edited', 'reloads autosaved canonical database from storage');

const nav = new NavigationService();
let opened = null;
const unsubscribe = nav.subscribe((moduleName) => { opened = moduleName; });
nav.open('atlas');
assert.equal(opened, 'atlas');
assert.equal(nav.activeModule, 'atlas');
unsubscribe();

console.log('Collection Catalog editing, history, and provenance tests passed.');
