import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {onRequest} from '../functions/api/research-publication.js';
globalThis.crypto??=webcrypto;
const file=JSON.stringify({schema_version:1,guide:'ss-test.html',claims:[{claim:'Test finding'}]});
const hash=createHash('sha256').update(file).digest('hex'),kv=new Map();
const env={CURATOROS_RECORDS:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,JSON.parse(v))},RESEARCH_DOSSIERS_R2:{get:async k=>k.endsWith('manifest.json')?{size:100,text:async()=>JSON.stringify({schema_version:1,run_id:'123',files:[{name:'ss-test.evidence.json',bytes:Buffer.byteLength(file),sha256:hash}]})}:k.endsWith('.evidence.json')?{size:Buffer.byteLength(file),arrayBuffer:async()=>Uint8Array.from(Buffer.from(file)).buffer}:null}};
const url='https://curator.example/api/research-publication?run=123&file=ss-test.evidence.json&claim=0';
const call=(body)=>onRequest({env,request:new Request(url,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
test('starts unincorporated, records separate PR and merge attestations',async()=>{
 let data=await (await call()).json();assert.equal(data.incorporation.status,'not_started');
 const base={reviewer:'Editor',notes:'Review completed, PR opened for this claim',pr_url:'https://github.com/jaredmberger/Ocean-Liner-Curator/pull/594'};
 let r=await call({...base,status:'pr_open',expected_version:0});assert.equal(r.status,200);
 assert.equal((await call({...base,status:'merged',expected_version:0})).status,409);
 r=await call({...base,status:'merged',notes:'Confirmed PR merge in GitHub',expected_version:1});assert.equal(r.status,200);
 assert.equal((await (await call()).json()).incorporation.history.length,2);
 assert.ok([...kv.keys()].every(k=>k.startsWith('research-library/incorporation/v1/')));
});
test('cannot falsely jump to deployed or link unrelated PR',async()=>{
 let r=await call({status:'deployed',expected_version:2,reviewer:'E',notes:'Reported as deployed',pr_url:'https://github.com/other/repo/pull/5'});assert.equal(r.status,400);
});
test('invalid claim rejected',async()=>{const r=await onRequest({env,request:new Request(url.replace('claim=0','claim=8'))});assert.equal(r.status,400)});
