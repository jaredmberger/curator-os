// Compatibility shim for CuratorOS v0.6.1.
// Corpus Intelligence v0.6.0 checked data.maidenVoyage while Ship schema v2 stores data.maidenVoyageDate.
// This shim mirrors the canonical value into the legacy analysis key in the browser cache only.
const KEY='curatoros.rebuilt.catalog';
try{
  const records=JSON.parse(localStorage.getItem(KEY)||'[]');
  if(Array.isArray(records)){
    let changed=false;
    for(const record of records){
      if((record?.type==='ship'||String(record?.id||'').startsWith('ship:'))&&record?.data?.maidenVoyageDate&&!record.data.maidenVoyage){
        record.data.maidenVoyage=record.data.maidenVoyageDate;
        changed=true;
      }
    }
    if(changed)localStorage.setItem(KEY,JSON.stringify(records));
  }
}catch{}
