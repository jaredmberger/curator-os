// Staging-only harmless authentication boundary exercise. Never reads Ops data.
// OFF unless explicitly configured in the preview deployment.
import {createOperatorAuthorizationFromBindings} from '../../tools/stewardship/operator-runtime-adapter.mjs';
const headers={'cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive','x-content-type-options':'nosniff','content-type':'application/json; charset=utf-8'};
export async function onRequest({request,env}) {
 if(request.method!=='GET') return new Response(null,{status:405,headers:{...headers,allow:'GET'}});
 if(env?.STAGING_STEWARDSHIP_AUTH_TEST_ENABLED!=='true')
  return new Response(JSON.stringify({available:false,reason:'disabled'}),{status:404,headers});
 // Diagnostic has no token, email, issuer, audience or key contents.
 if (!request.headers.get('Cf-Access-Jwt-Assertion')) return new Response(JSON.stringify({available:false,reason:'access_assertion_missing'}),{status:403,headers});
 // Record only coarse public-key service health, never JWTs, identity or keys.
 let certs='not_checked';
 const tracedFetch=async(url, options)=>{
  try {
   const response=await fetch(url, options);
   certs=response.status===200?'reachable':'unavailable';
   return response;
  } catch {
   certs='unavailable';
   throw new Error('access_key_fetch_failed');
  }
 };
 const allowed=await createOperatorAuthorizationFromBindings(env,{fetchKeys:tracedFetch}).authorize(request);
 if(!allowed) {
  const bindingNames=['STEWARDSHIP_ACCESS_ISSUER','STEWARDSHIP_ACCESS_AUDIENCE','STEWARDSHIP_OPERATOR_EMAIL'];
  const own=key=>!!env&&Object.prototype.hasOwnProperty.call(env,key);
  const configured=bindingNames.every(key=>own(key)&&typeof env[key]==='string');
  const configShape=!configured?'missing_binding':
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.STEWARDSHIP_ACCESS_ISSUER) ||
    !/^[A-Za-z0-9_-]{8,160}$/.test(env.STEWARDSHIP_ACCESS_AUDIENCE) ||
    !/^[^@\\s,]+@[^@\\s,]+\\.[^@\\s,]+$/.test(env.STEWARDSHIP_OPERATOR_EMAIL)?'invalid_binding_format':'valid';
  const assertion=request.headers.get('Cf-Access-Jwt-Assertion')||'';
  const assertionShape=assertion.includes(',')||assertion.length>16384?'invalid_header_format':'accepted_header_format';
  return new Response(JSON.stringify({available:false,reason:'forbidden',keyService:certs,
   configShape,assertionShape}),{status:403,headers});
 }
 return new Response(JSON.stringify({kind:'stewardship-auth-test',environment:'staging-test-only',sensitiveData:false,authorized:true}),{status:200,headers});
}
