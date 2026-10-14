import test from 'node:test';
import assert from 'node:assert/strict';
import {projectOpsHeartbeat,disconnectedHeartbeat} from '../tools/stewardship/verified-heartbeat-adapters.mjs';
const now=Date.parse('2026-10-14T04:00:00Z');
const fixture=source=>({ok:true,service:source==='site-health'?'Site Health':'Curator Integrity',
 schedule:{cadence:'hourly',minute:source==='site-health'?27:17},
 lastSuccessAt:'2026-10-14T02:45:00Z',ageMinutes:75,maxAgeMinutes:180,stale:false,
 status:'healthy',checkedAt:'2026-10-14T03:59:00Z',
 heartbeat:{component:'monitor',message:'unapproved private detail'},privateToken:'SECRET'});
test('verified hourly service heartbeats retain bounded, service-specific freshness',()=>{
 for(const id of ['site-health','curator-integrity']){
  const r=projectOpsHeartbeat(fixture(id),id,{nowMs:now});
  assert.equal(r.freshness,'fresh');assert.equal(r.state,'healthy');
  assert.equal(r.scope,'scheduled-monitor-heartbeat-only');
  assert.equal(r.coverage.reportedChecks,null);assert.equal(r.findings.count,null);
  assert.equal(JSON.stringify(r).includes('SECRET'),false);
  assert.equal(JSON.stringify(r).includes('unapproved private detail'),false);
 }
});
test('old query cannot certify fresh monitor even if heartbeat looks healthy',()=>{
 const f=fixture('site-health');f.checkedAt='2026-10-14T03:00:00Z';
 assert.equal(projectOpsHeartbeat(f,'site-health',{nowMs:now}).state,'unknown');
});
test('late heartbeat and inconsistent health fail closed',()=>{
 const late=fixture('site-health');late.lastSuccessAt='2026-10-13T20:00:00Z';
 assert.equal(projectOpsHeartbeat(late,'site-health',{nowMs:now}).freshness,'stale');
 const fake=fixture('site-health');fake.ok=false;
 assert.equal(projectOpsHeartbeat(fake,'site-health',{nowMs:now}).state,'unknown');
});
test('missing heartbeat and disconnected source remain unknown',()=>{
 const missing=fixture('site-health');missing.lastSuccessAt=null;missing.ageMinutes=null;missing.stale=null;missing.status='unknown';
 assert.equal(projectOpsHeartbeat(missing,'site-health',{nowMs:now}).freshness,'missing');
 assert.equal(disconnectedHeartbeat('curator-integrity').state,'unknown');
});
test('rejects source impersonation or unsupported formats',()=>{
 assert.throws(()=>projectOpsHeartbeat(fixture('site-health'),'curator-integrity',{nowMs:now}));
 assert.throws(()=>projectOpsHeartbeat({status:'healthy'},'site-health',{nowMs:now}));
});
