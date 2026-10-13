import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStewardshipSnapshots as normalize} from '../tools/stewardship/normalize.mjs';
import {siteHealthExportToSnapshot as site} from '../tools/stewardship/site-health-adapter.mjs';
import {integritySummaryToStewardship as integrity} from '../tools/stewardship/integrity-summary-adapter.mjs';
import {opsOperationalStateToSnapshot as ops} from '../tools/stewardship/ops-operational-state-adapter.mjs';

const now='2026-10-13T20:45:00Z';
const expected=['site-health','curator-integrity','curator-ops'];
const siteExport=()=>({
 schema:'https://oceanliners.net/curatoros/findings.schema.json',schemaVersion:'1.0',
 generator:{name:'OceanLiners.net Site Health Auditor',version:'2.1'},generatedAt:'2026-10-13T20:40:00Z',
 summary:{pagesScanned:12,linksChecked:40,findings:1},
 findings:[{id:'broken-image',type:'broken-link',severity:'broken',status:'reviewing',pageUrl:'https://oceanliners.net/ships/example',targetUrl:'https://oceanliners.net/images/missing.jpg',detectedAt:'2026-10-13T20:35:00Z',httpStatus:404}]
});
const integrityResponse=()=>({ok:true,snapshot:{
 ok:true,mode:'incremental-site-monitor',generatedAt:'2026-10-13T20:41:00Z',
 inventoryCount:370,auditedPageCount:300,pendingInitialAuditCount:70,findingCount:35,
 problemPages:[{path:'/ships/another',findingCount:2,highestSeverity:'warning',checkedAt:'2026-10-13T20:39:00Z',error:null}]
}});
const opsResponse=()=>({ok:true,snapshot:{
 generatedAt:'2026-10-13T20:42:00Z',status:'degraded',
 summary:{sources:2,activeFindings:2},
 sources:[{id:'reachability',freshnessState:'fresh',generatedAt:'2026-10-13T20:41:00Z'}],
 findings:[{id:'service:public-site',name:'Public Site',severity:'attention',role:'root',message:'Site is unreachable'},
 {id:'monitor:public-site-journey',name:'Public Site Journey',severity:'degraded',role:'symptom',message:'Journey failed downstream'}]
}});
const all=()=>[
 site(siteExport(),{maxAgeMs:60*60*1000}),
 integrity(integrityResponse(),{maxAgeMs:60*60*1000}),
 ops(opsResponse(),{maxAgeMs:15*60*1000})
];

test('all three sources normalize without inventing a universal green state',()=>{
 const original=all();
 const result=normalize(original,{now,expectedSources:expected});
 assert.equal(result.summary.current,3);
 assert.equal(result.summary.active,4);
 assert.equal(result.sources.length,3);
 assert.equal(result.findings.filter(f=>f.source_system==='curator-ops').length,2);
 assert.equal(original.find(s=>s.source_system==='curator-integrity').coverage.complete_findings,false);
 assert.equal(original.find(s=>s.source_system==='curator-integrity').coverage.pending_initial_audit_count,70);
});
test('a missing authority remains not checked',()=>{
 const result=normalize(all().filter(s=>s.source_system!=='curator-integrity'),{now,expectedSources:expected});
 assert.equal(result.summary.not_checked,1);
 assert.equal(result.sources.find(s=>s.source_system==='curator-integrity').state,'not_checked');
});
test('stale authority cannot contribute old findings',()=>{
 const sources=all(); sources.find(s=>s.source_system==='site-health').checked_at='2026-10-10T20:00:00Z';
 const result=normalize(sources,{now,expectedSources:expected});
 assert.equal(result.summary.stale,1);
 assert.equal(result.findings.some(f=>f.source_system==='site-health'),false);
});
test('ignored or reviewing Site Health item is never automatically cleared',()=>{
 for(const status of ['ignored','reviewing']){
  const x=siteExport();x.findings[0].status=status;
  const result=normalize([site(x,{maxAgeMs:3600000})],{now});
  assert.equal(result.findings[0].state,'active');
 }
});
test('clean Site Health plus partial Integrity does not prove healthy archive',()=>{
 const s=siteExport();s.findings=[];s.summary.findings=0;
 const i=integrityResponse();i.snapshot.problemPages=[];i.snapshot.findingCount=0;
 const adapted=[site(s,{maxAgeMs:3600000}),integrity(i,{maxAgeMs:3600000})];
 const result=normalize(adapted,{now,expectedSources:expected});
 assert.equal(result.findings.length,0);
 assert.equal(result.summary.not_checked,1);
 assert.equal(adapted[1].coverage.complete_findings,false);
 assert.match(result.disclaimer,/does not prove/);
});
test('duplicate source identity is rejected instead of double counting',()=>{
 const sources=all();assert.throws(()=>normalize([...sources,sources[0]],{now}),/duplicate source_system/);
});
test('all adapters are deterministic on the same sanitized input',()=>{
 const a=normalize(all(),{now,expectedSources:expected});
 const b=normalize(all(),{now,expectedSources:expected});
 assert.deepEqual(a,b);
});
