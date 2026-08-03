const CACHE_KEY='curatoros.rebuilt.catalog';
const STORE_META_KEY='curatoros.project.storeMeta';
const API_PATH='/api/project-records';

window.CuratorOSProjectRecordsStore={load,save,replace,getStatus};

async function load(){
  try{
    const response=await fetch(API_PATH,{headers:{accept:'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error(`Project Records store returned ${response.status}`);
    const payload=await response.json();
    const records=Array.isArray(payload?.records)?payload.records:[];
    localStorage.setItem(CACHE_KEY,JSON.stringify(records));
    writeMeta({mode:'remote',permanent:true,recordCount:records.length,loadedAt:new Date().toISOString(),version:payload?.version||0,storage:'kv'});
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

    let payload=null;
    try{payload=await response.json()}catch{}

    if(!response.ok){
      throw new Error(payload?.error||`Project Records store returned ${response.status}`);
    }

    const confirmedByResponse=payload?.ok===true&&payload?.storage==='kv';
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
    if(!response.ok)return{confirmed:false};
    const payload=await response.json();
    const remoteRecords=Array.isArray(payload?.records)?payload.records:null;
    if(!remoteRecords)return{confirmed:false};
    const versionMatches=!expectedVersion||!payload?.version||Number(payload.version)>=Number(expectedVersion);
    const recordsMatch=stableStringify(remoteRecords)===stableStringify(expectedRecords);
    return{confirmed:recordsMatch&&versionMatches,version:payload?.version||null};
  }catch{
    return{confirmed:false};
  }
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
