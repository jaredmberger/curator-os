import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../preview/ship-record.js', import.meta.url), 'utf8');

test('Ship Record editor uses a persistent dialog host', () => {
  assert.match(source, /function ensureShipEditorHost\(\)/);
  assert.match(source, /dialog=ensureShipEditorHost\(\)/);
  assert.doesNotMatch(source, /document\.querySelector\('#ship-record-editor'\)\?\.remove\(\)/);
  assert.match(source, /if\(d\.open\)d\.close\(\)/);
  assert.match(source, /d\.innerHTML=''/);
});

test('Create Ship Record click opens directly without propagation suppression or deferred timer', () => {
  assert.match(source, /ship\.addEventListener\('click',\(\)=>openShipEditor\(null\)\)/);
  assert.doesNotMatch(source, /stopPropagation\(\)/);
  assert.doesNotMatch(source, /setTimeout\(\(\)=>openShipEditor\(null\),0\)/);
});
