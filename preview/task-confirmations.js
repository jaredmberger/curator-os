const FLOW_KEY='curatoros.guidedWorkflow';
const CONFIRM_KEY='curatoros.workspace.confirmations';
const app=document.querySelector('#app');

const DEFINITIONS={
  'site-sync':{
    title:'Site / Knowledge Sync review',
    summary:'Review the site manifest and any pages needing attention.',
    requirement:'Import: load site-index.json if no manifest is present. Review: inspect the page/status you are working on. Export is optional unless you specifically need a sync report or extraction queue.',
    confirm:'✓ Confirm manifest review',
    skip:'Nothing else to review'
  },
  'entity-resolution':{
    title:'Entity identity review',
    summary:'Review duplicate identities and unresolved entity targets.',
    requirement:'Import: none. Review: inspect any duplicate groups or unresolved targets. Save: apply a consolidation only when one is actually needed. Export is optional for the resolution registry.',
    confirm:'✓ Confirm identities reviewed',
    skip:'Nothing to resolve — continue'
  },
  'knowledge-graph':{
    title:'Relationship review',
    summary:'Inspect the focused record’s incoming, outgoing, and unresolved relationships.',
    requirement:'Import: none. Review only. Exporting a graph slice is optional and is not required to finish this task.',
    confirm:'✓ Relationships look good',
    skip:'No relationship action needed'
  },
  'knowledge-intelligence':{
    title:'Knowledge opportunity review',
    summary:'Review the derived clusters, gaps, and opportunities relevant to this task.',
    requirement:'Import: none. Review: inspect useful opportunities. Save: only save a derived collection if you want to use it later. Exporting the intelligence report is optional.',
    confirm:'✓ Confirm opportunities reviewed',
    skip:'No useful opportunity here'
  },
  'evidence-ledger':{
    title:'Evidence review',
    summary:'Review relevant claims, conflicts, and uncovered facts.',
    requirement:'Import: none. Review: inspect claims and conflicts. Save: mark/apply a preferred claim only when needed. Exporting the evidence ledger is optional.',
    confirm:'✓ Confirm evidence review',
    skip:'No evidence issue to resolve'
  },
  'knowledge-explorer':{
    title:'Knowledge selection review',
    summary:'Confirm that the current result set is the collection you intend to use.',
    requirement:'Import: none. Review: search/filter the records. Save: if the next step is Publication Composer, save the result as a named collection. Export is optional.',
    confirm:'✓ Confirm this record set',
    skip:'No collection needed'
  },
  'publication-composer':{
    title:'Publication brief review',
    summary:'Confirm that the title, selected records, section plan, and editorial purpose are ready to move forward.',
    requirement:'Import: choose a saved Knowledge Explorer collection. Save: build and save the publication brief. Export is optional at this stage unless you want a standalone package.',
    confirm:'✓ Approve publication brief'
  },
  'page-assembly':{
    title:'Page package review',
    summary:'Confirm that the assembled page, target path, layout family, and provenance treatment are ready for handoff.',
    requirement:'Import: choose a saved Publication Composer brief. Review: inspect the assembled HTML and target path. Export: download the HTML and/or page-assembly package when you are ready to hand it off.',
    confirm:'✓ Approve page package'
  },
  'records':{
    title:'Project Record review',
    summary:'Confirm that you inspected the record and are satisfied with its current curated state.',
    requirement:'Import: none. Review: inspect the record. Save only if you make a local edit. Exporting a change set is optional unless you are handing those changes off.',
    confirm:'✓ Record looks good',
    skip:'No record review needed'
  }
};

const observer=new MutationObserver(()=>enhance());
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('curatoros:records-changed',enhance);
setTimeout(enhance,0);

