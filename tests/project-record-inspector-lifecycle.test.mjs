import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../preview/records-browser.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../preview/records-browser.css', import.meta.url), 'utf8');

test('Project Record inspector uses a fixed overlay instead of native dialog', () => {
  const start = source.indexOf('function openRecordInspector');
  const end = source.indexOf('function renderIdentity', start);
  const block = source.slice(start, end);

  assert.match(block, /document\.createElement\('div'\)/);
  assert.match(block, /setAttribute\('role', 'dialog'\)/);
  assert.match(block, /setAttribute\('aria-modal', 'true'\)/);
  assert.doesNotMatch(block, /showModal\(/);
  assert.doesNotMatch(block, /addEventListener\('cancel'/);
  assert.match(css, /#project-record-inspector\{position:fixed/);
  assert.match(css, /z-index:10020/);
});

test('Project Record inspector closes without calling native dialog close', () => {
  const match = source.match(/function closeInspector\(\) \{[^}]+\}/);
  assert.ok(match);
  assert.doesNotMatch(match[0], /\.close\(/);
  assert.match(match[0], /dialog\.remove\(\)/);
});
