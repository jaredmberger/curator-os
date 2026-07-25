import assert from 'node:assert/strict';
import {
  SearchService,
  NavigationService,
  mockRecords,
  renderRecordCard,
  renderInspector
} from '../src/ui/collection-catalog-shell.js';

const search = new SearchService(mockRecords);

assert.equal(search.search().length, 4, 'returns all records without filters');
assert.equal(search.search('olympic').length, 2, 'searches titles, tags, and metadata');
assert.equal(search.search('', { type: 'ship' }).length, 2, 'filters by type');
assert.equal(search.search('', { status: 'verified' }).length, 2, 'filters by status');
assert.equal(search.search('does-not-exist').length, 0, 'returns no false positives');

const card = renderRecordCard(mockRecords[0], true);
assert.match(card, /RMS Olympic/);
assert.match(card, /is-selected/);
assert.match(card, /SHIP-000001/);

const inspector = renderInspector(mockRecords[0]);
assert.match(inspector, /Collection Catalog/);
assert.match(inspector, /Relationships/);
assert.match(inspector, /Metadata/);

const nav = new NavigationService();
let opened = null;
const unsubscribe = nav.subscribe((moduleName) => { opened = moduleName; });
nav.open('atlas');
assert.equal(opened, 'atlas');
assert.equal(nav.activeModule, 'atlas');
unsubscribe();

console.log('Collection Catalog shell tests passed.');
