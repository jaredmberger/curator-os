const IDS=['site-health','curator-integrity'];
const states=new Set(['healthy','unknown']),freshness=new Set(['fresh','stale','missing','unknown']);
export function validateHeartbeatEnvelope(data){
 if(!data||data.available!==true||data.contractVersion!==1||data.scope!=='scheduled-monitor-heartbeats-only'||!Array.isArray(data.sources)||data.sources.length!==2)return false;
 return IDS.every(id=>{
  const s=data.sources.find(x=>x?.source===id);
  return s&&typeof s.connected==='boolean'&&s.scope==='scheduled-monitor-heartbeat-only'&&states.has(s.state)&&freshness.has(s.freshness)&&s.coverage?.reportedChecks===null&&s.coverage?.listedChecks===null&&s.coverage?.completeness==='unknown'&&s.findings?.count===null&&s.findings?.completeness==='unknown'&&
   (s.connected?(typeof s.checkedAt==='string'&&Number.isFinite(Date.parse(s.checkedAt))&&typeof s.maxAgeMinutes==='number'&&s.maxAgeMinutes>0):(s.state==='unknown'&&s.freshness==='unknown'));
 });
}
export function renderHeartbeats(data,doc=document){
 if(!validateHeartbeatEnvelope(data))throw Error('unexpected_heartbeat_contract');
 const area=doc.getElementById('heartbeat-sources');area.replaceChildren();
 for(const id of IDS){
  const s=data.sources.find(row=>row.source===id);
  const card=doc.createElement('article');card.className='source heartbeat-card';
  const title=doc.createElement('strong');title.textContent=id==='site-health'?'Site Health':'Curator Integrity';
  const state=doc.createElement('p');state.className='freshness '+s.freshness;
  state.textContent=s.connected?'Scheduled monitor: '+s.state+' · '+s.freshness:'Not connected · unknown';
  const detail=doc.createElement('p');
  detail.textContent=s.connected?'Last success: '+(s.lastSuccessAt?new Date(s.lastSuccessAt).toLocaleString():'unknown')+' · source freshness limit: '+s.maxAgeMinutes+' minutes': 'Source disabled or unavailable; no health conclusion.';
  const caveat=doc.createElement('p');caveat.className='help';caveat.textContent='Scan coverage: unknown · Scan findings: unknown';
  card.append(title,state,detail,caveat);area.append(card);
 }
}
export async function loadHeartbeats({fetcher=fetch,doc=document}={}){
 const status=doc.getElementById('heartbeat-status'),area=doc.getElementById('heartbeat-sources');
 status.textContent='Checking scheduled monitors…';area.replaceChildren();
 try{
  const response=await fetcher('/api/stewardship-heartbeats',{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'manual',headers:{accept:'application/json'}});
  if(!response.ok){status.textContent=response.status===404?'Heartbeat reads disabled':response.status===401||response.status===403?'Operator authorization unavailable':'Heartbeat sources unavailable; status unknown';return;}
  if(!(response.headers.get('content-type')||'').includes('application/json'))throw Error('content_type');
  const raw=await response.text();if(raw.length>32768)throw Error('oversize');
  renderHeartbeats(JSON.parse(raw),doc);status.textContent='Independent scheduled-monitor heartbeat summaries';
 }catch{status.textContent='Unable to validate heartbeat report; source status unknown';}
}
if(typeof document!=='undefined'&&document.getElementById('heartbeat-sources')){
 document.getElementById('refresh')?.addEventListener('click',()=>loadHeartbeats());
 loadHeartbeats();
}
