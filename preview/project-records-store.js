const CACHE_KEY='curatoros.rebuilt.catalog';
const STORE_META_KEY='curatoros.project.storeMeta';
const API_PATH='/api/project-records';
const HEALTH_PATH='/api/project-records/health';

window.CuratorOSProjectRecordsStore={load,save,replace,getStatus,health};

async function health(){
  const response=await fetch(HEALTH_PATH,{headers:{accept:'application/json'},cache:'no-store'});
  const payload=await readJsonResponse(response);
  if(!response.ok||payload?.service!=='curatoros-project-records'||payload?.storage!=='kv'){
    throw new Error(payload?.error||`Durable Project Records backend is not active (${response.status}).`);
  }
  return payload;
}

async function load(){
  try{
    const response=await fetch(API_PATH,{headers:{accept:'application/json'},cache:'no-store'});
    const payload=await readJsonResponse(response);
    if(!response.ok)throw new Error(payload?.error||`Project Records store returned ${response.status}`);
    if(payload?.ok!==true||payload?.storage!=='kv'||!Array.isArray(payload?.records)){
      throw new Error('Project Records response did not come from the durable KV backend.');
    }
    const records=payload.records;
    localStorage.setItem(CACHE_KEY,JSON.stringify(records));
    writeMeta({mode:'remote',permanent:true,recordCount:records.length,loadedAt:new Date().toISOString(),version:payload?.version||0,storage:'kv',key:payload?.key||'project-records'});
    window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'remote-load'}}));
    return records;
  }catch(error){
    const cached=readCache();
    writeMeta({mode:'cache',permanent:false,recordCount:cached.length,loadedAt:new Date().toISOString(),error:String(error?.message||error)});
    return cached;
  }
}

async function save(records,reason='update'){
  if(!Array.isArray(records))throw new Error('Project Records must be an array.');

  try{
    const response=await fetch(API_PATH,{
      method:'PUT',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({records,reason})
    });

    const payload=await readJsonResponse(response);

    if(!response.ok){
      throw new Error(payload?.error||`Project Records store returned ${response.status}`);
    }

    const confirmedByResponse=payload?.ok===true&&payload?.storage==='kv'&&payload?.service==='curatoros-project-records';
    const verification=confirmedByResponse?null:await verifyRemoteRecords(records,payload?.version);
    if(!confirmedByResponse&&!verification?.confirmed){
      throw new Error('Permanent Project Records write could not be verified after save.');
    }

    const confirmedVersion=payload?.version||verification?.version||null;
    localStorage.setItem(CACHE_KEY,JSON.stringify(records));
    writeMeta({
      mode:'remote',
      permanent:true,
      recordCount:records.length,
      savedAt:new Date().toISOString(),
      version:confirmedVersion,
      storage:'kv',
      key:payload?.key||'project-records',
      confirmation:confirmedByResponse?'worker-response':'read-back'
    });
    window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'remote-save'}}));
    return {...(payload||{}),ok:true,storage:'kv',verified:true,version:confirmedVersion};
  }catch(error){
    localStorage.setItem(CACHE_KEY,JSON.stringify(records));
    writeMeta({
      mode:'cache-pending',
      permanent:false,
      recordCount:records.length,
      savedAt:new Date().toISOString(),
      error:String(error?.message||error)
    });
    throw error;
  }
}

async function verifyRemoteRecords(expectedRecords,expectedVersion){
  try{
    const response=await fetch(API_PATH,{headers:{accept:'application/json'},cache:'no-store'});
    const payload=await readJsonResponse(response);
    if(!response.ok||payload?.storage!=='kv'||payload?.ok!==true)return{confirmed:false};
    const remoteRecords=Array.isArray(payload?.records)?payload.records:null;
    if(!remoteRecords)return{confirmed:false};
    const versionMatches=!expectedVersion||!payload?.version||Number(payload.version)>=Number(expectedVersion);
    const recordsMatch=stableStringify(remoteRecords)===stableStringify(expectedRecords);
    return{confirmed:recordsMatch&&versionMatches,version:payload?.version||null};
  }catch{
    return{confirmed:false};
  }
}

async function readJsonResponse(response){
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('application/json')){
    throw new Error('Durable Project Records API route is not active; the request did not reach the CuratorOS Worker.');
  }
  try{return await response.json()}catch{throw new Error('Durable Project Records API returned invalid JSON.');}
}

function stableStringify(value){
  if(Array.isArray(value))return`[${value.map(stableStringify).join(',')}]`;
  if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function replace(records,reason='replace'){return save(records,reason)}
function readCache(){try{const parsed=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');return Array.isArray(parsed)?parsed:[]}catch{return[]}}
function getStatus(){try{return JSON.parse(localStorage.getItem(STORE_META_KEY)||'null')}catch{return null}}
function writeMeta(meta){localStorage.setItem(STORE_META_KEY,JSON.stringify(meta));window.dispatchEvent(new CustomEvent('curatoros:project-store-status',{detail:meta}));}
