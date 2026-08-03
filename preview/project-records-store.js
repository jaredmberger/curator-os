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
    writeMeta({mode:'remote',recordCount:records.length,loadedAt:new Date().toISOString(),version:payload?.version||null});
    window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'remote-load'}}));
    return records;
  }catch(error){
    const cached=readCache();
    writeMeta({mode:'cache',recordCount:cached.length,loadedAt:new Date().toISOString(),error:String(error?.message||error)});
    return cached;
  }
}

async function save(records,reason='update'){
  if(!Array.isArray(records))throw new Error('Project Records must be an array.');
  localStorage.setItem(CACHE_KEY,JSON.stringify(records));
  try{
    const response=await fetch(API_PATH,{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({records,reason})});
    if(!response.ok)throw new Error(`Project Records store returned ${response.status}`);
    const payload=await response.json();
    writeMeta({mode:'remote',recordCount:records.length,savedAt:new Date().toISOString(),version:payload?.version||null});
    return payload;
  }catch(error){
    writeMeta({mode:'cache-pending',recordCount:records.length,savedAt:new Date().toISOString(),error:String(error?.message||error)});
    throw error;
  }
}

async function replace(records,reason='replace'){return save(records,reason)}
function readCache(){try{const parsed=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');return Array.isArray(parsed)?parsed:[]}catch{return[]}}
function getStatus(){try{return JSON.parse(localStorage.getItem(STORE_META_KEY)||'null')}catch{return null}}
function writeMeta(meta){localStorage.setItem(STORE_META_KEY,JSON.stringify(meta));window.dispatchEvent(new CustomEvent('curatoros:project-store-status',{detail:meta}));}
