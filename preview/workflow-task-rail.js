const FLOW_KEY='curatoros.guidedWorkflow';
const CATALOG_KEY='curatoros.rebuilt.catalog';
const COLLECTIONS_KEY='curatoros.knowledge.collections';
const DRAFTS_KEY='curatoros.publication.drafts';
const EXTRACTION_KEY='curatoros.extraction.lastSession';
const app=document.querySelector('#app');

const WORKSPACE_LABELS={
  'site-sync':'Site / Knowledge Sync','extract-knowledge':'Extract Knowledge','entity-resolution':'Entity Resolution','knowledge-graph':'Knowledge Graph','knowledge-intelligence':'Knowledge Intelligence','evidence-ledger':'Evidence & Conflicts','knowledge-explorer':'Knowledge Explorer','publication-composer':'Publication Composer','page-assembly':'Template & Page Assembly',records:'Project Records'
};

const observer=new MutationObserver(()=>enhance());
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('curatoros:records-changed',enhance);
window.addEventListener('curatoros:guided-step-completed',enhance);
setTimeout(enhance,0);

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));}
function flow(){return readJson(FLOW_KEY,null)}
function currentWorkspace(){const active=document.querySelector('.nav .active');if(!active)return'';if(active.dataset?.view==='records')return'records';return active.id||''}

function enhance(){
  document.querySelector('#guided-workflow-bar')?.remove();
  const f=flow();if(!f?.workflow||!app)return;
  const workspace=currentWorkspace();if(!workspace||workspace==='guided-workflow')return;
  app.querySelector('[data-task-rail]')?.remove();
  const readiness=window.CuratorOSWorkflowReadiness?.summary?.(f.workflow,f.step)||null;
  const rail=document.createElement('section');
  rail.className='panel workflow-task-rail';rail.dataset.taskRail='true';
  const subject=f.subject?`<span class="badge">${esc(f.subject)}</span>`:'';
  rail.innerHTML=`<div class="workflow-task-rail-head"><div><span class="eyebrow">Guided task</span><h4>${esc(WORKSPACE_LABELS[workspace]||workspace)}</h4><div class="badges">${subject}<span class="badge">Step ${Number(f.step||0)+1}</span></div></div><button type="button" data-return-guide>Return to workflow</button></div>
  ${readiness?renderReadiness(readiness):''}
  ${renderWorkspaceContext(workspace,f)}
  <div class="workflow-task-rail-note"><strong>Where does this data live?</strong><p>${esc(storageExplanation(workspace))}</p></div>`;
  app.prepend(rail);
  rail.querySelector('[data-return-guide]')?.addEventListener('click',()=>document.querySelector('#guided-workflow')?.click());
  bindContextActions(rail,workspace,f);
}

function renderReadiness(r){const missing=r.checks?.filter(x=>!x.ok)||[];return `<div class="workflow-task-status ${missing.length?'needs-action':'ready'}"><strong>${missing.length?'Action still needed':'Ready to finish this task'}</strong><span>${esc(missing[0]?.detail||'CuratorOS can see the expected prerequisite data for this step.')}</span></div>`}

