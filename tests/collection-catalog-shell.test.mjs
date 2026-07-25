import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadCanonicalGlobal(path, name) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  globalThis[name] = Function(`${source}\nreturn ${name};`)();
}

loadCanonicalGlobal('../src/core/database.js', 'CuratorDatabase');
loadCanonicalGlobal('../src/core/storage.js', 'CuratorStorage');

const {
  RecordService,
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
    relationships: [{ type: 'operated_by', targetId: 'company.white-star-line' }],
    sources: [{ id: 'source.builder-records', title: 'Builder records' }],
    media: [],
    notes: [],
    metadata: { confidence: 'verified' }
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
  }
];

const storage = new MemoryStorage();
const records = new RecordService({ storage, seedRecords });
const search = new SearchService(records);

assert.equal(records.all().length, 2, 'loads canonical seed records');
assert.equal(search.search().length, 2, 'returns all canonical records without filters');
assert.equal(search.search('olympic').length, 1, 'searches canonical titles and tags');
assert.equal(search.search('', { type: 'ship' }).length, 1, 'filters by canonical type');
assert.equal(search.search('', { status: 'published' }).length, 1, 'filters by canonical status');
assert.equal(search.search('does-not-exist').length, 0, 'returns no false positives');

const olympic = records.get('ship.olympic');
const card = renderRecordCard(olympic, true);
assert.match(card, /RMS Olympic/);
assert.match(card, /is-selected/);
assert.match(card, /ship\.olympic/);
assert.match(card, /verified/);

const inspector = renderInspector(olympic);
assert.match(inspector, /Collection Catalog/);
assert.match(inspector, /Relationships/);
assert.match(inspector, /Metadata/);

const reloaded = new RecordService({ storage });
assert.equal(reloaded.get('ship.olympic').title, 'RMS Olympic', 'reloads canonical database from storage');

const nav = new NavigationService();
let opened = null;
const unsubscribe = nav.subscribe((moduleName) => { opened = moduleName; });
nav.open('atlas');
assert.equal(opened, 'atlas');
assert.equal(nav.activeModule, 'atlas');
unsubscribe();

console.log('Collection Catalog canonical record tests passed.');