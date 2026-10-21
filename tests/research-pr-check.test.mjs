import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/research-pr-check.js';
const base='https://curator.example/api/research-pr-check?pr=';
const context=pr=>({request:new Request(base+encodeURIComponent(pr)),env:{CURATOROS_RECORDS:{}}});
test('rejects unknown repos and malformed links before fetch',async()=>{
 assert.equal((await onRequestGet(context('https://github.com/other/repo/pull/2'))).status,400);
 assert.equal((await onRequestGet(context('https://github.com/jaredmberger/Ocean-Liner-Curator/pull/1/extra'))).status,400);
});
test('reports live merge without conflating deployment',async()=>{
 const before=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({number:594,title:'Provenance fix',state:'closed',draft:false,merged:true,merged_at:'2026-10-21T00:00:00Z',base:{ref:'main',repo:{full_name:'jaredmberger/Ocean-Liner-Curator'}},head:{sha:'abc'}}),{status:200});
 try{
  const r=await onRequestGet(context('https://github.com/jaredmberger/Ocean-Liner-Curator/pull/594')),data=await r.json();
  assert.equal(data.merged,true);assert.equal(data.deployment_verified,false);assert.equal(data.base,'main');
 }finally{globalThis.fetch=before;}
});
test('fails closed if GitHub cannot confirm',async()=>{
 const before=globalThis.fetch;globalThis.fetch=async()=>new Response('rate-limited',{status:403});
 try{assert.equal((await onRequestGet(context('https://github.com/jaredmberger/Ocean-Liner-Curator/pull/594'))).status,502);}
 finally{globalThis.fetch=before;}
});
