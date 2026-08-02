const CATALOG_KEY='curatoros.rebuilt.catalog';
const app=document.querySelector('#app');
const button=document.querySelector('#knowledge-graph');
let focusId='';
let search='';
let relFilter='';

button?.addEventListener('click',()=>{activate();render();});
window.addEventListener('curatoros:records-changed',()=>{if(button?.classList.contains('active'))render();});

function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button?.classList.add('active');}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function records(){const value=readJson(CATALOG_KEY,[]);return Array.isArray(value)?value:[]}
function title(r){return r?.title||r?.name||r?.id||'Untitled record'}
function relName(rel){return rel?.relationship||rel?.type||'related_to'}
function relTarget(rel){return rel?.target||rel?.id||rel?.recordId||''}
function recordUrl(r){return r?.data?.pageUrl||r?.url||r?.path||r?.canonical||''}

function buildGraph(all){
  const byId=new Map(all.map(r=>[r.id,r]));
  const outgoing=new Map();
  const incoming=new Map();
  const unresolved=[];
  for(const r of all){
    const rels=Array.isArray(r.relationships)?r.relationships:[];
    outgoing.set(r.id,rels);
    for(const rel of rels){
      const target=relTarget(rel);if(!target)continue;
      if(!incoming.has(target))incoming.set(target,[]);
      incoming.get(target).push({source:r,rel});
      if(!byId.has(target))unresolved.push({source:r,rel,target});
    }
  }
  return{byId,outgoing,incoming,unresolved};
}

function render(){
  if(!app)return;
  const all=records();
  const graph=buildGraph(all);
  const relationshipTypes=[...new Set(all.flatMap(r=>(r.relationships||[]).map(relName)))].sort();
  if(!focusId||!graph.byId.has(focusId))focusId=defaultFocus(all,graph);
  const focus=graph.byId.get(focusId)||null;
  const outgoing=(graph.outgoing.get(focusId)||[]).filter(r=>!relFilter||relName(r)===relFilter);
  const incoming=(graph.incoming.get(focusId)||[]).filter(x=>!relFilter||relName(x.rel)===relFilter);
  const neighbors=unique([...outgoing.map(r=>graph.byId.get(relTarget(r))).filter(Boolean),...incoming.map(x=>x.source)]);
  const secondHop=collectSecondHop(neighbors,focusId,graph,relFilter);
  const results=searchRecords(all,search).slice(0,40);
  app.innerHTML=`
  <section class="panel graph-hero"><div><span class="eyebrow">Relationship / Knowledge Graph</span><h3>Navigate the connected corpus</h3><p>Start from any Project Record and follow outgoing, incoming, and second-hop relationships through the standardized knowledge base.</p></div><div class="graph-hero-stat"><strong>${all.reduce((n,r)=>n+(r.relationships?.length||0),0)}</strong><span>relationships</span></div></section>
  <section class="panel graph-controls"><label><span>Find a record</span><input id="graph-search" type="search" value="${esc(search)}" placeholder="Olympic, Harland & Wolff, White Star…"></label><label><span>Relationship type</span><select id="graph-rel-filter"><option value="">All relationships</option>${relationshipTypes.map(v=>`<option value="${esc(v)}"${v===relFilter?' selected':''}>${esc(label(v))}</option>`).join('')}</select></label><button id="graph-export" type="button" ${focus?'':'disabled'}>Export graph slice</button></section>
  ${search?`<section class="panel graph-search-results"><h4>Search results</h4><div>${results.length?results.map(r=>recordButton(r,graph)).join(''):'<p class="empty">No matching records.</p>'}</div></section>`:''}
  ${focus?renderFocus(focus,outgoing,incoming,neighbors,secondHop,graph):'<section class="panel"><p class="empty">Import Project Records to explore relationships.</p></section>'}
  <section class="panel graph-health"><div><span class="eyebrow">Graph health</span><h4>${graph.unresolved.length} unresolved relationship target${graph.unresolved.length===1?'':'s'}</h4></div>${graph.unresolved.length?`<details><summary>Review unresolved targets</summary><div class="graph-unresolved">${graph.unresolved.slice(0,100).map(x=>`<article><strong>${esc(title(x.source))}</strong><span>${esc(label(relName(x.rel)))}</span><code>${esc(x.target)}</code></article>`).join('')}</div></details>`:'<p>Every relationship target resolves to a current Project Record.</p>'}</section>`;
  bind(graph);
}

