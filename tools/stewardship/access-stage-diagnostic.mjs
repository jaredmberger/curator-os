// Stage-only diagnosis for a short-lived operator-controlled debugging window.
// No sensitive request material or configuration values leave this module.
export async function diagnoseAccessRequest(request,env,authorizerFactory,fetchKeys=fetch){
 const result=stage=>({available:true,stage});
 if(!env||typeof env.STEWARDSHIP_ACCESS_ISSUER!=='string'||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.STEWARDSHIP_ACCESS_ISSUER)||
    typeof env.STEWARDSHIP_ACCESS_AUDIENCE!=='string'||
    !/^[A-Za-z0-9_-]{8,160}$/.test(env.STEWARDSHIP_ACCESS_AUDIENCE)||
    typeof env.STEWARDSHIP_OPERATOR_EMAIL!=='string'||
    !/^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(env.STEWARDSHIP_OPERATOR_EMAIL))return result('trusted_configuration_unavailable');
 const assertion=request.headers.get('Cf-Access-Jwt-Assertion');
 const cookies=[...(request.headers.get('cookie')||'').matchAll(/(?:^|;\s*)CF_Authorization=([^;]*)/g)];
 if(!assertion&&!cookies.length)return result('signed_assertion_missing');
 if(!assertion&&cookies.length>1)return result('ambiguous_credentials');
 const token=assertion||cookies[0][1];
 if(typeof token!=='string'||token.length>16384||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return result('malformed_assertion');
 let allowed=false;
 try{allowed=(await authorizerFactory(env).authorize(request))===true;}catch{}
 if(allowed)return result('authorized');
 // Distinguish key retrieval failure from rejected signature/claims without
 // decoding or displaying token material or attributing a precise claim failure.
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);
  try{
   const response=await fetchKeys(env.STEWARDSHIP_ACCESS_ISSUER+'/cdn-cgi/access/certs',{method:'GET',headers:{accept:'application/json'},redirect:'manual',signal:controller.signal});
   if(response.status!==200||!(response.headers.get('content-type')||'').includes('application/json'))return result('signing_keys_unavailable');
   const raw=await response.text();
   if(raw.length>65536)return result('signing_keys_unavailable');
   const keys=JSON.parse(raw);
   if(!Array.isArray(keys.keys)||keys.keys.length>20)return result('signing_keys_unavailable');
   return result('signed_assertion_not_accepted');
  }finally{clearTimeout(timer);}
 }catch{return result('signing_keys_unavailable');}
}
