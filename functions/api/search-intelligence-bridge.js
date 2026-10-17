// Read-only proxy to Search Intelligence Watchtower; credentials remain server-side.
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function onRequestGet(c){
 const authorized=!!c.env.STEWARDSHIP_REVIEW_TOKEN&&c.request.headers.get('Authorization')==='Bearer '+c.env.STEWARDSHIP_REVIEW_TOKEN;
 if(!authorized)return reply({ok:false,error:'Authorization required'},401);
 try{
  const upstream=await fetch('https://search-intelligence.oceanliners.net/api/watchtower',{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!upstream.ok)return reply({ok:false,error:'Search Intelligence Watchtower returned HTTP '+upstream.status},502);
  if(!(upstream.headers.get('content-type')||'').includes('application/json'))return reply({ok:false,error:'Upstream returned non-JSON content (possible challenge or redirect)'},502);
  const source=await upstream.json();
  if(source?.ok!==true) return reply({ok:false,error:'Invalid Watchtower response'},502);
  const summary={ok:true,source:'Search Intelligence Watchtower',latestDate:source.latestDate||null,
   latestRange:source.latestRange||null,snapshotCount:Number(source.snapshotCount||0),
   latestTotals:source.latestTotals||null,
   events:(Array.isArray(source.events)?source.events:[]).slice(0,20).map(e=>({
    type:String(e.type||'observation').slice(0,100),
    label:String(e.label||e.message||e.description||'Watchtower observation').slice(0,280),
    score:Number.isFinite(Number(e.score))?Number(e.score):null,
    snapshotDate:e.snapshotDate||null,
    path:String(e.path||e.page||'').slice(0,400)})),
   observedAt:new Date().toISOString()};
  return reply(summary);
 }catch(e){return reply({ok:false,error:e?.name==='TimeoutError'?'Search Intelligence upstream timed out':'Search Intelligence upstream request failed ('+(e?.name||'network error')+')'},502)}
}
