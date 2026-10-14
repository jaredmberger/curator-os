const pathOK=x=>typeof x==='string'&&/^\/ships\/[a-z0-9][a-z0-9-]{0,120}$/.test(x);
const validCount=x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000;
export function validateInventory(x){
 if(!x||x.contractVersion!==1||x.scope!=='ship-guide-stewardship-offline-inventory'||!Number.isFinite(Date.parse(x.observedAt))||!Array.isArray(x.guides)||!x.guides.length||x.guides.length>10000||!x.coverage||x.coverage.completeness!=='export-scoped-not-live-certification'||x.coverage.listedGuides!==x.guides.length||!validCount(x.coverage.linkObservations)||x.coverage.linkObservations>x.guides.length)return false;
 const seen=new Set();
 return x.guides.every(g=>{
  if(!g||!pathOK(g.path)||seen.has(g.path)||g.sourceUrl!=='https://oceanliners.net'+g.path||!g.checks||!Array.isArray(g.candidates)||g.candidates.length>1000)return false;
  seen.add(g.path);
  return g.checks.archiveInventory==='listed'&&['observed','unknown'].includes(g.checks.staticLinkAudit)&&(g.checks.contextualIncoming===null||validCount(g.checks.contextualIncoming))&&g.checks.historicalAccuracy==='not-assessed'&&g.checks.externalCitationValidity==='not-assessed'&&g.candidates.every(c=>c&&['contextual-link-review','inventory-notice','historical-consistency-review'].includes(c.kind)&&c.verification==='unverified'&&typeof c.note==='string'&&c.note.length<=500);
 })&&x.guides.filter(g=>g.checks.staticLinkAudit==='observed').length===x.coverage.linkObservations;
}
export function renderInventory(data,doc=document){
 if(!validateInventory(data))throw new TypeError('Invalid ship stewardship export');
 const search=doc.getElementById('ship-search'),result=doc.getElementById('ship-results'),count=doc.getElementById('ship-count');
 doc.getElementById('inventory-meta').textContent='Offline export generated '+new Date(data.observedAt).toLocaleString()+' · '+data.coverage.listedGuides+' listed guides · '+data.coverage.linkObservations+' link observations · Snapshot is not a live audit.';
 const draw=()=>{
  const term=search.value.trim().toLowerCase();const matches=data.guides.filter(g=>g.path.includes(term));
  count.textContent=matches.length+' matching guides; showing first '+Math.min(matches.length,40)+'.';
  result.replaceChildren();
  for(const g of matches.slice(0,40)){
   const card=doc.createElement('article');card.className='finding';
   const heading=doc.createElement('strong');heading.textContent=g.path.slice('/ships/'.length).replaceAll('-',' ');
   const link=doc.createElement('a');link.href=g.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open published guide ↗';
   const detail=doc.createElement('p');detail.textContent='Static link audit: '+g.checks.staticLinkAudit+' · Contextual incoming: '+(g.checks.contextualIncoming===null?'unknown':g.checks.contextualIncoming)+' · Historical accuracy: not assessed · Citations: not assessed';
   card.append(heading,doc.createElement('p'),link,detail);
   if(!g.candidates.length){const p=doc.createElement('p');p.textContent='No candidates in supplied observations; remaining checks may be unknown.';card.append(p);}
   else for(const candidate of g.candidates){const p=doc.createElement('p');p.textContent='Review candidate ('+candidate.kind+'): '+candidate.note;card.append(p);}
   result.append(card);
  }
 };
 search.oninput=draw;draw();doc.getElementById('ship-inspection').hidden=false;
}
export async function loadInventoryFile(file,doc=document){
 const status=doc.getElementById('inventory-status');doc.getElementById('ship-inspection').hidden=true;
 if(!file){status.textContent='No export selected; ship guide status unknown.';return;}
 try{
  if(file.size>4000000)throw new Error('too large');
  const parsed=JSON.parse(await file.text());renderInventory(parsed,doc);
  status.textContent='Local export loaded for read-only inspection. No data uploaded.';
 }catch{status.textContent='Invalid or unsupported export. Nothing was loaded; observations remain unknown.';}
}
if(typeof document!=='undefined'&&document.getElementById('inventory-file')){
 document.getElementById('inventory-file').addEventListener('change',e=>loadInventoryFile(e.target.files?.[0]));
}
