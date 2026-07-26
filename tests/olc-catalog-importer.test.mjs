import assert from 'node:assert/strict';
import { detectOlcCatalog, importOlcCatalog } from '../src/core/olc-catalog-importer.js';

const manifest = {
  ships: [{ name: 'RMS Olympic', slug: 'rms-olympic', builder: 'Harland and Wolff', line: 'White Star Line', launchDate: '1910-10-20', status: 'published', confidence: 'verified' }],
  builders: [{ name: 'Harland and Wolff', slug: 'harland-and-wolff', city: 'Belfast' }],
  shippingLines: [{ name: 'White Star Line', slug: 'white-star-line', headquarters: 'Liverpool' }],
  sources: [{ name: 'Builder records', slug: 'builder-records', sourceType: 'archive', citation: 'Builder archive.' }]
};

assert.equal(detectOlcCatalog(manifest), 'olc-manifest');
const result = importOlcCatalog(manifest);
assert.equal(result.report.input, 4);
assert.equal(result.report.converted, 4);
assert.equal(result.report.errors.length, 0);
assert.equal(result.records[0].id, 'ship.rms-olympic');
assert.equal(result.records[0].type, 'ship');
assert.ok(result.records[0].relationships.some((item) => item.relationship === 'built_by'));
assert.ok(result.records[1].tags.includes('Shipbuilder'));
assert.ok(result.records[2].tags.includes('Shipping line'));

const duplicate = importOlcCatalog([{ name: 'A', type: 'ship' }, { name: 'A', type: 'ship' }]);
assert.equal(duplicate.records.length, 1);
assert.equal(duplicate.report.skipped.length, 1);

assert.throws(() => importOlcCatalog({ nonsense: true }), /not a recognized/);
console.log('OLC catalog importer tests passed.');
