const CATALOG_KEY='curatoros.rebuilt.catalog';
const COLLECTIONS_KEY='curatoros.knowledge.collections';
const app=document.querySelector('#app');
const button=document.querySelector('#knowledge-intelligence');
let filter='all';
let minSize=2;

button?.addEventListener('click',()=>{activate();render();});
window.addEventListener('curatoros:records-changed',()=>{if(button?.classList.contains('active'))render();});

function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button?.classList.add('active');}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function records(){const value=readJson(CATALOG_KEY,[]);return Array.isArray(value)?value:[]}
function collections(){const value=readJson(COLLECTIONS_KEY,[]);return Array.isArray(value)?value:[]}
function saveCollections(value){localStorage.setItem(COLLECTIONS_KEY,JSON.stringify(value));}
function relName(rel){return rel?.relationship||rel?.type||'related_to'}
function relTarget(rel){return rel?.target||rel?.id||rel?.recordId||''}
function title(r){return r?.title||r?.name||r?.id||'Untitled record'}

function analyze(all){
  const byId=new Map(all.map(r=>[r.id,r]));
  const inbound=new Map();
  const unresolved=[];
  const relationshipGaps=[];
  const structuredGroups=[];

  for(const record of all){
    const rels=Array.isArray(record.relationships)?record.relationships:[];
    for(const rel of rels){
      const target=relTarget(rel);if(!target)continue;
      const key=`${relName(rel)}|${target}`;
      if(!inbound.has(key))inbound.set(key,{relationship:relName(rel),target,records:[]});
      inbound.get(key).records.push(record);
      if(!byId.has(target))unresolved.push({record,relationship:relName(rel),target});
    }
    const data=record.data||{};
    if(data.builder&&!rels.some(r=>relName(r)==='built_by'))relationshipGaps.push({record,kind:'builder',value:data.builder,expected:'built_by'});
    if(data.operator&&!rels.some(r=>relName(r)==='operated_by'))relationshipGaps.push({record,kind:'operator',value:data.operator,expected:'operated_by'});
  }

  const clusters=[...inbound.values()]
    .filter(group=>group.records.length>=minSize)
    .map(group=>({
      id:`rel:${group.relationship}:${group.target}`,
      kind:'relationship-cluster',
      relationship:group.relationship,
      targetId:group.target,
      target:byId.get(group.target)||null,
      records:unique(group.records),
      score:group.records.length
    }));

  for(const field of ['class','routeFocus','country']){
    const groups=new Map();
    for(const record of all){
      const value=record.data?.[field];if(value==null||String(value).trim()==='')continue;
      const key=normalize(value);if(!key)continue;
      if(!groups.has(key))groups.set(key,{field,value:String(value).trim(),records:[]});
      groups.get(key).records.push(record);
    }
    for(const group of groups.values())if(group.records.length>=minSize)structuredGroups.push({id:`field:${field}:${normalize(group.value)}`,kind:'structured-cluster',field, value:group.value,records:unique(group.records),score:group.records.length});
  }

  const hubs=all.map(record=>{
    const incomingCount=[...inbound.values()].filter(g=>g.target===record.id).reduce((n,g)=>n+g.records.length,0);
    const outgoingCount=record.relationships?.length||0;
    return{record,incomingCount,outgoingCount,total:incomingCount+outgoingCount};
  }).filter(x=>x.total>=minSize).sort((a,b)=>b.total-a.total);

  const ideas=[...clusters,...structuredGroups].map(toIdea).filter(Boolean).sort((a,b)=>b.score-a.score);
  return{byId,clusters,structuredGroups,hubs,unresolved,relationshipGaps,ideas};
}

