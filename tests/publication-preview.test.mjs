import assert from 'node:assert/strict';
import { assessPublicationReadiness, buildPublicationPreview, renderPublicationPreview } from '../src/ui/publication-preview.js';

const records = [
  {
    id: 'ship.olympic',
    type: 'ship',
    title: 'RMS Olympic',
    summary: 'Lead ship of the Olympic class.',
    status: 'published',
    tags: ['White Star Line'],
    relationships: [
      { target: 'company.builder', relationship: 'built_by', confidence: 'verified', sourceIds: ['source.one'], note: '' },
      { target: 'company.line', relationship: 'operated_by', confidence: 'verified', sourceIds: ['source.one'], note: '' }
    ],
    sources: [],
    data: { builder: 'company.builder', operator: 'company.line', launchDate: '1910-10-20', maidenVoyage: '1911-06-14', grossTonnage: '45,324 GRT' },
    metadata: { confidence: 'verified', reviewed: '2026-07-25' }
  },
  { id: 'company.builder', type: 'company', title: 'Builder Co.', tags: ['Shipbuilder'], data: {}, metadata: { confidence: 'verified' } },
  { id: 'company.line', type: 'company', title: 'Line Co.', tags: ['Shipping line'], data: {}, metadata: { confidence: 'verified' } },
  { id: 'source.one', type: 'source', title: 'Source One', summary: 'Source.', metadata: { confidence: 'verified' } }
];

const ready = assessPublicationReadiness(records[0]);
assert.equal(ready.ready, true);
assert.deepEqual(ready.blockers, []);
assert.deepEqual(ready.warnings, []);

const blocked = assessPublicationReadiness({
  id: 'ship.incomplete',
  type: 'ship',
  title: '',
  summary: '',
  relationships: [],
  sources: [],
  data: {},
  metadata: { confidence: 'unknown' }
});
assert.equal(blocked.ready, false);
assert.ok(blocked.blockers.includes('Missing title'));
assert.ok(blocked.blockers.includes('Missing builder'));
assert.ok(blocked.blockers.includes('Missing operator'));
assert.ok(blocked.warnings.includes('No linked sources'));

const preview = buildPublicationPreview(records[0], records);
assert.equal(preview.title, 'RMS Olympic');
assert.ok(preview.details.some(([label, value]) => label === 'Builder' && value === 'Builder Co.'));
assert.equal(preview.sources[0].title, 'Source One');
assert.equal(preview.readiness.status, 'ready');

const html = renderPublicationPreview(records[0], records);
assert.match(html, /Publication preview/);
assert.match(html, /RMS Olympic/);
assert.match(html, /No publication issues found/);
assert.match(html, /Builder Co\./);
assert.match(html, /Source One/);

console.log('Publication preview tests passed.');
