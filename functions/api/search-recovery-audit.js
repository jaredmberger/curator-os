// Authenticated operator-triggered, bounded 10-URL Google inspection audit.
// Each request invokes the existing Search Intelligence inspection API; no scheduled work or KV writes.
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const urls=[
'https://www.oceanliners.net/how-long-did-it-take-titanic-to-sink',
'https://www.oceanliners.net/did-anyone-survive-in-the-water-after-titanic-sank',
'https://oceanliners.net/what-are-ocean-liners',
'https://oceanliners.net/ships/ships',
'https://oceanliners.net/ships/queen-elizabeth-2',
'https://oceanliners.net/ships/ss-storstad',
'https://www.oceanliners.net/white-star-line/',
'https://www.oceanliners.net/history-of-ocean-liners',
'https://oceanliners.net/ships/ss-germanic',
'https://oceanliners.net/ships/rms-queen-mary'
];
export async function onRequestPost(c){
 const auth=c.request.headers.get('Authorization');
 if(!c.env.STEWARDSHIP_REVIEW_TOKEN||auth!==`Bearer ${c.env.STEWARDSHIP_REVIEW_TOKEN}`)return json({ok:false,error:'Authorization required'},401);
 if(!c.env.SEARCH_INTELLIGENCE_SERVICE?.fetch)return json({ok:false,error:'Search Intelligence service binding unavailable'},503);
 let body;try{body=await c.request.json()}catch{return json({ok:false,error:'Invalid JSON'},400)}
 if(body?.confirm!==true)return json({ok:false,error:'Explicit confirmation required: this performs 10 Google inspections'},400);
 try{
  const response=await c.env.SEARCH_INTELLIGENCE_SERVICE.fetch('https://search-intelligence.internal/api/url-inspection',{
   method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({urls}),signal:AbortSignal.timeout(120000)
  });
  if(!(response.headers.get('content-type')||'').includes('application/json'))return json({ok:false,error:'Unexpected upstream content type (HTTP '+response.status+')'},502);
  const result=await response.json();
  if(!response.ok||result?.ok!==true||!Array.isArray(result.results))return json({ok:false,error:'Search Intelligence URL Inspection failed',upstreamStatus:response.status},502);
  if(result.results.length!==urls.length)return json({ok:false,error:'Incomplete audit response; do not infer missing pages are healthy'},502);
  return json({ok:true,audit:'2026-09 visibility collapse: representative ten-page technical inspection',runAt:new Date().toISOString(),requestedUrls:urls,results:result.results,
   interpretation:'Point-in-time Google inspection observations. Neither exclusion nor canonical discrepancy alone proves a cause of the September visibility collapse. API failures are unverified; no site changes were made.'});
 }catch(e){return json({ok:false,error:e?.name==='TimeoutError'?'Ten-page inspection timed out':'Inspection batch unavailable'},502)}
}
