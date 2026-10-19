// Read-only private research dossier access. Requires Cloudflare Access at the hostname.
// Bind R2 bucket to RESEARCH_DOSSIERS. Never creates public R2 URLs.
const deny=(status,message)=>new Response(JSON.stringify({ok:false,error:message}),{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const goodRun=id=>/^\d{1,20}$/.test(id||'');
const goodName=name=>/^[a-z0-9][a-z0-9._-]{0,160}$/.test(name||'')&&(name.endsWith('.md')||name.endsWith('.evidence.json')||name==='manifest.json');
export async function onRequestGet({request,env}){
 const url=new URL(request.url),run=url.searchParams.get('run'),file=url.searchParams.get('file');
 if(!goodRun(run)||!goodName(file))return deny(400,'Invalid research file reference');
 if(!env.RESEARCH_DOSSIERS)return deny(503,'Research archive reader not configured');
 const key=`runs/${run}/${file}`;
 const object=await env.RESEARCH_DOSSIERS.get(key);
 if(!object)return deny(404,'Research file not archived');
 if((object.size||0)>1024*1024)return deny(413,'Archive file exceeds review limit');
 return new Response(object.body,{headers:{
  'content-type':file.endsWith('.json')?'application/json; charset=utf-8':'text/plain; charset=utf-8',
  'cache-control':'private, no-store','x-content-type-options':'nosniff',
  'content-security-policy':"default-src 'none'; sandbox",
  'content-disposition':'inline'
 }});
}
