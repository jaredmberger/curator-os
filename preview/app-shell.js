const recordsButton=document.querySelector('[data-view="records"]');
const app=document.querySelector('#app');
const knowledgeIntelligenceButton=document.querySelector('#knowledge-intelligence');
const BUILDER_INTELLIGENCE_URL='https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-builders.json';
const CATALOG_KEY='curatoros.rebuilt.catalog';

recordsButton?.addEventListener('click',()=>{
  document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));
  recordsButton.classList.add('active');
  if(app)app.innerHTML='<section class="panel"><span class="eyebrow">Permanent knowledge corpus</span><h3>Loading Project Records…</h3></section>';
});

window.addEventListener('curatoros:research-state-loaded',()=>document.documentElement.dataset.researchState='permanent');
window.addEventListener('curatoros:research-store-status',event=>{
  document.documentElement.dataset.researchState=event.detail?.permanent?'permanent':'cache';
});

function installOpsHealthStrip(){
  const topbar=document.querySelector('.topbar');
  if(!topbar||document.querySelector('.ops-health-strip'))return;

  const strip=document.createElement('section');
  strip.className='ops-health-strip';
  strip.setAttribute('aria-label','CuratorOS operational health');
  strip.innerHTML=`
    <a class="ops-health-card" href="https://ops.oceanlinercurator.com/journey" target="_blank" rel="noopener" data-ops-health="journey">
      <span class="ops-health-label">Visitor Journey</span>
      <span class="ops-health-state"><span class="ops-health-dot unknown" aria-hidden="true"></span><span data-ops-state>Checking…</span></span>
    </a>
    <a class="ops-health-card" href="https://ops.oceanlinercurator.com/browser-search-journey" target="_blank" rel="noopener" data-ops-health="browser-search">
      <span class="ops-health-label">Browser Search</span>
      <span class="ops-health-state"><span class="ops-health-dot unknown" aria-hidden="true"></span><span data-ops-state>Checking…</span></span>
    </a>
    <a class="ops-health-card" href="https://ops.oceanlinercurator.com/self-test" target="_blank" rel="noopener" data-ops-health="self-test">
      <span class="ops-health-label">Monitoring Self-Test</span>
      <span class="ops-health-state"><span class="ops-health-dot unknown" aria-hidden="true"></span><span data-ops-state>Checking…</span></span>
    </a>
    <a class="ops-health-more" href="https://ops.oceanlinercurator.com/" target="_blank" rel="noopener">Curator Ops →</a>
  `;
  topbar.insertAdjacentElement('afterend',strip);

  const checks=[
    ['journey','https://ops.oceanlinercurator.com/api/public-site-journey'],
    ['browser-search','https://ops.oceanlinercurator.com/api/browser-search-journey'],
    ['self-test','https://ops.oceanlinercurator.com/api/self-test']
  ];

  checks.forEach(([id,url])=>loadOpsHealth(id,url));
}

