import test from 'node:test';
import assert from 'node:assert/strict';
import { siteHealthExportToSnapshot as adapt } from '../tools/stewardship/site-health-adapter.mjs';
import { normalizeStewardshipSnapshots as normalize } from '../tools/stewardship/normalize.mjs';

const base = () => ({
 schema:'https://oceanliners.net/curatoros/findings.schema.json',schemaVersion:'1.0',
 generator:{name:'OceanLiners.net Site Health Auditor',version:'2.1'},
 generatedAt:'2026-10-13T20:00:00Z',
 summary:{pagesScanned:10,linksChecked:100,findings:1},
 findings:[{id:'issue-1',type:'external-link',severity:'broken',status:'open',
 pageUrl:'https://oceanliners.net/ships/example',targetUrl:'https://example.org/missing',
 detectedAt:'2026-10-13T19:59:00Z',httpStatus:404}]
});
const run=(x)=>adapt(x,{maxAgeMs:3600000});
test('maps documented Site Health v1 fields and integrates with offline normalizer',()=>{
 const s=run(base()); const r=normalize([s],{now:'2026-10-13T20:01:00Z',expectedSources:['site-health']});
 assert.equal(r.sources[0].state,'current');
 assert.equal(r.findings[0].severity,'error');
 assert.equal(r.findings[0].confidence,'heuristic');
 assert.equal(r.summary.review_candidates,1);
});
test('clean complete scan is not asserted historical correctness',()=>{
 const x=base();x.summary.findings=0;x.findings=[];
 const result=normalize([run(x)],{now:'2026-10-13T20:01:00Z'});
 assert.equal(result.findings.length,0);
 assert.match(result.disclaimer,/does not prove/);
});
test('reviewing and ignored are never silently cleared',()=>{
 for (const status of ['reviewing','ignored']) {
  const x=base();x.findings[0].status=status;
  assert.equal(run(x).findings[0].state,'active');
  assert.match(run(x).findings[0].evidence,new RegExp(status));
 }
});
test('resolved explicitly maps to cleared',()=>{const x=base();x.findings[0].status='resolved';assert.equal(run(x).findings[0].state,'cleared')});
test('failed or incomplete export rejected',()=>{
 const x=base();x.summary.findings=2;assert.throws(()=>run(x),/Incomplete/);
 assert.throws(()=>run({...base(),findings:null}),/Incomplete/);
});
test('unknown upstream status and schema version fail closed',()=>{
 const x=base();x.findings[0].status='unknown';assert.throws(()=>run(x),/classification/);
 assert.throws(()=>run({...base(),schemaVersion:'2.0'}),/Unsupported/);
});
test('out-of-order duplicates use latest observation',()=>{
 const x=base();x.summary.findings=2;
 x.findings.push({...x.findings[0],status:'resolved',detectedAt:'2026-10-13T19:58:00Z'});
 const r=normalize([run(x)],{now:'2026-10-13T20:01:00Z'});
 assert.equal(r.findings.length,1);assert.equal(r.findings[0].state,'active');
});
test('vanished findings are not inferred cleared across snapshots',()=>{
 const x=base();x.findings=[];x.summary.findings=0;
 assert.equal(normalize([run(x)],{now:'2026-10-13T20:01:00Z'}).findings.length,0);
});
test('stale exports remain stale even if valid',()=>{
 const r=normalize([run(base())],{now:'2026-10-15T20:00:00Z'});
 assert.equal(r.sources[0].state,'stale');assert.equal(r.findings.length,0);
});
