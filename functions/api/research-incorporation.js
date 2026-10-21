// Phase 3: read-only incorporation package from independently reviewed evidence.
// Does not write records, change guides, or contact GitHub.
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const validRun=x=>typeof x==='string'&&/^\d{1,20}$/.test(x);
const validFile=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9._-]*\.evidence\.json$/.test(x);
async function archive(env,run,file){
 const m=await env.RESEARCH_DOSSIERS_R2.get('runs/'+run+'/manifest.json');
 if(!m||m.size>131072)return null;
 const manifest=JSON.parse(await m.text());
 if(manifest.schema_version!==1||manifest.run_id!==run||!Array.isArray(manifest.files))return null;
 const item=manifest.files.find(x=>x.name===file&&Number.isInteger(x.bytes)&&x.bytes>=0&&x.bytes<=1048576&&/^[a-f0-9]{64}$/.test(x.sha256));
 if(!item)return null;
 const object=await env.RESEARCH_DOSSIERS_R2.get('runs/'+run+'/'+file);
 if(!object||object.size!==item.bytes)return null;
 const bytes=await object.arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(digest!==item.sha256)return null;
 const reg=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(reg.schema_version!==1||!/^[-a-z0-9]+\.html$/.test(reg.guide)||!Array.isArray(reg.claims)||reg.claims.length>5)return null;
 return {reg,digest};
}
export async function onRequestGet({env,request}){
 if(!env.RESEARCH_DOSSIERS_R2||!env.CURATOROS_RECORDS)return reply({ok:false,error:'Research storage unavailable'},503);
 const u=new URL(request.url),run=u.searchParams.get('run'),file=u.searchParams.get('file');
 if(!validRun(run)||!validFile(file))return reply({ok:false,error:'Invalid archive identifier'},400);
 try{
  const archived=await archive(env,run,file);
  if(!archived)return reply({ok:false,error:'Evidence archive unavailable or corrupt'},404);
  const claims=[];
  for(let i=0;i<archived.reg.claims.length;i++){
   const key='research-library/review/v1/'+run+'/'+file+'/'+i;
   const review=await env.CURATOROS_RECORDS.get(key,'json');
   if(review?.status!=='verified'||review?.source_status!=='source_checked'||!Array.isArray(review.events))continue;
   const last=review.events.at(-1);
   if(!last||last.status!=='verified'||last.source_status!=='source_checked'||!last.notes?.trim())continue;
   const claim=archived.reg.claims[i];
   claims.push({index:i,claim:claim.claim||'',source_title:claim.source_title||'',source_url:claim.source_url||'',source_support:claim.source_support||'',uncertainty:claim.uncertainty||'',reviewer:last.reviewer||'',reviewed_at:last.at||'',rationale:last.notes});
  }
  return reply({ok:true,kind:'editorial_incorporation_proposal',guide:'ships/'+archived.reg.guide,run_id:run,evidence_file:file,archive_sha256:archived.digest,claims,eligible_count:claims.length,publication_status:'not_authorized',instructions:'Use this package for a human-reviewed proposed guide diff. Explicit editor direction required to create a PR. Do not automatically modify guides, publish or merge.'});
 }catch{return reply({ok:false,error:'Unable to prepare incorporation package'},502);}
}
