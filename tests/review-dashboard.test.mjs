import assert from 'node:assert/strict';
import { analyzeReviewQueue, renderReviewDashboard } from '../src/ui/review-dashboard.js';

const records = [
  {
    id: 'ship.complete',
    type: 'ship',
    title: 'Complete Ship',
    summary: 'Complete record.',
    status: 'published',
    tags: [],
    relationships: [
      { target: 'company.builder', relationship: 'built_by', confidence: 'verified', sourceIds: ['source.one'] },
      { target: 'company.line', relationship: 'operated_by', confidence: 'verified', sourceIds: ['source.one'] }
    ],
    sources: [],
    data: { builder: 'company.builder', operator: 'company.line', launchDate: '1910-01-01', maidenVoyage: '1911-01-01', grossTonnage: '10,000 GRT' },
    metadata: { confidence: 'verified', reviewed: '2026-07-25' }
  },
  {
    id: 'ship.review-me',
    type: 'ship',
    title: 'Review Me',
    summary: '',
    status: 'draft',
    tags: [],
    relationships: [{ target: 'company.missing', relationship: 'operated_by', confidence: 'unknown', sourceIds: [] }],
    sources: [],
    data: {},
    metadata: { confidence: 'unknown', reviewed: null }
  },
  {
    id: 'company.line',
    type: 'company',
    title: 'Line',
    summary: 'Shipping company.',
    status: 'review',
    tags: ['Shipping line'],
    relationships: [],
    sources: [],
    data: { country: 'United Kingdom', founded: '1900', routeFocus: 'North Atlantic' },
    metadata: { confidence: 'probable', reviewed: null }
  },
  {
    id: 'company.builder',
    type: 'company',
    title: 'Builder',
    summary: 'Shipbuilder.',
    status: 'review',
    tags: ['Shipbuilder'],
    relationships: [],
    sources: [{ id: 'source.one', title: 'Source One' }],
    data: { country: 'United Kingdom', founded: '1900', yard: 'Main yard' },
    metadata: { confidence: 'probable', reviewed: '2026-07-25' }
  },
  {
    id: 'source.one',
    type: 'source',
    title: 'Source One',
    summary: 'Source record.',
    status: 'published',
    tags: [],
    relationships: [],
    sources: [],
    metadata: { confidence: 'verified', reviewed: '2026-07-25' }
  },
  {
    id: 'photo.orphan',
    type: 'photo',
    title: 'Duplicate View',
    summary: 'Orphaned photo.',
    status: 'draft',
    tags: [],
    relationships: [],
    sources: [],
    metadata: { confidence: 'probable', reviewed: '2026-07-25' }
  },
  {
    id: 'object.duplicate',
    type: 'object',
    title: 'duplicate view',
    summary: 'Reference object.',
    status: 'draft',
    tags: [],
    relationships: [],
    sources: [],
    metadata: { confidence: 'probable', reviewed: '2026-07-25' }
  }
];

const queue = analyzeReviewQueue(records);
const reviewShip = queue.find((item) => item.record.id === 'ship.review-me');
assert.ok(reviewShip);
assert.ok(reviewShip.issues.some((issue) => issue.id === 'missing-builder' && issue.severity === 'blocker'));
assert.ok(reviewShip.issues.some((issue) => issue.id === 'broken-relationship' && issue.category === 'relationship'));
assert.ok(reviewShip.issues.some((issue) => issue.label === 'Missing summary'));
assert.ok(reviewShip.issues.some((issue) => issue.label === 'Confidence is unknown'));

const line = queue.find((item) => item.record.id === 'company.line');
assert.ok(line.issues.some((issue) => issue.label === 'No linked sources'));
assert.ok(line.issues.some((issue) => issue.label === 'Record has not been reviewed'));

const orphan = queue.find((item) => item.record.id === 'photo.orphan');
assert.ok(orphan.issues.some((issue) => issue.id === 'orphaned-record'));
assert.ok(orphan.issues.some((issue) => issue.id === 'duplicate-title'));
assert.equal(queue.some((item) => item.record.id === 'ship.complete'), false);

const html = renderReviewDashboard(records);
assert.match(html, /Publication health/);
assert.match(html, /data-review-severity="blocker"/);
assert.match(html, /data-review-category="relationship"/);
assert.match(html, /data-review-type-filter/);
assert.match(html, /data-review-record="ship\.review-me"/);
assert.match(html, /Missing ship builder/);
assert.match(html, /Duplicate-looking title/);

console.log('Review dashboard tests passed.');