function renderFocus(focus,outgoing,incoming,neighbors,secondHop,graph){
  const url=recordUrl(focus);
  return `<section class="panel graph-focus"><div class="graph-focus-head"><div><span class="eyebrow">Focused record</span><div class="badges"><span class="badge">${esc(label(focus.type||'record'))}</span><span class="badge">${esc(label(focus.status||'unknown'))}</span></div><h3>${esc(title(focus))}</h3><p>${esc(focus.id||'')}</p>${focus.summary?`<p>${esc(focus.summary)}</p>`:''}</div><div class="actions">${url?`<a href="${esc(normalizeUrl(url))}" target="_blank" rel="noopener">Open public page</a>`:''}<button type="button" id="graph-copy-id">Copy ID</button></div></div></section>
  <section class="metrics graph-metrics">${metric(outgoing.length,'Outgoing')}${metric(incoming.length,'Incoming')}${metric(neighbors.length,'Direct neighbors')}${metric(secondHop.length,'Second-hop records')}</section>
  <section class="graph-columns">
    <section class="panel"><span class="eyebrow">Incoming</span><h4>Records pointing here</h4><div class="graph-edge-list">${incoming.length?incoming.map(x=>edgeCard(x.source,x.rel,'incoming',graph)).join(''):'<p class="empty">No incoming relationships.</p>'}</div></section>
    <section class="panel"><span class="eyebrow">Outgoing</span><h4>Relationships from this record</h4><div class="graph-edge-list">${outgoing.length?outgoing.map(rel=>edgeCard(graph.byId.get(relTarget(rel)),rel,'outgoing',graph,relTarget(rel))).join(''):'<p class="empty">No outgoing relationships.</p>'}</div></section>
  </section>
  <section class="panel"><div class="graph-section-head"><div><span class="eyebrow">Connected knowledge</span><h4>Second-hop neighborhood</h4></div><span>${secondHop.length} records</span></div><div class="graph-neighbor-grid">${secondHop.length?secondHop.map(r=>recordButton(r,graph)).join(''):'<p class="empty">No additional second-hop records through the current filter.</p>'}</div></section>`;
}

function edgeCard(record,rel,direction,graph,missingTarget=''){
  const name=relName(rel);const target=relTarget(rel);const labelText=record?title(record):missingTarget||target||'Unresolved target';
  return `<article class="graph-edge ${record?'':'unresolved'}"><div><span class="graph-direction">${direction==='incoming'?'←':'→'} ${esc(label(name))}</span><strong>${esc(labelText)}</strong><small>${esc(record?.id||target||'')}</small>${rel?.note?`<p>${esc(rel.note)}</p>`:''}</div>${record?`<button type="button" data-graph-focus="${esc(record.id)}">Follow</button>`:'<span class="badge">Unresolved</span>'}</article>`;
}

function recordButton(r,graph){const out=graph.outgoing.get(r.id)?.length||0;const inc=graph.incoming.get(r.id)?.length||0;return `<button type="button" class="graph-record-button" data-graph-focus="${esc(r.id)}"><span>${esc(title(r))}</span><small>${esc(label(r.type||'record'))} · ${out} out · ${inc} in</small></button>`}
function defaultFocus(all,graph){return [...all].sort((a,b)=>((graph.incoming.get(b.id)?.length||0)+(b.relationships?.length||0))-((graph.incoming.get(a.id)?.length||0)+(a.relationships?.length||0)))[0]?.id||''}
function searchRecords(all,q){const s=q.trim().toLowerCase();if(!s)return[];return all.filter(r=>`${title(r)} ${r.id||''} ${r.type||''} ${r.summary||''}`.toLowerCase().includes(s)).sort((a,b)=>title(a).localeCompare(title(b)))}
function unique(items){const seen=new Set();return items.filter(r=>r&&!seen.has(r.id)&&seen.add(r.id))}
function collectSecondHop(neighbors,focus,graph,filter){const out=[];for(const n of neighbors){for(const rel of graph.outgoing.get(n.id)||[]){if(filter&&relName(rel)!==filter)continue;const r=graph.byId.get(relTarget(rel));if(r&&r.id!==focus)out.push(r)}for(const x of graph.incoming.get(n.id)||[]){if(filter&&relName(x.rel)!==filter)continue;if(x.source.id!==focus)out.push(x.source)}}return unique(out).filter(r=>!neighbors.some(n=>n.id===r.id)).slice(0,120)}

function bind(graph){
  document.querySelector('#graph-search')?.addEventListener('input',e=>{search=e.target.value;render();focusSearch();});
  document.querySelector('#graph-rel-filter')?.addEventListener('change',e=>{relFilter=e.target.value;render();});
  document.querySelectorAll('[data-graph-focus]').forEach(b=>b.addEventListener('click',()=>{focusId=b.dataset.graphFocus;search='';render();}));
  document.querySelector('#graph-copy-id')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(focusId)}catch{prompt('Record ID',focusId)}});
  document.querySelector('#graph-export')?.addEventListener('click',()=>exportSlice(graph));
}
function focusSearch(){setTimeout(()=>{const el=document.querySelector('#graph-search');el?.focus();try{el?.setSelectionRange(el.value.length,el.value.length)}catch{}},0)}
function exportSlice(graph){const focus=graph.byId.get(focusId);if(!focus)return;const outgoing=graph.outgoing.get(focusId)||[];const incoming=graph.incoming.get(focusId)||[];const ids=new Set([focusId,...outgoing.map(relTarget),...incoming.map(x=>x.source.id)]);const payload={format:'curatoros-knowledge-graph-slice',formatVersion:1,createdAt:new Date().toISOString(),focusRecordId:focusId,records:[...ids].map(id=>graph.byId.get(id)).filter(Boolean),outgoing,incoming:incoming.map(x=>({sourceId:x.source.id,relationship:x.rel})),unresolved:graph.unresolved.filter(x=>x.source.id===focusId)};download(payload,`curatoros-graph-${slug(title(focus))}.json`)}
function normalizeUrl(v){const s=String(v||'');return /^https?:\/\//i.test(s)?s:`https://oceanliners.net/${s.replace(/^\//,'')}`}
function metric(v,l){return `<div class="metric"><strong>${v}</strong><span>${esc(l)}</span></div>`}
function label(v){return String(v||'').replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g,m=>m.toUpperCase())}
function slug(v){return String(v||'record').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'record'}
function download(payload,name){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
