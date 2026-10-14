import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeartbeatHandler} from '../functions/api/stewardship-heartbeats.js';
const req=(method='GET')=>new Request('https://curator.oceanliners.net/api/stewardship-heartbeats',{method});
const allow=()=>({authorize:async()=>true}),deny=()=>({authorize:async()=>false});
const payload=source=>({ok:true,service:source,schedule:{cadence:'hourly',minute:27},status:'healthy',stale:false,maxAgeMinutes:180,lastSuccessAt:new Date(Date.now()-60000).toISOString(),checkedAt:new Date().toISOString()});
const binding=(service)=>({fetch:async()=>new Response(JSON.stringify(payload(service)),{headers:{'content-type':'application/json'}})});
test('disabled without bindings or access; no upstream fetch',async()=>{
 const r=await createHeartbeatHandler(allow)({request:req(),env:{}});
 assert.equal(r.status,404);assert.equal((await r.json()).reason,'disabled');
});
test('denies unverified operator before source access',async()=>{
 let fetched=0;const env={STEWARDSHIP_SITE_HEALTH_READ_ENABLED:'true',STEWARDSHIP_SITE_HEALTH:{fetch:()=>{fetched++;throw Error('wrong');}}};
 const r=await createHeartbeatHandler(deny)({request:req(),env});
 assert.equal(r.status,403);assert.equal(fetched,0);
});
test('enabled source emits heartbeat-only fields, other remains disconnected',async()=>{
 const env={STEWARDSHIP_SITE_HEALTH_READ_ENABLED:'true',STEWARDSHIP_SITE_HEALTH:binding('Site Health')};
 const r=await createHeartbeatHandler(allow)({request:req(),env}),data=await r.json();
 assert.equal(r.status,200);assert.equal(data.sources.length,2);
 assert.equal(data.sources[0].scope,'scheduled-monitor-heartbeat-only');
 assert.equal(data.sources[0].state,'healthy');assert.equal(data.sources[0].findings.count,null);
 assert.equal(data.sources[1].connected,false);assert.equal(data.sources[1].state,'unknown');
});
test('missing binding fails closed, no fabricated health',async()=>{
 const r=await createHeartbeatHandler(allow)({request:req(),env:{STEWARDSHIP_INTEGRITY_READ_ENABLED:'true'}});
 const data=await r.json();assert.equal(data.sources[1].state,'unknown');assert.equal(data.sources[1].reason,'binding_unavailable');
});
test('non-GET is rejected',async()=>{
 const r=await createHeartbeatHandler(allow)({request:req('POST'),env:{}});
 assert.equal(r.status,405);
});
