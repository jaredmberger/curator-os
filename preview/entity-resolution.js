const CATALOG_KEY='curatoros.rebuilt.catalog';
const CHANGE_KEY='curatoros.project.pendingChanges';
const BASELINE_KEY='curatoros.project.editBaseline';
const RESOLUTION_KEY='curatoros.entity.resolutions';
const app=document.querySelector('#app');
const button=document.querySelector('#entity-resolution');

const ENTITY_TYPES=new Set(['company','organization','person']);
let selectedGroup='';

button?.addEventListener('click',()=>{activate();render();});
window.addEventListener('curatoros:records-changed',()=>{if(button?.classList.contains('active'))render();});

function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button?.classList.add('active');}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function records(){const v=readJson(CATALOG_KEY,[]);return Array.isArray(v)?v:[]}
function resolutions(){const v=readJson(RESOLUTION_KEY,[]);return Array.isArray(v)?v:[]}
function saveResolutions(v){localStorage.setItem(RESOLUTION_KEY,JSON.stringify(v))}

function render(){
  if(!app)return;
  const all=records();
  const entities=all.filter(r=>ENTITY_TYPES.has(r.type));
  const groups=findGroups(entities);
  const unresolved=findUnresolvedTargets(all);
  if(selectedGroup&&!groups.some(g=>g.key===selectedGroup))selectedGroup='';
  app.innerHTML=`
  <section class="panel entity-hero"><div><span class="eyebrow">Entity resolution</span><h3>Consolidate names into canonical entities</h3><p>Find duplicate or variant company, organization, and person records, choose a canonical record, and preview every relationship rewrite before applying a reversible local change.</p></div><div class="entity-hero-stat"><strong>${groups.length}</strong><span>candidate groups</span></div></section>
  <section class="metrics">${metric(entities.length,'Entity records')}${metric(groups.length,'Candidate groups')}${metric(unresolved.length,'Unresolved targets')}${metric(resolutions().length,'Saved resolutions')}</section>
  <section class="entity-layout">
    <section class="panel entity-groups"><div class="entity-section-head"><div><span class="eyebrow">Possible duplicates</span><h4>Resolution queue</h4></div><button id="export-resolutions" type="button">Export registry</button></div><div class="entity-group-list">${groups.length?groups.map(renderGroup).join(''):'<div class="empty">No likely duplicate entity groups were detected.</div>'}</div></section>
    <section class="panel entity-detail">${selectedGroup?renderDetail(groups.find(g=>g.key===selectedGroup),all):renderIntro(unresolved)}</section>
  </section>
  ${unresolved.length?`<section class="panel entity-unresolved"><div class="entity-section-head"><div><span class="eyebrow">Relationship health</span><h4>Unresolved relationship targets</h4></div></div><div class="entity-unresolved-list">${unresolved.slice(0,100).map(renderUnresolved).join('')}</div></section>`:''}`;
  bind(groups,all);
}

