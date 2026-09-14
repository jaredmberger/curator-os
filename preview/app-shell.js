const recordsButton=document.querySelector('[data-view="records"]');
const app=document.querySelector('#app');

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
    <a class="ops-health-card" href="https://ops.oceanlinercurator.com/self-test" target="_blank" rel="noopener" data-ops-health="self-test">
      <span class="ops-health-label">Monitoring Self-Test</span>
      <span class="ops-health-state"><span class="ops-health-dot unknown" aria-hidden="true"></span><span data-ops-state>Checking…</span></span>
    </a>
    <a class="ops-health-more" href="https://ops.oceanlinercurator.com/" target="_blank" rel="noopener">Curator Ops →</a>
  `;
  topbar.insertAdjacentElement('afterend',strip);

  const checks=[
    ['journey','https://ops.oceanlinercurator.com/api/public-site-journey'],
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

installOpsHealthStrip();
setTimeout(()=>recordsButton?.click(),0);
