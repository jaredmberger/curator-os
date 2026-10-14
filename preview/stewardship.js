import {deriveReviewQueue} from '../tools/stewardship/review-queue.mjs';
const byId=id=>document.getElementById(id);
const set=(id,value)=>{byId(id).textContent=String(value)};
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n};
const VALID_STATES=new Set(['healthy','degraded','attention']);
const VALID_FRESHNESS=new Set(['fresh','stale','missing']);
const VALID_ROLES=new Set(['root','independent','symptom']);
const VALID_SEVERITIES=new Set(['attention','degraded']);
const idOk=x=>typeof x==='string'&&/^[A-Za-z0-9_:.-]{1,100}$/.test(x);
const countOk=x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000;
export function validateReport(r){
 if(!r||r.available!==true||r.contractVersion!==1||r.scope!=='ops-operational-state-summary'||!VALID_STATES.has(r.state)||!r.coverage||!Array.isArray(r.sources)||!Array.isArray(r.findings)||!Number.isFinite(Date.parse(r.generatedAt)))return false;
 const c=r.coverage;
 if(!countOk(c.reportedSources)||!countOk(c.listedSources)||!countOk(c.reportedFindings)||c.listedSources!==r.sources.length||c.reportedFindings!==r.findings.length||c.listedSources>c.reportedSources||c.completeness!=='operational-state-only')return false;
 return r.sources.every(s=>s&&idOk(s.id)&&VALID_FRESHNESS.has(s.freshness))&&r.findings.every(f=>f&&idOk(f.id)&&VALID_ROLES.has(f.role)&&VALID_SEVERITIES.has(f.severity));
}
export function assessReport(r,nowMs=Date.now()){
 if(!validateReport(r))throw Error('unexpected_contract');
 const ageMs=nowMs-Date.parse(r.generatedAt);
 const stale=ageMs>20*60*1000,clockSkew=ageMs< -60*1000;
 const notFresh=r.sources.filter(s=>s.freshness!=='fresh');
 const unlisted=r.coverage.reportedSources-r.coverage.listedSources;
 return {ageMs,stale,clockSkew,notFresh:notFresh.length,unlisted,
  needsReview:stale||clockSkew||notFresh.length>0||unlisted>0||r.findings.length>0};
}
export function renderReport(r,doc=document){
 if(!validateReport(r))throw Error('unexpected_contract');
 const node=id=>doc.getElementById(id);
 const write=(id,value)=>{node(id).textContent=String(value)};
 write('state',r.state);
 node('state').className='state-label '+r.state;
 write('findings-count',r.coverage.reportedFindings);
 write('coverage-count',r.coverage.listedSources+' / '+r.coverage.reportedSources);
 const date=new Date(r.generatedAt);
 const assessment=assessReport(r);
 const minutes=Math.max(0,Math.floor(assessment.ageMs/60000));
 write('stamp','Report generated '+date.toLocaleString()+(assessment.clockSkew?' · Clock discrepancy':' · '+minutes+' min ago'));
 write('scope','Coverage: operational-state-only. '+(r.coverage.listedSources<r.coverage.reportedSources?'Some reported sources are not individually listed; this is not full archive coverage.':'All reported sources are individually listed; this is not full archive coverage.'));
 const notes=node('review-notes');notes.replaceChildren();
 const addNote=(message)=>{const p=doc.createElement('p');p.textContent=message;notes.append(p);};
 if(assessment.stale||assessment.clockSkew)addNote('Report freshness cannot be trusted. Refresh and check the authoritative Curator Ops source before interpreting operational status.');
 if(assessment.unlisted>0)addNote(assessment.unlisted+' reported source(s) are not individually listed. Their state is unknown here.');
 if(assessment.notFresh>0)addNote(assessment.notFresh+' listed source(s) are stale or missing. Review freshness in Curator Ops.');
 if(!assessment.needsReview)addNote('No operational alerts in this scoped report. Historical accuracy and broader coverage are not assessed.');
 node('review-notes').hidden=false;
 const sources=node('sources');sources.replaceChildren();
 for(const s of r.sources){const card=doc.createElement('article');card.className='source';const name=doc.createElement('span');name.textContent=s.id;const freshness=doc.createElement('strong');freshness.textContent=s.freshness;freshness.className='freshness '+s.freshness;card.append(name,freshness);sources.append(card);}
 const findings=node('findings');findings.replaceChildren();
 if(!r.findings.length){const empty=doc.createElement('p');empty.className='empty';empty.textContent='No active operational findings in this report. This does not certify historical accuracy or full system coverage.';findings.append(empty);}
 else {
  const queue=deriveReviewQueue(r);
  const context=doc.createElement('p');context.className='help';context.textContent=queue.note;findings.append(context);
  for(const f of queue.items){
   const card=doc.createElement('article');card.className='finding review-candidate';
   const heading=doc.createElement('strong');heading.textContent=f.id;card.append(heading);
   for(const value of ['Severity: '+f.severity,'Correlation: '+f.correlation,'Source: '+f.source,'Verification: unverified','Report freshness: '+f.freshness,f.nextStep]){
    const line=doc.createElement('p');line.textContent=value;card.append(line);
   }
   findings.append(card);
  }
 }
 node('report').hidden=false;
}
export async function loadReport({fetcher=fetch,doc=document}={}){
 const status=doc.getElementById('status'),notice=doc.getElementById('notice'),report=doc.getElementById('report'),button=doc.getElementById('refresh');
 button.disabled=true;status.textContent='Checking…';report.hidden=true;notice.hidden=true;
 try{
  const response=await fetcher('/api/stewardship-ops',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},redirect:'manual'});
  if(!response.ok){
   let reason='unavailable';if(response.status===404)reason='disabled';else if(response.status===403||response.status===401)reason='access_denied';
   notice.textContent=reason==='disabled'?'Stewardship reading is disabled. Enablement requires a separate operator decision.':reason==='access_denied'?'Operator authorization was not verified. No operational data was retrieved.':'Operational summary unavailable. Do not interpret missing information as healthy.';
   notice.hidden=false;status.textContent='Unavailable';return;
  }
  if(!(response.headers.get('content-type')||'').includes('application/json'))throw Error('unexpected_response');
  const raw=await response.text();if(raw.length>160000)throw Error('oversized_response');
  const payload=JSON.parse(raw);renderReport(payload,doc);status.textContent='Read-only report loaded';
 }catch{
  notice.textContent='Unable to load or validate the operational summary. No status can be inferred.';
  notice.hidden=false;status.textContent='Unavailable';
 }finally{button.disabled=false;}
}
if(typeof document!=='undefined'&&document.getElementById('refresh')){
 document.getElementById('refresh').addEventListener('click',()=>loadReport());
 loadReport();
}
