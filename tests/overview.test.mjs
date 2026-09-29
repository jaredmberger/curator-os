import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../preview/index.html',import.meta.url),'utf8');
const overview=fs.readFileSync(new URL('../preview/overview.js',import.meta.url),'utf8');
const nav=fs.readFileSync(new URL('../preview/workspace-navigation.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../preview/app-shell.js',import.meta.url),'utf8');

assert.match(html,/id="overview"/);
assert.match(html,/overview\.css/);
assert.match(html,/overview\.js/);
assert.match(overview,/\/api\/device\/v1\/status/);
assert.match(overview,/Needs attention/);
assert.match(overview,/Open Research Queue items/);
assert.match(overview,/Conclusions awaiting review/);
assert.match(overview,/Ready for incorporation/);
assert.match(overview,/curatoros\.project\.storeMeta/);
assert.match(overview,/curatoros\.research\.storeMeta/);
assert.match(nav,/overview:\{selector:'#overview'\}/);
assert.doesNotMatch(shell,/setTimeout\(\(\)=>recordsButton\?\.click\(\),0\)/);

console.log('CuratorOS overview contract checks passed');
