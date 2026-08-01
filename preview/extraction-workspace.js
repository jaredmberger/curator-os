const CATALOG_KEY='curatoros.rebuilt.catalog';
const CHANGE_KEY='curatoros.project.pendingChanges';
const BASELINE_KEY='curatoros.project.editBaseline';
const SESSION_KEY='curatoros.extraction.lastSession';
const app=document.querySelector('#app');
const button=document.querySelector('#extract-knowledge');
const htmlInput=document.querySelector('#extract-html-file');

const FIELD_MAP={
  builder:['builder','built by','shipbuilder','yard','builders'],
  operator:['operator','operated by','line','shipping line','owner','owners'],
  launchDate:['launch','launched','launch date','date launched'],
  maidenVoyage:['maiden voyage','maiden voyage date','first voyage'],
  grossTonnage:['gross tonnage','tonnage','grt','gross register tonnage','gross tons'],
  length:['length','length overall','loa'],
  beam:['beam','breadth'],
  speed:['speed','service speed','top speed','maximum speed'],
  yardNumber:['yard number','yard no','yard no.','hull number','build number'],
  country:['country','nation'],
  routeFocus:['route','routes','service','route focus'],
  fate:['fate','status','final fate'],
  class:['class','ship class'],
  passengers:['passengers','capacity','passenger capacity'],
  crew:['crew','crew complement']
};
const REL_FIELDS=new Set(['builder','operator']);
let session=readJson(SESSION_KEY,null);

button?.addEventListener('click',()=>{activateButton();renderWorkspace();});
htmlInput?.addEventListener('change',loadHtmlFile);