function toIdea(cluster){
  const count=cluster.records.length;
  if(cluster.kind==='relationship-cluster'){
    const targetTitle=cluster.target?title(cluster.target):cluster.targetId;
    if(cluster.relationship==='built_by')return{...cluster,ideaType:'builder-fleet',title:`Ships built by ${targetTitle}`,reason:`${count} records share the same built-by relationship.`,suggestedTemplate:'builder collection'};
    if(cluster.relationship==='operated_by')return{...cluster,ideaType:'operator-fleet',title:`Ships operated by ${targetTitle}`,reason:`${count} records share the same operator relationship.`,suggestedTemplate:'fleet directory'};
    return{...cluster,ideaType:'relationship-collection',title:`${label(cluster.relationship)}: ${targetTitle}`,reason:`${count} records share this relationship target.`,suggestedTemplate:'research table'};
  }
  if(cluster.field==='class')return{...cluster,ideaType:'class-group',title:`${cluster.value} class`,reason:`${count} records share the same standardized class value.`,suggestedTemplate:'comparison'};
  if(cluster.field==='routeFocus')return{...cluster,ideaType:'route-group',title:`Ships associated with ${cluster.value}`,reason:`${count} records share the same standardized route focus.`,suggestedTemplate:'hub page'};
  if(cluster.field==='country')return{...cluster,ideaType:'country-group',title:`Ocean liners associated with ${cluster.value}`,reason:`${count} records share this standardized country value.`,suggestedTemplate:'research table'};
  return null;
}

function render(){
  if(!app)return;
  const all=records();
  const analysis=analyze(all);
  const visibleIdeas=analysis.ideas.filter(idea=>filter==='all'||idea.ideaType===filter);
  const ideaTypes=[...new Set(analysis.ideas.map(x=>x.ideaType))].sort();
  app.innerHTML=`
  <section class="panel intelligence-hero"><div><span class="eyebrow">Knowledge intelligence</span><h3>Let the corpus suggest useful connections</h3><p>CuratorOS analyzes canonical relationships and standardized fields to surface reusable clusters, publication opportunities, and knowledge gaps. Nothing is changed automatically.</p></div><div class="intelligence-hero-stat"><strong>${analysis.ideas.length}</strong><span>derived opportunities</span></div></section>

  <section class="metrics intelligence-metrics">${metric(analysis.clusters.length,'Relationship clusters')}${metric(analysis.structuredGroups.length,'Structured clusters')}${metric(analysis.relationshipGaps.length,'Relationship gaps')}${metric(analysis.unresolved.length,'Unresolved targets')}</section>

  <section class="panel intelligence-controls"><label><span>Opportunity type</span><select id="intelligence-filter"><option value="all">All opportunities</option>${ideaTypes.map(v=>`<option value="${esc(v)}"${filter===v?' selected':''}>${esc(label(v))}</option>`).join('')}</select></label><label><span>Minimum cluster size</span><select id="intelligence-min">${[2,3,4,5,10].map(v=>`<option value="${v}"${minSize===v?' selected':''}>${v}+ records</option>`).join('')}</select></label><button id="intelligence-export" type="button">Export intelligence report</button></section>

  <section class="panel intelligence-opportunities"><div class="intelligence-section-head"><div><span class="eyebrow">Derived knowledge</span><h4>Collection & publication opportunities</h4></div><span>${visibleIdeas.length} shown</span></div><div class="intelligence-grid">${visibleIdeas.length?visibleIdeas.map(renderIdea).join(''):'<p class="empty">No opportunities meet the current threshold.</p>'}</div></section>

  <section class="intelligence-columns">
    <section class="panel"><span class="eyebrow">Graph hubs</span><h4>Highly connected records</h4><div class="intelligence-list">${analysis.hubs.slice(0,30).map(h=>`<article><div><strong>${esc(title(h.record))}</strong><small>${esc(h.record.id||'')} · ${esc(label(h.record.type||'record'))}</small></div><span>${h.total} links</span></article>`).join('')||'<p class="empty">No connected hubs yet.</p>'}</div></section>
    <section class="panel"><span class="eyebrow">Knowledge gaps</span><h4>Structured facts missing relationships</h4><div class="intelligence-list">${analysis.relationshipGaps.slice(0,60).map(g=>`<article><div><strong>${esc(title(g.record))}</strong><small>${esc(label(g.kind))}: ${esc(g.value)}</small></div><span class="badge">Needs ${esc(label(g.expected))}</span></article>`).join('')||'<p class="empty">No obvious builder/operator relationship gaps.</p>'}</div></section>
  </section>

  <section class="panel"><span class="eyebrow">Graph integrity</span><h4>${analysis.unresolved.length} unresolved target${analysis.unresolved.length===1?'':'s'}</h4>${analysis.unresolved.length?`<div class="intelligence-list">${analysis.unresolved.slice(0,80).map(x=>`<article><div><strong>${esc(title(x.record))}</strong><small>${esc(label(x.relationship))}</small></div><code>${esc(x.target)}</code></article>`).join('')}</div>`:'<p>Every relationship target currently resolves to a Project Record.</p>'}</section>`;
  bind(analysis);
}

