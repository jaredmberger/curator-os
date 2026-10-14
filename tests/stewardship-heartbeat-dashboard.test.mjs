import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHeartbeatEnvelope,loadHeartbeats} from '../preview/stewardship-heartbeats.js';
const item=(source,connected=true)=>connected?{connected:true,source,scope:'scheduled-monitor-heartbeat-only',checkedAt:'2026-10-14T04:08:46.931Z',lastSuccessAt:'2026-10-14T03:17:13.625Z',frequency:'hourly',freshness:'fresh',state:'healthy',maxAgeMinutes:180,coverage:{reportedChecks:null,listedChecks:null,completeness:'unknown'},findings:{count:null,completeness:'unknown'},reviewRequired:false}:{source,scope:'scheduled-monitor-heartbeat-only',connected:false,reason:'disabled',state:'unknown',freshness:'unknown',coverage:{reportedChecks:null,listedChecks:null,completeness:'unknown'},findings:{count:null,completeness:'unknown'}};
const data=()=>({available:true,contractVersion:1,scope:'scheduled-monitor-heartbeats-only',sources:[item('site-health'),item('curator-integrity')]});
test('accepts verified live heartbeat-only response',()=>assert.equal(validateHeartbeatEnvelope(data()),true));
test('disabled source stays unknown, not fabricated healthy',()=>{const d=data();d.sources[1]=item('curator-integrity',false);assert.equal(validateHeartbeatEnvelope(d),true);});
test('rejects invented scan findings or coverage',()=>{const d=data();d.sources[0].findings.count=0;assert.equal(validateHeartbeatEnvelope(d),false);const e=data();e.sources[1].coverage.reportedChecks=9;assert.equal(validateHeartbeatEnvelope(e),false);});
test('rejects untrusted source IDs and contract variants',()=>{const d=data();d.sources[0].source='other';assert.equal(validateHeartbeatEnvelope(d),false);const e=data();e.contractVersion=2;assert.equal(validateHeartbeatEnvelope(e),false);});
test('disabled endpoint displays disabled, and does not treat it as healthy',async()=>{
 const nodes={'heartbeat-status':{textContent:''},'heartbeat-sources':{replaceChildren(){}}};
 await loadHeartbeats({doc:{getElementById:id=>nodes[id]},fetcher:async()=>({ok:false,status:404})});
 assert.match(nodes['heartbeat-status'].textContent,/disabled/i);
});
