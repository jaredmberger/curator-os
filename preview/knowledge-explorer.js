const CATALOG_KEY='curatoros.rebuilt.catalog';
const COLLECTIONS_KEY='curatoros.knowledge.collections';
const app=document.querySelector('#app');
const button=document.querySelector('#knowledge-explorer');

const state={search:'',type:'',status:'',field:'',operator:'contains',value:'',relationship:'',target:'',sort:'title'};

button?.addEventListener('click',()=>{activate();render();});

function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button.classList.add('active');}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function records(){const v=readJson(CATALOG_KEY,[]);return Array.isArray(v)?v:[];}
function collections(){const v=readJson(COLLECTIONS_KEY,[]);return Array.isArray(v)?v:[];}
function saveCollections(v){localStorage.setItem(COLLECTIONS_KEY,JSON.stringify(v));}

function render(){
  if(!app)return;
  const all=records();
  const visible=query(all);
  const types=[...new Set(all.map(r=>r.type||'record'))].sort();
  const statuses=[...new Set(all.map(r=>r.status||'unknown'))].sort();
  const fields=discoverFields(all);
  const relTypes=[...new Set(all.flatMap(r=>(r.relationships||[]).map(x=>x.relationship||x.type).filter(Boolean)))].sort();
  const saved=collections();

  app.innerHTML=`
  <section class="panel knowledge-hero">
    <div><span class="eyebrow">Knowledge Explorer</span><h3>Query the standardized corpus</h3><p>Combine Project Records by type, status, structured field values, and relationships. Save useful result sets as reusable knowledge collections.</p></div>
    <div class="knowledge-hero-stat"><strong>${visible.length}</strong><span>matching ${visible.length===1?'record':'records'}</span></div>
  </section>

  <section class="panel knowledge-query">
    <div class="knowledge-query-grid">
      <label><span>Search</span><input id="ke-search" type="search" placeholder="Title, ID, summary, field, source…" value="${esc(state.search)}"></label>
      <label><span>Type</span><select id="ke-type"><option value="">Any type</option>${types.map(v=>opt(v,state.type,label(v))).join('')}</select></label>
      <label><span>Status</span><select id="ke-status"><option value="">Any status</option>${statuses.map(v=>opt(v,state.status,label(v))).join('')}</select></label>
      <label><span>Structured field</span><select id="ke-field"><option value="">Any field</option>${fields.map(v=>opt(v,state.field,label(v))).join('')}</select></label>
      <label><span>Match</span><select id="ke-operator">${['contains','equals','starts-with','exists','missing'].map(v=>opt(v,state.operator,label(v))).join('')}</select></label>
      <label><span>Field value</span><input id="ke-value" value="${esc(state.value)}" placeholder="Harland & Wolff, 1910…" ${['exists','missing'].includes(state.operator)?'disabled':''}></label>
      <label><span>Relationship</span><select id="ke-relationship"><option value="">Any relationship</option>${relTypes.map(v=>opt(v,state.relationship,label(v))).join('')}</select></label>
      <label><span>Relationship target</span><input id="ke-target" value="${esc(state.target)}" placeholder="company.harland-wolff"></label>
      <label><span>Sort</span><select id="ke-sort">${[['title','Title A–Z'],['type','Type'],['status','Status'],['id','Record ID']].map(([v,l])=>opt(v,state.sort,l)).join('')}</select></label>
    </div>
    <div class="actions knowledge-query-actions"><button id="ke-clear" type="button">Clear query</button><button id="ke-save" type="button" ${visible.length?'':'disabled'}>Save result as collection</button><button id="ke-export" type="button" ${visible.length?'':'disabled'}>Export result JSON</button></div>
  </section>

  <section class="metrics knowledge-metrics">${metric(all.length,'Corpus records')}${metric(visible.length,'Matches')}${metric(saved.length,'Saved collections')}${metric(visible.reduce((n,r)=>n+(r.relationships?.length||0),0),'Relationships in result')}</section>

  <section class="panel knowledge-results">
    <div class="knowledge-results-head"><div><span class="eyebrow">Query result</span><h4>${visible.length} ${visible.length===1?'record':'records'}</h4></div><span class="knowledge-query-summary">${esc(querySummary())}</span></div>
    <div class="knowledge-result-list">${visible.length?visible.map(renderRecord).join(''):'<div class="empty">No records match this query.</div>'}</div>
  </section>

  <section class="panel knowledge-collections">
    <div class="knowledge-results-head"><div><span class="eyebrow">Reusable knowledge sets</span><h4>Saved collections</h4></div></div>
    <div class="knowledge-collection-list">${saved.length?saved.map(renderCollection).join(''):'<div class="empty">No saved collections yet. Save any useful query result to reuse it later.</div>'}</div>
  </section>`;
  bind(visible);
}

