const CATALOG_KEY='curatoros.rebuilt.catalog';
const CHANGE_KEY='curatoros.project.pendingChanges';
const BASELINE_KEY='curatoros.project.editBaseline';
const LEDGER_KEY='curatoros.evidence.ledger';
const SINGLE_KEY='curatoros.extraction.lastSession';
const BATCH_KEY='curatoros.extraction.batch';
const app=document.querySelector('#app');
const button=document.querySelector('#evidence-ledger');
let filter='all';
let search='';

button?.addEventListener('click',()=>{activate();ingestExtractionEvidence();render();});
window.addEventListener('curatoros:records-changed',()=>{ingestExtractionEvidence();if(button?.classList.contains('active'))render();});

function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button?.classList.add('active');}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));}
function records(){const v=readJson(CATALOG_KEY,[]);return Array.isArray(v)?v:[]}
function ledger(){const v=readJson(LEDGER_KEY,[]);return Array.isArray(v)?v:[]}
function title(r){return r?.title||r?.name||r?.id||'Untitled record'}
function norm(v){return String(v??'').trim().replace(/\s+/g,' ').toLowerCase()}

function ingestExtractionEvidence(){
  const claims=ledger();
  const seen=new Set(claims.map(c=>c.id));
  const single=readJson(SINGLE_KEY,null);
  if(single?.approvedAt)ingestSession(single,claims,seen,'single-extraction');
  const batch=readJson(BATCH_KEY,{items:[]});
  for(const item of batch?.items||[])if(item?.state==='approved'||item?.approvedAt)ingestSession(item,claims,seen,'batch-extraction');
  writeJson(LEDGER_KEY,claims);
}

function ingestSession(session,claims,seen,mode){
  const recordId=session.recordId||session.existingRecordId;if(!recordId)return;
  const approvedAt=session.approvedAt||session.extractedAt||new Date().toISOString();
  for(const c of session.candidates||[]){
    if(!c.include||!c.field||c.field==='unmapped'||!String(c.normalizedValue??'').trim())continue;
    const sourceIdentity=session.url||session.filename||'local-page';
    const id=`claim:${hash(`${recordId}|${c.field}|${c.normalizedValue}|${sourceIdentity}|${approvedAt}`)}`;
    if(seen.has(id))continue;
    claims.push({id,recordId,field:c.field,value:c.normalizedValue,rawValue:c.rawValue??c.normalizedValue,rawLabel:c.rawLabel||c.field,confidence:c.confidence||'unknown',source:{url:session.url||'',filename:session.filename||'',kind:c.sourceKind||'page',mode},observedAt:session.extractedAt||approvedAt,approvedAt,preferred:false,resolutionNote:''});
    seen.add(id);
  }
}

