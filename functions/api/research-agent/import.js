// Protected, opt-in Historical Research Agent intake. Never mutates canonical records.
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const types=new Set(['contemporary_primary','archival_catalog','scholarly_secondary','general_secondary','derivative','unknown']);
const comparisons=new Set(['new','already_present','possible_conflict','unclear']);
const access=new Set(['model_reports_read','model_reports_snippet_only','inaccessible','unknown']);
const fields=['claim','guide_comparison','source_url','source_title','source_type','access_status','source_support','identity_and_period','uncertainty','verification_needed'];
function validString(value,max,nonempty=false){return typeof value==='string'&&value.length<=max&&(!nonempty||!!value.trim())}
function validRegister(r){
 if(!r||typeof r!=='object'||Array.isArray(r)||r.schema_version!==1||!validString(r.guide,150,true)||!/^[-a-z0-9]+\.html$/.test(r.guide)||!Array.isArray(r.claims)||r.claims.length>5)return false;
 return r.claims.every(c=>c&&typeof c==='object'&&!Array.isArray(c)&&fields.every(f=>validString(c[f],f==='claim'?2500:1500))&&validString(c.claim,2500,true)&&comparisons.has(c.guide_comparison)&&types.has(c.source_type)&&access.has(c.access_status)&&(!c.source_url||(/^https?:\/\//i.test(c.source_url)&&(()=>{try{const u=new URL(c.source_url);return !!u.hostname&&!u.username&&!u.password}catch{return false}})()))&&(!('independently_verified' in c)||c.independently_verified===false)&&(!('editorial_status' in c)||c.editorial_status==='unverified_pending_editorial_review'));
}
async function digest(value){const data=new TextEncoder().encode(value);const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',data));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
async function handleImportPost(context){
 const {request,env}=context;
 if(env.RESEARCH_AGENT_IMPORT_ENABLED!=='true')return reply({ok:false,error:'Import disabled'},503);
 const token=env.RESEARCH_AGENT_IMPORT_TOKEN;
 const auth=request.headers.get('authorization')||'';
 if(!token||auth!==`Bearer ${token}`)return reply({ok:false,error:'Unauthorized'},401);
 const kv=env.CURATOROS_RECORDS;
 if(!kv)return reply({ok:false,error:'Storage unavailable'},503);
 if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return reply({ok:false,error:'JSON required'},415);
 if(Number(request.headers.get('content-length')||0)>80000)return reply({ok:false,error:'Payload too large'},413);
 let raw;try{raw=await request.text()}catch{return reply({ok:false,error:'Invalid request body'},400)}
 if(new TextEncoder().encode(raw).byteLength>80000)return reply({ok:false,error:'Payload too large'},413);
 let body;try{body=JSON.parse(raw)}catch{return reply({ok:false,error:'Invalid JSON'},400)}
 if(!body||!validRegister(body.register)||!validString(body.run_id,40,true)||!/^\d+$/.test(body.run_id))return reply({ok:false,error:'Invalid research register or run_id'},400);
 const reg=body.register;
 const now=new Date().toISOString();
 let created=0,alreadyPresent=0;
 const identifiers=[];
 for(const c of reg.claims){
   const normalized=[reg.guide,c.claim.trim().replace(/\s+/g,' '),c.source_url.trim()];
   const id=await digest(JSON.stringify(['research-claim-v1',...normalized]));
   const key=`research-agent/claim/v1/${id}`;
   identifiers.push(id);
   if(await kv.get(key)){alreadyPresent++;continue}
   const record={schema_version:1,id,guide:reg.guide,claim:c.claim,guide_comparison:c.guide_comparison,source_url:c.source_url,source_title:c.source_title,source_type:c.source_type,access_status:c.access_status,source_support:c.source_support,identity_and_period:c.identity_and_period,uncertainty:c.uncertainty,verification_needed:c.verification_needed,editorial_status:'unverified_pending_editorial_review',independently_verified:false,imported_at:now,source_run_id:body.run_id};
   await kv.put(key,JSON.stringify(record));
   created++;
 }
 return reply({ok:true,imported:created,already_present:alreadyPresent,claim_ids:identifiers,guide:reg.guide,storage:'kv'});
}


// Diagnostics intentionally record only arrival, a random correlation ID and status.
export async function onRequestPost(context){
 const diagnosticId=crypto.randomUUID();
 console.log(JSON.stringify({event:'research_import_arrival',diagnostic_id:diagnosticId}));
 try{
  const response=await handleImportPost(context);
  console.log(JSON.stringify({event:'research_import_response',diagnostic_id:diagnosticId,status:response.status}));
  return response;
 }catch(error){
  console.log(JSON.stringify({event:'research_import_exception',diagnostic_id:diagnosticId,status:500}));
  throw error;
 }
}