function bind(visible){
  const bindValue=(id,key,event='input')=>document.querySelector(id)?.addEventListener(event,e=>{state[key]=e.target.value;render();focusLater(id);});
  bindValue('#ke-search','search');bindValue('#ke-type','type','change');bindValue('#ke-status','status','change');bindValue('#ke-field','field','change');bindValue('#ke-operator','operator','change');bindValue('#ke-value','value');bindValue('#ke-relationship','relationship','change');bindValue('#ke-target','target');bindValue('#ke-sort','sort','change');
  document.querySelector('#ke-clear')?.addEventListener('click',()=>{Object.assign(state,{search:'',type:'',status:'',field:'',operator:'contains',value:'',relationship:'',target:'',sort:'title'});render();});
  document.querySelector('#ke-save')?.addEventListener('click',()=>saveCollection(visible));
  document.querySelector('#ke-export')?.addEventListener('click',()=>download({format:'curatoros-knowledge-query',formatVersion:1,createdAt:new Date().toISOString(),query:{...state},recordCount:visible.length,records:visible},`curatoros-knowledge-query-${dateStamp()}.json`));
  document.querySelectorAll('[data-load-collection]').forEach(b=>b.addEventListener('click',()=>loadCollection(b.dataset.loadCollection)));
  document.querySelectorAll('[data-export-collection]').forEach(b=>b.addEventListener('click',()=>exportCollection(b.dataset.exportCollection)));
  document.querySelectorAll('[data-delete-collection]').forEach(b=>b.addEventListener('click',()=>deleteCollection(b.dataset.deleteCollection)));
}

function query(all){
  const q=state.search.trim().toLowerCase();
  const v=state.value.trim().toLowerCase();
  const target=state.target.trim().toLowerCase();
  const out=all.filter(r=>{
    if(state.type&&(r.type||'record')!==state.type)return false;
    if(state.status&&(r.status||'unknown')!==state.status)return false;
    if(q&&!JSON.stringify(r).toLowerCase().includes(q))return false;
    if(state.field){const fv=getField(r,state.field);if(state.operator==='exists'&&(fv===undefined||fv===null||fv===''))return false;if(state.operator==='missing'&&!(fv===undefined||fv===null||fv===''))return false;if(!['exists','missing'].includes(state.operator)){const text=display(fv).toLowerCase();if(state.operator==='equals'&&text!==v)return false;if(state.operator==='starts-with'&&!text.startsWith(v))return false;if(state.operator==='contains'&&!text.includes(v))return false;}}
    if(state.relationship||target){const rels=Array.isArray(r.relationships)?r.relationships:[];const ok=rels.some(rel=>{const relName=String(rel.relationship||rel.type||'').toLowerCase();const relTarget=String(rel.target||rel.id||rel.recordId||'').toLowerCase();return(!state.relationship||relName===state.relationship.toLowerCase())&&(!target||relTarget.includes(target));});if(!ok)return false;}
    return true;
  });
  return [...out].sort((a,b)=>{if(state.sort==='type')return `${a.type||''} ${title(a)}`.localeCompare(`${b.type||''} ${title(b)}`);if(state.sort==='status')return `${a.status||''} ${title(a)}`.localeCompare(`${b.status||''} ${title(b)}`);if(state.sort==='id')return String(a.id||'').localeCompare(String(b.id||''));return title(a).localeCompare(title(b));});
}

