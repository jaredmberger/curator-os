import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateReport} from '../preview/stewardship.js';
const sample=()=>({available:true,contractVersion:1,scope:'ops-operational-state-summary',generatedAt:'2026-10-14T03:30:20Z',state:'healthy',coverage:{reportedSources:10,listedSources:9,reportedFindings:0,completeness:'operational-state-only'},sources:Array.from({length:9},(_,i)=>({id:'source-'+i,freshness:'fresh'})),findings:[]});
test('dashboard accepts partial operational coverage but never declares it complete',()=>{
 assert.equal(validateReport(sample()),true);
 assert.equal(sample().coverage.listedSources<sample().coverage.reportedSources,true);
});
test('dashboard rejects malformed, unsanitized or inconsistent reporting',()=>{
 const bad=sample();bad.sources[0].freshness='secret';assert.equal(validateReport(bad),false);
 const mismatch=sample();mismatch.coverage.listedSources=10;assert.equal(validateReport(mismatch),false);
 const wrong=sample();wrong.contractVersion=2;assert.equal(validateReport(wrong),false);
 const missing=sample();missing.available=false;assert.equal(validateReport(missing),false);
});
test('dashboard strictly uses DOM textContent and has no write action',()=>{
 const js=readFileSync(new URL('../preview/stewardship.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../preview/stewardship.html',import.meta.url),'utf8');
 assert.equal(js.includes('innerHTML'),false);
 assert.equal(js.includes("fetcher('/api/stewardship-ops'"),true);
 assert.equal(js.includes("method:'GET'"),true);
 assert.equal(js.includes("cache:'no-store'"),true);
 assert.equal(html.includes('stewardship.js'),true);
 assert.equal(html.includes('noindex,nofollow,noarchive'),true);
 assert.equal(html.includes('No automated actions'),true);
});
