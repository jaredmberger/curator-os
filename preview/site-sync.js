const CATALOG_KEY='curatoros.rebuilt.catalog';
const MANIFEST_KEY='curatoros.siteSync.currentManifest';
const PREVIOUS_KEY='curatoros.siteSync.previousManifest';
const META_KEY='curatoros.siteSync.metadata';
const QUEUE_KEY='curatoros.siteSync.extractionQueue';
const app=document.querySelector('#app');
const button=document.querySelector('#site-sync');
const input=document.querySelector('#site-index-file');

const state={search:'',status:'',section:''};

button?.addEventListener('click',()=>{activate();render();});
input?.addEventListener('change',loadManifest);
window.addEventListener('curatoros:records-changed',()=>{if(button?.classList.contains('active'))render();});

function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button?.classList.add('active');}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function records(){const value=readJson(CATALOG_KEY,[]);return Array.isArray(value)?value:[]}
function currentManifest(){const value=readJson(MANIFEST_KEY,[]);return Array.isArray(value)?value:[]}
function previousManifest(){const value=readJson(PREVIOUS_KEY,[]);return Array.isArray(value)?value:[]}
function queue(){const value=readJson(QUEUE_KEY,[]);return Array.isArray(value)?value:[]}
function saveQueue(value){localStorage.setItem(QUEUE_KEY,JSON.stringify(value));}

function render(){
  if(!app)return;
  const manifest=currentManifest();
  const meta=readJson(META_KEY,null);
  if(!manifest.length){app.innerHTML=emptyWorkspace();bindEmpty();return;}
  const analysis=analyze(manifest,previousManifest(),records());
  const visible=filterPages(analysis.pages);
  const sections=[...new Set(analysis.pages.map(x=>x.section).filter(Boolean))].sort();
  const q=queue();
  app.innerHTML=`
  <section class="panel sync-hero">
    <div><span class="eyebrow">Site / Knowledge Sync</span><h3>Use site-index.json as the map of the corpus</h3><p>Compare the published website inventory with CuratorOS Project Records and extraction history, then work only on pages that need attention.</p></div>
    <div class="actions"><button id="replace-site-index" type="button">Load newer site-index.json</button><button id="export-sync" type="button">Export sync report</button><button id="clear-site-index" type="button">Clear site index</button></div>
  </section>
  <section class="panel sync-source"><div><strong>${esc(meta?.filename||'site-index.json')}</strong><span>${manifest.length} indexed pages · synced ${esc(formatDate(meta?.importedAt))}</span></div><div class="badges"><span class="badge">Website manifest</span>${meta?.previousCount!=null?`<span class="badge">Previous: ${meta.previousCount}</span>`:''}</div></section>
  <section class="metrics sync-metrics">${metric(manifest.length,'Indexed pages')}${metric(analysis.linked,'Linked records')}${metric(analysis.extracted,'Knowledge extracted')}${metric(analysis.attention,'Need attention')}</section>
  <section class="metrics sync-metrics secondary">${metric(analysis.newPages,'New since last sync')}${metric(analysis.changed,'Changed')}${metric(analysis.unextracted,'Never extracted')}${metric(analysis.unmatched,'Unmatched pages')}</section>
  <section class="panel sync-controls">
    <div class="sync-filter-grid">
      <label><span>Search</span><input id="sync-search" type="search" placeholder="Title, URL, record ID…" value="${esc(state.search)}"></label>
      <label><span>Status</span><select id="sync-status"><option value="">All statuses</option>${['current','new','changed','unextracted','unmatched'].map(v=>option(v,state.status,label(v))).join('')}</select></label>
      <label><span>Section</span><select id="sync-section"><option value="">All sections</option>${sections.map(v=>option(v,state.section,v)).join('')}</select></label>
    </div>
    <div class="actions"><button id="queue-attention" type="button" ${analysis.attention?'':'disabled'}>Queue all needing attention</button><button id="download-queue" type="button" ${q.length?'':'disabled'}>Download extraction queue (${q.length})</button><button id="clear-sync-filters" type="button">Clear filters</button></div>
  </section>
  <section class="panel sync-list-panel"><div class="sync-list-head"><div><span class="eyebrow">Website coverage</span><h4>${visible.length} shown of ${analysis.pages.length} pages</h4></div><span>${analysis.orphans.length} Project Record${analysis.orphans.length===1?'':'s'} with public pages missing from this index</span></div><div class="sync-list">${visible.length?visible.map(renderPage).join(''):'<div class="empty">No indexed pages match these filters.</div>'}</div></section>
  ${analysis.orphans.length?`<section class="panel sync-orphans"><details><summary>Project Records with public pages missing from site-index.json (${analysis.orphans.length})</summary><div class="sync-list">${analysis.orphans.slice(0,100).map(r=>`<article class="sync-row"><div><div class="badges"><span class="badge">Possible orphan</span></div><strong>${esc(r.title||r.id)}</strong><p>${esc(publicUrl(r))}</p></div></article>`).join('')}</div></details></section>`:''}`;
  bind(analysis);
}

