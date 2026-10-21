// Editorial decisions only. Deliberately separate from canonical ship records and R2.
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const validRun=x=>typeof x==='string'&&/^\d{1,20}$/.test(x);
const validFile=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9._-]*\.evidence\.json$/.test(x);
const validClaim=x=>Number.isInteger(x)&&x>=0&&x<5;
const statuses=new Set(['pending','needs_research','rejected','verified']);
const keys=(run,file,claim)=>'research-library/review/v1/'+run+'/'+file+'/'+claim;
const read=async(kv,key)=>{const value=await kv.get(key,'json');return value&&typeof value==='object'?value:{events:[],version:0,status:'pending'}};
function parse(req){const u=new URL(req.url);const run=u.searchParams.get('run'),file=u.searchParams.get('file'),claim=Number(u.searchParams.get('claim'));return {run,file,claim,valid:validRun(run)&&validFile(file)&&u.searchParams.has('claim')&&validClaim(claim)};}
async function archivedClaim(env,run,file,claim){
 const m=await env.RESEARCH_DOSSIERS_R2.get('runs/'+run+'/manifest.json');
 if(!m||m.size>131072)return null;
 const manifest=JSON.parse(await m.text());
 if(manifest.run_id!==run||manifest.schema_version!==1||!Array.isArray(manifest.files))return null;
 const entry=manifest.files.find(x=>x.name===file&&Number.isInteger(x.bytes)&&x.bytes<=1048576&&/^[a-f0-9]{64}$/.test(x.sha256));
 if(!entry)return null;
 const object=await env.RESEARCH_DOSSIERS_R2.get('runs/'+run+'/'+file);
 if(!object||object.size!==entry.bytes)return null;
 const bytes=await object.arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==entry.sha256)return null;
 const evidence=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(evidence.schema_version!==1||!Array.isArray(evidence.claims)||!evidence.claims[claim])return null;
 return {guide:evidence.guide,claim:evidence.claims[claim].claim};
}
function store(env){return env.CURATOROS_RECORDS&&env.RESEARCH_DOSSIERS_R2;}
export async function onRequestGet({env,request}){
 if(!store(env))return reply({ok:false,error:'Required research storage unavailable'},503);
 const p=parse(request);if(!p.valid)return reply({ok:false,error:'Invalid review identifier'},400);
 try{const source=await archivedClaim(env,p.run,p.file,p.claim);if(!source)return reply({ok:false,error:'Archived claim unavailable'},404);
 return reply({ok:true,source,review:await read(env.CURATOROS_RECORDS,keys(p.run,p.file,p.claim))});
 }catch{return reply({ok:false,error:'Review lookup failed'},502);}
}
export async function onRequestPost({env,request}){
 if(!store(env))return reply({ok:false,error:'Required research storage unavailable'},503);
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))return reply({ok:false,error:'JSON required'},415);
 const p=parse(request);if(!p.valid)return reply({ok:false,error:'Invalid review identifier'},400);
 let body;try{const raw=await request.text();if(raw.length>12000)return reply({ok:false,error:'Review too large'},413);body=JSON.parse(raw);}catch{return reply({ok:false,error:'Invalid review JSON'},400);}
 if(!statuses.has(body?.status)||!['unverified','source_checked'].includes(body?.source_status)||typeof body.notes!=='string'||body.notes.length>4000||typeof body.reviewer!=='string'||!body.reviewer.trim()||body.reviewer.length>120||!Number.isSafeInteger(body.expected_version)||body.expected_version<0)return reply({ok:false,error:'Invalid review decision'},400);
 if(body.status==='verified'&&(body.source_status!=='source_checked'||!body.notes.trim()))return reply({ok:false,error:'Verified claims require source checked and an evidence rationale'},400);
 try{
 const source=await archivedClaim(env,p.run,p.file,p.claim);if(!source)return reply({ok:false,error:'Archived claim unavailable'},404);
 const key=keys(p.run,p.file,p.claim),current=await read(env.CURATOROS_RECORDS,key);
 if(current.version!==body.expected_version)return reply({ok:false,error:'Review changed since last load; refresh before saving',review:current},409);
 const event={status:body.status,source_status:body.source_status,notes:body.notes.trim(),reviewer:body.reviewer.trim(),at:new Date().toISOString()};
 const review={version:current.version+1,status:event.status,source_status:event.source_status,events:[...(current.events||[]).slice(-99),event]};
 await env.CURATOROS_RECORDS.put(key,JSON.stringify(review));
 return reply({ok:true,source,review});
 }catch{return reply({ok:false,error:'Review save failed'},502);}
}
