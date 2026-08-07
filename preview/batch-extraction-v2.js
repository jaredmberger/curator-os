const CATALOG_KEY='curatoros.rebuilt.catalog';
const BATCH_KEY='curatoros.extraction.batch.v2';
const app=document.querySelector('#app');
const button=document.querySelector('#batch-extract-knowledge');
const input=document.querySelector('#batch-html-files');

const SHIP_FIELDS={
  prefix:['prefix','ship prefix'],alternateNames:['nickname','alternate name','alternative name','later name','former name'],
  originalOperator:['operator','operator as built','operator (as built)','shipping line','line'],operatorHistory:['owner later operator','owner / later operator','later operator','operator history'],
  builder:['builder','built by','shipbuilder','yard'],yardNumber:['yard number','yard no','yard no.','hull number'],buildLocation:['built at','build location','built in'],registry:['registry','flag','country','nation'],homePort:['home port'],shipClass:['class','ship class'],sisterShips:['sister ships','sisters'],
  orderedDate:['ordered'],keelLaidDate:['keel laid'],launchDate:['launch','launched','launch date'],completedDate:['completed','completion','completed date'],enteredServiceDate:['entered service','entry into service'],maidenVoyageDate:['maiden voyage','maiden voyage date','first voyage'],
  grossTonnage:['gross tonnage','tonnage','grt','gross register tonnage'],netTonnage:['net tonnage','nrt'],displacement:['displacement'],length:['length','length overall','loa'],beam:['beam','breadth'],draft:['draft','draught'],propulsion:['propulsion'],engines:['engines','engine'],power:['power','horsepower','shp'],serviceSpeed:['speed','service speed'],maximumSpeed:['maximum speed','top speed'],funnels:['funnels'],masts:['masts'],
  passengerCapacity:['passengers','capacity','passenger capacity'],crew:['crew','crew complement'],routes:['route','routes','primary route','primary route typical','primary route (typical)'],serviceEras:['service period','service era','service eras'],wartimeService:['wartime service'],majorRefits:['major refits','refits'],majorIncidents:['major incidents','incidents'],notableCaptains:['notable captains','captains'],serviceNotes:['type','ship type','service notes'],
  serviceEndDate:['service ended','service end','end of service'],withdrawnDate:['withdrawn','withdrawal'],fate:['fate','final fate'],fateDate:['fate date'],fateLocation:['fate location']
};
const LIST_FIELDS=new Set(['alternateNames','operatorHistory','sisterShips','routes','notableCaptains']);
const REL_FIELDS=new Set(['builder','originalOperator']);
let batch=readJson(BATCH_KEY,{items:[],createdAt:null});

button?.addEventListener('click',()=>{activate();render();});
input?.addEventListener('change',loadFiles);

function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button?.classList.add('active');}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function readRecords(){const value=readJson(CATALOG_KEY,[]);return Array.isArray(value)?value:[]}
function saveBatch(){localStorage.setItem(BATCH_KEY,JSON.stringify(batch))}

function render(){
  if(!app)return;
  const items=batch.items||[];
  const ready=items.filter(item=>item.state==='ready'&&!item.conflicts.length).length;
  const review=items.filter(item=>item.state!=='approved'&&item.conflicts.length).length;
  const approved=items.filter(item=>item.state==='approved').length;
  app.innerHTML=`
    <section class="panel batch-hero"><div><span class="eyebrow">Canonical corpus extraction · Ship schema v2</span><h3>Build Ship Records from many guides</h3><p>Select saved OceanLiners.net ship-guide HTML files. CuratorOS reads each guide's Key Facts block first, maps supported facts into the canonical Ship Record schema, and creates a review queue. Nothing becomes permanent until you approve it.</p></div><div class="actions"><button id="choose-batch-files">Choose ship-guide HTML pages</button>${items.length?'<button id="clear-batch">Clear queue</button>':''}</div></section>
    <section class="metrics">${metric(items.length,'Pages queued')}${metric(ready,'Ready')}${metric(review,'Need review')}${metric(approved,'Saved')}</section>
    ${items.length?`<section class="panel batch-controls"><div class="batch-filter"><input id="batch-search" type="search" placeholder="Search queued ships…"><select id="batch-state"><option value="">All states</option><option value="ready">Ready</option><option value="review">Needs review</option><option value="approved">Saved</option></select></div><div class="actions"><button id="approve-clean">Save all clean Ship Records</button><button id="export-batch">Export batch report</button></div></section><section class="panel"><div id="batch-list" class="batch-list">${items.map(renderItem).join('')}</div></section>`:`<section class="panel"><h4>No corpus queue yet</h4><p>Choose multiple ship-guide HTML files. Key Facts are treated as the primary structured source; unsupported facts remain blank.</p></section>`}`;
  document.querySelector('#choose-batch-files')?.addEventListener('click',()=>input?.click());
  document.querySelector('#clear-batch')?.addEventListener('click',clearBatch);
  document.querySelector('#approve-clean')?.addEventListener('click',approveClean);
  document.querySelector('#export-batch')?.addEventListener('click',exportBatch);
  document.querySelector('#batch-search')?.addEventListener('input',filterList);
  document.querySelector('#batch-state')?.addEventListener('change',filterList);
  document.querySelectorAll('[data-review-item]').forEach(el=>el.addEventListener('click',()=>openItem(el.dataset.reviewItem)));
}

