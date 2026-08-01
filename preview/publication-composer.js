const CATALOG_KEY='curatoros.rebuilt.catalog';
const COLLECTIONS_KEY='curatoros.knowledge.collections';
const DRAFTS_KEY='curatoros.publication.drafts';
const app=document.querySelector('#app');
const button=document.querySelector('#publication-composer');

const state={collectionId:'',pageType:'fleet-directory',title:'',slug:'',audience:'general',angle:'',sort:'title',selectedIds:[],built:null};
const PAGE_TYPES={
  'fleet-directory':'Fleet directory',
  timeline:'Timeline',
  comparison:'Comparison',
  'builder-collection':'Builder collection',
  'research-table':'Research table',
  'illustrated-article':'Illustrated article',
  'hub-page':'Hub page',
  custom:'Custom page brief'
};

button?.addEventListener('click',()=>{activate();render();});

function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button.classList.add('active');}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function records(){const value=readJson(CATALOG_KEY,[]);return Array.isArray(value)?value:[];}
function collections(){const value=readJson(COLLECTIONS_KEY,[]);return Array.isArray(value)?value:[];}
function drafts(){const value=readJson(DRAFTS_KEY,[]);return Array.isArray(value)?value:[];}
function saveDrafts(value){localStorage.setItem(DRAFTS_KEY,JSON.stringify(value));}

function render(){
  if(!app)return;
  const saved=collections();
  const chosen=saved.find(x=>x.id===state.collectionId)||null;
  const selected=chosen?collectionRecords(chosen):[];
  if(chosen&&!state.selectedIds.length)state.selectedIds=selected.map(r=>r.id);
  const active=selected.filter(r=>state.selectedIds.includes(r.id));

  app.innerHTML=`
    <section class="panel publication-hero">
      <div><span class="eyebrow">Publication Composer</span><h3>Turn reusable knowledge into a page plan</h3><p>Select a saved Knowledge Explorer collection, choose how the records should be presented, then build a reviewable publication brief and semantic HTML draft.</p></div>
      <div class="publication-hero-stat"><strong>${active.length}</strong><span>records selected</span></div>
    </section>

    <section class="panel publication-setup">
      <div class="publication-setup-grid">
        <label><span>Knowledge collection</span><select id="pub-collection"><option value="">Choose a saved collection</option>${saved.map(c=>opt(c.id,state.collectionId,`${c.name} (${c.recordCount||c.recordIds?.length||0})`)).join('')}</select></label>
        <label><span>Page type</span><select id="pub-type">${Object.entries(PAGE_TYPES).map(([v,l])=>opt(v,state.pageType,l)).join('')}</select></label>
        <label><span>Working title</span><input id="pub-title" value="${esc(state.title)}" placeholder="Generated from collection name"></label>
        <label><span>Proposed slug</span><input id="pub-slug" value="${esc(state.slug)}" placeholder="white-star-line-fleet"></label>
        <label><span>Audience</span><select id="pub-audience">${[['general','General reader'],['research','Research/reference'],['collector','Collector'],['education','Educational'],['enthusiast','Enthusiast']].map(([v,l])=>opt(v,state.audience,l)).join('')}</select></label>
        <label><span>Record order</span><select id="pub-sort">${[['title','Title A–Z'],['launchDate','Launch date'],['type','Record type'],['status','Status']].map(([v,l])=>opt(v,state.sort,l)).join('')}</select></label>
        <label class="publication-wide"><span>Editorial angle / purpose</span><textarea id="pub-angle" rows="3" placeholder="What should this page help the reader understand?">${esc(state.angle)}</textarea></label>
      </div>
      <div class="actions"><button type="button" id="pub-build" ${active.length?'':'disabled'}>Build publication brief</button></div>
    </section>

    ${chosen?renderSelection(chosen,selected):renderNoCollection(saved)}
    ${state.built?renderBrief(state.built):''}
    ${renderSavedDrafts()}`;
  bind(selected);
}

function renderNoCollection(saved){return `<section class="panel publication-empty"><h4>${saved.length?'Choose a knowledge collection':'No saved knowledge collections yet'}</h4><p>${saved.length?'The composer uses stable record sets saved in Knowledge Explorer.':'Create a reusable collection in Knowledge Explorer first, then return here to compose a page from it.'}</p></section>`;}

