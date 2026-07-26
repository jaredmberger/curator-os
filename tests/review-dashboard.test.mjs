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
    relationships: [{ target: 'company.line', relationship: 'operated_by', confidence: 'verified', sourceIds: ['source.one'] }],
    sources: [],
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
    metadata: { confidence: 'probable', reviewed: null }
  },
  {
    id: 'source.one',
    type: 'source',
    title: 'Source One',
    summary: 'Source record.',
    status: 'published',
    tags: [],
    relationships: [],
    sources: [{ id: 'source.one', title: 'Source One' }],
    metadata: { confidence: 'verified', reviewed: '2026-07-25' }
  }
];

const queue = analyzeReviewQueue(records);
const reviewShip = queue.find((item) => item.record.id === 'ship.review-me');
assert.ok(reviewShip);
assert.deepEqual(reviewShip.issues.map((issue) => issue.id).sort(), [
  'broken-relationship',
  'missing-summary',
  'no-sources',
  'unknown-confidence',
  'unreviewed'
]);

const line = queue.find((item) => item.record.id === 'company.line');
assert.ok(line.issues.some((issue) => issue.id === 'unreviewed'));
assert.ok(line.issues.some((issue) => issue.id === 'no-sources'));
assert.equal(queue.some((item) => item.record.id === 'ship.complete'), false);

const html = renderReviewDashboard(records);
assert.match(html, /Review dashboard/);
assert.match(html, /data-review-filter="broken-relationship"/);
assert.match(html, /data-review-record="ship\.review-me"/);
assert.match(html, /Missing summary/);

console.log('Review dashboard tests passed.');
