// Operator-triggered Google URL Inspection via the existing Search Intelligence service binding.
// No persistence or automatic editorial conclusions.
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function onRequestPost(c){
 if(!c.env.STEWARDSHIP_REVIEW_TOKEN||c.request.headers.get('Authorization')!==`Bearer ${c.env.STEWARDSHIP_REVIEW_TOKEN}`)return json({ok:false,error:'Authorization required'},401);
 if(!c.env.SEARCH_INTELLIGENCE_SERVICE?.fetch)return json({ok:false,error:'Search Intelligence service binding unavailable'},503);
 let body;try{body=await c.request.json()}catch{return json({ok:false,error:'Invalid JSON'},400)}
 if(typeof body?.url!=='string'||body.url.length>800)return json({ok:false,error:'One URL is required'},400);
 let url;try{url=new URL(body.url)}catch{return json({ok:false,error:'Provide a complete HTTPS OceanLiners.net URL'},400)}
 if(url.protocol!=='https:'||!['oceanliners.net','www.oceanliners.net'].includes(url.hostname)||url.username||url.password||url.port)return json({ok:false,error:'Only HTTPS OceanLiners.net URLs are permitted'},400);
 url.search='';url.hash='';
 try{
  const response=await c.env.SEARCH_INTELLIGENCE_SERVICE.fetch('https://search-intelligence.internal/api/url-inspection',{
   method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({urls:[url.href]}),signal:AbortSignal.timeout(25000)});
  if(!(response.headers.get('content-type')||'').includes('application/json'))return json({ok:false,error:'Search Intelligence returned non-JSON (HTTP '+response.status+')'},502);
  const data=await response.json();
  if(!response.ok||data?.ok!==true)return json({ok:false,error:'Search Intelligence inspection failed',upstreamStatus:response.status},502);
  const results=Array.isArray(data.results)?data.results:[];
  if(results.length!==1)return json({ok:false,error:'Inspection did not return exactly one URL result'},502);
  const r=results[0];
  return json({ok:true,source:'Google Search Console URL Inspection via Search Intelligence',
   inspectedAt:new Date().toISOString(),url:r.url||url.href,result:{
    ok:r.ok===true,error:r.ok===true?null:String(r.error||'Inspection unavailable').slice(0,300),
    path:r.path||url.pathname,verdict:r.verdict||null,coverageState:r.coverageState||null,
    robotsTxtState:r.robotsTxtState||null,indexingState:r.indexingState||null,
    pageFetchState:r.pageFetchState||null,lastCrawlTime:r.lastCrawlTime||null,
    googleCanonical:r.googleCanonical||null,userCanonical:r.userCanonical||null,
    diagnostics:r.diagnostics||{classification:'unverified',signals:[],note:'No diagnostics returned'}}});
 }catch(e){return json({ok:false,error:e?.name==='TimeoutError'?'Inspection timed out':'Inspection unavailable'},502)}
}