function renderIntro(unresolved){return `<div class="entity-empty-detail"><h4>Select a candidate group</h4><p>CuratorOS groups names using a conservative normalized key. Nothing is merged automatically.</p>${unresolved.length?`<p>${unresolved.length} relationship target${unresolved.length===1?' is':'s are'} also pointing to IDs that do not currently exist.</p>`:''}</div>`}
function renderGroup(g){const active=g.key===selectedGroup?' active':'';return `<button type="button" class="entity-group${active}" data-group="${esc(g.key)}"><strong>${esc(g.records[0]?.title||g.key)}</strong><span>${g.records.length} records · ${g.referenceCount} references</span><small>${g.records.map(r=>esc(r.title||r.id)).join(' · ')}</small></button>`}
function renderDetail(g,all){if(!g)return renderIntro([]);const refs=referencesTo(all,new Set(g.records.map(r=>r.id)));return `<div class="entity-detail-head"><span class="eyebrow">Candidate group</span><h4>${esc(g.records[0]?.title||g.key)}</h4><p>${g.records.length} records appear to describe the same entity. Choose the record CuratorOS should treat as canonical.</p></div><div class="entity-canonical-list">${g.records.map((r,i)=>`<label class="entity-canonical-option"><input type="radio" name="canonical-entity" value="${esc(r.id)}" ${i===0?'checked':''}><div><strong>${esc(r.title||r.id)}</strong><span>${esc(r.id)} · ${esc(r.status||'unknown')}</span><small>${(r.relationships?.length||0)} outgoing relationships · ${(r.sources?.length||0)} sources</small></div></label>`).join('')}</div><section class="entity-preview"><h5>References that would be rewritten</h5>${refs.length?`<div>${refs.slice(0,100).map(x=>`<p><strong>${esc(x.record.title||x.record.id)}</strong> — ${esc(x.relationship.relationship||x.relationship.type||'relationship')} → ${esc(x.relationship.target||'')}</p>`).join('')}</div>`:'<p>No other records currently reference these entity IDs.</p>'}</section><label class="entity-aliases"><span>Additional aliases — one per line</span><textarea id="entity-extra-aliases" rows="4" placeholder="H&W\nHarland and Wolff"></textarea></label><div class="entity-safety"><strong>Apply locally</strong><p>The canonical record will retain aliases. Duplicate records will be archived and marked as merged into the canonical ID. Relationships elsewhere will be rewritten. Every touched record becomes a normal pending change and can be reverted.</p></div><div class="actions"><button type="button" id="apply-entity-resolution">Apply resolution locally</button></div>`}
function renderUnresolved(x){return `<article><div><strong>${esc(x.record.title||x.record.id)}</strong><p>${esc(x.record.id)}</p></div><span>${esc(x.relationship.relationship||x.relationship.type||'relationship')} → ${esc(x.target)}</span></article>`}

function bind(groups,all){
  document.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>{selectedGroup=b.dataset.group;render()}));
  document.querySelector('#apply-entity-resolution')?.addEventListener('click',()=>applyResolution(groups.find(g=>g.key===selectedGroup),all));
  document.querySelector('#export-resolutions')?.addEventListener('click',exportRegistry);
}

function findGroups(entities){
  const buckets=new Map();
  for(const r of entities){const key=entityKey(r.title||r.id);if(!key)continue;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r)}
  const all=records();
  return [...buckets.entries()].filter(([,rs])=>rs.length>1).map(([key,rs])=>({key,records:rs,referenceCount:referencesTo(all,new Set(rs.map(r=>r.id))).length})).sort((a,b)=>b.referenceCount-a.referenceCount||a.key.localeCompare(b.key));
}
function referencesTo(all,ids){const out=[];for(const record of all)for(const relationship of record.relationships||[]){const target=relationship.target||relationship.id||relationship.recordId;if(ids.has(target))out.push({record,relationship})}return out}
function findUnresolvedTargets(all){const ids=new Set(all.map(r=>r.id));const out=[];for(const record of all)for(const relationship of record.relationships||[]){const target=relationship.target||relationship.id||relationship.recordId;if(target&&!ids.has(target))out.push({record,relationship,target})}return out}

