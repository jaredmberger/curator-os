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
    if(payload?.ok!==true||payload?.storage!=='kv'){
      throw new Error('Permanent Project Records write was not confirmed by KV storage.');
    }

    localStorage.setItem(CACHE_KEY,JSON.stringify(records));
    writeMeta({
      mode:'remote',
      permanent:true,
      recordCount:records.length,
      savedAt:new Date().toISOString(),
      version:payload?.version||null,
      storage:'kv',
      key:payload?.key||'project-records'
    });
    window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'remote-save'}}));
    return payload;
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

async function replace(records,reason='replace'){return save(records,reason)}
function readCache(){try{const parsed=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');return Array.isArray(parsed)?parsed:[]}catch{return[]}}
function getStatus(){try{return JSON.parse(localStorage.getItem(STORE_META_KEY)||'null')}catch{return null}}
function writeMeta(meta){localStorage.setItem(STORE_META_KEY,JSON.stringify(meta));window.dispatchEvent(new CustomEvent('curatoros:project-store-status',{detail:meta}));}
