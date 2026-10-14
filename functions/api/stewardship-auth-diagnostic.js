// Diagnostic is strictly stage-only. No token, cookie, email, audience, key, or claims
// are returned. This endpoint remains behind the existing Cloudflare Access policy.
// Enabled only by a separate operator-owned feature flag.
import {createOperatorAuthorizationFromBindings} from '../../tools/stewardship/operator-runtime-adapter.mjs';
import {diagnoseAccessRequest} from '../../tools/stewardship/access-stage-diagnostic.mjs';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-robots-tag':'noindex, nofollow, noarchive','x-content-type-options':'nosniff'};
export const createDiagnosticHandler=(authorizerFactory=createOperatorAuthorizationFromBindings)=>async ({request,env})=>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,allow:'GET'}});
 if(env?.STEWARDSHIP_AUTH_DIAGNOSTIC_ENABLED!=='true')return new Response(null,{status:404,headers});
 const result=await diagnoseAccessRequest(request,env,authorizerFactory);
 return new Response(JSON.stringify(result),{status:200,headers});
};
export const onRequest=createDiagnosticHandler();
