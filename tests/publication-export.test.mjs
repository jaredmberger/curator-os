import assert from 'node:assert/strict';
import { buildPublicationPackage, buildPublicationPayload, renderPublicationExportDialog } from '../src/ui/publication-export.js';

const records = [
  {
    id: 'ship.olympic',
    type: 'ship',
    title: 'RMS Olympic',
    summary: 'Lead ship of the Olympic class.',
    status: 'published',
    tags: ['White Star Line'],
    relationships: [
      { target: 'company.harland-wolff', relationship: 'built_by', confidence: 'verified', sourceIds: ['source.builder-records'] },
      { target: 'company.white-star-line', relationship: 'operated_by', confidence: 'verified', sourceIds: ['source.builder-records'] }
    ],
    sources: [{ id: 'source.builder-records', title: 'Builder records', type: 'archive' }],
    data: { builder: 'company.harland-wolff', operator: 'company.white-star-line', launchDate: '1910-10-20', maidenVoyage: '1911-06-14', grossTonnage: '45,324 GRT' },
    metadata: { confidence: 'verified', reviewed: '2026-07-25' }
  },
  { id: 'company.harland-wolff', type: 'company', title: 'Harland and Wolff', summary: 'Belfast shipbuilder.', status: 'review', tags: ['Shipbuilder'], relationships: [], sources: [{ id: 'source.builder-records', title: 'Builder records' }], data: { city: 'Belfast', country: 'United Kingdom', founded: '1861', yard: 'Queen’s Island' }, metadata: { confidence: 'probable', reviewed: '2026-07-25' } },
  { id: 'company.white-star-line', type: 'company', title: 'White Star Line', summary: 'British shipping line.', status: 'review', tags: ['Shipping line'], relationships: [], sources: [{ id: 'source.builder-records', title: 'Builder records' }], data: { country: 'United Kingdom', headquarters: 'Liverpool', founded: '1845', routeFocus: 'North Atlantic passenger service' }, metadata: { confidence: 'probable', reviewed: '2026-07-25' } },
  { id: 'source.builder-records', type: 'source', title: 'Builder records', summary: 'Primary documentation.', status: 'published', tags: ['Primary source'], relationships: [], sources: [], data: { sourceType: 'archive', citation: 'Harland and Wolff builder records.' }, metadata: { confidence: 'verified', reviewed: '2026-07-25' } },
  { id: 'ship.blocked', type: 'ship', title: 'Blocked Ship', summary: '', status: 'draft', tags: [], relationships: [], sources: [], data: {}, metadata: { confidence: 'unknown' } }
];

const payload = buildPublicationPayload(records[0], records);
assert.equal(payload.format, 'curatoros-publication-record');
assert.equal(payload.record.type, 'ship');
assert.equal(payload.record.details.Builder, 'Harland and Wolff');
assert.equal(payload.record.sources[0].title, 'Builder records');
assert.equal(payload.structuredData['@type'], 'Vehicle');
assert.equal(payload.structuredData.manufacturer, 'Harland and Wolff');
assert.equal(payload.readiness.ready, true);

assert.throws(() => buildPublicationPayload(records.at(-1), records), /Publication is blocked/);
assert.throws(() => buildPublicationPayload(records[3], records), /not supported/);

const batch = buildPublicationPackage(records);
assert.equal(batch.summary.eligible, 4);
assert.equal(batch.summary.exported, 3);
assert.equal(batch.summary.blocked, 1);
assert.equal(batch.blocked[0].id, 'ship.blocked');

const html = renderPublicationExportDialog(records, 'ship.olympic');
assert.match(html, /Export publication data/);
assert.match(html, /Export selected JSON/);
assert.match(html, /3 ready · 1 blocked · 4 eligible/);

console.log('Publication export tests passed.');
