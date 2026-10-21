// Read-only private R2 archive. Configure Pages R2 binding RESEARCH_DOSSIERS_R2.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const validRun=r=>/^[0-9]{1,20}$/.test(r);
const validFile=f=>/^[a-z0-9][a-z0-9._-]*\.(md|evidence\.json)$/.test(f);
const validEntry=f=>f&&validFile(f.name)&&Number.isInteger(f.bytes)&&f.bytes>=0&&f.bytes<=1048576&&/^[a-f0-9]{64}$/.test(f.sha256);
async function loadManifest(bucket,run){
 const object=await bucket.get('runs/'+run+'/manifest.json');
 if(!object)return null;
 if(object.size>131072)throw Error('Oversized manifest');
 const m=JSON.parse(await object.text());
 if(m.schema_version!==1||m.run_id!==run||!Array.isArray(m.files))throw Error('Bad manifest');
 return m;
}
export async function onRequestGet({env,request}){
 const bucket=env.RESEARCH_DOSSIERS_R2;
 if(!bucket)return json({ok:false,error:'Private R2 binding RESEARCH_DOSSIERS_R2 is not configured'},503);
 const url=new URL(request.url),run=url.searchParams.get('run'),file=url.searchParams.get('file');
 if(file&&!run)return json({ok:false,error:'Run ID required'},400);
 try{
  if(run!==null){
   if(!validRun(run))return json({ok:false,error:'Invalid run ID'},400);
   const manifest=await loadManifest(bucket,run);
   if(!manifest)return json({ok:false,error:'Run not found'},404);
   const files=manifest.files.filter(validEntry);
   if(!file)return json({ok:true,run_id:run,editorial_status:'unverified_pending_editorial_review',manifest:{...manifest,files}});
   const entry=files.find(f=>f.name===file);
   if(!entry)return json({ok:false,error:'File absent from manifest'},404);
   const object=await bucket.get('runs/'+run+'/'+file);
   if(!object)return json({ok:false,error:'File not found'},404);
   if(object.size!==entry.bytes||object.size>1048576)return json({ok:false,error:'Archive size mismatch'},409);
   const bytes=await object.arrayBuffer();
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
   const checksum=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
   if(checksum!==entry.sha256)return json({ok:false,error:'Archive checksum mismatch'},409);
   return json({ok:true,run_id:run,file,content:new TextDecoder('utf-8',{fatal:true}).decode(bytes),editorial_status:'unverified_pending_editorial_review'});
  }
  const cursor=url.searchParams.get('cursor')||undefined;
  if(cursor&&cursor.length>1024)return json({ok:false,error:'Invalid cursor'},400);
  const listed=await bucket.list({prefix:'runs/',delimiter:'/',limit:100,cursor});
  const runs=[];
  for(const prefix of listed.delimitedPrefixes||[]){
   if(!/^runs\/[0-9]{1,20}\/$/.test(prefix))continue;
   const id=prefix.slice(5,-1);
   try{const manifest=await loadManifest(bucket,id);if(manifest)runs.push({run_id:id,files:manifest.files.filter(validEntry).map(f=>({name:f.name,bytes:f.bytes})),legacy_markdown_only:!!manifest.legacy_markdown_only,editorial_status:'unverified_pending_editorial_review'});}
   catch{runs.push({run_id:id,files:[],error:'Manifest unreadable'});}
  }
  return json({ok:true,runs,next_cursor:listed.truncated?listed.cursor:null});
 }catch{return json({ok:false,error:'Unable to read private research archive'},502);}
}