function emptyWorkspace(){return `<section class="panel sync-hero"><div><span class="eyebrow">Site / Knowledge Sync</span><h3>Connect the live website inventory to the knowledge corpus</h3><p>Load the site-index.json generated for OceanLiners.net. CuratorOS will keep it separate from Project Records and use it as the authoritative inventory of published pages.</p></div><div class="actions"><button id="choose-site-index" type="button">Choose site-index.json</button></div></section><section class="panel"><h4>No site manifest loaded</h4><p>This workspace does not replace your Project Records. It compares the site inventory against them so CuratorOS can identify new, changed, unmatched, unextracted, and potentially orphaned pages.</p></section>`;}
function bindEmpty(){document.querySelector('#choose-site-index')?.addEventListener('click',()=>input?.click());}

function bind(analysis){
  document.querySelector('#replace-site-index')?.addEventListener('click',()=>input?.click());
  document.querySelector('#clear-site-index')?.addEventListener('click',clearManifest);
  document.querySelector('#export-sync')?.addEventListener('click',()=>exportReport(analysis));
  document.querySelector('#queue-attention')?.addEventListener('click',()=>queueAttention(analysis));
  document.querySelector('#download-queue')?.addEventListener('click',downloadQueue);
  document.querySelector('#clear-sync-filters')?.addEventListener('click',()=>{state.search='';state.status='';state.section='';render();});
  document.querySelector('#sync-search')?.addEventListener('input',e=>{state.search=e.target.value;render();refocus('#sync-search');});
  document.querySelector('#sync-status')?.addEventListener('change',e=>{state.status=e.target.value;render();});
  document.querySelector('#sync-section')?.addEventListener('change',e=>{state.section=e.target.value;render();});
  document.querySelectorAll('[data-queue-page]').forEach(b=>b.addEventListener('click',()=>queueOne(analysis.pages.find(x=>x.key===b.dataset.queuePage))));
}

async function loadManifest(){
  const file=input?.files?.[0];if(!file)return;
  try{
    const parsed=JSON.parse(await file.text());
    const normalized=normalizeManifest(parsed);
    if(!normalized.length)throw new Error('No webpage entries were found in this site-index.json file.');
    const existing=currentManifest();
    if(existing.length)localStorage.setItem(PREVIOUS_KEY,JSON.stringify(existing));
    localStorage.setItem(MANIFEST_KEY,JSON.stringify(normalized));
    localStorage.setItem(META_KEY,JSON.stringify({filename:file.name,importedAt:new Date().toISOString(),pageCount:normalized.length,previousCount:existing.length||0}));
    activate();render();
  }catch(error){alert(error instanceof Error?error.message:String(error));}
  finally{input.value='';}
}

function normalizeManifest(value){
  const rows=findRows(value);
  return rows.map((entry,index)=>normalizeEntry(entry,index)).filter(x=>x.url||x.title);
}
function findRows(value){if(Array.isArray(value))return value;if(!value||typeof value!=='object')return[];for(const key of ['pages','entries','items','documents','urls','index','records'])if(Array.isArray(value[key]))return value[key];for(const nested of Object.values(value)){if(!nested||typeof nested!=='object'||Array.isArray(nested))continue;for(const key of ['pages','entries','items','documents','urls','index'])if(Array.isArray(nested[key]))return nested[key];}return[];}
function normalizeEntry(entry,index){
  if(typeof entry==='string')return makeEntry({url:entry,title:titleFromPath(entry)},index);
  if(!entry||typeof entry!=='object')return makeEntry({},index);
  const url=entry.url||entry.path||entry.href||entry.canonical||entry.loc||entry.permalink||'';
  const title=entry.title||entry.name||entry.label||entry.ship||titleFromPath(url);
  const section=entry.section||entry.category||entry.type||inferSection(url);
  const modified=entry.lastModified||entry.lastmod||entry.modified||entry.updatedAt||entry.dateModified||entry.updated||'';
  const hash=entry.hash||entry.contentHash||entry.checksum||entry.etag||entry.digest||'';
  const description=entry.description||entry.summary||entry.metaDescription||'';
  return makeEntry({url,title,section,modified,hash,description,raw:entry},index);
}
function makeEntry(data,index){const url=normalizePath(data.url||'');const title=data.title||titleFromPath(url)||`Page ${index+1}`;return{key:url||`entry-${index}`,url,title,section:data.section||inferSection(url),modified:data.modified||'',hash:data.hash||'',description:data.description||'',signature:signature({url,title,section:data.section||'',modified:data.modified||'',hash:data.hash||'',description:data.description||''}),sourceIndex:index};}

