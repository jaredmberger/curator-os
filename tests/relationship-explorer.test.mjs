import assert from 'node:assert/strict';
import { buildRelationshipExplorer, renderRelationshipExplorer } from '../src/ui/relationship-explorer.js';

const records = [
  {
    id: 'ship.olympic',
    type: 'ship',
    title: 'RMS Olympic',
    relationships: [
      { target: 'company.harland-wolff', relationship: 'built_by', confidence: 'verified' },
      { target: 'company.missing', relationship: 'operated_by', confidence: 'unknown' }
    ]
  },
  { id: 'company.harland-wolff', type: 'company', title: 'Harland and Wolff', relationships: [] },
  { id: 'object.menu', type: 'object', title: 'Olympic Menu', relationships: [{ target: 'ship.olympic', relationship: 'associated_with', confidence: 'verified' }] },
  { id: 'source.orphan', type: 'source', title: 'Orphan Source', relationships: [] }
];

const view = buildRelationshipExplorer(records, 'ship.olympic');
assert.equal(view.selected.id, 'ship.olympic');
assert.equal(view.groups.length, 3);
assert.ok(view.groups.some((group) => group.direction === 'outgoing' && group.relationship === 'built_by'));
assert.ok(view.groups.some((group) => group.direction === 'incoming' && group.relationship === 'associated_with'));
assert.ok(view.groups.flatMap((group) => group.links).some((link) => link.broken && link.targetId === 'company.missing'));
assert.deepEqual(view.orphaned.map((record) => record.id), ['source.orphan']);

const html = renderRelationshipExplorer(records, 'ship.olympic');
assert.match(html, /Relationship explorer/);
assert.match(html, /Harland and Wolff/);
assert.match(html, /Broken target/);
assert.match(html, /data-explore-record="object\.menu"/);
assert.match(html, /1 orphaned record/);

console.log('Relationship explorer tests passed.');
