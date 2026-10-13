import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStewardshipSnapshots as run } from '../tools/stewardship/normalize.mjs';

const now='2026-10-13T20:00:00Z';
const finding=(overrides={})=>({source_finding_id:'f1',rule_id:'historical-date',observed_at:'2026-10-13T19:00:00Z',severity:'warning',confidence:'heuristic',state:'active',subject:'rms-example',evidence:'Candidate conflict, editorial review required',...overrides});
const snapshot=(overrides={})=>({source_system:'historical-consistency',checked_at:'2026-10-13T19:59:00Z',max_age_ms:300000,available:true,findings:[finding()],...overrides});
test('read-only fixture yields candidate, not asserted error',()=>{
  const result=run([snapshot()],{now,expectedSources:['historical-consistency']});
  assert.equal(result.summary.review_candidates,1);
  assert.equal(result.findings[0].confidence,'heuristic');
  assert.equal(result.sources[0].state,'current');
});
test('stale snapshot cannot appear healthy or pass through old findings',()=>{
  const result=run([snapshot({checked_at:'2026-10-13T18:00:00Z'})],{now});
  assert.equal(result.sources[0].state,'stale');
  assert.equal(result.findings.length,0);
});
test('unavailable source cannot appear healthy',()=>{
  const result=run([snapshot({available:false})],{now});
  assert.equal(result.sources[0].state,'unavailable');
  assert.equal(result.findings.length,0);
});
test('missing source is visibly not checked',()=>{
  const result=run([],{now,expectedSources:['site-health']});
  assert.equal(result.sources[0].state,'not_checked');
  assert.equal(result.summary.current,0);
});
test('duplicate finding snapshots deduplicate by source and ID',()=>{
  const result=run([snapshot({findings:[finding(),finding()]})],{now});
  assert.equal(result.findings.length,1);
});
test('later cleared finding wins without inferred resolution',()=>{
  const result=run([snapshot({findings:[finding(),finding({state:'cleared',observed_at:'2026-10-13T19:30:00Z'})]})],{now});
  assert.equal(result.findings[0].state,'cleared');
  assert.equal(result.summary.active,0);
});
test('contradictory equal-time claims fail visibly',()=>{
  assert.throws(()=>run([snapshot({findings:[finding(),finding({state:'cleared'})]})],{now}),/Contradictory/);
});
test('partial coverage remains visible',()=>{
  const result=run([snapshot()],{now,expectedSources:['historical-consistency','site-health','ops']});
  assert.equal(result.summary.not_checked,2);
});
test('future-dated check is stale, not fresh',()=>{
  const result=run([snapshot({checked_at:'2026-10-14T00:00:00Z'})],{now});
  assert.equal(result.sources[0].state,'stale');
});
test('malformed current source cannot be silently counted as green',()=>{
  assert.throws(()=>run([snapshot({findings:null})],{now}),/array/);
});
