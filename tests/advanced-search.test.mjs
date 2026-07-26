import assert from 'node:assert/strict';
import { AdvancedSearchService, renderAdvancedSearch } from '../src/ui/advanced-search.js';

const records = [
  {
    id: 'ship.olympic', type: 'ship', title: 'RMS Olympic', summary: 'Olympic-class liner.', status: 'published',
    tags: ['White Star Line'], relationships: [{ target: 'company.harland-wolff', relationship: 'built_by', confidence: 'verified', sourceIds: ['source.builder'] }],
    sources: [], notes: [{ body: 'Yard number 400' }], data: { builder: 'company.harland-wolff', operator: 'company.white-star-line', launchDate: '1910-10-20' },
    metadata: { confidence: 'verified', reviewed: '2026-07-25', updated: '2026-07-26T04:00:00Z' }
  },
  {
    id: 'ship.draft', type: 'ship', title: 'Draft Liner', summary: '', status: 'draft', tags: ['Unpublished'], relationships: [], sources: [], notes: [], data: {},
    metadata: { confidence: 'unknown', updated: '2026-07-26T05:00:00Z' }
  },
  {
    id: 'source.builder', type: 'source', title: 'Builder Archive', summary: 'Primary builder source.', status: 'published', tags: ['Primary source'], relationships: [], sources: [], notes: [], data: { identifier: 'HW-400' },
    metadata: { confidence: 'verified', reviewed: '2026-07-25', updated: '2026-07-24T05:00:00Z' }
  }
];

const memory = new Map();
const storage = { getItem(key) { return memory.has(key) ? memory.get(key) : null; }, setItem(key, value) { memory.set(key, value); } };
const recordService = { all() { return structuredClone(records); }, get(id) { return structuredClone(records.find((item) => item.id === id) || null); } };
const service = new AdvancedSearchService(recordService, { storage });

assert.deepEqual(service.search('yard number').map((item) => item.id), ['ship.olympic']);
assert.deepEqual(service.search('HW-400').map((item) => item.id), ['source.builder']);
assert.deepEqual(service.search('', { type: 'ship', readiness: 'blocked' }).map((item) => item.id), ['ship.draft']);
assert.deepEqual(service.applyView('unpublished-ships').map((item) => item.id), ['ship.draft']);
assert.equal(service.applyView('recently-updated')[0].id, 'ship.draft');

const saved = service.saveView({ label: 'White Star ships', query: 'Olympic', filters: { type: 'ship', tag: 'White Star Line' } });
assert.equal(saved.id, 'white-star-ships');
assert.equal(service.savedViews().length, 1);
service.recordRecent('ship.olympic');
service.recordRecent('source.builder');
assert.deepEqual(service.recentRecords().map((item) => item.id), ['source.builder', 'ship.olympic']);

const html = renderAdvancedSearch(service);
assert.match(html, /Advanced search/);
assert.match(html, /Needs review/);
assert.match(html, /Recently updated/);
assert.match(html, /White Star ships/);
assert.match(html, /data-advanced-readiness/);

console.log('Advanced search tests passed.');