function activateButton(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button.classList.add('active');}
function renderWorkspace(){
  if(!app)return;
  const s=session;
  app.innerHTML=`
  <section class="panel extraction-hero">
    <div><span class="eyebrow">Knowledge extraction & normalization</span><h3>Turn a webpage into reusable project knowledge</h3><p>Load an existing OceanLiners.net HTML page, review the facts CuratorOS finds, map them to standardized fields and entities, then approve them into Project Records.</p></div>
    <div class="extraction-actions"><button type="button" id="choose-html">Choose HTML page</button><button type="button" id="paste-html">Paste page HTML</button></div>
  </section>
  ${s?renderSession(s):renderEmpty()}`;
  document.querySelector('#choose-html')?.addEventListener('click',()=>htmlInput?.click());
  document.querySelector('#paste-html')?.addEventListener('click',openPasteDialog);
  bindSessionControls();
}
function renderEmpty(){return `<section class="panel extraction-empty"><h4>No page loaded</h4><p>For the most dependable iPad workflow, save or export a webpage as HTML and choose it here. Pasting page source also works.</p><p>CuratorOS will preserve the page as provenance; extraction does not alter the source HTML.</p></section>`;}
function renderSession(s){
  const approved=s.candidates.filter(x=>x.include).length;
  return `
  <section class="metrics extraction-metrics">${metric(s.candidates.length,'Candidates found')}${metric(approved,'Selected')}${metric(s.relationshipsResolved||0,'Entities matched')}${metric(s.warnings.length,'Warnings')}</section>
  <section class="panel extraction-source"><div><span class="eyebrow">Source page</span><h4>${esc(s.title||s.filename||'Untitled page')}</h4><p>${esc(s.url||s.filename||'Local HTML source')}</p></div><div class="badges"><span class="badge">${esc(s.inferredType)}</span>${s.existingRecordId?'<span class="badge">Existing record matched</span>':'<span class="badge">New record candidate</span>'}</div></section>
  <section class="panel extraction-target">
    <h4>Target record</h4>
    <div class="extraction-target-grid">
      <label><span>Record title</span><input id="extract-title" value="${esc(s.recordTitle)}"></label>
      <label><span>Record ID</span><input id="extract-id" value="${esc(s.recordId)}" ${s.existingRecordId?'readonly':''}></label>
      <label><span>Record type</span><select id="extract-type">${['ship','company','person','object','photo','source','organization'].map(t=>`<option value="${t}"${s.inferredType===t?' selected':''}>${label(t)}</option>`).join('')}</select></label>
      <label><span>Status</span><select id="extract-status">${['draft','review','published','archived'].map(t=>`<option value="${t}"${s.status===t?' selected':''}>${label(t)}</option>`).join('')}</select></label>
    </div>
  </section>
  <section class="panel extraction-review">
    <div class="extraction-review-head"><div><span class="eyebrow">Candidate knowledge</span><h4>Review and normalize</h4></div><div class="actions"><button id="select-all-candidates" type="button">Select all</button><button id="clear-candidates" type="button">Clear</button></div></div>
    <div class="extraction-candidates">${s.candidates.length?s.candidates.map((c,i)=>renderCandidate(c,i)).join(''):'<div class="empty">No structured fact pairs were recognized on this page.</div>'}</div>
  </section>
  ${s.narrative?.length?`<section class="panel extraction-narrative"><details><summary>Extracted narrative blocks (${s.narrative.length})</summary>${s.narrative.slice(0,20).map(p=>`<p>${esc(p)}</p>`).join('')}</details></section>`:''}
  ${s.warnings.length?`<section class="panel"><details><summary>Extraction warnings (${s.warnings.length})</summary><ul>${s.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></details></section>`:''}
  <section class="panel extraction-approve"><div><h4>Approve into Project Records</h4><p>This creates a reviewable local knowledge-base change. It does not edit the original webpage or publish anything.</p></div><div class="actions"><button type="button" id="export-extraction">Export extraction report</button><button type="button" id="approve-extraction">Approve selected knowledge</button></div></section>`;
}
function renderCandidate(c,i){
  return `<article class="extraction-candidate ${c.include?'selected':''}">
    <label class="candidate-check"><input type="checkbox" data-candidate-include="${i}" ${c.include?'checked':''}><span></span></label>
    <div class="candidate-raw"><small>Raw page value</small><strong>${esc(c.rawLabel)}</strong><p>${esc(c.rawValue)}</p></div>
    <div class="candidate-map">
      <label><span>Standard field</span><select data-candidate-field="${i}">${fieldOptions(c.field)}</select></label>
      <label><span>Normalized value</span><input data-candidate-value="${i}" value="${esc(c.normalizedValue)}"></label>
      ${REL_FIELDS.has(c.field)?`<label><span>Entity target</span><input data-candidate-target="${i}" value="${esc(c.entityTarget||'')}" placeholder="company.harland-wolff"></label>`:''}
      <div class="candidate-meta"><span>${esc(c.sourceKind)}</span>${c.confidence?`<span>${esc(c.confidence)} confidence</span>`:''}${c.entityMatch?`<span>Matched: ${esc(c.entityMatch)}</span>`:''}</div>
    </div>
  </article>`;
}
function fieldOptions(selected){const fields=['unmapped',...Object.keys(FIELD_MAP),'summary','date','category','creator','dimensions','material','condition'];return fields.map(f=>`<option value="${f}"${selected===f?' selected':''}>${label(f)}</option>`).join('');}
function bindSessionControls(){
  if(!session)return;
  document.querySelector('#select-all-candidates')?.addEventListener('click',()=>{session.candidates.forEach(c=>c.include=true);saveSession();renderWorkspace();});
  document.querySelector('#clear-candidates')?.addEventListener('click',()=>{session.candidates.forEach(c=>c.include=false);saveSession();renderWorkspace();});
  document.querySelectorAll('[data-candidate-include]').forEach(el=>el.addEventListener('change',e=>{session.candidates[+e.target.dataset.candidateInclude].include=e.target.checked;saveSession();}));
  document.querySelectorAll('[data-candidate-field]').forEach(el=>el.addEventListener('change',e=>{const c=session.candidates[+e.target.dataset.candidateField];c.field=e.target.value;if(REL_FIELDS.has(c.field))resolveEntity(c);saveSession();renderWorkspace();}));
  document.querySelectorAll('[data-candidate-value]').forEach(el=>el.addEventListener('input',e=>{session.candidates[+e.target.dataset.candidateValue].normalizedValue=e.target.value;saveSession();}));
  document.querySelectorAll('[data-candidate-target]').forEach(el=>el.addEventListener('input',e=>{session.candidates[+e.target.dataset.candidateTarget].entityTarget=e.target.value;saveSession();}));
  document.querySelector('#extract-title')?.addEventListener('input',e=>{session.recordTitle=e.target.value;saveSession();});
  document.querySelector('#extract-id')?.addEventListener('input',e=>{session.recordId=e.target.value;saveSession();});
  document.querySelector('#extract-type')?.addEventListener('change',e=>{session.inferredType=e.target.value;saveSession();});
  document.querySelector('#extract-status')?.addEventListener('change',e=>{session.status=e.target.value;saveSession();});
  document.querySelector('#approve-extraction')?.addEventListener('click',approveExtraction);
  document.querySelector('#export-extraction')?.addEventListener('click',exportExtraction);
}
async function loadHtmlFile(){const file=htmlInput?.files?.[0];if(!file)return;try{session=extractHtml(await file.text(),file.name);saveSession();activateButton();renderWorkspace();}catch(e){alert(e.message||String(e));}finally{htmlInput.value='';}}
function openPasteDialog(){
  const d=document.createElement('dialog');d.id='extract-paste-dialog';d.innerHTML=`<form class="extract-paste-card"><span class="eyebrow">Paste webpage source</span><h3>Extract knowledge from HTML</h3><label><span>Optional source URL</span><input id="paste-source-url" placeholder="https://oceanliners.net/ships/..."></label><label><span>HTML</span><textarea id="paste-source-html" rows="18" placeholder="Paste the page HTML here"></textarea></label><div class="actions"><button type="button" data-close>Cancel</button><button type="submit">Extract knowledge</button></div></form>`;document.body.append(d);d.querySelector('[data-close]').addEventListener('click',()=>closeDialog(d));d.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const html=d.querySelector('#paste-source-html').value;if(!html.trim())return;session=extractHtml(html,'pasted-page.html',d.querySelector('#paste-source-url').value.trim());saveSession();closeDialog(d);activateButton();renderWorkspace();});d.showModal();
}
function extractHtml(html,filename,forcedUrl=''){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const canonical=forcedUrl||doc.querySelector('link[rel="canonical"]')?.href||'';
  const title=cleanTitle(doc.querySelector('h1')?.textContent||doc.title||'');
  const inferredType=inferType(canonical,doc);
  const records=readRecords();
  const recordTitle=title||titleFromPath(canonical)||filename.replace(/\.html?$/i,'');
  const recordId=makeRecordId(inferredType,canonical||recordTitle);
  const existing=findExisting(records,recordId,canonical,recordTitle);
  const warnings=[];
  const candidates=[];
  const seen=new Set();
  collectTableFacts(doc,candidates,seen);
  collectDefinitionFacts(doc,candidates,seen);
  collectLabeledFacts(doc,candidates,seen);
  collectJsonLd(doc,candidates,seen,warnings);
  const description=doc.querySelector('meta[name="description"]')?.content?.trim();
  if(description)addCandidate(candidates,seen,'Description',description,'summary','metadata');
  const narrative=[...doc.querySelectorAll('main p, article p, .content p')].map(p=>compact(p.textContent)).filter(t=>t.length>80).slice(0,50);
  let resolved=0;
  for(const c of candidates){normalizeCandidate(c);if(resolveEntity(c,records))resolved++;}
  return {filename,url:canonical,title:recordTitle,recordTitle,recordId:existing?.id||recordId,existingRecordId:existing?.id||'',inferredType:existing?.type||inferredType,status:existing?.status||'review',candidates,narrative,warnings,relationshipsResolved:resolved,extractedAt:new Date().toISOString()};
}
function collectTableFacts(doc,out,seen){doc.querySelectorAll('tr').forEach(row=>{const cells=[...row.querySelectorAll('th,td')].map(x=>compact(x.textContent));if(cells.length>=2&&cells[0]&&cells[1])addCandidate(out,seen,cells[0],cells.slice(1).join(' · '),'','table');});}
function collectDefinitionFacts(doc,out,seen){doc.querySelectorAll('dt').forEach(dt=>{const dd=dt.nextElementSibling;if(dd?.tagName==='DD')addCandidate(out,seen,compact(dt.textContent),compact(dd.textContent),'','definition-list');});}
function collectLabeledFacts(doc,out,seen){doc.querySelectorAll('li,p,div').forEach(el=>{if(el.children.length>5)return;const strong=el.querySelector(':scope > strong:first-child, :scope > b:first-child');if(!strong)return;const labelText=compact(strong.textContent).replace(/:$/,'');const whole=compact(el.textContent);const value=compact(whole.slice(strong.textContent.length)).replace(/^[:\-–—]\s*/,'');if(labelText&&value&&value.length<300)addCandidate(out,seen,labelText,value,'','labeled-text');});}
function collectJsonLd(doc,out,seen,warnings){doc.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{try{const data=JSON.parse(script.textContent);const list=Array.isArray(data)?data:[data];for(const item of list){if(!item||typeof item!=='object')continue;[['name','Name'],['description','Description'],['datePublished','Date published'],['dateModified','Date modified']].forEach(([key,labelText])=>{if(item[key])addCandidate(out,seen,labelText,String(item[key]),key==='description'?'summary':key,'json-ld');});}}catch{warnings.push('One JSON-LD block could not be parsed.');}});}
function addCandidate(out,seen,rawLabel,rawValue,field='',sourceKind='page'){const key=`${rawLabel.toLowerCase()}|${rawValue.toLowerCase()}`;if(seen.has(key))return;seen.add(key);const guessed=field||guessField(rawLabel);out.push({rawLabel,rawValue,field:guessed,normalizedValue:normalizeValue(guessed,rawValue),sourceKind,include:guessed!=='unmapped',confidence:guessed==='unmapped'?'low':'probable',entityTarget:'',entityMatch:''});}
function guessField(raw){const labelText=compact(raw).toLowerCase().replace(/[:.]/g,'');for(const [field,aliases] of Object.entries(FIELD_MAP)){if(aliases.some(alias=>labelText===alias||labelText.startsWith(alias+' ')))return field;}return 'unmapped';}
function normalizeCandidate(c){c.normalizedValue=normalizeValue(c.field,c.normalizedValue||c.rawValue);}
function normalizeValue(field,value){const v=compact(value);if(['launchDate','maidenVoyage','datePublished','dateModified'].includes(field)){const d=new Date(v);if(!Number.isNaN(d.getTime())&&/\d/.test(v))return d.toISOString().slice(0,10);}return v;}
function resolveEntity(c,records=readRecords()){
  if(!REL_FIELDS.has(c.field))return false;
  const needle=entityKey(c.normalizedValue);
  const matches=records.filter(r=>['company','organization'].includes(r.type)&&entityKey(r.title)===needle);
  if(matches.length===1){c.entityTarget=matches[0].id;c.entityMatch=matches[0].title;return true;}
  if(!c.entityTarget)c.entityTarget=`company.${slug(c.normalizedValue)}`;
  return false;
}
function approveExtraction(){
  if(!session)return;
  syncTargetControls();
  const selected=session.candidates.filter(c=>c.include&&c.field!=='unmapped'&&c.normalizedValue);
  if(!selected.length)return alert('Select at least one mapped candidate before approving.');
  const records=readRecords();
  const index=records.findIndex(r=>r.id===session.recordId);
  const before=index>=0?structuredCloneSafe(records[index]):null;
  const record=before?structuredCloneSafe(before):{id:session.recordId,type:session.inferredType,title:session.recordTitle,status:session.status,summary:'',tags:[],relationships:[],sources:[],notes:[],data:{},metadata:{confidence:'unknown'}};
  record.title=session.recordTitle;record.type=session.inferredType;record.status=session.status;record.data=record.data||{};record.relationships=Array.isArray(record.relationships)?record.relationships:[];record.sources=Array.isArray(record.sources)?record.sources:[];record.notes=Array.isArray(record.notes)?record.notes:[];record.metadata=record.metadata||{};
  for(const c of selected){
    if(c.field==='summary'){record.summary=c.normalizedValue;continue;}
    if(REL_FIELDS.has(c.field)){
      record.data[c.field]=c.normalizedValue;
      const rel=c.field==='builder'?'built_by':'operated_by';
      if(c.entityTarget&&!record.relationships.some(r=>r.target===c.entityTarget&&r.relationship===rel))record.relationships.push({target:c.entityTarget,relationship:rel,confidence:'probable',sourceIds:[],note:`Extracted from ${session.url||session.filename}`});
      continue;
    }
    record.data[c.field]=c.normalizedValue;
  }
  const sourceUrl=session.url||'';const sourceId=`source.page-${slug(sourceUrl||session.filename)}`;
  if(!record.sources.some(s=>(typeof s==='string'?s:s.id)===sourceId))record.sources.push({id:sourceId,title:`Website page: ${session.title}`,url:sourceUrl||undefined,sourceType:'website-page'});
  record.metadata.lastExtractedAt=new Date().toISOString();record.metadata.extractionState='reviewed';
  record.notes.push({kind:'extraction',body:`Knowledge extracted and reviewed from ${session.url||session.filename} on ${new Date().toISOString().slice(0,10)}.`});
  if(index>=0)records[index]=record;else records.push(record);
  if(!localStorage.getItem(BASELINE_KEY))localStorage.setItem(BASELINE_KEY,JSON.stringify(readRecords()));
  localStorage.setItem(CATALOG_KEY,JSON.stringify(records));
  const changes=readJson(CHANGE_KEY,[]).filter(ch=>ch.recordId!==record.id);
  changes.push({id:`change:${record.id}`,recordId:record.id,title:record.title,changedAt:new Date().toISOString(),origin:record.origin||{filename:session.filename,sourceType:'webpage-extraction',sourceUrl:session.url},before,after:record,fields:before?changedFields(before,record):['new record'],changeKind:before?'extraction-update':'extraction-create'});
  localStorage.setItem(CHANGE_KEY,JSON.stringify(changes));
  session.approvedAt=new Date().toISOString();session.existingRecordId=record.id;saveSession();window.dispatchEvent(new CustomEvent('curatoros:records-changed'));
  alert(`${record.title} was added to the local Project Records change queue. Review and publish it through the normal change-set workflow.`);
}
function syncTargetControls(){session.recordTitle=document.querySelector('#extract-title')?.value.trim()||session.recordTitle;session.recordId=document.querySelector('#extract-id')?.value.trim()||session.recordId;session.inferredType=document.querySelector('#extract-type')?.value||session.inferredType;session.status=document.querySelector('#extract-status')?.value||session.status;}
function exportExtraction(){if(!session)return;syncTargetControls();downloadJson({format:'curatoros-extraction-review',formatVersion:1,createdAt:new Date().toISOString(),session},`curatoros-extraction-${slug(session.recordTitle)||'page'}.json`);}
function inferType(url,doc){const text=`${url} ${doc.body?.className||''}`.toLowerCase();if(/\/ships\//.test(text)||/ship guide/.test(doc.title.toLowerCase()))return'ship';if(/builder|shipyard/.test(text))return'company';if(/shipping[-_/ ]?line|\/lines\//.test(text))return'company';if(/reference[-_/ ]?object/.test(text))return'object';if(/photo|gallery|image/.test(text))return'photo';if(/source|bibliograph/.test(text))return'source';return'ship';}
function findExisting(records,id,url,title){return records.find(r=>r.id===id)||records.find(r=>url&&[r.url,r.path,r.canonical,r.data?.pageUrl].includes(url))||records.find(r=>entityKey(r.title)===entityKey(title));}
function makeRecordId(type,value){const path=String(value||'').replace(/^https?:\/\/[^/]+/,'').split(/[?#]/)[0].replace(/\.html?$/i,'');const last=path.split('/').filter(Boolean).pop()||value;return `${type}.${slug(last)}`;}
function titleFromPath(value){return String(value||'').split(/[?#]/)[0].replace(/\/$/,'').split('/').filter(Boolean).pop()?.replace(/\.html?$/i,'').replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase())||'';}
function cleanTitle(value){return compact(value).replace(/\s*[|—–-]\s*(Ship Guide|Ocean Liner Curator).*$/i,'').trim();}
function readRecords(){const v=readJson(CATALOG_KEY,[]);return Array.isArray(v)?v:[];}
function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback;}catch{return fallback;}}
function saveSession(){localStorage.setItem(SESSION_KEY,JSON.stringify(session));}
function changedFields(a,b){const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);return[...keys].filter(k=>JSON.stringify(a?.[k]??null)!==JSON.stringify(b?.[k]??null));}
function structuredCloneSafe(v){return JSON.parse(JSON.stringify(v));}
function entityKey(v){return compact(v).toLowerCase().replace(/&/g,'and').replace(/\b(ltd|limited|company|co)\b\.?/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function slug(v){return compact(v).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function compact(v){return String(v??'').replace(/\s+/g,' ').trim();}
function label(v){return String(v||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase());}
function metric(v,l){return `<div class="metric"><strong>${v}</strong><span>${esc(l)}</span></div>`;}
function closeDialog(d){try{d.close();}catch{}d.remove();}
function downloadJson(value,name){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
