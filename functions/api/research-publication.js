// A separate human-attested incorporation ledger. Research decisions remain unchanged.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const valid=x=>typeof x==='string'&&/^\d{1,20}$/.test(x);
const validFile=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9._-]*\.evidence\.json$/.test(x);
const key=(run,file,i)=>'research-library/incorporation/v1/'+run+'/'+file+'/'+i;
const states=['not_started','pr_open','merged','deployed'];
export async function onRequest({env,request}){
 if(!env.CURATOROS_RECORDS||!env.RESEARCH_DOSSIERS_R2)return reply({ok:false,error:'Research storage unavailable'},503);
 const u=new URL(request.url),run=u.searchParams.get('run'),file=u.searchParams.get('file'),raw=u.searchParams.get('claim'),i=Number(raw);
 if(!valid(run)||!validFile(file)||raw===null||!Number.isInteger(i)||i<0||i>=5)return reply({ok:false,error:'Invalid claim identity'},400);
 try{
  // Only recognize a claim if the immutable archive manifest and evidence match.
  const m=await env.RESEARCH_DOSSIERS_R2.get('runs/'+run+'/manifest.json');
  if(!m||m.size>131072)return reply({ok:false,error:'Archive not found'},404);
  const manifest=JSON.parse(await m.text());
  if(manifest.run_id!==run||manifest.schema_version!==1||!Array.isArray(manifest.files))return reply({ok:false,error:'Invalid archive'},404);
  const entry=manifest.files.find(x=>x.name===file&&Number.isInteger(x.bytes)&&x.bytes<=1048576&&/^[a-f0-9]{64}$/.test(x.sha256));
  if(!entry)return reply({ok:false,error:'Evidence not in manifest'},404);
  const obj=await env.RESEARCH_DOSSIERS_R2.get('runs/'+run+'/'+file);
  if(!obj||obj.size!==entry.bytes)return reply({ok:false,error:'Evidence unavailable'},404);
  const bytes=await obj.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==entry.sha256)return reply({ok:false,error:'Evidence checksum mismatch'},409);
  const evidence=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(evidence.schema_version!==1||!Array.isArray(evidence.claims)||!evidence.claims[i])return reply({ok:false,error:'Claim not found'},404);
  const current=await env.CURATOROS_RECORDS.get(key(run,file,i),'json')||{version:0,status:'not_started',history:[]};
  if(request.method==='GET')return reply({ok:true,guide:evidence.guide,incorporation:current});
  if(request.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))return reply({ok:false,error:'JSON required'},415);
  const rawBody=await request.text();if(rawBody.length>12000)return reply({ok:false,error:'Request too large'},413);
  let body;try{body=JSON.parse(rawBody)}catch{return reply({ok:false,error:'Invalid JSON'},400)}
  if(!states.includes(body.status)||!Number.isSafeInteger(body.expected_version)||body.expected_version<0||typeof body.reviewer!=='string'||!body.reviewer.trim()||body.reviewer.length>120||typeof body.notes!=='string'||body.notes.trim().length<8||body.notes.length>4000)return reply({ok:false,error:'Invalid attestation'},400);
  const match=typeof body.pr_url==='string'&&/^https:\/\/github\.com\/jaredmberger\/Ocean-Liner-Curator\/pull\/[1-9]\d*$/.test(body.pr_url);
  if(body.status!=='not_started'&&!match)return reply({ok:false,error:'Exact Ocean Liner Curator PR URL required'},400);
  if(body.status==='deployed'&&current.status!=='merged'&&current.status!=='deployed')return reply({ok:false,error:'Record merge confirmation before deployment'},400);
  if(current.version!==body.expected_version)return reply({ok:false,error:'Status changed; refresh before saving',incorporation:current},409);
  const event={status:body.status,pr_url:match?body.pr_url:null,reviewer:body.reviewer.trim(),notes:body.notes.trim(),recorded_at:new Date().toISOString(),attestation:'manual'};
  const updated={version:current.version+1,status:event.status,pr_url:event.pr_url,history:[...(current.history||[]).slice(-99),event]};
  await env.CURATOROS_RECORDS.put(key(run,file,i),JSON.stringify(updated));
  return reply({ok:true,guide:evidence.guide,incorporation:updated,verified_by_github:false,verified_deployment:false});
 }catch{return reply({ok:false,error:'Incorporation ledger unavailable'},502)}
}
