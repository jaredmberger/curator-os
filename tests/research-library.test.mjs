import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {onRequestGet} from '../functions/api/research-library.js';
globalThis.crypto??=webcrypto;
const run='123456',data='Research lead, not verified',bytes=Buffer.from(data);
const sha256=createHash('sha256').update(bytes).digest('hex');
const manifest={schema_version:1,run_id:run,files:[{name:'ss-test.md',bytes:bytes.length,sha256}]};
const bucket={
 async list(){return {delimitedPrefixes:['runs/'+run+'/'],truncated:false};},
 async get(key){const content=key.endsWith('/manifest.json')?JSON.stringify(manifest):key.endsWith('/ss-test.md')?data:null;
  return content===null?null:{size:Buffer.byteLength(content),text:async()=>content,arrayBuffer:async()=>Uint8Array.from(Buffer.from(content)).buffer};}
};
const get=(query='',env={RESEARCH_DOSSIERS_R2:bucket})=>onRequestGet({env,request:new Request('https://curator.example/api/research-library'+query)});
test('fails closed without R2 binding',async()=>assert.equal((await get('',{})).status,503));
test('lists archived runs without bucket credentials',async()=>{const j=await(await get()).json();assert.equal(j.runs[0].run_id,run);assert.equal(j.next_cursor,null);});
test('returns manifest and checksum-verified research document',async()=>{assert.equal((await get('?run='+run)).status,200);const j=await(await get('?run='+run+'&file=ss-test.md')).json();assert.equal(j.content,data);});
test('rejects invalid paths and files missing from manifest',async()=>{assert.equal((await get('?run=../bad')).status,400);assert.equal((await get('?run='+run+'&file=secrets.md')).status,404);});
test('rejects corrupted evidence',async()=>{const bad={...bucket,async get(key){if(key.endsWith('/ss-test.md'))return{size:bytes.length,arrayBuffer:async()=>Uint8Array.from(Buffer.from('X'.repeat(bytes.length))).buffer};return bucket.get(key);}};assert.equal((await get('?run='+run+'&file=ss-test.md',{RESEARCH_DOSSIERS_R2:bad})).status,409);});