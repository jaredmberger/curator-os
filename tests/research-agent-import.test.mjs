import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {onRequestPost} from '../functions/api/research-agent/import.js';
globalThis.crypto ??= webcrypto;
const c={claim:'Reported March 1947 fire',guide_comparison:'new',source_url:'https://example.org/item',source_title:'Source',source_type:'contemporary_primary',access_status:'model_reports_snippet_only',source_support:'Reported date',identity_and_period:'Specific ship',uncertainty:'Needs original',verification_needed:'Inspect original'};
const register={schema_version:1,guide:'ss-example.html',claims:[c]};
function fake(){
 const records=new Map();
 return {records,kv:{get:async k=>records.get(k)||null,put:async(k,v)=>{records.set(k,v)}}};
}
function context(kv,body,opts={}){
 return {env:{CURATOROS_RECORDS:kv,RESEARCH_AGENT_IMPORT_ENABLED:opts.enabled??'true',RESEARCH_AGENT_IMPORT_TOKEN:'test-secret'},request:new Request('https://curator.test/api/research-agent/import',{method:'POST',headers:{authorization:opts.auth??'Bearer test-secret','content-type':'application/json'},body:JSON.stringify(body)})};
}
test('import fails closed when disabled and without bearer token',async()=>{
 const {kv}=fake();const b={register,run_id:'39156470158'};
 assert.equal((await onRequestPost(context(kv,b,{enabled:'false'}))).status,503);
 assert.equal((await onRequestPost(context(kv,b,{auth:'Bearer wrong'}))).status,401);
});
test('imports unverified claim once and preserves existing immutable content',async()=>{
 const {kv,records}=fake();const b={register,run_id:'39156470158'};
 let r=await onRequestPost(context(kv,b));assert.equal(r.status,200);
 let p=await r.json();assert.equal(p.imported,1);assert.equal(p.already_present,0);
 r=await onRequestPost(context(kv,b));p=await r.json();assert.equal(p.imported,0);assert.equal(p.already_present,1);
 assert.equal(records.size,1);
 const record=JSON.parse([...records.values()][0]);
 assert.equal(record.independently_verified,false);
 assert.equal(record.editorial_status,'unverified_pending_editorial_review');
 assert.equal(record.guide,'ss-example.html');
});
test('rejects forged verification and bad URLs and malformed schemas',async()=>{
 const {kv,records}=fake();const b=(claim)=>({register:{...register,claims:[claim]},run_id:'33'});
 for(const change of [{independently_verified:true},{editorial_status:'verified'},{source_url:'javascript:alert(1)'},{source_url:'https://user:pass@example.org'}, {guide_comparison:'invented'}]){
  const res=await onRequestPost(context(kv,b({...c,...change})));
  assert.equal(res.status,400);
 }
 assert.equal((await onRequestPost(context(kv,{register:{...register,guide:'../bad.html'},run_id:'33'}))).status,400);
 assert.equal(records.size,0);
});
