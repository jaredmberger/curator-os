import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../preview/ship-record.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../preview/ship-record.css', import.meta.url), 'utf8');

test('Ship Record editor no longer depends on the native dialog API', () => {
  assert.match(source, /function ensureShipEditorHost\(\)/);
  assert.match(source, /host\.setAttribute\('role','dialog'\)/);
  assert.match(source, /host\.hidden=false/);
  assert.doesNotMatch(source, /showModal\(/);
  assert.doesNotMatch(source, /\.close\(\)/);
  assert.match(css, /#ship-record-editor\[hidden\]\{display:none!important\}/);
  assert.match(css, /position:fixed/);
});

test('Create Ship Record uses delegated click handling that survives Project Records rerenders', () => {
  assert.match(source, /document\.addEventListener\('click',handleShipRecordEditorClick\)/);
  assert.match(source, /closest\?\.\('\[data-create-ship-record\]'\)/);
  assert.doesNotMatch(source, /ship\.addEventListener\('click'/);
  assert.doesNotMatch(source, /stopPropagation\(\)/);
  assert.doesNotMatch(source, /setTimeout\(\(\)=>openShipEditor\(null\),0\)/);
});