function getField(r,key){if(r.data&&Object.prototype.hasOwnProperty.call(r.data,key))return r.data[key];if(Object.prototype.hasOwnProperty.call(r,key))return r[key];return undefined;}
function discoverFields(all){return [...new Set(all.flatMap(r=>Object.keys(r.data||{})))].sort();}
function renderRecord(r){const rels=r.relationships?.length||0;const sources=r.sources?.length||0;const url=r.data?.pageUrl||r.url||r.path||'';return `<article class="knowledge-record"><div><div class="badges"><span class="badge">${esc(label(r.type||'record'))}</span><span class="badge">${esc(label(r.status||'unknown'))}</span></div><h4>${esc(title(r))}</h4><p>${esc(r.id||'')}</p>${r.summary?`<p>${esc(r.summary)}</p>`:''}</div><div class="knowledge-record-meta"><span>${sources} source${sources===1?'':'s'}</span><span>${rels} relationship${rels===1?'':'s'}</span>${url?`<a href="${esc(normalizeUrl(url))}" target="_blank" rel="noopener">Open page</a>`:''}</div></article>`;}
function saveCollection(visible){const name=prompt('Name this knowledge collection:');if(!name?.trim())return;const list=collections();list.push({id:`collection-${Date.now()}`,name:name.trim(),createdAt:new Date().toISOString(),query:{...state},recordIds:visible.map(r=>r.id),recordCount:visible.length});saveCollections(list);render();}
function renderCollection(c){return `<article class="knowledge-collection"><div><strong>${esc(c.name)}</strong><p>${c.recordCount||c.recordIds?.length||0} records · ${esc(formatDate(c.createdAt))}</p><small>${esc(summaryFor(c.query||{}))}</small></div><div class="actions"><button type="button" data-load-collection="${esc(c.id)}">Load query</button><button type="button" data-export-collection="${esc(c.id)}">Export</button><button type="button" data-delete-collection="${esc(c.id)}">Delete</button></div></article>`;}
function loadCollection(id){const c=collections().find(x=>x.id===id);if(!c)return;Object.assign(state,{search:'',type:'',status:'',field:'',operator:'contains',value:'',relationship:'',target:'',sort:'title'},c.query||{});render();}
function exportCollection(id){const c=collections().find(x=>x.id===id);if(!c)return;const byId=new Map(records().map(r=>[r.id,r]));const set=(c.recordIds||[]).map(id=>byId.get(id)).filter(Boolean);download({format:'curatoros-knowledge-collection',formatVersion:1,exportedAt:new Date().toISOString(),collection:c,records:set},`${slug(c.name)}-${dateStamp()}.json`);}
function deleteCollection(id){const c=collections().find(x=>x.id===id);if(!c||!confirm(`Delete saved collection “${c.name}”?`))return;saveCollections(collections().filter(x=>x.id!==id));render();}
function querySummary(){return summaryFor(state);}
function summaryFor(s){const bits=[];if(s.search)bits.push(`search “${s.search}”`);if(s.type)bits.push(`type = ${s.type}`);if(s.status)bits.push(`status = ${s.status}`);if(s.field)bits.push(`${s.field} ${s.operator}${['exists','missing'].includes(s.operator)?'':` “${s.value||''}”`}`);if(s.relationship)bits.push(`relationship = ${s.relationship}`);if(s.target)bits.push(`target contains ${s.target}`);return bits.length?bits.join(' · '):'All records';}
function metric(v,l){return `<div class="metric"><strong>${v}</strong><span>${esc(l)}</span></div>`;}
function opt(v,current,l){return `<option value="${esc(v)}"${v===current?' selected':''}>${esc(l)}</option>`;}
function title(r){return r.title||r.name||r.id||'Untitled record';}
function display(v){if(v==null)return'';return typeof v==='object'?JSON.stringify(v):String(v);}
function label(v){return String(v||'').replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g,m=>m.toUpperCase());}
function normalizeUrl(v){const s=String(v||'');if(/^https?:\/\//i.test(s))return s;return `https://oceanliners.net/${s.replace(/^\//,'')}`;}
function download(payload,name){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);}
function focusLater(sel){setTimeout(()=>{const el=document.querySelector(sel);if(el&&['INPUT','TEXTAREA'].includes(el.tagName)){el.focus();try{el.setSelectionRange(el.value.length,el.value.length);}catch{}}},0);}
function formatDate(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString();}
function dateStamp(){return new Date().toISOString().slice(0,10);}
function slug(v){return String(v||'collection').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'collection';}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