function renderSelection(collection,items){return `
  <section class="panel publication-selection">
    <div class="publication-section-head"><div><span class="eyebrow">Source knowledge</span><h4>${esc(collection.name)}</h4><p>${esc(summaryFor(collection.query||{}))}</p></div><div class="actions"><button type="button" id="pub-select-all">Select all</button><button type="button" id="pub-clear-all">Clear</button></div></div>
    <div class="publication-records">${items.map(r=>`<label class="publication-record"><input type="checkbox" data-pub-record="${esc(r.id)}" ${state.selectedIds.includes(r.id)?'checked':''}><span><strong>${esc(title(r))}</strong><small>${esc(label(r.type||'record'))} · ${esc(r.id||'')}</small></span></label>`).join('')}</div>
  </section>`;}

function buildBrief(items,collection){
  const sorted=sortRecords(items);
  const titleText=state.title.trim()||collection.name;
  const slugText=slug(state.slug.trim()||titleText);
  const fields=commonFields(sorted);
  const relationships=countRelationships(sorted);
  const sources=sorted.reduce((n,r)=>n+(r.sources?.length||0),0);
  const sections=sectionsFor(state.pageType,sorted,fields);
  return {
    format:'curatoros-publication-brief',formatVersion:1,createdAt:new Date().toISOString(),
    title:titleText,slug:slugText,pageType:state.pageType,pageTypeLabel:PAGE_TYPES[state.pageType],audience:state.audience,
    editorialAngle:state.angle.trim(),collection:{id:collection.id,name:collection.name,query:collection.query||{}},
    recordIds:sorted.map(r=>r.id),recordCount:sorted.length,sourceCount:sources,relationshipCount:relationships,
    commonFields:fields,sections,records:sorted,html:buildHtml(titleText,slugText,sections,sorted)
  };
}

function sectionsFor(type,items,fields){
  const overview={id:'overview',heading:'Overview',purpose:'Introduce the collection, define its scope, and explain why these records belong together.'};
  const sources={id:'sources',heading:'Sources & provenance',purpose:'Document the underlying Project Records and source-page provenance used to assemble the page.'};
  if(type==='timeline')return [overview,{id:'chronology',heading:'Chronology',purpose:'Present records in launch-date order with concise dates and contextual notes.'},{id:'patterns',heading:'Patterns and context',purpose:'Explain changes, clusters, gaps, or transitions visible across the chronology.'},sources];
  if(type==='comparison')return [overview,{id:'comparison-table',heading:'At-a-glance comparison',purpose:`Compare the strongest shared fields${fields.length?`: ${fields.slice(0,6).map(label).join(', ')}`:''}.`},{id:'interpretation',heading:'What the comparison shows',purpose:'Explain meaningful similarities, differences, and limits in the available data.'},sources];
  if(type==='research-table')return [overview,{id:'research-table',heading:'Research table',purpose:`Create a reference-first table using shared fields${fields.length?`: ${fields.slice(0,8).map(label).join(', ')}`:''}.`},{id:'notes',heading:'Research notes',purpose:'Record uncertainties, exceptions, and interpretive cautions.'},sources];
  if(type==='illustrated-article')return [overview,{id:'narrative',heading:'Historical narrative',purpose:'Build a prose-led account supported by the selected records rather than merely listing them.'},{id:'record-highlights',heading:'Selected highlights',purpose:'Use representative records as evidence and examples within the narrative.'},sources];
  if(type==='hub-page')return [overview,{id:'featured',heading:'Featured records',purpose:'Surface the most useful entry points into the collection.'},{id:'browse',heading:'Browse the collection',purpose:'Provide a complete, scannable directory of included records.'},{id:'related',heading:'Related research paths',purpose:'Use relationships and shared fields to suggest adjacent topics.'},sources];
  if(type==='builder-collection')return [overview,{id:'builder-context',heading:'Builder context',purpose:'Explain the builder, yard, or construction context represented by the collection.'},{id:'ships',heading:'Ships in this collection',purpose:'Present the associated vessels with standardized construction and service facts.'},{id:'patterns',heading:'Construction patterns',purpose:'Compare dates, operators, dimensions, classes, and other recurring fields.'},sources];
  if(type==='custom')return [overview,{id:'custom-main',heading:'Main section',purpose:'Define the central presentation using the selected standardized records.'},{id:'custom-support',heading:'Supporting evidence',purpose:'Organize supporting facts, relationships, sources, and notes.'},sources];
  return [overview,{id:'directory',heading:'Directory',purpose:'Present every included record consistently using standardized identifying and service fields.'},{id:'context',heading:'Collection context',purpose:'Explain important relationships, patterns, and historical context across the directory.'},sources];
}