function renderItem(item){
  const selected=item.candidates.filter(c=>c.include&&c.field).length;
  const state=item.state==='approved'?'approved':item.conflicts.length?'review':'ready';
  const keyFacts=item.candidates.filter(c=>c.sourceKind==='ship-key-facts').length;
  return `<article class="batch-item" data-batch-card data-state="${state}" data-hay="${esc((item.title+' '+item.filename+' '+item.recordId).toLowerCase())}"><div><div class="badges"><span class="badge">${label(state)}</span><span class="badge">Ship schema v2</span>${item.existingRecordId?'<span class="badge">Existing record</span>':'<span class="badge">New record</span>'}${keyFacts?`<span class="badge">${keyFacts} Key Facts</span>`:''}</div><h4>${esc(item.title||item.filename)}</h4><p>${esc(item.filename)} · ${selected} selected facts</p>${item.conflicts.length?`<p class="batch-warning">${item.conflicts.length} conflict${item.conflicts.length===1?'':'s'} require review.</p>`:''}</div><button type="button" data-review-item="${esc(item.id)}">${item.state==='approved'?'Inspect':'Review'}</button></article>`;
}

async function loadFiles(){
  const files=[...(input?.files||[])];if(!files.length)return;
  const records=readRecords();const items=[];
  for(const file of files){
    try{items.push(extractPage(await file.text(),file.name,records))}
    catch(error){items.push({id:`error:${file.name}`,filename:file.name,title:file.name,recordId:'',existingRecordId:'',candidates:[],conflicts:[error instanceof Error?error.message:String(error)],warnings:[],state:'review',error:true})}
  }
  batch={items:dedupe([...(batch.items||[]),...items]),createdAt:batch.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  detectCrossPageConflicts(batch.items);saveBatch();input.value='';activate();render();
}

function extractPage(html,filename,records){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const canonical=doc.querySelector('link[rel="canonical"]')?.href||'';
  const title=cleanTitle(doc.querySelector('h1')?.textContent||doc.title||titleFromPath(canonical)||filename.replace(/\.html?$/i,''));
  const inferredType=inferType(canonical,doc);
  if(inferredType!=='ship')throw new Error('Build Corpus v2 currently accepts ship-guide pages only.');
  const existing=findExisting(records,canonical,title);
  const recordId=existing?.id||`ship:${slug(title)}`;
  const candidates=[];const seen=new Set();
  collectKeyFacts(doc,candidates,seen);
  collectNativeTables(doc,candidates,seen);
  collectDefinitions(doc,candidates,seen);
  const description=doc.querySelector('meta[name="description"]')?.content?.trim();
  if(description)addCandidate(candidates,seen,'Description',description,'summary','metadata','probable');
  const conflicts=detectRecordConflicts(existing,candidates);
  return {id:`batch:${slug(filename)}:${Date.now()}:${Math.random().toString(36).slice(2,7)}`,filename,url:canonical,title,recordId,existingRecordId:existing?.id||'',status:existing?.status||'review',candidates,conflicts,warnings:[],state:'ready',extractedAt:new Date().toISOString()};
}

function collectKeyFacts(doc,out,seen){
  const rows=doc.querySelectorAll('.facts .fact-row,[role="table"] [role="row"]');
  rows.forEach(row=>{
    const labelNode=row.querySelector('.fact-label,[role="cell"]:first-child');
    const valueNode=row.querySelector('.fact-value,[role="cell"]:last-child');
    const rawLabel=compact(labelNode?.textContent);const rawValue=compact(valueNode?.textContent);
    if(!rawLabel||!rawValue||rawLabel===rawValue)return;
    if(normalizeLabel(rawLabel)==='length beam'){splitLengthBeam(out,seen,rawValue);return;}
    const field=guessField(rawLabel);
    addCandidate(out,seen,rawLabel,rawValue,field,'ship-key-facts',field?'high':'low');
  });
}
function splitLengthBeam(out,seen,value){
  const parts=String(value).split(/\s*[·|/]\s*/).map(compact).filter(Boolean);
  let length=parts.find(p=>/\blength\b/i.test(p));let beam=parts.find(p=>/\bbeam|breadth\b/i.test(p));
  if(length)length=compact(length.replace(/^length\s*[:\-]?\s*/i,''));
  if(beam)beam=compact(beam.replace(/^(beam|breadth)\s*[:\-]?\s*/i,''));
  if(!length&&parts[0])length=parts[0];if(!beam&&parts[1])beam=parts[1];
  if(length)addCandidate(out,seen,'Length',length,'length','ship-key-facts','high');
  if(beam)addCandidate(out,seen,'Beam',beam,'beam','ship-key-facts','high');
}
function collectNativeTables(doc,out,seen){doc.querySelectorAll('tr').forEach(row=>{const cells=[...row.querySelectorAll('th,td')].map(el=>compact(el.textContent));if(cells.length>=2&&cells[0]&&cells[1])addCandidate(out,seen,cells[0],cells.slice(1).join(' · '),guessField(cells[0]),'table','probable')})}
function collectDefinitions(doc,out,seen){doc.querySelectorAll('dt').forEach(dt=>{const dd=dt.nextElementSibling;if(dd?.tagName==='DD')addCandidate(out,seen,compact(dt.textContent),compact(dd.textContent),guessField(dt.textContent),'definition-list','probable')})}
function addCandidate(out,seen,rawLabel,rawValue,field='',sourceKind='page',confidence='probable'){
  const key=`${normalizeLabel(rawLabel)}|${compact(rawValue).toLowerCase()}`;if(seen.has(key))return;seen.add(key);
  const value=normalizeValue(field,rawValue);
  out.push({rawLabel:compact(rawLabel),rawValue:compact(rawValue),field,normalizedValue:value,sourceKind,include:!!field,confidence,entityTarget:''});
}
function guessField(raw){const normalized=normalizeLabel(raw);for(const [field,aliases] of Object.entries(SHIP_FIELDS)){if(aliases.some(alias=>normalized===normalizeLabel(alias)||normalized.startsWith(normalizeLabel(alias)+' ')))return field}return''}
function normalizeLabel(value){return compact(value).toLowerCase().replace(/[()]/g,' ').replace(/[\/:.,–—-]+/g,' ').replace(/\s+/g,' ').trim()}
function normalizeValue(field,value){const text=compact(value);if(!text)return'';if(LIST_FIELDS.has(field))return parseList(text);return text}
function parseList(value){return String(value).split(/\n|\s*[;|]\s*/).map(compact).filter(Boolean)}

function detectRecordConflicts(existing,candidates){
  if(!existing)return[];const conflicts=[];
  for(const c of candidates.filter(c=>c.include&&c.field&&c.field!=='summary')){
    const current=existing.data?.[c.field];if(current==null||display(current)==='')continue;
    if(display(current)!==display(c.normalizedValue))conflicts.push(`${label(c.field)} differs: record has “${display(current)}”; page has “${display(c.normalizedValue)}”.`);
  }
  return conflicts;
}
function detectCrossPageConflicts(items){
  const byId=new Map();for(const item of items){if(!item.recordId)continue;if(!byId.has(item.recordId))byId.set(item.recordId,[]);byId.get(item.recordId).push(item)}
  for(const group of byId.values()){if(group.length<2)continue;const values=new Map();for(const item of group)for(const c of item.candidates.filter(c=>c.include&&c.field)){if(!values.has(c.field))values.set(c.field,new Set());values.get(c.field).add(display(c.normalizedValue))}for(const [field,set] of values)if(set.size>1)for(const item of group)item.conflicts.push(`Queued pages disagree on ${label(field)}: ${[...set].join(' / ')}`)}
}

function openItem(id){
  const item=batch.items.find(x=>x.id===id);if(!item)return;closeDialog();
  const d=document.createElement('dialog');d.id='batch-item-dialog';
  d.innerHTML=`<section class="batch-dialog"><header><div><span class="eyebrow">Canonical Ship Record candidate</span><h3>${esc(item.title)}</h3><p>${esc(item.filename)}</p></div><button data-close>×</button></header>${item.conflicts.length?`<section class="batch-conflicts"><h4>Conflicts</h4><ul>${item.conflicts.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}<div class="batch-candidates">${item.candidates.map((c,i)=>`<article><label><input type="checkbox" data-inc="${i}" ${c.include?'checked':''}> Include</label><div><small>${esc(c.rawLabel)} · ${esc(c.sourceKind)}</small><p>${esc(c.rawValue)}</p></div><label>Ship field<select data-field="${i}">${fieldOptions(c.field)}</select></label><label>Normalized value<input data-val="${i}" value="${esc(displayEditor(c.normalizedValue))}"></label></article>`).join('')}</div><footer><button data-close>Close</button>${item.state!=='approved'?'<button id="save-batch-item">Save canonical Ship Record</button>':''}</footer></section>`;
  document.body.append(d);
  d.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closeDialog));
  d.querySelectorAll('[data-inc]').forEach(el=>el.addEventListener('change',e=>{item.candidates[+e.target.dataset.inc].include=e.target.checked;saveBatch()}));
  d.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('change',e=>{const c=item.candidates[+e.target.dataset.field];c.field=e.target.value;c.include=!!c.field;c.normalizedValue=normalizeValue(c.field,c.rawValue);saveBatch()}));
  d.querySelectorAll('[data-val]').forEach(el=>el.addEventListener('input',e=>{const c=item.candidates[+e.target.dataset.val];c.normalizedValue=LIST_FIELDS.has(c.field)?parseList(e.target.value):e.target.value;saveBatch()}));
  d.querySelector('#save-batch-item')?.addEventListener('click',async()=>{await saveItems([item]);closeDialog();render()});
  d.showModal();
}

async function approveClean(){
  const clean=batch.items.filter(item=>item.state!=='approved'&&!item.error&&!item.conflicts.length);
  if(!clean.length)return alert('There are no clean Ship Record candidates to save.');
  if(!confirm(`Save ${clean.length} reviewed, conflict-free canonical Ship Record${clean.length===1?'':'s'} to the permanent corpus?`))return;
  await saveItems(clean);render();
}
async function saveItems(items){
  const store=window.CuratorOSProjectRecordsStore;if(!store)return alert('Permanent Project Records store is not available.');
  let records=readRecords();const now=new Date().toISOString();
  for(const item of items){
    const selected=item.candidates.filter(c=>c.include&&c.field&&display(c.normalizedValue));if(!selected.length)continue;
    const index=records.findIndex(r=>r.id===item.recordId);const existing=index>=0?clone(records[index]):null;
    const record=existing||{id:item.recordId,title:item.title,type:'ship',status:item.status||'review',summary:'',tags:[],data:{},fieldEvidence:{},relationships:[],sources:[],notes:[],metadata:{shipSchemaVersion:2},origin:{kind:'batch-webpage-extraction',source:item.url||item.filename}};
    record.id=item.recordId;record.title=item.title;record.type='ship';record.status=item.status||record.status||'review';record.data=record.data||{};record.fieldEvidence=record.fieldEvidence||{};record.relationships=Array.isArray(record.relationships)?record.relationships:[];record.sources=Array.isArray(record.sources)?record.sources:[];record.notes=Array.isArray(record.notes)?record.notes:[];
    const sourceId=`source.page-${slug(item.url||item.filename)}`;
    for(const c of selected){
      if(c.field==='summary'){record.summary=display(c.normalizedValue);continue}
      record.data[c.field]=c.normalizedValue;
      record.fieldEvidence[c.field]={status:c.sourceKind==='ship-key-facts'?'documented':c.confidence==='low'?'needs review':'probable',sources:[sourceId],extractedFrom:{label:c.rawLabel,sourceKind:c.sourceKind}};
      if(REL_FIELDS.has(c.field)){const relationship=c.field==='builder'?'built by':'operated by';const target=c.entityTarget||display(c.normalizedValue);if(!record.relationships.some(r=>r.relationship===relationship&&r.target===target))record.relationships.push({relationship,target,confidence:c.confidence||'probable',sourceIds:[sourceId],note:`Batch-extracted from ${c.rawLabel}`})}
    }
    if(item.url)record.data.pageUrl=item.url;
    if(!record.sources.some(s=>(typeof s==='string'?s:s?.id)===sourceId))record.sources.push({id:sourceId,title:`Website page: ${item.title}`,url:item.url||undefined,sourceType:'website-page'});
    record.metadata={...(record.metadata||{}),shipSchemaVersion:2,lastExtractedAt:now,extractionState:'reviewed',knowledgeExtraction:'batch-v2'};
    record.notes.push({kind:'extraction',body:`Canonical Ship Record facts batch-extracted and reviewed from ${item.url||item.filename} on ${now.slice(0,10)}.`});
    if(index>=0)records[index]=record;else records.push(record);
    item.state='approved';item.approvedAt=now;
  }
  try{await store.save(records,`batch-canonical-ships:${items.length}`);saveBatch();window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'batch-canonical-ship-extraction'}}));alert(`${items.filter(i=>i.state==='approved').length} canonical Ship Record${items.length===1?'':'s'} saved to the permanent corpus.`)}catch(error){alert(`Build Corpus could not save permanently. ${error instanceof Error?error.message:String(error)}`)}
}

function fieldOptions(selected){return [`<option value=""${!selected?' selected':''}>Unmapped</option>`,`<option value="summary"${selected==='summary'?' selected':''}>Summary</option>`,...Object.keys(SHIP_FIELDS).map(field=>`<option value="${field}"${field===selected?' selected':''}>${label(field)}</option>`)].join('')}
function findExisting(records,url,title){return records.find(r=>r.type==='ship'&&url&&r.data?.pageUrl===url)||records.find(r=>r.type==='ship'&&entityKey(r.title)===entityKey(title))||null}
function inferType(url,doc){const text=`${url} ${doc.title} ${doc.body?.className||''}`.toLowerCase();return /\/ships\//.test(text)||/ship guide/.test(text)?'ship':'unknown'}
function dedupe(items){const map=new Map();for(const item of items)map.set(item.url||item.filename,item);return[...map.values()]}
function filterList(){const q=(document.querySelector('#batch-search')?.value||'').toLowerCase();const state=document.querySelector('#batch-state')?.value||'';document.querySelectorAll('[data-batch-card]').forEach(card=>{card.hidden=!!((q&&!card.dataset.hay.includes(q))||(state&&card.dataset.state!==state))})}
function clearBatch(){if(!confirm('Clear the Build Corpus review queue? Already-saved Project Records remain permanent.'))return;batch={items:[],createdAt:null};saveBatch();render()}
function exportBatch(){downloadJson({format:'curatoros-canonical-ship-corpus',formatVersion:2,createdAt:new Date().toISOString(),batch},`curatoros-canonical-ship-corpus-${new Date().toISOString().slice(0,10)}.json`)}
function closeDialog(){const d=document.querySelector('#batch-item-dialog');if(!d)return;try{d.close()}catch{}d.remove()}
function clone(value){return JSON.parse(JSON.stringify(value))}
function entityKey(value){return compact(value).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim()}
function slug(value){return compact(value).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unnamed'}
function compact(value){return String(value??'').replace(/\s+/g,' ').trim()}
function cleanTitle(value){return compact(value).replace(/\s*[|—–-]\s*(Ship Guide|Ocean Liner Curator).*$/i,'').trim()}
function titleFromPath(value){return String(value||'').split(/[?#]/)[0].replace(/\/$/,'').split('/').filter(Boolean).pop()?.replace(/\.html?$/i,'').replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase())||''}
function display(value){return Array.isArray(value)?value.join(', '):compact(value)}
function displayEditor(value){return Array.isArray(value)?value.join('\n'):String(value??'')}
function label(value){return String(value||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
function metric(value,text){return `<div class="metric"><strong>${value}</strong><span>${esc(text)}</span></div>`}
function downloadJson(value,name){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
