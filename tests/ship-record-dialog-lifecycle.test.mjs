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


test('Discovery Candidate uses an explicit touch toggle backed by the saved checkbox boolean', () => {
  assert.match(source, /data-discovery-toggle/);
  assert.match(source, /function bindDiscoveryCandidateToggle\(root\)/);
  assert.match(source, /input\.checked=!input\.checked/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /id="ship-discovery-candidate" type="checkbox" hidden/);
  assert.match(css, /\.ship-discovery-toggle\{/);
  assert.match(css, /touch-action:manipulation/);
});