function enhance(){
  const workspace=currentWorkspace();
  if(!workspace||!DEFINITIONS[workspace])return;
  if(app?.querySelector('[data-workspace-confirmation]'))return;
  const def=DEFINITIONS[workspace];
  const state=confirmationState(workspace);
  const panel=document.createElement('section');
  panel.className=`panel workspace-confirmation ${state?.status==='confirmed'?'confirmed':''}`;
  panel.dataset.workspaceConfirmation=workspace;
  panel.innerHTML=`
    <div class="workspace-confirmation-copy">
      <span class="eyebrow">Task completion</span>
      <h4>${esc(def.title)}</h4>
      <p>${esc(def.summary)}</p>
      <div class="workspace-task-requirement"><strong>What counts as done</strong><p>${esc(def.requirement)}</p></div>
      ${state?`<p class="workspace-confirmation-status"><strong>${state.status==='confirmed'?'✓ Confirmed':'↷ Skipped / not applicable'}</strong> ${esc(formatDate(state.at))}</p>`:''}
    </div>
    <div class="workspace-confirmation-actions">
      <button type="button" data-confirm-workspace="${esc(workspace)}">${esc(def.confirm)}</button>
      ${def.skip?`<button type="button" data-skip-workspace="${esc(workspace)}">${esc(def.skip)}</button>`:''}
      ${state?`<button type="button" data-clear-workspace-confirmation="${esc(workspace)}">Undo confirmation</button>`:''}
    </div>`;
  app?.append(panel);
  panel.querySelector('[data-confirm-workspace]')?.addEventListener('click',()=>complete(workspace,'confirmed'));
  panel.querySelector('[data-skip-workspace]')?.addEventListener('click',()=>complete(workspace,'skipped'));
  panel.querySelector('[data-clear-workspace-confirmation]')?.addEventListener('click',()=>clear(workspace));
}

function currentWorkspace(){
  const active=document.querySelector('.nav .active');
  if(!active)return'';
  if(active.dataset?.view==='records')return'records';
  return active.id||'';
}

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));}
function confirmations(){const v=readJson(CONFIRM_KEY,{});return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function confirmationState(workspace){return confirmations()[workspace]||null}

function complete(workspace,status){
  const map=confirmations();
  const flow=readJson(FLOW_KEY,{workflow:'',step:0,subject:''});
  map[workspace]={workspace,status,at:new Date().toISOString(),workflow:flow.workflow||'',step:Number.isFinite(flow.step)?flow.step:null,subject:flow.subject||''};
  writeJson(CONFIRM_KEY,map);
  advanceGuidedWorkflowIfMatching(workspace,status);
  app?.querySelector('[data-workspace-confirmation]')?.remove();
  enhance();
}

function clear(workspace){const map=confirmations();delete map[workspace];writeJson(CONFIRM_KEY,map);app?.querySelector('[data-workspace-confirmation]')?.remove();enhance();}

function advanceGuidedWorkflowIfMatching(workspace,status){
  const flow=readJson(FLOW_KEY,null);if(!flow?.workflow)return;
  const map={
    ingest:['site-sync','extract-knowledge','extract-knowledge','extract-knowledge','entity-resolution','evidence-ledger','records'],
    create:['knowledge-explorer','knowledge-explorer','publication-composer','publication-composer','page-assembly','page-assembly'],
    update:['site-sync','records','evidence-ledger','knowledge-explorer','publication-composer','page-assembly','page-assembly'],
    review:['records','records','entity-resolution','knowledge-graph','evidence-ledger','records'],
    explore:['knowledge-graph','knowledge-graph','knowledge-intelligence','knowledge-intelligence','knowledge-explorer','knowledge-explorer']
  };
  const steps=map[flow.workflow]||[];
  const current=steps[flow.step];
  if(current!==workspace)return;
  flow.completed=flow.completed&&typeof flow.completed==='object'?flow.completed:{};
  flow.completed[String(flow.step)]={status,at:new Date().toISOString(),workspace};
  if(flow.step<steps.length-1)flow.step+=1;
  writeJson(FLOW_KEY,flow);
  window.dispatchEvent(new CustomEvent('curatoros:guided-step-completed',{detail:{workspace,status,step:flow.step}}));
}

function formatDate(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString()}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
