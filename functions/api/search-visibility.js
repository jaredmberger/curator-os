// Search visibility observations kept separate from historical stewardship cases.
// Read access through existing steward operator credential; write via distinct ingest token.
const KEY='search-visibility-v1';
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const allowed=c=>!!c.env.STEWARDSHIP_REVIEW_TOKEN&&c.request.headers.get('Authorization')==='Bearer '+c.env.STEWARDSHIP_REVIEW_TOKEN;
const ingestAllowed=c=>!!c.env.SEARCH_VISIBILITY_INGEST_TOKEN&&c.request.headers.get('Authorization')==='Bearer '+c.env.SEARCH_VISIBILITY_INGEST_TOKEN;
const empty={version:0,updatedAt:null,source:'not-connected',property:'sc-domain:oceanliners.net',rows:[]};
export async function onRequestGet(c){if(!allowed(c))return json({ok:false,error:'Authorization required'},401);if(!c.env.CURATOROS_RECORDS)return json({ok:false,error:'Storage unavailable'},503);const value=await c.env.CURATOROS_RECORDS.get(KEY,'json');return json({ok:true,...(value||empty)});}
export async function onRequestPost(c){
 if(!ingestAllowed(c))return json({ok:false,error:'Ingestion authorization required'},401);
 if(!c.env.CURATOROS_RECORDS)return json({ok:false,error:'Storage unavailable'},503);
 let b;try{b=await c.request.json()}catch{return json({ok:false,error:'Invalid JSON'},400)}
 if(b?.property!=='sc-domain:oceanliners.net'||!Array.isArray(b.rows)||b.rows.length>1500||!['data-bloo-export','google-search-console-api','verified-manual-import'].includes(b.source))return json({ok:false,error:'Invalid source, property or rows'},400);
 const normalized=[];
 for(const r of b.rows){
  const date=String(r.date||'').replace(/-/g,'');
  if(!/^20\d{6}$/.test(date)||!Number.isInteger(Number(r.clicks))||!Number.isInteger(Number(r.impressions))||Number(r.clicks)<0||Number(r.impressions)<0||Number(r.clicks)>Number(r.impressions)||!Number.isFinite(Number(r.average_position))||Number(r.average_position)<0)return json({ok:false,error:'Invalid metrics row'},400);
  normalized.push({date,clicks:Number(r.clicks),impressions:Number(r.impressions),average_position:Number(r.average_position)});
 }
 const old=await c.env.CURATOROS_RECORDS.get(KEY,'json')||empty;
 const map=new Map(old.rows.map(r=>[r.date,r]));for(const row of normalized)map.set(row.date,row);
 const rows=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-800);
 const next={version:old.version+1,updatedAt:new Date().toISOString(),source:b.source,property:b.property,rows};
 await c.env.CURATOROS_RECORDS.put(KEY,JSON.stringify(next));return json({ok:true,version:next.version,rows:rows.length,updatedAt:next.updatedAt});
}
