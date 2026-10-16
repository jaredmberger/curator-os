// CuratorOS stewardship review queue. KV persists cases and reviewer dispositions.
// A dedicated API secret is required for reads and writes; do not expose secrets in page source.
const KEY='stewardship-review-queue-v1';
const decisions=new Set(['acknowledged','investigate','deferred','dismissed']);
const reply=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function authorized(c,role='review'){const configured=role==='ingest'?c.env.STEWARDSHIP_INGEST_TOKEN:c.env.STEWARDSHIP_REVIEW_TOKEN;const supplied=c.request.headers.get('Authorization');return !!configured&&supplied===`Bearer ${configured}`;}
function storage(c){return c.env.CURATOROS_RECORDS;}
async function load(kv){const d=await kv.get(KEY,'json');return d&&Array.isArray(d.cases)?d:{version:0,updatedAt:null,cases:[],auditHealth:'not-ingested'};}
export async function onRequestGet(c){if(!authorized(c))return reply({ok:false,error:'Authorization required'},401);const kv=storage(c);if(!kv)return reply({ok:false,error:'Storage unavailable'},503);return reply({ok:true,...await load(kv)});}
export async function onRequestPost(c){
 const kv=storage(c);if(!kv)return reply({ok:false,error:'Storage unavailable'},503);
 let body;try{body=await c.request.json()}catch{return reply({ok:false,error:'Invalid JSON'},400)}
 if(body?.action!=='ingest'&&!decisions.has(body?.action))return reply({ok:false,error:'Unknown action'},400);
 if(!authorized(c,body.action==='ingest'?'ingest':'review'))return reply({ok:false,error:'Authorization required'},401);
 const current=await load(kv),now=new Date().toISOString();
 if(body.action==='ingest'){
   const snapshot=body.snapshot;
   if(!snapshot||!Array.isArray(snapshot.findings)||snapshot.findings.length>15000||!['complete','incomplete'].includes(snapshot.auditHealth))return reply({ok:false,error:'Invalid snapshot'},400);
   const previous=new Map(current.cases.map(x=>[x.id,x]));
   const seen=new Set();const cases=[];
   for(const f of snapshot.findings){
     if(!f||typeof f.id!=='string'||!/^[a-f0-9]{20}$/.test(f.id)||typeof f.type!=='string'||typeof f.scope!=='string'||seen.has(f.id))return reply({ok:false,error:'Invalid or duplicate finding'},400);
     seen.add(f.id);const old=previous.get(f.id);
     cases.push({id:f.id,type:f.type.slice(0,120),scope:f.scope.slice(0,700),severity:String(f.severity||'review').slice(0,32),
       description:String(f.description||'').slice(0,1000),evidence:f.evidence||{},
       firstSeen:old?.firstSeen||now,lastSeen:now,observations:(old?.observations||0)+1,
       lifecycle:'active',review:old?.review||null});
   }
   for(const old of current.cases){if(seen.has(old.id))continue;
     // An incomplete run cannot prove disappearance. Preserve prior review and mark unverified.
     const family=old.type.startsWith('canonical:')?'canonical':'internal-links';
     const failed=(snapshot.errors||[]).some(e=>e.audit===family);
     cases.push({...old,lifecycle:failed||snapshot.auditHealth==='incomplete'?'unverified':'not-observed',lastSeen:old.lastSeen});
   }
   const next={version:current.version+1,updatedAt:now,auditHealth:snapshot.auditHealth,cases};
   await kv.put(KEY,JSON.stringify(next));return reply({ok:true,version:next.version,total:cases.length,active:seen.size});
 }
 if(typeof body.id!=='string'||!body.id)return reply({ok:false,error:'Finding id required'},400);
 const reviewer=String(body.reviewer||'').trim().slice(0,120);
 const reason=String(body.reason||'').trim().slice(0,2000);
 if(!reviewer||!reason)return reply({ok:false,error:'Reviewer and reason are required'},400);
 const item=current.cases.find(x=>x.id===body.id);
 if(!item)return reply({ok:false,error:'Finding not found'},404);
 if(!Number.isSafeInteger(body.version)||body.version!==current.version)return reply({ok:false,error:'Version conflict; reload before saving'},409);
 item.review={decision:body.action,reason,reviewer,at:now};
 const next={...current,version:current.version+1,updatedAt:now};
 await kv.put(KEY,JSON.stringify(next));return reply({ok:true,version:next.version,review:item.review});
}
