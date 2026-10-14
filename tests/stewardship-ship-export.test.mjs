import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('archive export reads authoritative archive without writing site files',()=>{
 const w=readFileSync(new URL('../.github/workflows/ship-stewardship-export.yml',import.meta.url),'utf8');
 assert.match(w,/repository: jaredmberger\/Ocean-Liner-Curator/);
 assert.match(w,/internal-link-audit\.mjs --json/);
 assert.match(w,/verify-ship-export\.mjs/);
 assert.match(w,/upload-artifact@v4/);
 assert.equal(w.includes('git push'),false);
 assert.equal(w.includes('pull_request_target'),false);
});
test('verification requires source revision and sufficient guide coverage',()=>{
 const v=readFileSync(new URL('../tools/stewardship/verify-ship-export.mjs',import.meta.url),'utf8');
 assert.match(v,/validateInventory/);
 assert.match(v,/listedGuides<300/);
 assert.match(v,/linkObservations<300/);
 assert.match(v,/historicalAccuracy==='not-assessed'/);
});
