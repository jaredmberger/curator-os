import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest,createOpsHandler} from '../functions/api/stewardship-ops.js';
const req=(headers={})=>new Request('https://staging.example/api/stewardship-ops',{headers});
const protectedEnv=()=>({STEWARDSHIP_OPS_READ_ENABLED:'true'});
const auth=allowed=>createOpsHandler(()=>({authorize:async()=>allowed}));
const sample=()=>({ok:true,snapshot:{generatedAt:new Date().toISOString(),status:'degraded',summary:{sources:1,activeFindings:1},sources:[{id:'reachability',freshnessState:'stale',name:'SENSITIVE',data:{token:'NEVER_EXPOSE'}}],findings:[{id:'monitor:reachability',severity:'attention',role:'root',message:'NEVER_EXPOSE',evidence:{secret:'NEVER_EXPOSE'}}]}});
test('preview flag off prevents Ops fetch even with test authorizer',async()=>{
 let calls=0;const env={STEWARDSHIP_OPS_READ_ENABLED:'false',CURATOR_OPS:{fetch:()=>{calls++;throw Error('not called')}}};
 const r=await auth(true)({request:req(),env});
 assert.equal(r.status,404);assert.equal(calls,0);
});
test('real handler denies spoofed Access header before source is read',async()=>{
 let calls=0;const env={...protectedEnv(),CURATOR_OPS:{fetch:()=>{calls++;throw Error('not called')}}};
 const r=await onRequest({request:req({'Cf-Access-Jwt-Assertion':'a.b.c','X-CF-Access-Authenticated-User-Email':'operator@example.org'}),env});
 assert.equal(r.status,403);assert.equal(calls,0);
});
test('preview lacking Ops binding fails closed after authorization',async()=>{
 const r=await auth(true)({request:req(),env:protectedEnv()});
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{available:false,reason:'source_unavailable'});
});
test('sanitized status never includes raw source, names or evidence',async()=>{
 const env={...protectedEnv(),CURATOR_OPS:{fetch:async request=>{
  assert.equal(request.method,'GET');assert.equal(new URL(request.url).pathname,'/api/operational-state');
  return new Response(JSON.stringify(sample()),{headers:{'content-type':'application/json'}});
 }}};
 const r=await auth(true)({request:req(),env});assert.equal(r.status,200);
 const body=await r.text();assert.equal(body.includes('NEVER_EXPOSE'),false);assert.equal(body.includes('SENSITIVE'),false);
 const value=JSON.parse(body);assert.equal(value.coverage.completeness,'operational-state-only');
 assert.equal(value.findings[0].role,'root');assert.equal(r.headers.get('cache-control'),'no-store');
});
test('upstream access denial never reveals source payload',async()=>{
 const env={...protectedEnv(),CURATOR_OPS:{fetch:async()=>new Response('PRIVATE',{status:403})}};
 const r=await auth(true)({request:req(),env});assert.equal(r.status,503);
 assert.equal((await r.text()).includes('PRIVATE'),false);
});
