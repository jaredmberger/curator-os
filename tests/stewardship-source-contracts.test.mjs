import test from 'node:test';
import assert from 'node:assert/strict';
import {projectStewardshipSource,unconnectedStewardshipSource,SOURCE_IDS} from '../tools/stewardship/source-contracts.mjs';
const now=Date.parse('2026-10-14T04:00:00Z');
const fixture=(source='site-health')=>({contractVersion:1,source,generatedAt:'2026-10-14T03:55:00Z',state:'healthy',freshness:'fresh',coverage:{reportedChecks:10,listedChecks:9,completeness:'source-specific-only'},findings:[]});
test('unconnected sources are unknown, not healthy',()=>{for(const id of SOURCE_IDS){const r=unconnectedStewardshipSource(id);assert.equal(r.state,'unknown');assert.equal(r.connected,false);}});
test('contract accepts scoped, partial coverage but requires review',()=>{for(const id of SOURCE_IDS){const result=projectStewardshipSource(fixture(id),id,{nowMs:now});assert.equal(result.reviewRequired,true);assert.equal(result.coverage.listedChecks,9);}});
test('source identity must match requested trusted binding',()=>assert.throws(()=>projectStewardshipSource(fixture(),'curator-integrity',{nowMs:now})));
test('rejects arbitrary findings, missing counts and unregistered source',()=>{
 const x=fixture();x.findings=[{id:'issue',severity:'critical',secret:'token'}];assert.throws(()=>projectStewardshipSource(x,'site-health',{nowMs:now}));
 const y=fixture();delete y.coverage.reportedChecks;assert.throws(()=>projectStewardshipSource(y,'site-health',{nowMs:now}));
 assert.throws(()=>unconnectedStewardshipSource('other'));
});
test('old and future timestamps fail closed, no healthy inference',()=>{
 const stale=fixture();stale.generatedAt='2026-10-14T03:00:00Z';
 const r=projectStewardshipSource(stale,'site-health',{nowMs:now});assert.equal(r.state,'unknown');assert.equal(r.freshness,'stale');
 const future=fixture();future.generatedAt='2026-10-14T04:02:00Z';
 assert.equal(projectStewardshipSource(future,'site-health',{nowMs:now}).state,'unknown');
});
test('projection strips messages, URLs, and arbitrary upstream fields',()=>{
 const x=fixture();x.privateDiagnostic='secret';x.findings=[{id:'alpha',severity:'attention',message:'private',url:'https://internal.example'}];
 const r=projectStewardshipSource(x,'site-health',{nowMs:now});
 assert.equal(r.findings[0].message,undefined);assert.equal(r.findings[0].url,undefined);
 assert.equal(JSON.stringify(r).includes('private'),false);
});
