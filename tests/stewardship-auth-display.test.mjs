import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAuthorizationStage} from '../preview/stewardship-auth-display.js';
const doc=()=>{const result={textContent:''};return {result,getElementById:()=>result};};
test('empty diagnostic HTTP 404 is identified without implying success',async()=>{
 const d=doc();await checkAuthorizationStage({doc:d,fetcher:async()=>({status:404,ok:false})});
 assert.match(d.result.textContent,/HTTP 404/);
});
test('only explicitly allowed stage names display',async()=>{
 const d=doc();await checkAuthorizationStage({doc:d,fetcher:async()=>({status:200,ok:true,headers:new Headers({'content-type':'application/json'}),text:async()=>JSON.stringify({available:true,stage:'sensitive-token-value'})})});
 assert.equal(d.result.textContent,'Unexpected diagnostic response. No status inferred.');
});
test('valid bounded stage displays without token or claims',async()=>{
 const d=doc();await checkAuthorizationStage({doc:d,fetcher:async()=>({status:200,ok:true,headers:new Headers({'content-type':'application/json'}),text:async()=>JSON.stringify({available:true,stage:'signed_assertion_missing'})})});
 assert.equal(d.result.textContent,'Diagnostic stage: signed_assertion_missing');
});
