import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStewardshipSnapshots as normalize} from '../tools/stewardship/normalize.mjs';
import {integritySummaryToStewardship as integrity} from '../tools/stewardship/integrity-summary-adapter.mjs';
import {opsOperationalStateToSnapshot as ops} from '../tools/stewardship/ops-operational-state-adapter.mjs';
const now='2026-10-13T21:00:00Z';
const integrityFixture=()=>({ok:true,snapshot:{ok:true,mode:'incremental-site-monitor',generatedAt:'2026-10-13T20:55:00Z',inventoryCount:370,auditedPageCount:300,pendingInitialAuditCount:70,findingCount:0,problemPages:[]}});
const opsFixture=()=>({ok:true,snapshot:{generatedAt:'2026-10-13T20:55:00Z',status:'healthy',summary:{sources:2,activeFindings:0},sources:[{id:'reachability',freshnessState:'fresh',generatedAt:'2026-10-13T20:54:00Z'}],findings:[]}});
test('partial coverage survives all the way to normalized source output',()=>{
 const out=normalize([integrity(integrityFixture(),{maxAgeMs:3600000})],{now});
 const coverage=out.sources[0].coverage;
 assert.equal(coverage.completeness,'partial');
 assert.equal(coverage.complete_findings,false);
 assert.equal(coverage.inventory_count,370);
 assert.equal(coverage.audited_page_count,300);
 assert.equal(coverage.pending_initial_audit_count,70);
 assert.equal(out.findings.length,0);
});
test('Ops operational scope remains explicit without inheriting raw nested monitoring data',()=>{
 const out=normalize([ops(opsFixture(),{maxAgeMs:3600000})],{now});
 assert.equal(out.sources[0].coverage.completeness,'complete');
 assert.match(out.sources[0].coverage.scope,/operational-state/);
 assert.equal(out.sources[0].coverage.source_freshness,undefined);
});
test('sources without an explicit coverage claim stay unknown, even when current',()=>{
 const out=normalize([{source_system:'a',available:true,checked_at:now,max_age_ms:3600000,findings:[]}],{now});
 assert.equal(out.sources[0].state,'current');
 assert.equal(out.sources[0].coverage.completeness,'unknown');
});
test('missing or stale sources do not acquire invented healthy coverage',()=>{
 const out=normalize([{source_system:'a',available:true,checked_at:'2026-10-12T21:00:00Z',max_age_ms:1000,findings:[],coverage:{complete_findings:false}}],{now,expectedSources:['a','b']});
 assert.equal(out.sources.find(s=>s.source_system==='a').state,'stale');
 assert.equal(out.sources.find(s=>s.source_system==='a').coverage.completeness,'partial');
 assert.equal(out.sources.find(s=>s.source_system==='b').coverage.completeness,'unknown');
});
test('unknown or malformed source coverage fails closed, not silently green',()=>{
 assert.throws(()=>normalize([{source_system:'a',available:true,checked_at:now,max_age_ms:1000,findings:[],coverage:{inventory_count:-1}}],{now}),/coverage field/);
});