function buildHtml(pageTitle,pageSlug,sections,items){
  const cards=items.map(r=>`<article class="record-card" data-record-id="${attr(r.id||'')}"><h3>${esc(title(r))}</h3>${r.summary?`<p>${esc(r.summary)}</p>`:''}${renderFacts(r)}</article>`).join('\n');
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${esc(pageTitle)} | Ocean Liner Curator</title>\n<link rel="canonical" href="https://oceanliners.net/${attr(pageSlug)}">\n</head>\n<body>\n<main>\n<header><p>Ocean Liner Curator · CuratorOS publication draft</p><h1>${esc(pageTitle)}</h1>${state.angle.trim()?`<p>${esc(state.angle.trim())}</p>`:''}</header>\n${sections.map(section=>`<section id="${attr(section.id)}"><h2>${esc(section.heading)}</h2><p data-editorial-purpose>${esc(section.purpose)}</p>${['directory','browse','ships','record-highlights','featured','chronology','comparison-table','research-table','custom-main'].includes(section.id)?cards:''}</section>`).join('\n')}\n</main>\n</body>\n</html>`;
}
function renderFacts(r){const entries=Object.entries(r.data||{}).filter(([,v])=>v!==''&&v!=null).slice(0,8);if(!entries.length)return'';return `<dl>${entries.map(([k,v])=>`<dt>${esc(label(k))}</dt><dd>${esc(display(v))}</dd>`).join('')}</dl>`;}

function renderBrief(brief){return `
  <section class="panel publication-brief">
    <div class="publication-section-head"><div><span class="eyebrow">Generated publication brief</span><h4>${esc(brief.title)}</h4><p>${esc(brief.pageTypeLabel)} · /${esc(brief.slug)}</p></div><div class="badges"><span class="badge">${brief.recordCount} records</span><span class="badge">${brief.sourceCount} sources</span><span class="badge">${brief.relationshipCount} relationships</span></div></div>
    <div class="publication-brief-grid"><div><strong>Audience</strong><span>${esc(label(brief.audience))}</span></div><div><strong>Editorial purpose</strong><span>${esc(brief.editorialAngle||'Not specified')}</span></div><div><strong>Reusable fields</strong><span>${esc(brief.commonFields.slice(0,8).map(label).join(', ')||'No common structured fields yet')}</span></div></div>
    <div class="publication-sections">${brief.sections.map((s,i)=>`<article><span>${i+1}</span><div><strong>${esc(s.heading)}</strong><p>${esc(s.purpose)}</p></div></article>`).join('')}</div>
    <details class="publication-html-preview"><summary>Preview generated semantic HTML</summary><pre>${esc(brief.html)}</pre></details>
    <div class="actions"><button id="pub-save-draft" type="button">Save brief</button><button id="pub-copy-brief" type="button">Copy brief JSON</button><button id="pub-download-package" type="button">Download publication package</button><button id="pub-download-html" type="button">Download HTML draft</button></div>
  </section>`;}

function renderSavedDrafts(){const list=drafts();return `<section class="panel publication-drafts"><div class="publication-section-head"><div><span class="eyebrow">Publication workspace</span><h4>Saved briefs</h4></div></div><div class="publication-draft-list">${list.length?list.slice().reverse().map(d=>`<article><div><strong>${esc(d.title)}</strong><p>${esc(PAGE_TYPES[d.pageType]||d.pageType)} · ${d.recordCount} records · ${esc(formatDate(d.savedAt))}</p></div><div class="actions"><button data-load-draft="${esc(d.id)}" type="button">Load</button><button data-delete-draft="${esc(d.id)}" type="button">Delete</button></div></article>`).join(''):'<div class="empty">No publication briefs saved yet.</div>'}</div></section>`;}

function bind(selected){
  document.querySelector('#pub-collection')?.addEventListener('change',e=>{state.collectionId=e.target.value;state.selectedIds=[];state.built=null;const c=collections().find(x=>x.id===state.collectionId);if(c&&!state.title)state.title=c.name;render();});
  bindValue('#pub-type','pageType','change');bindValue('#pub-title','title');bindValue('#pub-slug','slug');bindValue('#pub-audience','audience','change');bindValue('#pub-sort','sort','change');bindValue('#pub-angle','angle');
  document.querySelectorAll('[data-pub-record]').forEach(input=>input.addEventListener('change',e=>{const id=e.target.dataset.pubRecord;if(e.target.checked&&!state.selectedIds.includes(id))state.selectedIds.push(id);if(!e.target.checked)state.selectedIds=state.selectedIds.filter(x=>x!==id);state.built=null;render();}));
  document.querySelector('#pub-select-all')?.addEventListener('click',()=>{state.selectedIds=selected.map(r=>r.id);state.built=null;render();});
  document.querySelector('#pub-clear-all')?.addEventListener('click',()=>{state.selectedIds=[];state.built=null;render();});
  document.querySelector('#pub-build')?.addEventListener('click',()=>{const c=collections().find(x=>x.id===state.collectionId);if(!c)return;const items=collectionRecords(c).filter(r=>state.selectedIds.includes(r.id));state.built=buildBrief(items,c);render();});
  document.querySelector('#pub-save-draft')?.addEventListener('click',saveBrief);
  document.querySelector('#pub-copy-brief')?.addEventListener('click',copyBrief);
  document.querySelector('#pub-download-package')?.addEventListener('click',()=>state.built&&download(JSON.stringify(state.built,null,2),`${state.built.slug}-publication-package.json`,'application/json'));
  document.querySelector('#pub-download-html')?.addEventListener('click',()=>state.built&&download(state.built.html,`${state.built.slug}.html`,'text/html'));
  document.querySelectorAll('[data-load-draft]').forEach(b=>b.addEventListener('click',()=>loadDraft(b.dataset.loadDraft)));
  document.querySelectorAll('[data-delete-draft]').forEach(b=>b.addEventListener('click',()=>deleteDraft(b.dataset.deleteDraft)));
}
function bindValue(selector,key,event='input'){document.querySelector(selector)?.addEventListener(event,e=>{state[key]=e.target.value;state.built=null;});}
function saveBrief(){if(!state.built)return;const list=drafts();const saved={...state.built,id:`publication-${Date.now()}`,savedAt:new Date().toISOString()};list.push(saved);saveDrafts(list);render();}
async function copyBrief(){if(!state.built)return;try{await navigator.clipboard.writeText(JSON.stringify(state.built,null,2));const b=document.querySelector('#pub-copy-brief');if(b)b.textContent='Copied';}catch{alert('The publication brief could not be copied on this device.');}}
function loadDraft(id){const d=drafts().find(x=>x.id===id);if(!d)return;state.collectionId=d.collection?.id||'';state.pageType=d.pageType||'fleet-directory';state.title=d.title||'';state.slug=d.slug||'';state.audience=d.audience||'general';state.angle=d.editorialAngle||'';state.selectedIds=d.recordIds||[];state.built={...d};render();}
function deleteDraft(id){const d=drafts().find(x=>x.id===id);if(!d||!confirm(`Delete saved publication brief “${d.title}”?`))return;saveDrafts(drafts().filter(x=>x.id!==id));render();}

function collectionRecords(c){const byId=new Map(records().map(r=>[r.id,r]));return (c.recordIds||[]).map(id=>byId.get(id)).filter(Boolean);}
function sortRecords(items){return [...items].sort((a,b)=>{if(state.sort==='launchDate')return String(a.data?.launchDate||'9999').localeCompare(String(b.data?.launchDate||'9999'))||title(a).localeCompare(title(b));if(state.sort==='type')return `${a.type||''} ${title(a)}`.localeCompare(`${b.type||''} ${title(b)}`);if(state.sort==='status')return `${a.status||''} ${title(a)}`.localeCompare(`${b.status||''} ${title(b)}`);return title(a).localeCompare(title(b));});}
function commonFields(items){if(!items.length)return[];const counts={};items.forEach(r=>Object.keys(r.data||{}).forEach(k=>counts[k]=(counts[k]||0)+1));return Object.entries(counts).filter(([,n])=>n>=Math.max(1,Math.ceil(items.length*.5))).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([k])=>k);}
function countRelationships(items){return items.reduce((n,r)=>n+(r.relationships?.length||0),0);}
function summaryFor(s){const bits=[];if(s.search)bits.push(`search “${s.search}”`);if(s.type)bits.push(`type = ${s.type}`);if(s.status)bits.push(`status = ${s.status}`);if(s.field)bits.push(`${s.field} ${s.operator}${['exists','missing'].includes(s.operator)?'':` “${s.value||''}”`}`);if(s.relationship)bits.push(`relationship = ${s.relationship}`);if(s.target)bits.push(`target contains ${s.target}`);return bits.length?bits.join(' · '):'All records';}
function download(text,name,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);}
function opt(v,current,l){return `<option value="${esc(v)}"${v===current?' selected':''}>${esc(l)}</option>`;}
function title(r){return r.title||r.name||r.id||'Untitled record';}
function display(v){if(v==null)return'';return typeof v==='object'?JSON.stringify(v):String(v);}
function label(v){return String(v||'').replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g,m=>m.toUpperCase());}
function formatDate(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString();}
function slug(v){return String(v||'page').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'page';}
function attr(v){return esc(String(v)).replace(/`/g,'&#096;');}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
