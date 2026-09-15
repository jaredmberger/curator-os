const recordsButton=document.querySelector('[data-view="records"]');
const app=document.querySelector('#app');
const knowledgeIntelligenceButton=document.querySelector('#knowledge-intelligence');
const BUILDER_INTELLIGENCE_URL='https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-builders.json';

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
    panel.innerHTML=`
      <span class="eyebrow">Site knowledge feed</span>
      <h4>Shipbuilder intelligence</h4>
      <p>CuratorOS is reading the builder identity layer generated from the public ship guides. This feed remains observational: Ocean Liner Curator is the source of truth.</p>
      <section class="metrics intelligence-metrics">
        <article><strong>${Number(summary.canonicalBuilders||0)}</strong><span>Canonical builders</span></article>
        <article><strong>${Number(summary.guidesWithBuilder||0)}</strong><span>Guides with builder data</span></article>
        <article><strong>${Number(summary.guidesMissingBuilder||0)}</strong><span>Unresolved builders</span></article>
        <article><strong>${Number(summary.guidesMissingLaunch||0)}</strong><span>Missing launch dates</span></article>
        <article><strong>${Number(summary.shipGuides||0)}</strong><span>Ship guides scanned</span></article>
      </section>
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

installOpsHealthStrip();
setTimeout(()=>recordsButton?.click(),0);