function analyze(all,claims){
  const byRecord=new Map(all.map(r=>[r.id,r]));
  const grouped=new Map();
  for(const claim of claims){const key=`${claim.recordId}|${claim.field}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(claim)}
  const conflicts=[];const supported=[];
  for(const [key,list] of grouped){const values=[...new Set(list.map(c=>norm(c.value)).filter(Boolean))];const [recordId,field]=key.split('|');const record=byRecord.get(recordId);const current=currentValue(record,field);const item={key,recordId,field,record,current,claims:list,values};if(values.length>1)conflicts.push(item);else supported.push(item)}
  const uncovered=[];
  for(const record of all){
    for(const [field,value] of Object.entries(record.data||{})){if(value==null||String(value).trim()==='')continue;const key=`${record.id}|${field}`;if(!grouped.has(key))uncovered.push({record,field,value})}
    if(record.summary&&!grouped.has(`${record.id}|summary`))uncovered.push({record,field:'summary',value:record.summary});
  }
  return{byRecord,grouped,conflicts,supported,uncovered};
}

function currentValue(record,field){if(!record)return'';return field==='summary'?record.summary??'':record.data?.[field]??''}

function render(){
  if(!app)return;
  const all=records();const claims=ledger();const a=analyze(all,claims);
  const conflictClaims=new Set(a.conflicts.flatMap(x=>x.claims.map(c=>c.id)));
  let visible=claims;
  if(filter==='conflict')visible=claims.filter(c=>conflictClaims.has(c.id));
  if(filter==='preferred')visible=claims.filter(c=>c.preferred);
  if(search){const q=search.toLowerCase();visible=visible.filter(c=>`${c.recordId} ${c.field} ${c.value} ${c.rawValue} ${c.source?.url||''} ${c.source?.filename||''}`.toLowerCase().includes(q));}

  app.innerHTML=`
  <section class="panel evidence-hero"><div><span class="eyebrow">Evidence & conflict ledger</span><h3>Track which source supports each fact</h3><p>Fact-level evidence is preserved separately from the record value so CuratorOS can show provenance, competing claims, preferred evidence, and gaps without erasing disagreement.</p></div><div class="evidence-hero-stat"><strong>${claims.length}</strong><span>fact claims</span></div></section>
  <section class="metrics">${metric(a.supported.length,'Supported fields')}${metric(a.conflicts.length,'Conflicting fields')}${metric(a.uncovered.length,'Facts without claim evidence')}${metric(claims.filter(c=>c.preferred).length,'Preferred claims')}</section>
  <section class="panel evidence-controls"><label><span>Search evidence</span><input id="evidence-search" type="search" value="${esc(search)}" placeholder="Olympic, launchDate, source URL…"></label><label><span>Show</span><select id="evidence-filter"><option value="all"${filter==='all'?' selected':''}>All claims</option><option value="conflict"${filter==='conflict'?' selected':''}>Conflicting claims</option><option value="preferred"${filter==='preferred'?' selected':''}>Preferred claims</option></select></label><button id="evidence-export" type="button">Export ledger</button></section>
  <section class="panel"><div class="evidence-section-head"><div><span class="eyebrow">Conflict review</span><h4>${a.conflicts.length} field${a.conflicts.length===1?'':'s'} with competing values</h4></div></div>${a.conflicts.length?`<div class="evidence-conflicts">${a.conflicts.map(renderConflict).join('')}</div>`:'<p class="empty">No competing fact values are currently recorded.</p>'}</section>
  <section class="panel"><div class="evidence-section-head"><div><span class="eyebrow">Claim ledger</span><h4>${visible.length} visible claim${visible.length===1?'':'s'}</h4></div></div><div class="evidence-claims">${visible.length?visible.slice(0,300).map(c=>renderClaim(c,a.byRecord.get(c.recordId),conflictClaims.has(c.id))).join(''):'<p class="empty">No evidence claims match this view.</p>'}</div></section>
  <section class="panel"><details><summary>Facts without fact-level evidence (${a.uncovered.length})</summary><div class="evidence-uncovered">${a.uncovered.slice(0,200).map(x=>`<article><div><strong>${esc(title(x.record))}</strong><small>${esc(x.record.id)}</small></div><span>${esc(label(x.field))}</span><code>${esc(display(x.value))}</code></article>`).join('')||'<p class="empty">Every structured fact has at least one claim.</p>'}</div></details></section>`;
  bind(a);
}

function renderConflict(item){
  const preferred=item.claims.find(c=>c.preferred);
  return `<article class="evidence-conflict"><header><div><strong>${esc(title(item.record)||item.recordId)}</strong><small>${esc(item.recordId)} · ${esc(label(item.field))}</small></div><span class="badge">${item.values.length} values</span></header><p><strong>Current record:</strong> ${esc(display(item.current)||'—')}</p><div class="evidence-options">${item.claims.map(c=>`<label class="evidence-option ${c.preferred?'preferred':''}"><input type="radio" name="pref-${esc(hash(item.key))}" data-prefer-claim="${esc(c.id)}" ${c.preferred?'checked':''}><span><strong>${esc(display(c.value))}</strong><small>${esc(sourceLabel(c))} · ${esc(label(c.confidence||'unknown'))}</small>${c.rawValue!==c.value?`<em>Raw: ${esc(display(c.rawValue))}</em>`:''}</span></label>`).join('')}</div><div class="actions">${preferred?`<button type="button" data-apply-preferred="${esc(item.key)}">Apply preferred value to record</button>`:''}<button type="button" data-clear-preferred="${esc(item.key)}" ${preferred?'':'disabled'}>Clear preference</button></div></article>`;
}

function renderClaim(c,record,isConflict){return `<article class="evidence-claim"><div><div class="badges"><span class="badge">${esc(label(c.field))}</span>${isConflict?'<span class="badge">Conflict</span>':''}${c.preferred?'<span class="badge">Preferred</span>':''}</div><strong>${esc(title(record)||c.recordId)}</strong><p>${esc(display(c.value))}</p><small>${esc(sourceLabel(c))}</small></div><div><code>${esc(c.recordId)}</code><small>${esc(formatDate(c.approvedAt))}</small></div></article>`}

function bind(a){
  document.querySelector('#evidence-search')?.addEventListener('input',e=>{search=e.target.value;render();refocus('#evidence-search')});
  document.querySelector('#evidence-filter')?.addEventListener('change',e=>{filter=e.target.value;render()});
  document.querySelector('#evidence-export')?.addEventListener('click',exportLedger);
  document.querySelectorAll('[data-prefer-claim]').forEach(el=>el.addEventListener('change',()=>setPreferred(el.dataset.preferClaim)));
  document.querySelectorAll('[data-clear-preferred]').forEach(b=>b.addEventListener('click',()=>clearPreferred(b.dataset.clearPreferred)));
  document.querySelectorAll('[data-apply-preferred]').forEach(b=>b.addEventListener('click',()=>applyPreferred(b.dataset.applyPreferred,a)));
}

function setPreferred(id){const claims=ledger();const selected=claims.find(c=>c.id===id);if(!selected)return;for(const c of claims)if(c.recordId===selected.recordId&&c.field===selected.field)c.preferred=c.id===id;writeJson(LEDGER_KEY,claims);render()}
function clearPreferred(key){const [recordId,field]=key.split('|');const claims=ledger();for(const c of claims)if(c.recordId===recordId&&c.field===field)c.preferred=false;writeJson(LEDGER_KEY,claims);render()}

function applyPreferred(key,a){
  const [recordId,field]=key.split('|');const claims=ledger();const preferred=claims.find(c=>c.recordId===recordId&&c.field===field&&c.preferred);if(!preferred)return;
  const all=records();const index=all.findIndex(r=>r.id===recordId);if(index<0)return alert('The target Project Record no longer exists.');
  const before=clone(all[index]);const after=clone(before);if(field==='summary')after.summary=preferred.value;else{after.data=after.data||{};after.data[field]=preferred.value}after.metadata={...(after.metadata||{}),evidenceResolvedAt:new Date().toISOString()};
  if(JSON.stringify(before)===JSON.stringify(after))return alert('The Project Record already uses the preferred value.');
  if(!localStorage.getItem(BASELINE_KEY))writeJson(BASELINE_KEY,all);
  all[index]=after;writeJson(CATALOG_KEY,all);
  const changes=readJson(CHANGE_KEY,[]).filter(x=>x.recordId!==recordId);changes.push({id:`change:${recordId}`,recordId,title:after.title,changedAt:new Date().toISOString(),origin:after.origin||null,before,after,fields:[field],changeKind:'evidence-resolution'});writeJson(CHANGE_KEY,changes);
  preferred.resolutionNote=`Applied as preferred value on ${new Date().toISOString()}`;writeJson(LEDGER_KEY,claims);window.dispatchEvent(new CustomEvent('curatoros:records-changed'));alert(`Applied preferred ${label(field)} to ${title(after)} as a reversible pending change.`);
}

function exportLedger(){const claims=ledger();const a=analyze(records(),claims);download({format:'curatoros-fact-evidence-ledger',formatVersion:1,createdAt:new Date().toISOString(),claimCount:claims.length,conflictCount:a.conflicts.length,uncoveredFactCount:a.uncovered.length,claims,conflicts:a.conflicts.map(x=>({recordId:x.recordId,field:x.field,current:x.current,claimIds:x.claims.map(c=>c.id),values:x.claims.map(c=>c.value)}))},`curatoros-evidence-ledger-${new Date().toISOString().slice(0,10)}.json`)}
function sourceLabel(c){return c.source?.url||c.source?.filename||c.source?.kind||'Unknown source'}
function display(v){return typeof v==='object'?JSON.stringify(v):String(v??'')}
function clone(v){return JSON.parse(JSON.stringify(v))}
function hash(v){let h=2166136261;for(const ch of String(v)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function metric(v,l){return `<div class="metric"><strong>${v}</strong><span>${esc(l)}</span></div>`}
function label(v){return String(v||'').replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g,m=>m.toUpperCase())}
function formatDate(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString()}
function refocus(sel){setTimeout(()=>{const el=document.querySelector(sel);el?.focus();try{el?.setSelectionRange(el.value.length,el.value.length)}catch{}},0)}
function download(payload,name){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]))}
