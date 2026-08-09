import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../preview/index.html', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../preview/app-shell.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../preview/rebuilt.css', import.meta.url), 'utf8');
const shellStyles = fs.readFileSync(new URL('../preview/app-shell.css', import.meta.url), 'utf8');

// Current v0.9 production surface: permanent records first, with the legacy
// rebuilt.js / Findings dashboard intentionally retired from the live app.
assert.match(html, /rebuilt\.css/);
assert.match(html, /app-shell\.css/);
assert.match(html, /app-shell\.js/);
assert.match(html, /data-view="records"/);
assert.match(html, /Project Records/);
assert.match(html, /id="research-desk"/);
assert.match(html, /id="research-queue"/);
assert.match(html, /id="conclusion-review"/);
assert.match(html, /id="knowledge-promotion"/);
assert.match(html, /id="incorporation-review"/);

// Legacy product-surface controls should stay retired.
assert.doesNotMatch(html, /\.\/rebuilt\.js/);
assert.doesNotMatch(html, /id="load-catalog"/);
assert.doesNotMatch(html, /id="import-scan"/);
assert.doesNotMatch(html, /id="command"/);
assert.doesNotMatch(html, /id="quick-backup"/);
assert.doesNotMatch(html, /data-view="findings"/);

assert.match(shell, /recordsButton/);
assert.match(shell, /Project Records/);
assert.match(shell, /click/);

assert.match(styles, /@media\(max-width:900px\)/);
assert.match(shellStyles, /nav-group-label/);
assert.match(shellStyles, /overflow-y:auto/);

const databaseSource = fs.readFileSync(new URL('../src/core/database.js', import.meta.url), 'utf8');
const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(databaseSource, context);
assert.equal(typeof context.globalThis.CuratorDatabase?.assertDatabase, 'function');
assert.equal(context.globalThis.CuratorDatabase.SCHEMA_VERSION, 1);

console.log('current CuratorOS production surface stability checks passed');