async function loadOpsHealth(id,url){
  const card=document.querySelector(`[data-ops-health="${id}"]`);
  if(!card)return;
  const stateEl=card.querySelector('[data-ops-state]');
  const dot=card.querySelector('.ops-health-dot');
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=setTimeout(()=>controller?.abort(),5000);
  try{
    const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:controller?.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();
    const snapshot=payload?.snapshot||{};
    const state=String(snapshot.effectiveState||snapshot.summary?.status||'unknown').toLowerCase();
    const allowed=['healthy','warming','observing','degraded','persistent','attention','unknown'];
    const safeState=allowed.includes(state)?state:'unknown';
    dot.className=`ops-health-dot ${safeState}`;
    stateEl.textContent=safeState.charAt(0).toUpperCase()+safeState.slice(1);
    card.dataset.state=safeState;
    const checked=snapshot.generatedAt?new Date(snapshot.generatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'not yet run';
    card.title=`Last Ops check: ${checked}`;
  }catch(error){
    dot.className='ops-health-dot unknown';
    stateEl.textContent='Unavailable';
    card.dataset.state='unknown';
    card.title='Curator Ops status could not be loaded.';
  }finally{
    clearTimeout(timer);
  }
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function readLocalRecords(){
  try{const value=JSON.parse(localStorage.getItem(CATALOG_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}
}

function valueList(value){
  if(Array.isArray(value))return value.flatMap(valueList).filter(Boolean);
  if(value&&typeof value==='object')return valueList(value.name||value.value||value.label||'');
  const text=String(value??'').trim();
  return text?[text]:[];
}

function normalizeText(value){
  return String(value??'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[’‘]/g,"'").replace(/&/g,' and ')
    .replace(/\bcompany\b/g,'co').replace(/\blimited\b/g,'ltd')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

function normalizeShip(value){
  return normalizeText(value)
    .replace(/^(rms|ss|s s|mv|ms|hmhs|hmt|hms|ts|rmmv|qsmv)\s+/,'')
    .replace(/\bship guide\b/g,'').trim();
}

function yearFrom(value){
  const match=String(value??'').match(/\b(?:18|19|20)\d{2}\b/);
  return match?match[0]:null;
}

function recordTitle(record){return record?.title||record?.name||record?.data?.name||record?.id||'Untitled record'}
function recordLaunchYear(record){return yearFrom(record?.data?.launchDate||record?.data?.launched||record?.data?.built||'')}
function relationshipType(rel){return rel?.relationship||rel?.type||''}
function relationshipTarget(rel){return rel?.target||rel?.id||rel?.recordId||''}

function matchSiteShip(siteShip,localShips){
  const exact=localShips.filter(record=>normalizeText(recordTitle(record))===normalizeText(siteShip.name));
  if(exact.length===1)return exact[0];
  const loose=localShips.filter(record=>normalizeShip(recordTitle(record))===normalizeShip(siteShip.name));
  if(loose.length===1)return loose[0];
  if(siteShip.launchYear){
    const byYear=loose.filter(record=>recordLaunchYear(record)===String(siteShip.launchYear));
    if(byYear.length===1)return byYear[0];
  }
  return null;
}

function builderAliasMap(payload){
  const map=new Map();
  for(const builder of Array.isArray(payload?.builders)?payload.builders:[]){
    const canonical=String(builder?.name||'').trim();
    if(!canonical)continue;
    const variants=[canonical,...(builder.names||[]),...(builder.rawValues||[])];
    variants.forEach(value=>{const key=normalizeText(value);if(key)map.set(key,canonical)});
  }
  return map;
}

function canonicalBuilder(value,aliases){
  const text=String(value??'').trim();
  if(!text)return'';
  const direct=aliases.get(normalizeText(text));
  if(direct)return direct;
  const withoutLocation=text.replace(/\s*\([^)]*\)\s*$/,'').replace(/,\s*[^,]{2,40}$/,'').trim();
  return aliases.get(normalizeText(withoutLocation))||text;
}

function reconcileBuilders(payload){
  const all=readLocalRecords();
  const localShips=all.filter(record=>record?.type==='ship'||String(record?.id||'').startsWith('ship:'));
  const byId=new Map(all.map(record=>[record?.id,record]));
  const aliases=builderAliasMap(payload);
  const siteShips=Array.isArray(payload?.ships)?payload.ships:[];
  const result={matched:0,unmatched:[],fieldMissing:[],fieldMismatch:[],relationshipMissing:[],relationshipMismatch:[],agreement:0};

  for(const siteShip of siteShips){
    const local=matchSiteShip(siteShip,localShips);
    if(!local){result.unmatched.push(siteShip);continue}
    result.matched++;
    const expected=[...new Set((siteShip.builders||[]).map(x=>x?.name).filter(Boolean))];
    if(!expected.length)continue;

    const localValues=valueList(local?.data?.builder);
    if(!localValues.length){
      result.fieldMissing.push({siteShip,local,expected});
    }else{
      const localCanonical=localValues.map(value=>canonicalBuilder(value,aliases));
      const fieldAgrees=expected.every(name=>localCanonical.some(value=>normalizeText(value)===normalizeText(name)));
      if(fieldAgrees)result.agreement++;
      else result.fieldMismatch.push({siteShip,local,expected,actual:localValues});
    }

    const builtBy=(Array.isArray(local?.relationships)?local.relationships:[]).filter(rel=>relationshipType(rel)==='built_by');
    if(!builtBy.length){
      result.relationshipMissing.push({siteShip,local,expected});
    }else{
      const targets=builtBy.map(rel=>{
        const target=relationshipTarget(rel);
        const targetRecord=byId.get(target);
        return targetRecord?recordTitle(targetRecord):target;
      }).filter(Boolean);
      const targetCanonical=targets.map(value=>canonicalBuilder(value,aliases));
      const relAgrees=expected.every(name=>targetCanonical.some(value=>normalizeText(value)===normalizeText(name)));
      if(!relAgrees)result.relationshipMismatch.push({siteShip,local,expected,actual:targets});
    }
  }
  return result;
}

function reconciliationList(items,kind){
  if(!items.length)return '<p class="empty">No items in this category.</p>';
  return `<div class="intelligence-list">${items.slice(0,30).map(item=>{
    const expected=(item.expected||[]).join(' · ');
    const actual=(item.actual||[]).join(' · ');
    const detail=kind==='unmatched'?'No matching CuratorOS ship record':kind==='field-missing'?`Site builder: ${expected}`:kind==='relationship-missing'?`Expected built_by: ${expected}`:`Site: ${expected}${actual?` · CuratorOS: ${actual}`:''}`;
    const name=item.siteShip?.name||item.name||'Unknown ship';
    return `<article><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div><span class="badge">Review</span></article>`;
  }).join('')}</div>`;
}

function installBuilderIntelligencePanel(){
  if(!app||document.querySelector('#site-builder-intelligence'))return;
  const anchor=document.querySelector('.intelligence-metrics');
  if(!anchor)return;

  const panel=document.createElement('section');
  panel.className='panel';
  panel.id='site-builder-intelligence';
  panel.innerHTML='<span class="eyebrow">Site knowledge feed</span><h4>Shipbuilder intelligence</h4><p>Loading the canonical builder dataset from Ocean Liner Curator…</p>';
  anchor.insertAdjacentElement('afterend',panel);
  loadBuilderIntelligence(panel);
}

async function loadBuilderIntelligence(panel){
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=setTimeout(()=>controller?.abort(),6500);
  try{
    const response=await fetch(BUILDER_INTELLIGENCE_URL,{cache:'no-store',credentials:'omit',signal:controller?.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();
    const summary=payload?.summary||{};
    const topBuilders=Array.isArray(payload?.topBuilders)?payload.topBuilders:[];
    const generated=payload?.generatedAt?new Date(payload.generatedAt).toLocaleString():'unknown';
    const reconciliation=Array.isArray(payload?.ships)?reconcileBuilders(payload):null;
    panel.innerHTML=`
      <span class="eyebrow">Site knowledge feed</span>
      <h4>Shipbuilder intelligence</h4>
      <p>CuratorOS is reading the builder identity layer generated from the public ship guides. Ocean Liner Curator remains the source of truth; reconciliation findings are review suggestions only and never rewrite permanent records automatically.</p>
      <section class="metrics intelligence-metrics">
        <article><strong>${Number(summary.canonicalBuilders||0)}</strong><span>Canonical builders</span></article>
        <article><strong>${Number(summary.guidesWithBuilder||0)}</strong><span>Guides with builder data</span></article>
        <article><strong>${Number(summary.guidesMissingBuilder||0)}</strong><span>Unresolved site builders</span></article>
        <article><strong>${Number(summary.guidesMissingLaunch||0)}</strong><span>Missing launch dates</span></article>
        <article><strong>${Number(summary.shipGuides||0)}</strong><span>Ship guides scanned</span></article>
      </section>
      ${reconciliation?`
        <section class="panel" style="margin-top:1rem">
          <span class="eyebrow">Builder reconciliation</span>
          <h4>Public site ↔ permanent corpus</h4>
          <section class="metrics intelligence-metrics">
            <article><strong>${reconciliation.matched}</strong><span>Ship records matched</span></article>
            <article><strong>${reconciliation.agreement}</strong><span>Builder fields aligned</span></article>
            <article><strong>${reconciliation.fieldMissing.length}</strong><span>Builder fields missing</span></article>
            <article><strong>${reconciliation.fieldMismatch.length}</strong><span>Builder field mismatches</span></article>
            <article><strong>${reconciliation.relationshipMissing.length}</strong><span>Missing built_by links</span></article>
            <article><strong>${reconciliation.relationshipMismatch.length}</strong><span>built_by mismatches</span></article>
            <article><strong>${reconciliation.unmatched.length}</strong><span>Site ships unmatched locally</span></article>
          </section>
          <details><summary>Missing built_by relationships (${reconciliation.relationshipMissing.length})</summary>${reconciliationList(reconciliation.relationshipMissing,'relationship-missing')}</details>
          <details><summary>Builder field mismatches (${reconciliation.fieldMismatch.length})</summary>${reconciliationList(reconciliation.fieldMismatch,'field-mismatch')}</details>
          <details><summary>built_by relationship mismatches (${reconciliation.relationshipMismatch.length})</summary>${reconciliationList(reconciliation.relationshipMismatch,'relationship-mismatch')}</details>
          <details><summary>Missing local builder fields (${reconciliation.fieldMissing.length})</summary>${reconciliationList(reconciliation.fieldMissing,'field-missing')}</details>
          <details><summary>Unmatched site ships (${reconciliation.unmatched.length})</summary>${reconciliationList(reconciliation.unmatched,'unmatched')}</details>
        </section>
      `:'<p class="empty">Ship-level reconciliation will appear as soon as the version 2 builder feed is published.</p>'}
      <h4 style="margin-top:1.2rem">Most represented builders</h4>
      <div class="intelligence-list">
        ${topBuilders.slice(0,8).map(builder=>`<article><div><strong>${escapeHtml(builder.name)}</strong><small>${escapeHtml([builder.firstLaunchYear&&builder.lastLaunchYear?`${builder.firstLaunchYear}–${builder.lastLaunchYear}`:'',...(builder.locations||[]).slice(0,2)].filter(Boolean).join(' · '))}</small></div><span>${Number(builder.shipCount||0)} ships</span></article>`).join('')||'<p class="empty">No builder groups were returned.</p>'}
      </div>
      <small>Dataset generated: ${escapeHtml(generated)}</small>
    `;
  }catch(error){
    panel.innerHTML='<span class="eyebrow">Site knowledge feed</span><h4>Shipbuilder intelligence</h4><p class="empty">The published builder feed is temporarily unavailable. Local Corpus Intelligence remains fully functional.</p>';
  }finally{
    clearTimeout(timer);
  }
}

knowledgeIntelligenceButton?.addEventListener('click',()=>{
  window.setTimeout(installBuilderIntelligencePanel,0);
});

window.addEventListener('curatoros:records-changed',()=>{
  if(knowledgeIntelligenceButton?.classList.contains('active')){
    document.querySelector('#site-builder-intelligence')?.remove();
    window.setTimeout(installBuilderIntelligencePanel,0);
  }
});

installOpsHealthStrip();
setTimeout(()=>recordsButton?.click(),0);
