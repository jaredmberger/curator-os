import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSafeOperationalState as project } from '../tools/stewardship/ops-safe-projection.mjs';

const secret='PRIVATE_TOKEN_DO_NOT_EXPOSE';
const sample=()=>({ok:true,snapshot:{
 generatedAt:'2026-10-13T20:50:00Z',status:'degraded',
 summary:{sources:2,activeFindings:1},
 sources:[{id:'reachability',freshnessState:'stale',key:secret,data:{token:secret,notes:secret},name:secret}],
 findings:[{id:'monitor:reachability',role:'independent',severity:'degraded',name:secret,message:secret,evidence:{raw:secret},causedBy:secret}],
 repositoryIntegrity:{secret},secret,
}});
test('projection strictly allowlists fields and strips nested data and sensitive text',()=>{
 const result=project(sample()), serialized=JSON.stringify(result);
 assert.equal(serialized.includes(secret),false);
 assert.deepEqual(Object.keys(result),['contractVersion','scope','generatedAt','state','coverage','sources','findings']);
 assert.deepEqual(result.findings,[{id:'monitor:reachability',role:'independent',severity:'degraded'}]);
 assert.deepEqual(result.sources,[{id:'reachability',freshness:'stale'}]);
});
test('does not change original source',()=>{const input=sample();const before=JSON.stringify(input);project(input);assert.equal(JSON.stringify(input),before)});
test('never invents source freshness or full coverage',()=>{
 const result=project(sample());assert.equal(result.sources[0].freshness,'stale');assert.equal(result.coverage.completeness,'operational-state-only');
});
test('unknown or malicious free-text IDs fail closed',()=>{
 const input=sample();input.snapshot.findings[0].id='secret='+secret+'\n';assert.throws(()=>project(input),/Invalid Ops finding/);
});
test('refuses incomplete and corrupt upstream envelope',()=>{
 assert.throws(()=>project({ok:false,snapshot:sample().snapshot}),/envelope/);
 const input=sample();input.snapshot.summary.activeFindings=0;assert.throws(()=>project(input),/coverage/);
});
test('allows a clean, scoped operational-state report',()=>{
 const input=sample();input.snapshot.status='healthy';input.snapshot.findings=[];input.snapshot.summary.activeFindings=0;
 const r=project(input);assert.equal(r.state,'healthy');assert.equal(r.findings.length,0);assert.equal(r.coverage.completeness,'operational-state-only');
});
test('duplicate or unknown fields never enter result',()=>{
 const input=sample();input.snapshot.findings[0].extra={arbitrary:secret};input.snapshot.sources[0].other=secret;
 assert.equal(JSON.stringify(project(input)).includes(secret),false);
});
