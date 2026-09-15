const REL_BUTTON=document.querySelector('#knowledge-intelligence');
const REL_APP=document.querySelector('#app');
const REL_CATALOG_KEY='curatoros.rebuilt.catalog';
const REL_COLLECTIONS_KEY='curatoros.knowledge.collections';
const REL_BUILDER_URL='https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-builders.json';
const REL_OPERATOR_URL='https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-operators.json';

function relEsc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function relNorm(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function relRecords(){try{const value=JSON.parse(localStorage.getItem(REL_CATALOG_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function relTitle(record){return record?.title||record?.name||record?.data?.name||record?.id||'Untitled record'}
function relIsShip(record){return record?.type==='ship'||String(record?.id||'').startsWith('ship:')}
function relCollections(){try{const value=JSON.parse(localStorage.getItem(REL_COLLECTIONS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}

function entityExists(entity,records){
  const variants=[entity?.name,...(entity?.names||[]),...(entity?.rawValues||[])].filter(Boolean).map(relNorm);
  return records.some(record=>!relIsShip(record)&&variants.includes(relNorm(relTitle(record))));
}

function matchLocalShip(siteShip,ships){
  const exact=ships.filter(record=>relNorm(relTitle(record))===relNorm(siteShip.name));
  if(exact.length===1)return exact[0];
  const strip=value=>relNorm(value).replace(/^(rms|ss|s s|mv|ms|hmhs|hmt|hms|ts|rmmv|qsmv)\s+/,'').replace(/\bship guide\b/g,'').trim();
  const loose=ships.filter(record=>strip(relTitle(record))===strip(siteShip.name));
  if(loose.length===1)return loose[0];
  return null;
}

function deriveOpportunities(builders,operators){
  const local=relRecords();
  const localShips=local.filter(relIsShip);
  const operatorByPath=new Map((operators?.ships||[]).map(ship=>[ship.path,ship]));
  const pairings=new Map();

  for(const ship of builders?.ships||[]){
    const operator=operatorByPath.get(ship.path);
    if(!operator?.operator)continue;
    for(const builder of ship.builders||[]){
      if(!builder?.name)continue;
      const key=`${builder.id||relNorm(builder.name)}|${relNorm(operator.operator)}`;
      if(!pairings.has(key))pairings.set(key,{id:key,builder:builder.name,operator:operator.operator,ships:[]});
      pairings.get(key).ships.push({name:ship.name,path:ship.path,launchYear:ship.launchYear});
    }
  }

  const repeated=[...pairings.values()]
    .filter(group=>group.ships.length>=3)
    .map(group=>{
      const localMatches=group.ships.map(ship=>matchLocalShip(ship,localShips)).filter(Boolean);
      const years=group.ships.map(ship=>Number(ship.launchYear)).filter(Number.isFinite).sort((a,b)=>a-b);
      return {...group,localMatches,firstYear:years[0]||null,lastYear:years.at(-1)||null,score:group.ships.length};
    })
    .sort((a,b)=>b.score-a.score||a.builder.localeCompare(b.builder));

  const builderGaps=(builders?.builders||[])
    .filter(entity=>Number(entity.shipCount||0)>=5&&!entityExists(entity,local))
    .sort((a,b)=>Number(b.shipCount||0)-Number(a.shipCount||0));
  const operatorGaps=(operators?.operators||[])
    .filter(entity=>Number(entity.shipCount||0)>=5&&!entityExists(entity,local))
    .sort((a,b)=>Number(b.shipCount||0)-Number(a.shipCount||0));

  const crossLineBuilders=[];
  const builderOperators=new Map();
  for(const group of pairings.values()){
    if(!builderOperators.has(group.builder))builderOperators.set(group.builder,new Set());
    builderOperators.get(group.builder).add(group.operator);
  }
  for(const [builder,set] of builderOperators){if(set.size>=3)crossLineBuilders.push({builder,operatorCount:set.size,operators:[...set].sort()});}
  crossLineBuilders.sort((a,b)=>b.operatorCount-a.operatorCount||a.builder.localeCompare(b.builder));

  return {repeated,builderGaps,operatorGaps,crossLineBuilders};
}

function savePairing(group){
  const list=relCollections();
  const key=`relationship-opportunity:${group.id}`;
  const existing=list.find(item=>item?.derivedFrom?.id===key);
  const recordIds=group.localMatches.map(record=>record.id).filter(Boolean);
  const payload={
    id:existing?.id||`collection-${Date.now()}`,
    name:`${group.operator} × ${group.builder}`,
    createdAt:existing?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    query:{},recordIds,recordCount:recordIds.length,
    derivedFrom:{kind:'relationship-opportunity',id:key,ideaType:'builder-operator-cluster',reason:`${group.ships.length} ship guides connect ${group.operator} with ${group.builder}.`,suggestedTemplate:'builder-line collection'}
  };
  localStorage.setItem(REL_COLLECTIONS_KEY,JSON.stringify(existing?list.map(item=>item.id===existing.id?payload:item):[...list,payload]));
  alert(`Saved “${payload.name}” as a knowledge collection.`);
}

function pairingCard(group,index){
  const span=group.firstYear&&group.lastYear?(group.firstYear===group.lastYear?String(group.firstYear):`${group.firstYear}–${group.lastYear}`):'Dates vary';
  const names=group.ships.slice(0,7).map(ship=>ship.name);
  return `<article class="intelligence-card"><div class="badges"><span class="badge">Builder × operator</span><span class="badge">${group.ships.length} ships</span></div><h4>${relEsc(group.operator)} × ${relEsc(group.builder)}</h4><p>${group.ships.length} documented ships connect this operator and builder${group.firstYear?` across ${relEsc(span)}`:''}. This may support a focused collection, contextual essay, or cross-linking pass.</p><div class="intelligence-members">${names.map(name=>`<span>${relEsc(name)}</span>`).join('')}${group.ships.length>names.length?`<span>+${group.ships.length-names.length} more</span>`:''}</div><div class="actions"><button type="button" data-save-rel-pair="${index}"${group.localMatches.length?'':' disabled'}>Save as knowledge collection</button></div></article>`;
}

async function installRelationshipOpportunities(){
  if(!REL_APP||document.querySelector('#relationship-opportunities'))return;
  const anchor=document.querySelector('#site-operator-intelligence')||document.querySelector('#site-builder-intelligence')||document.querySelector('.intelligence-metrics');
  if(!anchor)return;
  const panel=document.createElement('section');
  panel.className='panel intelligence-opportunities';
  panel.id='relationship-opportunities';
  panel.innerHTML='<span class="eyebrow">Relationship intelligence</span><h4>Content opportunities</h4><p>Joining builder and operator knowledge…</p>';
  anchor.insertAdjacentElement('afterend',panel);
  try{
    const [builderResponse,operatorResponse]=await Promise.all([
      fetch(REL_BUILDER_URL,{cache:'no-store',credentials:'omit'}),
      fetch(REL_OPERATOR_URL,{cache:'no-store',credentials:'omit'})
    ]);
    if(!builderResponse.ok||!operatorResponse.ok)throw new Error('One or more intelligence feeds are unavailable.');
    const [builders,operators]=await Promise.all([builderResponse.json(),operatorResponse.json()]);
    const analysis=deriveOpportunities(builders,operators);
    panel.innerHTML=`
      <div class="intelligence-section-head"><div><span class="eyebrow">Relationship intelligence</span><h4>Content opportunities</h4></div><span>Derived from site entities</span></div>
      <p>These suggestions come from relationships already documented across OceanLiners.net. They are editorial leads, not automatic publication decisions.</p>
      <section class="metrics intelligence-metrics">
        <article><strong>${analysis.repeated.length}</strong><span>Repeated builder–operator clusters</span></article>
        <article><strong>${analysis.builderGaps.length}</strong><span>High-coverage builders without local entity records</span></article>
        <article><strong>${analysis.operatorGaps.length}</strong><span>High-coverage operators without local entity records</span></article>
        <article><strong>${analysis.crossLineBuilders.length}</strong><span>Builders spanning 3+ operators</span></article>
      </section>
      <h4 style="margin-top:1.2rem">Strong builder–operator clusters</h4>
      <div class="intelligence-grid">${analysis.repeated.length?analysis.repeated.slice(0,18).map(pairingCard).join(''):'<p class="empty">No relationship clusters currently meet the three-ship threshold.</p>'}</div>
      <section class="intelligence-columns" style="margin-top:1rem">
        <section><span class="eyebrow">Entity opportunities</span><h4>Builders with substantial coverage</h4><div class="intelligence-list">${analysis.builderGaps.slice(0,20).map(entity=>`<article><div><strong>${relEsc(entity.name)}</strong><small>Canonical builder represented across the site</small></div><span>${Number(entity.shipCount||0)} ships</span></article>`).join('')||'<p class="empty">High-coverage builders already have corresponding local entities.</p>'}</div></section>
        <section><span class="eyebrow">Entity opportunities</span><h4>Operators with substantial coverage</h4><div class="intelligence-list">${analysis.operatorGaps.slice(0,20).map(entity=>`<article><div><strong>${relEsc(entity.name)}</strong><small>Canonical operator represented across the site</small></div><span>${Number(entity.shipCount||0)} ships</span></article>`).join('')||'<p class="empty">High-coverage operators already have corresponding local entities.</p>'}</div></section>
      </section>
      <details style="margin-top:1rem"><summary>Builders spanning three or more operators (${analysis.crossLineBuilders.length})</summary><div class="intelligence-list">${analysis.crossLineBuilders.slice(0,30).map(item=>`<article><div><strong>${relEsc(item.builder)}</strong><small>${relEsc(item.operators.slice(0,5).join(' · '))}${item.operators.length>5?` · +${item.operators.length-5} more`:''}</small></div><span>${item.operatorCount} operators</span></article>`).join('')}</div></details>`;
    document.querySelectorAll('[data-save-rel-pair]').forEach(button=>button.addEventListener('click',()=>savePairing(analysis.repeated[Number(button.dataset.saveRelPair)])));
  }catch(error){
    panel.innerHTML='<span class="eyebrow">Relationship intelligence</span><h4>Content opportunities</h4><p class="empty">Relationship opportunities are temporarily unavailable. Existing Corpus Intelligence remains fully functional.</p>';
  }
}

REL_BUTTON?.addEventListener('click',()=>setTimeout(installRelationshipOpportunities,80));
window.addEventListener('curatoros:records-changed',()=>{if(REL_BUTTON?.classList.contains('active')){document.querySelector('#relationship-opportunities')?.remove();setTimeout(installRelationshipOpportunities,80)}});