function applyResolution(group,all){
  if(!group)return;
  const canonicalId=document.querySelector('input[name="canonical-entity"]:checked')?.value;
  const canonical=group.records.find(r=>r.id===canonicalId);
  if(!canonical)return alert('Choose a canonical entity.');
  const duplicateIds=new Set(group.records.filter(r=>r.id!==canonicalId).map(r=>r.id));
  const extra=(document.querySelector('#entity-extra-aliases')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);
  const aliases=[...new Set([...group.records.map(r=>r.title).filter(Boolean),...extra].filter(x=>entityKey(x)!==entityKey(canonical.title)))];
  const touched=new Map();
  const updated=clone(all);
  const byId=new Map(updated.map(r=>[r.id,r]));
  const canonicalAfter=byId.get(canonicalId);
  canonicalAfter.metadata={...(canonicalAfter.metadata||{}),canonicalEntity:true,aliases:[...new Set([...(canonicalAfter.metadata?.aliases||[]),...aliases])],entityResolvedAt:new Date().toISOString()};
  touched.set(canonicalId,{before:clone(all.find(r=>r.id===canonicalId)),after:canonicalAfter,kind:'entity-canonical'});
  for(const id of duplicateIds){const r=byId.get(id);const before=clone(all.find(x=>x.id===id));r.status='archived';r.metadata={...(r.metadata||{}),mergedInto:canonicalId,entityResolvedAt:new Date().toISOString()};r.relationships=Array.isArray(r.relationships)?r.relationships:[];if(!r.relationships.some(x=>x.relationship==='same_as'&&x.target===canonicalId))r.relationships.push({relationship:'same_as',target:canonicalId,confidence:'reviewed',note:'Entity consolidation'});touched.set(id,{before,after:r,kind:'entity-alias'})}
  for(const r of updated){let changed=false;const before=clone(all.find(x=>x.id===r.id));r.relationships=(r.relationships||[]).map(rel=>{const target=rel.target||rel.id||rel.recordId;if(!duplicateIds.has(target))return rel;changed=true;return {...rel,target:canonicalId,id:rel.id&&rel.target===undefined?canonicalId:rel.id,recordId:rel.recordId&&rel.target===undefined?canonicalId:rel.recordId}});if(changed)touched.set(r.id,{before,after:r,kind:'relationship-rewrite'})}
  if(!localStorage.getItem(BASELINE_KEY))localStorage.setItem(BASELINE_KEY,JSON.stringify(all));
  localStorage.setItem(CATALOG_KEY,JSON.stringify(updated));
  const existing=readJson(CHANGE_KEY,[]).filter(ch=>!touched.has(ch.recordId));
  const now=new Date().toISOString();
  for(const [recordId,item] of touched)existing.push({id:`change:${recordId}`,recordId,title:item.after.title||recordId,changedAt:now,origin:item.after.origin||null,before:item.before,after:item.after,fields:changedFields(item.before,item.after),changeKind:item.kind});
  localStorage.setItem(CHANGE_KEY,JSON.stringify(existing));
  const registry=resolutions();registry.push({id:`resolution-${Date.now()}`,resolvedAt:now,canonicalId,canonicalTitle:canonicalAfter.title,aliases,mergedIds:[...duplicateIds],rewrittenRecordCount:[...touched.values()].filter(x=>x.kind==='relationship-rewrite').length});saveResolutions(registry);
  selectedGroup='';window.dispatchEvent(new CustomEvent('curatoros:records-changed'));render();alert(`Resolved ${group.records.length} entity records into ${canonicalAfter.title}. ${touched.size} record${touched.size===1?'':'s'} now have reviewable local changes.`);
}

function exportRegistry(){download({format:'curatoros-entity-resolution-registry',formatVersion:1,createdAt:new Date().toISOString(),resolutions:resolutions()},`curatoros-entity-resolutions-${new Date().toISOString().slice(0,10)}.json`)}
function changedFields(a,b){const keys=['title','type','status','summary','tags','data','sources','relationships','notes','metadata'];return keys.filter(k=>JSON.stringify(a?.[k]??null)!==JSON.stringify(b?.[k]??null))}
function entityKey(v){return String(v||'').toLowerCase().replace(/&/g,'and').replace(/\b(the|incorporated|inc|limited|ltd|company|co|corporation|corp)\b\.?/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function metric(v,l){return `<div class="metric"><strong>${v}</strong><span>${esc(l)}</span></div>`}
function clone(v){return JSON.parse(JSON.stringify(v))}
function download(payload,name){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
