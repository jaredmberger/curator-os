// Read-only live GitHub PR check, deliberately separate from manually recorded incorporation status.
// Public repository metadata only; no GitHub token, mutations, or deployment assertions.
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
export async function onRequestGet({request,env}){
 if(!env.CURATOROS_RECORDS)return respond({ok:false,error:'Private research context unavailable'},503);
 const url=new URL(request.url),raw=url.searchParams.get('pr');
 if(!raw||!/^https:\/\/github\.com\/jaredmberger\/Ocean-Liner-Curator\/pull\/[1-9]\d*$/.test(raw))return respond({ok:false,error:'Invalid PR URL'},400);
 const id=raw.split('/').at(-1);
 try{
  const response=await fetch('https://api.github.com/repos/jaredmberger/Ocean-Liner-Curator/pulls/'+id,{headers:{'accept':'application/vnd.github+json','user-agent':'Ocean-Liner-Curator-CuratorOS','x-github-api-version':'2022-11-28'},redirect:'error'});
  if(!response.ok)return respond({ok:false,error:'GitHub PR status unavailable',upstream_status:response.status},502);
  const data=await response.json();
  if(data.number!==Number(id)||data.base?.repo?.full_name!=='jaredmberger/Ocean-Liner-Curator')return respond({ok:false,error:'Unexpected GitHub PR metadata'},502);
  return respond({ok:true,pr_url:raw,number:data.number,title:data.title,state:data.state,draft:data.draft,merged:data.merged===true,merged_at:data.merged_at||null,base:data.base.ref,head_sha:data.head.sha,checked_at:new Date().toISOString(),deployment_verified:false});
 }catch{return respond({ok:false,error:'GitHub status lookup failed'},502)}
}