function analyze(manifest,previous,allRecords){
  const previousMap=new Map(previous.map(x=>[x.key,x]));
  const manifestKeys=new Set(manifest.map(x=>normalizePath(x.url)).filter(Boolean));
  let linked=0,extracted=0,attention=0,newPages=0,changed=0,unextracted=0,unmatched=0;
  const pages=manifest.map(page=>{
    const record=findRecord(page,allRecords);
    if(record)linked++;
    const wasExtracted=!!record&&isExtracted(record,page);
    if(wasExtracted)extracted++;
    const prev=previousMap.get(page.key);
    const isNew=!prev;
    const changedByManifest=!!prev&&prev.signature!==page.signature;
    const changedAfterExtraction=!!record&&page.modified&&record.metadata?.lastExtractedAt&&dateAfter(page.modified,record.metadata.lastExtractedAt);
    let status='current';
    if(!record){status='unmatched';unmatched++;}
    else if(!wasExtracted){status='unextracted';unextracted++;}
    else if(changedByManifest||changedAfterExtraction){status='changed';changed++;}
    else if(isNew&&previous.length){status='new';newPages++;}
    if(['new','changed','unextracted','unmatched'].includes(status))attention++;
    return{...page,status,recordId:record?.id||'',recordTitle:record?.title||'',lastExtractedAt:record?.metadata?.lastExtractedAt||record?.metadata?.locallyEditedAt||'',isExtracted:wasExtracted};
  });
  const orphans=allRecords.filter(r=>{const url=normalizePath(publicUrl(r));return url&&!manifestKeys.has(url);});
  return{pages,orphans,linked,extracted,attention,newPages,changed,unextracted,unmatched};
}
function findRecord(page,all){const path=normalizePath(page.url);const titleKey=entityKey(page.title);return all.find(r=>normalizePath(publicUrl(r))===path)||all.find(r=>r.id&&page.rawId&&r.id===page.rawId)||all.find(r=>entityKey(r.title||'')===titleKey);}
function isExtracted(record,page){if(record.metadata?.lastExtractedAt||record.metadata?.extractionState||record.metadata?.knowledgeExtraction)return true;return (record.sources||[]).some(source=>{const item=typeof source==='string'?{id:source}:source||{};return normalizePath(item.url||'')===normalizePath(page.url)||String(item.sourceType||'').toLowerCase().includes('website');});}
function publicUrl(record){return record.data?.pageUrl||record.url||record.path||record.canonical||record.href||'';}

function filterPages(pages){const q=state.search.trim().toLowerCase();return pages.filter(x=>(!state.status||x.status===state.status)&&(!state.section||x.section===state.section)&&(!q||`${x.title} ${x.url} ${x.recordId} ${x.section}`.toLowerCase().includes(q)));}
function renderPage(page){const queued=queue().some(x=>x.key===page.key);return `<article class="sync-row ${page.status}"><div><div class="badges"><span class="badge">${esc(label(page.status))}</span>${page.section?`<span class="badge">${esc(page.section)}</span>`:''}${page.recordId?'<span class="badge">Record linked</span>':''}</div><strong>${esc(page.title)}</strong><p>${esc(page.url||'No URL')}</p><div class="sync-meta">${page.recordId?`<span>${esc(page.recordId)}</span>`:'<span>No matching Project Record</span>'}${page.modified?`<span>Modified: ${esc(formatDate(page.modified))}</span>`:''}${page.lastExtractedAt?`<span>Extracted: ${esc(formatDate(page.lastExtractedAt))}</span>`:''}</div></div><div class="actions">${page.url?`<a href="${esc(absoluteUrl(page.url))}" target="_blank" rel="noopener">Open page</a>`:''}${page.status!=='current'?`<button type="button" data-queue-page="${esc(page.key)}" ${queued?'disabled':''}>${queued?'Queued':'Queue for extraction'}</button>`:''}</div></article>`;}

