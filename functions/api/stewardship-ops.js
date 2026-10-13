// Stewardship Mode: narrow, opt-in and fail-closed operational status bridge.
// IMPORTANT: Not activated by repository code alone. Requires BOTH explicit
// STEWARDSHIP_OPS_READ_ENABLED=true and an independently trusted operator
// authorizer binding. Do not treat an Access header or cookie as verified identity.
import { projectSafeOperationalState } from '../../tools/stewardship/ops-safe-projection.mjs';

const headers = { 'cache-control':'no-store', 'x-robots-tag':'noindex, nofollow, noarchive',
 'x-content-type-options':'nosniff' };
const reply = (status, reason) => new Response(JSON.stringify({available:false,reason}),{
 status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});
const UPSTREAM = 'https://ops.oceanlinercurator.com/api/operational-state';

export async function onRequest({request,env}) {
 if(request.method!=='GET') return new Response(null,{status:405,headers:{...headers,allow:'GET'}});
 if(env?.STEWARDSHIP_OPS_READ_ENABLED!=='true') return reply(404,'disabled');
 // This authorizer is deliberately NOT bound in production. An operator-auth
 // review must implement and configure it separately; absence denies access.
 if(typeof env?.STEWARDSHIP_OPERATOR_AUTHZ?.authorize!=='function') return reply(403,'authorization_unavailable');
 let allowed=false;
 try { allowed=(await env.STEWARDSHIP_OPERATOR_AUTHZ.authorize(request))===true; }
 catch { return reply(403,'authorization_unavailable'); }
 if(!allowed) return reply(403,'forbidden');
 if(typeof env?.CURATOR_OPS?.fetch!=='function') return reply(503,'source_unavailable');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),5000);
 try {
  const response=await env.CURATOR_OPS.fetch(new Request(UPSTREAM,{
    method:'GET',headers:{accept:'application/json'},redirect:'manual',signal:controller.signal
  }));
  if(response.status>=300&&response.status<400||response.status===401||response.status===403)
    return reply(503,'source_access_unavailable');
  if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))
    return reply(503,'source_unavailable');
  const payload=await response.json();
  const safe=projectSafeOperationalState(payload);
  const observed=Date.parse(safe.generatedAt);
  const age=Date.now()-observed;
  if(!Number.isFinite(age)||age<0||age>20*60*1000) return reply(503,'source_stale');
  return new Response(JSON.stringify({available:true,...safe}),{
   status:200,headers:{...headers,'content-type':'application/json; charset=utf-8'}
  });
 }catch{return reply(503,'source_unavailable');}
 finally{clearTimeout(timeout);}
}
