import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest,createOpsHandler} from '../functions/api/stewardship-ops.js';
const url='https://curator.oceanliners.net/api/stewardship-ops';
const req=(method='GET')=>new Request(url,{method});
const payload=()=>({ok:true,snapshot:{
 generatedAt:new Date().toISOString(),status:'degraded',
 summary:{sources:1,activeFindings:1},
 sources:[{id:'reachability',freshnessState:'fresh',data:{token:'SECRET_DO_NOT_EXPOSE'}}],
 findings:[{id:'service:public-site',role:'root',severity:'attention',message:'SECRET_DO_NOT_EXPOSE',evidence:{token:'SECRET_DO_NOT_EXPOSE'}}]
}});
const ops=()=>({fetch:async()=>new Response(JSON.stringify(payload()),{headers:{'content-type':'application/json'}})});
const env=()=>({STEWARDSHIP_OPS_READ_ENABLED:'true',CURATOR_OPS:ops()});
const tested=(auth=true)=>createOpsHandler(()=>({authorize:async()=>auth}));
test('feature switch off: no authorization or upstream fetch',async()=>{
 let calls=0;const e={CURATOR_OPS:{fetch:()=>{calls++;throw Error('should not fetch')}}};
 const r=await onRequest({request:req(),env:e});assert.equal(r.status,404);assert.equal(calls,0);
});
test('missing, rejected, throwing authorizer: denies without fetch',async()=>{
 for(const mode of ['missing','deny','throw']){
  let calls=0;const e=env();e.CURATOR_OPS.fetch=async()=>{calls++;throw Error('unexpected fetch')};
  const handler=mode==='missing'?onRequest:mode==='deny'?tested(false):createOpsHandler(()=>({authorize:async()=>{throw Error('auth unavailable')}}));
  const r=await handler({request:req(),env:e});assert.equal(r.status,403);assert.equal(calls,0);
 }
});
test('unsupported methods fail before authorization',async()=>{
 const r=await onRequest({request:req('POST'),env:env()});assert.equal(r.status,405);
});
test('allowed request returns strictly sanitized scoped state',async()=>{
 const r=await tested()({request:req(),env:env()});assert.equal(r.status,200);
 const raw=await r.text();assert.equal(raw.includes('SECRET_DO_NOT_EXPOSE'),false);
 const data=JSON.parse(raw);assert.equal(data.coverage.completeness,'operational-state-only');assert.equal(data.findings[0].role,'root');
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('upstream redirect, auth errors, and invalid JSON fail closed',async()=>{
 for(const response of [
  new Response(null,{status:302,headers:{location:'https://example.org/'}}),
  new Response(null,{status:403}),
  new Response('<html/>',{headers:{'content-type':'text/html'}})
 ]){
  const e=env();e.CURATOR_OPS.fetch=async()=>response;
  const r=await tested()({request:req(),env:e});assert.equal(r.status,503);
 }
});
test('stale snapshot cannot look healthy',async()=>{
 const e=env();e.CURATOR_OPS.fetch=async()=>{const p=payload();p.snapshot.generatedAt='2020-01-01T00:00:00Z';return new Response(JSON.stringify(p),{headers:{'content-type':'application/json'}})};
 const r=await tested()({request:req(),env:e});assert.equal(r.status,503);
});

test('actual deployed handler denies spoofed operator identity without Ops reads',async()=>{
 let calls=0;const e=env();e.CURATOR_OPS.fetch=async()=>{calls++;throw Error('unexpected')};
 const r=await onRequest({request:new Request(url,{headers:{'Cf-Access-Jwt-Assertion':'a.b.c','X-CF-Access-Authenticated-User-Email':'operator@example.org'}}),env:e});
 assert.equal(r.status,403);assert.equal(calls,0);
});