function renderWorkspaceContext(workspace,f){
  if(workspace==='extract-knowledge'){
    const s=readJson(EXTRACTION_KEY,null);
    if(!s)return `<div class="workflow-data-box"><h5>No webpage loaded</h5><p>Use Choose HTML page or Paste page HTML below. Nothing has been added to Project Records yet.</p></div>`;
    const selected=(s.candidates||[]).filter(c=>c.include&&c.field!=='unmapped');
    return `<div class="workflow-data-box"><div><h5>${esc(s.title||s.filename||'Loaded webpage')}</h5><p>${selected.length} selected fact${selected.length===1?'':'s'} · ${s.approvedAt?'already approved into Project Records':'not yet part of Project Records'}</p></div><div class="workflow-mini-list">${selected.slice(0,8).map(c=>`<label><input type="checkbox" data-flow-candidate="${esc(candidateKey(c))}" ${c.include?'checked':''}><span><strong>${esc(c.rawLabel||c.field)}</strong><small>${esc(c.normalizedValue||c.rawValue||'')}</small></span></label>`).join('')||'<p>No facts are currently selected.</p>'}</div><p class="workflow-membership ${s.approvedAt?'in-collection':'pending'}">${s.approvedAt?'✓ These approved facts are now represented in the larger Project Records collection.':'○ These facts are still isolated in this extraction session until you press Approve selected knowledge.'}</p></div>`;
  }
  if(workspace==='knowledge-explorer'){
    const collections=readJson(COLLECTIONS_KEY,[]);
    return `<div class="workflow-data-box"><h5>Reusable collections</h5><p>${collections.length?`${collections.length} saved collection${collections.length===1?'':'s'} are part of CuratorOS and can be reopened later.`:'No saved collection exists yet. Search/filtering alone is temporary until you save a collection.'}</p>${collections.length?`<div class="workflow-mini-list">${collections.slice(-5).reverse().map(c=>`<article><strong>${esc(c.name||c.id)}</strong><small>${c.recordCount||c.recordIds?.length||0} records · saved in CuratorOS</small></article>`).join('')}</div>`:''}</div>`;
  }
  if(workspace==='publication-composer'){
    const drafts=readJson(DRAFTS_KEY,[]);
    return `<div class="workflow-data-box"><h5>Publication briefs</h5><p>${drafts.length?`${drafts.length} saved brief${drafts.length===1?'':'s'} exist in CuratorOS. Choose one of the saved collections above, build the brief, then press Save brief to make it persistent.`:'No saved publication brief exists yet. A built preview is temporary until you press Save brief.'}</p></div>`;
  }
  if(workspace==='page-assembly'){
    const drafts=readJson(DRAFTS_KEY,[]);
    return `<div class="workflow-data-box"><h5>Page handoff</h5><p>${drafts.length?'The selected Publication Composer brief is already part of CuratorOS. The assembled HTML is a generated output; download it only when you want a file handoff.':'No saved brief is available, so there is nothing to assemble yet.'}</p></div>`;
  }
  if(workspace==='records'){
    const records=readJson(CATALOG_KEY,[]);
    return `<div class="workflow-data-box"><h5>The larger collection</h5><p>${records.length} Project Record${records.length===1?' is':'s are'} currently in the local CuratorOS corpus. These are the canonical reusable records other workspaces read from.</p></div>`;
  }
  return `<div class="workflow-data-box"><h5>This is a review workspace</h5><p>The items shown here are views of the shared Project Records corpus, not separate imported copies. Use the task-completion control at the bottom when your review is finished.</p></div>`;
}

function bindContextActions(rail,workspace){
  if(workspace!=='extract-knowledge')return;
  rail.querySelectorAll('[data-flow-candidate]').forEach(cb=>cb.addEventListener('change',()=>{
    const s=readJson(EXTRACTION_KEY,null);if(!s)return;
    const key=cb.dataset.flowCandidate;const candidate=(s.candidates||[]).find(c=>candidateKey(c)===key);if(!candidate)return;
    candidate.include=cb.checked;writeJson(EXTRACTION_KEY,s);
    const original=[...document.querySelectorAll('[data-candidate-include]')].find(el=>{const idx=Number(el.dataset.candidateInclude);const c=s.candidates?.[idx];return c&&candidateKey(c)===key});
    if(original){original.checked=cb.checked;original.dispatchEvent(new Event('change',{bubbles:true}));}
    enhance();
  }));
}

function storageExplanation(workspace){
  if(workspace==='site-sync')return 'site-index.json is an imported website manifest used for comparison. It does not become Project Records.';
  if(workspace==='extract-knowledge')return 'The loaded HTML is a temporary extraction source. Selected facts become part of the shared Project Records corpus only after approval.';
  if(workspace==='records')return 'Project Records are the shared knowledge collection. Other CuratorOS workspaces read these same records.';
  if(workspace==='knowledge-explorer')return 'Search results are temporary. A saved collection is a reusable list of stable Project Record IDs stored inside CuratorOS.';
  if(workspace==='publication-composer')return 'A previewed brief is temporary. Press Save brief to store a reusable publication brief inside CuratorOS.';
  if(workspace==='page-assembly')return 'The publication brief remains stored in CuratorOS. Downloaded HTML/package files are external handoff artifacts, not a second knowledge database.';
  if(['entity-resolution','knowledge-graph','knowledge-intelligence','evidence-ledger'].includes(workspace))return 'This workspace is looking at the same shared Project Records corpus. Its results are not isolated copies unless you explicitly save a derived collection or resolution.';
  return 'This workspace is part of the same CuratorOS local knowledge state.';
}
function candidateKey(c){return `${c.rawLabel||''}|${c.field||''}|${c.rawValue||''}`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
