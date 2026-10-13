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
 const allowed=await createOperatorAuthorizationFromBindings(env).authorize(request);
 if(!allowed) return new Response(JSON.stringify({available:false,reason:'forbidden'}),{status:403,headers});
 return new Response(JSON.stringify({kind:'stewardship-auth-test',environment:'staging-test-only',sensitiveData:false,authorized:true}),{status:200,headers});
}
