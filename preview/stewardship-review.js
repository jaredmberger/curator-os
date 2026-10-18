const $=id=>document.getElementById(id);let state=null;
const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value);return n};
const status=s=>$('status').textContent=s;
async function request(method,body){const r=await fetch('/api/stewardship-review',{method,headers:{Authorization:'Bearer '+$('token').value.trim(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const x=await r.json();if(!r.ok)throw Error(x.error||'HTTP '+r.status);return x}
async function load(){try{status('Loading…');state=await request('GET');render();void loadTechnicalTriage();status('Loaded')}catch(e){state=null;$('cases').replaceChildren();status('Unable to load: '+e.message)}}
function render(){
 const items=state.cases||[],filter=$('filter').value;
 $('total').textContent=items.length;$('active').textContent=items.filter(x=>x.lifecycle==='active').length;
 $('awaiting').textContent=items.filter(x=>x.lifecycle==='active'&&!x.review).length;
 $('freshness').textContent='Last updated: '+(state.updatedAt||'not yet ingested')+' · Audit: '+state.auditHealth;
 $('cases').replaceChildren();
 for(const item of items.filter(x=>filter==='all'||(filter==='pending'?x.lifecycle==='active'&&!x.review:!!x.review))){
  const box=text('article','');box.className='case';
  const title=text('h3',item.description||item.type);box.append(title);
  box.append(text('small',item.scope+' · '+item.severity+' · '+item.lifecycle+' · first seen '+item.firstSeen));
  if(item.review)box.append(text('p','Decision: '+item.review.decision+' — '+item.review.reason+' ('+item.review.reviewer+')'));
  const details=document.createElement('details');details.append(text('summary','Inspect evidence'));details.append(text('pre',JSON.stringify(item.evidence,null,2)));box.append(details);
  const form=document.createElement('form');form.className='grid';
  const select=document.createElement('select');for(const val of ['acknowledged','investigate','deferred','dismissed']){const o=document.createElement('option');o.value=val;o.textContent=val;select.append(o)}
  const reviewer=document.createElement('input');reviewer.placeholder='Reviewer';reviewer.required=true;reviewer.maxLength=120;
  const reason=document.createElement('textarea');reason.placeholder='Evidence-based reason or next step';reason.required=true;reason.maxLength=2000;
  const save=text('button','Save review decision');save.type='submit';
  form.append(select,reviewer,reason,save);form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{await request('POST',{action:select.value,id:item.id,reviewer:reviewer.value,reason:reason.value,version:state.version});await load()}catch(err){status(err.message);save.disabled=false}});
  box.append(form);$('cases').append(box);
 }
}
$('load').addEventListener('click',load);$('clear').addEventListener('click',()=>{$('token').value='';state=null;$('cases').replaceChildren();$('watchtower-candidates').replaceChildren();$('watchtower-status').textContent='Token cleared';$('inspection-result').replaceChildren();$('inspection-status').textContent='';status('Token cleared')});$('filter').addEventListener('change',()=>{if(state)render()});

async function loadTechnicalTriage(){
 const panel=$('watchtower-candidates');panel.replaceChildren();$('watchtower-status').textContent='Checking Watchtower…';
 try{
  const r=await fetch('/api/search-intelligence-bridge',{headers:{Authorization:'Bearer '+$('token').value.trim()},cache:'no-store'});
  const payload=await r.json();if(!r.ok||!payload.ok)throw Error(payload.error||'HTTP '+r.status);
  const signals=payload.triage||{},candidates=signals.technical||[];
  const date=payload.latestDate||'unknown';
  $('watchtower-status').textContent='Latest snapshot '+date+' · '+candidates.length+' technical candidates · '+(signals.ranking||[]).length+' ranking observations kept separate · '+(signals.other||[]).length+' unclassified';
  if(!candidates.length){panel.append(text('p','No explicitly classified technical findings in the current Watchtower response. This does not prove the site has no indexing problems.'));return}
  for(const item of candidates){
   const box=text('article','');box.className='case';box.append(text('h3',item.title));
   box.append(text('small',item.type+' · '+(item.snapshotDate||'undated')+' · '+item.page));
   box.append(text('p',item.detail));
   const a=document.createElement('a');a.href='https://search-intelligence.oceanliners.net/';a.target='_blank';a.rel='noopener noreferrer';a.textContent='Investigate in Search Intelligence ↗';box.append(a);panel.append(box);
  }
 }catch(e){$('watchtower-status').textContent='Watchtower unavailable: '+e.message+' (existing saved reviews unaffected)'}
}

async function inspectUrl(){
 const btn=$('inspect-url'),out=$('inspection-result');out.replaceChildren();
 const token=$('token').value.trim();if(!token){$('inspection-status').textContent='Enter review token first';return}
 btn.disabled=true;$('inspection-status').textContent='Requesting Google inspection…';
 try{
  const r=await fetch('/api/index-inspection-review',{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({url:$('inspection-url').value.trim()}),cache:'no-store'});
  const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'HTTP '+r.status);
  const item=data.result||{},diagnostics=item.diagnostics||{},signals=diagnostics.signals||[];
  $('inspection-status').textContent=item.ok?'Inspection received · '+data.inspectedAt:'Inspection unavailable · '+data.inspectedAt;
  const box=text('article','');box.className='case';
  box.append(text('h3',item.path||data.url));
  box.append(text('p','Classification: '+(diagnostics.classification||'unverified')+' · Google verdict: '+(item.verdict||'unknown')));
  for(const [label,value] of [['Coverage',item.coverageState],['Robots',item.robotsTxtState],['Indexing',item.indexingState],['Fetch',item.pageFetchState],['Last crawl',item.lastCrawlTime],['Google canonical',item.googleCanonical],['Declared canonical',item.userCanonical]]){
   box.append(text('p',label+': '+(value||'not reported')));
  }
  if(!item.ok)box.append(text('p','Inspection request failed: '+(item.error||'unknown error')));
  if(signals.length)for(const signal of signals)box.append(text('p','Review candidate: '+signal.type+' — '+signal.reason));
  else box.append(text('p','No explicit blocker observed in these fields. This does not establish that the page is indexed or healthy.'));
  box.append(text('small',diagnostics.note||'Verify before making changes.'));
  out.append(box);
 }catch(e){$('inspection-status').textContent='Inspection unavailable: '+e.message}
 finally{btn.disabled=false}
}
$('inspect-url').addEventListener('click',inspectUrl);
