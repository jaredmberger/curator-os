import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('inspector reports safe, bounded snapshot errors without exposing upstream strings',()=>{
 const s=readFileSync(new URL('../preview/ship-inspector.js',import.meta.url),'utf8');
 assert.match(s,/allowed\.has\(envelope\.reason\)/);
 assert.match(s,/snapshot_binding_unavailable/);
 assert.match(s,/authorization_unavailable/);
 assert.match(s,/non_json_response/);
 assert.match(s,/No ship health can be inferred/);
 assert.equal(s.includes('innerHTML'),false);
});
