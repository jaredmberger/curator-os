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
export function renderReport(r,doc=document){
 if(!validateReport(r))throw Error('unexpected_contract');
 const node=id=>doc.getElementById(id);
 const write=(id,value)=>{node(id).textContent=String(value)};
 write('state',r.state);
 write('findings-count',r.coverage.reportedFindings);
 write('coverage-count',r.coverage.listedSources+' / '+r.coverage.reportedSources);
 const date=new Date(r.generatedAt);
 const minutes=Math.round((Date.now()-date.getTime())/60000);
 write('stamp','Report generated '+date.toLocaleString()+(minutes>=0?' · '+minutes+' min ago':' · clock discrepancy'));
 write('scope','Coverage: operational-state-only. '+(r.coverage.listedSources<r.coverage.reportedSources?'Some reported sources are not individually listed; this is not full archive coverage.':'All reported sources are individually listed; this is not full archive coverage.'));
 const sources=node('sources');sources.replaceChildren();
 for(const s of r.sources){const card=doc.createElement('article');card.className='source';const name=doc.createElement('span');name.textContent=s.id;const freshness=doc.createElement('strong');freshness.textContent=s.freshness;freshness.className='freshness '+s.freshness;card.append(name,freshness);sources.append(card);}
 const findings=node('findings');findings.replaceChildren();
 if(!r.findings.length){const empty=doc.createElement('p');empty.className='empty';empty.textContent='No active operational findings in this report. This does not certify historical accuracy or full system coverage.';findings.append(empty);}
 else for(const f of r.findings){const card=doc.createElement('article');card.className='finding';for(const value of [f.id,'Severity: '+f.severity,'Correlation: '+f.role]){const line=doc.createElement('p');line.textContent=value;card.append(line);}findings.append(card);}
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
