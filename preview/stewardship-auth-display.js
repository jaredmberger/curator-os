const allowedStages=new Set(['trusted_configuration_unavailable','signed_assertion_missing','ambiguous_credentials','malformed_assertion','authorized','signing_keys_unavailable','signed_assertion_not_accepted']);
export async function checkAuthorizationStage({fetcher=fetch,doc=document}={}){
 const output=doc.getElementById('auth-diagnostic-result');
 output.textContent='Checking diagnostic route…';
 try{
  const response=await fetcher('/api/stewardship-auth-diagnostic',{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'manual',headers:{accept:'application/json'}});
  if(response.status===404){output.textContent='HTTP 404: diagnostic disabled or route not deployed (empty response expected).';return;}
  if(response.status===401||response.status===403){output.textContent='HTTP '+response.status+': Access or route authorization blocked the diagnostic.';return;}
  if(!response.ok){output.textContent='HTTP '+response.status+': diagnostic unavailable.';return;}
  if(!(response.headers.get('content-type')||'').includes('application/json')){output.textContent='HTTP 200: unexpected non-JSON content; verify Access routing.';return;}
  const raw=await response.text();if(raw.length>1024)throw Error('oversize');
  const data=JSON.parse(raw);
  output.textContent=data.available===true&&allowedStages.has(data.stage)?'Diagnostic stage: '+data.stage:'Unexpected diagnostic response. No status inferred.';
 }catch{output.textContent='Diagnostic request failed or was intercepted. No authorization result inferred.';}
}
if(typeof document!=='undefined'&&document.getElementById('auth-diagnostic-check')){
 document.getElementById('auth-diagnostic-check').addEventListener('click',()=>checkAuthorizationStage());
}
