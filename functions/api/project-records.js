export async function onRequestGet(context){
  const store=context.env.CURATOROS_RECORDS;
  if(!store)return json({ok:false,error:'CURATOROS_RECORDS binding is not configured.'},500);
  const raw=await store.get('project-records','json');
  const payload=raw&&Array.isArray(raw.records)?raw:{records:[],version:0,updatedAt:null};
  return json({...payload,ok:true,storage:'kv',key:'project-records'},200);
}

export async function onRequestPut(context){
  const store=context.env.CURATOROS_RECORDS;
  if(!store)return json({ok:false,error:'CURATOROS_RECORDS binding is not configured.'},500);
  let body;
  try{body=await context.request.json();}catch{return json({ok:false,error:'Invalid JSON body.'},400)}
  if(!Array.isArray(body?.records))return json({ok:false,error:'records must be an array.'},400);
  const previous=await store.get('project-records','json');
  const version=Number(previous?.version||0)+1;
  const payload={records:body.records,version,updatedAt:new Date().toISOString(),reason:String(body.reason||'update')};
  await store.put('project-records',JSON.stringify(payload));
  return json({ok:true,storage:'kv',key:'project-records',version,recordCount:body.records.length,updatedAt:payload.updatedAt},200);
}

function json(value,status){return new Response(JSON.stringify(value,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
