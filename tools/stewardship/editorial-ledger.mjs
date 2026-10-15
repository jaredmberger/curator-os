// Personal, browser-local editorial decisions; never changes the archive or audit export.
// Candidate identity is based on exact source path, kind and wording; changed
// audit evidence creates a fresh undecided candidate instead of inheriting approval.
export const LEDGER_STORAGE_KEY='curatoros:editorial-ledger:v1';
export const STATES=['needs-research','accepted','not-warranted','resolved'];
const pathOK=x=>typeof x==='string'&&/^\/ships\/[a-z0-9][a-z0-9-]{0,120}$/.test(x);
const kinds=new Set(['contextual-link-review','inventory-notice','historical-consistency-review']);
export const candidateId=(path,c)=>JSON.stringify([path,c.kind,c.note]);
export function validLedger(value){
 if(!value||value.version!==1||!Array.isArray(value.entries)||value.entries.length>10000)return false;
 const seen=new Set();
 return value.entries.every(e=>{
  if(!e||!pathOK(e.path)||!kinds.has(e.kind)||typeof e.candidateNote!=='string'||e.candidateNote.length>500||!STATES.includes(e.status)||typeof e.note!=='string'||e.note.length>2000||!Number.isFinite(Date.parse(e.updatedAt)))return false;
  const id=candidateId(e.path,{kind:e.kind,note:e.candidateNote});
  if(seen.has(id))return false;seen.add(id);return true;
 });
}
export const emptyLedger=()=>({version:1,entries:[]});
export function putDecision(ledger,path,c,status,note,updatedAt=new Date().toISOString()){
 if(!validLedger(ledger)||!pathOK(path)||!kinds.has(c?.kind)||typeof c.note!=='string'||c.note.length>500||!STATES.includes(status)||typeof note!=='string'||note.length>2000||!Number.isFinite(Date.parse(updatedAt)))throw Error('Invalid editorial decision');
 const id=candidateId(path,c);
 const entries=ledger.entries.filter(e=>candidateId(e.path,{kind:e.kind,note:e.candidateNote})!==id);
 entries.push({path,kind:c.kind,candidateNote:c.note,status,note,updatedAt});
 const next={version:1,entries};if(!validLedger(next))throw Error('Invalid ledger');return next;
}
export function decisionFor(ledger,path,c){
 return ledger.entries.find(e=>candidateId(e.path,{kind:e.kind,note:e.candidateNote})===candidateId(path,c))||null;
}
export function readLedger(storage){
 try{const x=JSON.parse(storage.getItem(LEDGER_STORAGE_KEY));return validLedger(x)?x:emptyLedger();}catch{return emptyLedger();}
}
export function saveLedger(storage,ledger){
 if(!validLedger(ledger))throw Error('Invalid ledger');
 storage.setItem(LEDGER_STORAGE_KEY,JSON.stringify(ledger));
}
export function mergeLedger(current,imported){
 if(!validLedger(current)||!validLedger(imported))throw Error('Invalid ledger import');
 const rows=new Map();
 for(const e of [...current.entries,...imported.entries]){
  const key=candidateId(e.path,{kind:e.kind,note:e.candidateNote}),previous=rows.get(key);
  if(!previous||Date.parse(e.updatedAt)>Date.parse(previous.updatedAt))rows.set(key,e);
 }
 const result={version:1,entries:[...rows.values()]};
 if(!validLedger(result))throw Error('Ledger exceeds supported size');
 return result;
}