function renderIdea(idea){
  const names=idea.records.slice(0,6).map(title);
  return `<article class="intelligence-card"><div class="badges"><span class="badge">${esc(label(idea.ideaType))}</span><span class="badge">${idea.records.length} records</span></div><h4>${esc(idea.title)}</h4><p>${esc(idea.reason)}</p><small>Suggested page pattern: ${esc(label(idea.suggestedTemplate))}</small><div class="intelligence-members">${names.map(n=>`<span>${esc(n)}</span>`).join('')}${idea.records.length>names.length?`<span>+${idea.records.length-names.length} more</span>`:''}</div><div class="actions"><button type="button" data-save-derived="${esc(idea.id)}">Save as knowledge collection</button><button type="button" data-export-derived="${esc(idea.id)}">Export cluster</button></div></article>`;
}

function bind(analysis){
  document.querySelector('#intelligence-filter')?.addEventListener('change',e=>{filter=e.target.value;render();});
  document.querySelector('#intelligence-min')?.addEventListener('change',e=>{minSize=Number(e.target.value)||2;render();});
  document.querySelector('#intelligence-export')?.addEventListener('click',()=>downloadReport(analysis));
  document.querySelectorAll('[data-save-derived]').forEach(b=>b.addEventListener('click',()=>saveDerived(analysis.ideas.find(x=>x.id===b.dataset.saveDerived))));
  document.querySelectorAll('[data-export-derived]').forEach(b=>b.addEventListener('click',()=>exportDerived(analysis.ideas.find(x=>x.id===b.dataset.exportDerived))));
}

function saveDerived(idea){
  if(!idea)return;
  const list=collections();
  const existing=list.find(x=>x.derivedFrom?.id===idea.id);
  const payload={id:existing?.id||`collection-${Date.now()}`,name:idea.title,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),query:{},recordIds:idea.records.map(r=>r.id),recordCount:idea.records.length,derivedFrom:{kind:'knowledge-intelligence',id:idea.id,ideaType:idea.ideaType,reason:idea.reason,suggestedTemplate:idea.suggestedTemplate}};
  const next=existing?list.map(x=>x.id===existing.id?payload:x):[...list,payload];
  saveCollections(next);
  alert(`Saved “${idea.title}” as a reusable Knowledge Explorer collection.`);
}
function exportDerived(idea){if(!idea)return;download({format:'curatoros-derived-knowledge-cluster',formatVersion:1,createdAt:new Date().toISOString(),idea:{id:idea.id,ideaType:idea.ideaType,title:idea.title,reason:idea.reason,suggestedTemplate:idea.suggestedTemplate},recordCount:idea.records.length,records:idea.records},`${slug(idea.title)}-${dateStamp()}.json`)}
function downloadReport(a){download({format:'curatoros-knowledge-intelligence',formatVersion:1,createdAt:new Date().toISOString(),summary:{relationshipClusters:a.clusters.length,structuredClusters:a.structuredGroups.length,relationshipGaps:a.relationshipGaps.length,unresolvedTargets:a.unresolved.length},opportunities:a.ideas.map(i=>({id:i.id,ideaType:i.ideaType,title:i.title,reason:i.reason,suggestedTemplate:i.suggestedTemplate,recordIds:i.records.map(r=>r.id)})),relationshipGaps:a.relationshipGaps.map(g=>({recordId:g.record.id,field:g.kind,value:g.value,expectedRelationship:g.expected})),unresolved:a.unresolved.map(x=>({recordId:x.record.id,relationship:x.relationship,target:x.target}))},`curatoros-knowledge-intelligence-${dateStamp()}.json`)}
function unique(items){const seen=new Set();return items.filter(r=>r&&!seen.has(r.id)&&seen.add(r.id))}
function normalize(v){return String(v??'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim()}
function metric(v,l){return `<div class="metric"><strong>${v}</strong><span>${esc(l)}</span></div>`}
function label(v){return String(v||'').replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g,m=>m.toUpperCase())}
function slug(v){return String(v||'cluster').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'cluster'}
function dateStamp(){return new Date().toISOString().slice(0,10)}
function download(payload,name){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]))}
