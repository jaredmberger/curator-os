import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/ui/worker-era-shell.js', import.meta.url), 'utf8');
assert.match(source, /No actionable findings were detected/);
assert.match(source, /sourceType === sourceType/);
assert.match(source, /safeUrl\(/);
assert.match(source, /removeEventListener\('click'/);
assert.match(source, /\uFEFF/);

const databaseSource = fs.readFileSync(new URL('../src/core/database.js', import.meta.url), 'utf8');
const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(databaseSource, context);
assert.equal(typeof context.globalThis.CuratorDatabase?.assertDatabase, 'function');
assert.equal(context.globalThis.CuratorDatabase.SCHEMA_VERSION, 1);

console.log('worker-era findings stability checks passed');
