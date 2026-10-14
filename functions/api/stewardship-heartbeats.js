// Additional Stewardship heartbeat reader. All sources disabled by default.
// No scan findings, audit content, remediation operations, or user-supplied URLs.
import { createOperatorAuthorizationFromBindings } from '../../tools/stewardship/operator-runtime-adapter.mjs';
import { projectOpsHeartbeat,disconnectedHeartbeat } from '../../tools/stewardship/verified-heartbeat-adapters.mjs';
const SETTINGS=[
 {id:'site-health',flag:'STEWARDSHIP_SITE_HEALTH_READ_ENABLED',binding:'STEWARDSHIP_SITE_HEALTH',url:'https://site-health.oceanliners.net/api/ops-health'},
 {id:'curator-integrity',flag:'STEWARDSHIP_INTEGRITY_READ_ENABLED',binding:'STEWARDSHIP_INTEGRITY',url:'https://integrity.oceanliners.net/api/ops-health'}
];
const headers={'cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive','x-content-type-options':'nosniff','content-type':'application/json; charset=utf-8'};
const respond=(status,payload)=>new Response(JSON.stringify(payload),{status,headers});
async function readOne(env,s){
 if(env?.[s.flag]!=='true')return {...disconnectedHeartbeat(s.id),reason:'disabled'};
 if(typeof env?.[s.binding]?.fetch!=='function')return {...disconnectedHeartbeat(s.id),reason:'binding_unavailable'};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{
  const response=await env[s.binding].fetch(new Request(s.url,{method:'GET',headers:{accept:'application/json'},redirect:'manual',signal:controller.signal}));
  if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return {...disconnectedHeartbeat(s.id),reason:'source_unavailable'};
  // Limit actual body length, independent of Content-Length reporting.
  const reader=response.body?.getReader();if(!reader)return {...disconnectedHeartbeat(s.id),reason:'source_unavailable'};
  let bytes=0;const parts=[];
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>32768){await reader.cancel();throw new Error('oversized');}parts.push(value);}
  const body=new Uint8Array(bytes);let offset=0;for(const p of parts){body.set(p,offset);offset+=p.byteLength;}
  const raw=JSON.parse(new TextDecoder().decode(body));
  return {connected:true,...projectOpsHeartbeat(raw,s.id)};
 }catch{return {...disconnectedHeartbeat(s.id),reason:'source_unavailable'};}
 finally{clearTimeout(timer);}
}
export const createHeartbeatHandler=(authorizerFactory=createOperatorAuthorizationFromBindings)=>async ({request,env})=>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,allow:'GET'}});
 if(!SETTINGS.some(s=>env?.[s.flag]==='true'))return respond(404,{available:false,reason:'disabled'});
 let allowed=false;try{allowed=(await authorizerFactory(env).authorize(request))===true;}catch{return respond(403,{available:false,reason:'authorization_unavailable'});}
 if(!allowed)return respond(403,{available:false,reason:'forbidden'});
 const sources=await Promise.all(SETTINGS.map(s=>readOne(env,s)));
 return respond(200,{available:true,contractVersion:1,scope:'scheduled-monitor-heartbeats-only',sources});
};
export const onRequest=createHeartbeatHandler();
