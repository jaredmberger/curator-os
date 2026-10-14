import test from 'node:test';
import assert from 'node:assert/strict';
import {assessReport} from '../preview/stewardship.js';
const when=Date.parse('2026-10-14T04:00:00Z');
const sample=()=>({available:true,contractVersion:1,scope:'ops-operational-state-summary',generatedAt:new Date(when-5*60000).toISOString(),state:'healthy',coverage:{reportedSources:10,listedSources:9,reportedFindings:0,completeness:'operational-state-only'},sources:Array.from({length:9},(_,i)=>({id:'monitor-'+i,freshness:'fresh'})),findings:[]});
test('missing source coverage stays visible even when Ops reports healthy',()=>{
 const a=assessReport(sample(),when);assert.equal(a.unlisted,1);assert.equal(a.needsReview,true);
});
test('20 minute threshold and future clock skew are explicit',()=>{
 const stale=sample();stale.generatedAt=new Date(when-21*60000).toISOString();
 assert.equal(assessReport(stale,when).stale,true);
 const future=sample();future.generatedAt=new Date(when+120000).toISOString();
 assert.equal(assessReport(future,when).clockSkew,true);
});
test('missing or stale monitor is independently reported',()=>{
 const r=sample();r.coverage.reportedSources=9;r.sources[0].freshness='missing';r.sources[1].freshness='stale';
 const a=assessReport(r,when);assert.equal(a.notFresh,2);assert.equal(a.needsReview,true);
});
test('a clean scoped operational report is never asserted to verify history',()=>{
 const r=sample();r.coverage.reportedSources=9;
 const a=assessReport(r,when);assert.equal(a.needsReview,false);
 assert.equal(r.coverage.completeness,'operational-state-only');
});