function queueAttention(analysis){const candidates=analysis.pages.filter(x=>x.status!=='current');const existing=queue();const keys=new Set(existing.map(x=>x.key));const additions=candidates.filter(x=>!keys.has(x.key)).map(queueItem);saveQueue([...existing,...additions]);render();}
function queueOne(page){if(!page)return;const existing=queue();if(existing.some(x=>x.key===page.key))return;saveQueue([...existing,queueItem(page)]);render();}
function queueItem(page){return{key:page.key,url:page.url,title:page.title,section:page.section,status:page.status,recordId:page.recordId||'',queuedAt:new Date().toISOString(),instruction:'Obtain the current HTML for this page and process it through Extract Knowledge or Build Corpus.'};}
function downloadQueue(){const items=queue();if(!items.length)return;downloadJson({format:'curatoros-site-extraction-queue',formatVersion:1,createdAt:new Date().toISOString(),count:items.length,items},`curatoros-site-extraction-queue-${stamp()}.json`);}
function exportReport(analysis){downloadJson({format:'curatoros-site-knowledge-sync',formatVersion:1,createdAt:new Date().toISOString(),siteIndex:readJson(META_KEY,null),summary:{indexed:analysis.pages.length,linked:analysis.linked,extracted:analysis.extracted,attention:analysis.attention,newPages:analysis.newPages,changed:analysis.changed,unextracted:analysis.unextracted,unmatched:analysis.unmatched,orphans:analysis.orphans.length},pages:analysis.pages,orphanRecords:analysis.orphans.map(r=>({id:r.id,title:r.title,url:publicUrl(r)})),extractionQueue:queue()},`curatoros-site-sync-${stamp()}.json`);}
function clearManifest(){if(!confirm('Clear the loaded site-index.json sync state? Project Records and extraction work will remain untouched.'))return;localStorage.removeItem(MANIFEST_KEY);localStorage.removeItem(PREVIOUS_KEY);localStorage.removeItem(META_KEY);state.search='';state.status='';state.section='';render();}

function signature(value){return stable(JSON.stringify(value));}
function stable(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function normalizePath(value){const raw=String(value||'').trim();if(!raw)return'';try{const url=new URL(raw,'https://oceanliners.net');let path=url.pathname.replace(/\/index\.html?$/i,'/').replace(/\.html?$/i,'').replace(/\/$/,'');return path||'/';}catch{return raw.split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/,'').replace(/\.html?$/i,'').replace(/\/$/,'')||'/';}}
function inferSection(url){const path=normalizePath(url);const first=path.split('/').filter(Boolean)[0]||'home';return first;}
function titleFromPath(value){const path=normalizePath(value);const last=path.split('/').filter(Boolean).pop()||'Home';return decodeURIComponent(last).replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase());}
function entityKey(v){return String(v||'').toLowerCase().replace(/&/g,'and').replace(/\b(ltd|limited|company|co)\b\.?/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function dateAfter(a,b){const da=new Date(a),db=new Date(b);return !Number.isNaN(da.getTime())&&!Number.isNaN(db.getTime())&&da.getTime()>db.getTime();}
function absoluteUrl(value){const raw=String(value||'');return /^https?:\/\//i.test(raw)?raw:`https://oceanliners.net/${raw.replace(/^\//,'')}`;}
function option(v,current,l){return `<option value="${esc(v)}"${v===current?' selected':''}>${esc(l)}</option>`;}
function metric(v,l){return `<div class="metric"><strong>${v}</strong><span>${esc(l)}</span></div>`;}
function label(v){return String(v||'').replace(/[-_]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g,m=>m.toUpperCase());}
function formatDate(v){if(!v)return'unknown';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString();}
function stamp(){return new Date().toISOString().slice(0,10);}
function downloadJson(value,name){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);}
function refocus(selector){setTimeout(()=>{const el=document.querySelector(selector);el?.focus();try{el?.setSelectionRange(el.value.length,el.value.length)}catch{}},0);}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
