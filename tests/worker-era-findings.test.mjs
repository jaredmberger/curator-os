import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../preview/index.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../preview/rebuilt.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../preview/rebuilt.css', import.meta.url), 'utf8');

assert.match(html, /rebuilt\.css/);
assert.match(html, /rebuilt\.js/);
assert.match(html, /id="load-catalog"/);
assert.match(html, /id="import-scan"/);
assert.match(html, /id="command"/);
assert.match(html, /id="quick-backup"/);
assert.match(html, /id="catalog-file"/);
assert.match(html, /id="scan-file"/);

assert.match(source, /addEventListener\('click'/);
assert.match(source, /addEventListener\('input'/);
assert.match(source, /addEventListener\('change'/);
assert.match(source, /All categories/);
assert.match(source, /All priorities/);
assert.match(source, /Mark handled/);
assert.match(source, /Quick Backup|quick-backup/);
assert.doesNotMatch(source, /safari-touch-activation/);
assert.doesNotMatch(source, /dispatchEvent\(new MouseEvent/);

assert.match(styles, /\.filters/);
assert.match(styles, /@media\(max-width:900px\)/);

const databaseSource = fs.readFileSync(new URL('../src/core/database.js', import.meta.url), 'utf8');
const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(databaseSource, context);
assert.equal(typeof context.globalThis.CuratorDatabase?.assertDatabase, 'function');
assert.equal(context.globalThis.CuratorDatabase.SCHEMA_VERSION, 1);

console.log('rebuilt CuratorOS findings stability checks passed');
