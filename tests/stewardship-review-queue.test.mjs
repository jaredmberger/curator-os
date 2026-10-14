import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveReviewQueue} from '../tools/stewardship/review-queue.mjs';
const time='2026-10-14T04:10:00.000Z',now=Date.parse(time);
const report=()=>({available:true,contractVersion:1,scope:'ops-operational-state-summary',generatedAt:time,coverage:{reportedFindings:2},findings:[{id:'B',severity:'attention',role:'symptom',message:'private'},{id:'A',severity:'degraded',role:'root',url:'private'}]});
test('orders only unverified operational signals and strips arbitrary data',()=>{
 const r=deriveReviewQueue(report(),now);
 assert.deepEqual(r.items.map(x=>x.id),['A','B']);
 assert.equal(r.items[0].verification,'unverified');
 assert.equal(r.items[0].source,'Curator Ops');
 assert.equal(JSON.stringify(r).includes('private'),false);
});
test('stale report cannot be treated as reliable',()=>{
 const r=deriveReviewQueue(report(),now+21*60*1000);
 assert.equal(r.reportReliable,false);
 assert.equal(r.items[0].freshness,'report-unreliable');
});
test('unknown or missing fields fail closed',()=>{
 const x=report();x.findings[0].severity='critical';assert.throws(()=>deriveReviewQueue(x,now));
 const y=report();y.coverage.reportedFindings=0;assert.throws(()=>deriveReviewQueue(y,now));
});
test('queue never invents site-health or integrity findings',()=>{
 const r=deriveReviewQueue(report(),now);
 assert.ok(r.items.every(x=>x.source==='Curator Ops'&&x.kind==='operational-signal'));
});
