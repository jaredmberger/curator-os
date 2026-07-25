const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Date, JSON, Map, Set, globalThis: {} });
for (const file of ['src/core/database.js', 'src/core/storage.js', 'src/core/relationships.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const api = vm.runInContext('({ CuratorDatabase, CuratorStorage, CuratorRelationships })', context);
const olympic = api.CuratorDatabase.createRecord({
  id: 'ship.rms_olympic',
  type: 'ship',
  title: 'RMS Olympic',
  status: 'published',
  metadata: { confidence: 'verified' }
});
const builder = api.CuratorDatabase.createRecord({
  id: 'company.harland_wolff',
  type: 'company',
  title: 'Harland & Wolff',
  metadata: { confidence: 'verified' }
});
olympic.relationships.push(api.CuratorRelationships.create({
  target: builder.id,
  relationship: 'built_by',
  confidence: 'verified'
}));

const database = api.CuratorDatabase.createDatabase([olympic, builder]);
assert.equal(api.CuratorDatabase.validateDatabase(database).length, 0);
assert.equal(api.CuratorRelationships.validateIntegrity(database).length, 0);
assert.equal(api.CuratorRelationships.incoming(database, builder.id)[0].source, olympic.id);

const serialized = api.CuratorStorage.serialize(database);
const restored = api.CuratorStorage.deserialize(serialized);
assert.equal(restored.records.length, 2);
assert.equal(restored.records[0].title, 'RMS Olympic');

assert.throws(() => api.CuratorDatabase.createRecord({ id: 'bad id', type: 'ship', title: 'Bad' }));
const broken = api.CuratorDatabase.createDatabase([olympic]);
assert.equal(api.CuratorRelationships.validateIntegrity(broken).length, 1);

console.log('CuratorOS database core tests passed.');
