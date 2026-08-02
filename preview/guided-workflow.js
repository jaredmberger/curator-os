const app=document.querySelector('#app');
const button=document.querySelector('#guided-workflow');
const FLOW_KEY='curatoros.guidedWorkflow';

const WORKFLOWS={
  ingest:{title:'Learn from an existing webpage',purpose:'Use an existing OceanLiners.net page to create or update structured knowledge.',steps:[
    {title:'Check the site manifest',workspace:'site-sync',instruction:'Open Site / Knowledge Sync. Load site-index.json if needed, then locate the page you want to work on. Confirm whether it is new, changed, already extracted, or unmatched.'},
    {title:'Load the webpage',workspace:'extract-knowledge',instruction:'Open Extract Knowledge. Choose the saved HTML page from Files, or paste the page HTML and source URL.'},
    {title:'Review extracted facts',workspace:'extract-knowledge',instruction:'Check the target record, then review each candidate fact. Keep the useful facts selected, correct the standardized field when needed, and verify normalized values and entity targets.'},
    {title:'Approve into Project Records',workspace:'extract-knowledge',instruction:'Choose Approve selected knowledge. This creates or updates the local Project Record and preserves the page as provenance.'},
    {title:'Check entity identity',workspace:'entity-resolution',instruction:'Open Entity Resolution if the page introduced builders, companies, people, or other entities. Resolve duplicate names only when CuratorOS flags them.'},
    {title:'Review evidence and conflicts',workspace:'evidence-ledger',instruction:'Open Evidence & Conflicts. Check whether the new facts created competing claims or uncovered fields. Mark a preferred claim only when the evidence justifies it.'},
    {title:'Finish',workspace:'records',instruction:'Open Project Records and inspect the finished record. You are done unless you want to use this knowledge in a new page.'}
  ]},
  create:{title:'Create a new webpage from CuratorOS knowledge',purpose:'Combine existing records into a new OceanLiners.net page.',steps:[
    {title:'Find the records you want',workspace:'knowledge-explorer',instruction:'Open Knowledge Explorer. Search and filter until the result set contains the records that belong on the page.'},
    {title:'Save the result as a collection',workspace:'knowledge-explorer',instruction:'Save the current result as a named reusable collection. Give it a name that describes the proposed page or research set.'},
    {title:'Compose the publication',workspace:'publication-composer',instruction:'Open Publication Composer. Choose the saved collection, select the page type, confirm which records to include, enter a working title, proposed slug, audience, and editorial purpose, then build the publication brief.'},
    {title:'Save the publication brief',workspace:'publication-composer',instruction:'Review the generated section plan and semantic HTML. If the plan is right, choose Save brief.'},
    {title:'Assemble the site-shaped page',workspace:'page-assembly',instruction:'Open Template & Page Assembly. Choose the saved brief, select the appropriate house layout family, review the target path and any site-index collision warning, then build the page package.'},
    {title:'Review and download',workspace:'page-assembly',instruction:'Read the assembled HTML preview. When satisfied, download the HTML and/or the full page-assembly package. CuratorOS does not publish it automatically yet.'}
  ]},
  update:{title:'Update an existing webpage from CuratorOS knowledge',purpose:'Use current structured knowledge to prepare a reviewed replacement for an existing public page.',steps:[
    {title:'Confirm the public page',workspace:'site-sync',instruction:'Open Site / Knowledge Sync and locate the existing page. Confirm its path and whether CuratorOS considers it current or changed.'},
    {title:'Verify the underlying records',workspace:'records',instruction:'Open Project Records and inspect the records that should supply the updated page. Resolve obvious gaps before composing.'},
    {title:'Review evidence if facts changed',workspace:'evidence-ledger',instruction:'If the update involves disputed or newly changed facts, review Evidence & Conflicts and resolve preferred claims first.'},
    {title:'Build the source collection',workspace:'knowledge-explorer',instruction:'Use Knowledge Explorer to assemble the records that belong on the updated page and save them as a collection.'},
    {title:'Compose the replacement',workspace:'publication-composer',instruction:'Choose that collection in Publication Composer, use the existing page title/path as your target, define the update purpose, then build and save the publication brief.'},
    {title:'Assemble and compare',workspace:'page-assembly',instruction:'Open Template & Page Assembly. Build the page using the proper house layout. The site manifest should flag the path as an existing-page update candidate.'},
    {title:'Review and download',workspace:'page-assembly',instruction:'Review the generated HTML carefully, then download the page package for the future publishing step.'}
  ]},
  review:{title:'Review or clean up a Project Record',purpose:'Inspect an existing record, its identity, relationships, and supporting evidence.',steps:[
    {title:'Open the record',workspace:'records',instruction:'Open Project Records, search for the entity, then inspect its structured data, relationships, sources, notes, and origin.'},
    {title:'Edit only if needed',workspace:'records',instruction:'Use Edit local record for corrections. Saved edits remain reversible pending changes.'},
    {title:'Resolve duplicate identities',workspace:'entity-resolution',instruction:'If similar entity records exist, open Entity Resolution and consolidate them into one canonical identity.'},
    {title:'Inspect connections',workspace:'knowledge-graph',instruction:'Open Knowledge Graph and focus the record to check incoming and outgoing relationships and unresolved targets.'},
    {title:'Inspect evidence',workspace:'evidence-ledger',instruction:'Use Evidence & Conflicts to see which claims support the record and whether any values disagree.'},
    {title:'Finish',workspace:'records',instruction:'Return to Project Records and confirm the record now reflects the curated state you want.'}
  ]},
  explore:{title:'Explore the knowledge base',purpose:'Browse connections, discover patterns, and turn useful findings into reusable collections.',steps:[
    {title:'Choose your starting point',workspace:'knowledge-graph',instruction:'Open Knowledge Graph and search for a ship, builder, line, person, object, or source that interests you.'},
    {title:'Follow the relationships',workspace:'knowledge-graph',instruction:'Inspect incoming, outgoing, and second-hop connections. Follow related records as needed.'},
    {title:'Look for derived opportunities',workspace:'knowledge-intelligence',instruction:'Open Knowledge Intelligence to see builder fleets, operator groups, class/route clusters, hubs, and relationship gaps found automatically.'},
    {title:'Save something useful',workspace:'knowledge-intelligence',instruction:'If a derived cluster is useful, save it as a Knowledge Explorer collection.'},
    {title:'Refine the collection',workspace:'knowledge-explorer',instruction:'Open Knowledge Explorer to filter, search, or reshape the record set. Save the refined result if needed.'},
    {title:'Continue or stop',workspace:'knowledge-explorer',instruction:'You can stop here with a reusable research collection, or continue into Publication Composer to make a page from it.'}
  ]}
};

let state=readState();
button?.addEventListener('click',()=>{activate();render();});
window.addEventListener('curatoros:guided-step-completed',()=>{state=readState();if(button?.classList.contains('active'))render();});

function readState(){try{return JSON.parse(localStorage.getItem(FLOW_KEY)||'null')||{workflow:'',step:0,subject:''}}catch{return{workflow:'',step:0,subject:''}}}
function save(){localStorage.setItem(FLOW_KEY,JSON.stringify(state));}
function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button?.classList.add('active');}

function render(){if(!app)return;const flow=WORKFLOWS[state.workflow];app.innerHTML=flow?renderFlow(flow):renderStart();bind();}
function renderStart(){return `<section class="panel guide-flow-hero"><span class="eyebrow">Start Here · Guided Workflow</span><h3>What are you trying to do?</h3><p>Choose the outcome you want. CuratorOS will show you the exact order of workspaces, what to click or select in each one, and what you should have before moving on.</p></section><section class="guide-flow-grid">${card('ingest','Learn from an existing webpage','Start with one OceanLiners.net page and turn it into reviewed Project Records.')}${card('create','Create a new webpage','Start with knowledge already in CuratorOS and build a new page package.')}${card('update','Update an existing webpage','Use reviewed records to prepare a replacement for a page that already exists.')}${card('review','Review a Project Record','Clean up one record, its identity, relationships, and evidence.')}${card('explore','Explore the knowledge base','Follow relationships, discover clusters, and save useful collections.')}</section>`;}
function card(id,titleText,desc){return `<button type="button" class="guide-flow-choice" data-start-flow="${id}"><strong>${esc(titleText)}</strong><span>${esc(desc)}</span><em>Start this workflow →</em></button>`}

function renderFlow(flow){
  const step=Math.min(state.step,flow.steps.length-1);const current=flow.steps[step];const progress=Math.round(((step+1)/flow.steps.length)*100);const readiness=window.CuratorOSWorkflowReadiness?.summary?.(state.workflow,step)||{checks:[],missingCount:0,nextMissing:null};
  return `<section class="panel guide-flow-hero"><div><span class="eyebrow">Guided Workflow</span><h3>${esc(flow.title)}</h3><p>${esc(flow.purpose)}</p></div><button type="button" id="change-workflow">Choose a different workflow</button></section>
  <section class="panel guide-flow-subject"><label><span>What page / record / topic are you working on?</span><input id="workflow-subject" value="${esc(state.subject||'')}" placeholder="Example: RMS Olympic or /ships/rms-olympic"></label></section>
  <section class="panel guide-flow-progress"><div><strong>Step ${step+1} of ${flow.steps.length}</strong><span>${progress}% complete</span></div><div class="guide-progress-track"><span style="width:${progress}%"></span></div></section>
  <section class="panel guide-flow-current"><span class="eyebrow">Do this now</span><h3>${esc(current.title)}</h3><p>${esc(current.instruction)}</p>${renderReadiness(readiness)}<div class="guide-flow-actions"><button type="button" data-open-workspace="${esc(current.workspace)}">Open ${esc(workspaceLabel(current.workspace))}</button>${step>0?'<button type="button" id="workflow-back">← Previous step</button>':''}${step<flow.steps.length-1?'<button type="button" id="workflow-next">I finished this step →</button>':'<button type="button" id="workflow-finish">Finish workflow</button>'}</div></section>
  <section class="panel"><span class="eyebrow">Whole workflow</span><div class="guide-flow-steps">${flow.steps.map((s,i)=>`<article class="${i===step?'current':''} ${i<step?'done':''}"><span>${i<step?'✓':i+1}</span><div><strong>${esc(s.title)}</strong><p>${esc(workspaceLabel(s.workspace))}</p></div>${i!==step?`<button type="button" data-jump-step="${i}">Go here</button>`:''}</article>`).join('')}</div></section>`;
}

function renderReadiness(r){if(!r.checks?.length)return'';return `<div class="guide-readiness"><div class="guide-readiness-head"><strong>What CuratorOS can see right now</strong><span>${r.missingCount?`${r.missingCount} item${r.missingCount===1?'':'s'} still needed`:'Ready for review / completion'}</span></div><div class="guide-readiness-list">${r.checks.map(c=>`<article class="${c.ok?'ready':'missing'}"><span>${c.ok?'✓':'!'}</span><div><strong>${esc(c.label)}</strong><p>${esc(c.detail)}</p></div><small>${esc(label(c.kind))}</small></article>`).join('')}</div>${r.nextMissing?`<p class="guide-readiness-next"><strong>Next concrete action:</strong> ${esc(r.nextMissing.detail)}</p>`:''}</div>`}

function bind(){document.querySelectorAll('[data-start-flow]').forEach(b=>b.addEventListener('click',()=>{state={workflow:b.dataset.startFlow,step:0,subject:'',completed:{}};save();render();}));document.querySelector('#change-workflow')?.addEventListener('click',()=>{state={workflow:'',step:0,subject:state.subject||''};save();render();});document.querySelector('#workflow-subject')?.addEventListener('input',e=>{state.subject=e.target.value;save();});document.querySelector('#workflow-next')?.addEventListener('click',()=>{const flow=WORKFLOWS[state.workflow];state.step=Math.min(state.step+1,flow.steps.length-1);save();render();});document.querySelector('#workflow-back')?.addEventListener('click',()=>{state.step=Math.max(0,state.step-1);save();render();});document.querySelector('#workflow-finish')?.addEventListener('click',()=>{state={workflow:'',step:0,subject:''};save();render();});document.querySelectorAll('[data-jump-step]').forEach(b=>b.addEventListener('click',()=>{state.step=Number(b.dataset.jumpStep)||0;save();render();}));document.querySelectorAll('[data-open-workspace]').forEach(b=>b.addEventListener('click',()=>openWorkspace(b.dataset.openWorkspace)));}
function openWorkspace(id){const selector=id==='records'?'[data-view="records"]':`#${CSS.escape(id)}`;const target=document.querySelector(selector);if(!target)return alert('That CuratorOS workspace is not available in this build.');save();target.click();showGuideBar();}
function showGuideBar(){document.querySelector('#guided-workflow-bar')?.remove();const flow=WORKFLOWS[state.workflow];if(!flow)return;const current=flow.steps[Math.min(state.step,flow.steps.length-1)];const readiness=window.CuratorOSWorkflowReadiness?.summary?.(state.workflow,state.step);const status=readiness?.nextMissing?`Next: ${readiness.nextMissing.detail}`:'Ready for task confirmation.';const bar=document.createElement('div');bar.id='guided-workflow-bar';bar.className='guided-workflow-bar';bar.innerHTML=`<div><small>Guided workflow · Step ${state.step+1} of ${flow.steps.length}</small><strong>${esc(current.title)}</strong>${state.subject?`<span>${esc(state.subject)}</span>`:''}<span>${esc(status)}</span></div><div><button type="button" data-return-guide>Return to guide</button></div>`;document.body.append(bar);bar.querySelector('[data-return-guide]')?.addEventListener('click',()=>{activate();state=readState();render();});}
function workspaceLabel(id){return ({'site-sync':'Site / Knowledge Sync','extract-knowledge':'Extract Knowledge','entity-resolution':'Entity Resolution','evidence-ledger':'Evidence & Conflicts','knowledge-graph':'Knowledge Graph','knowledge-intelligence':'Knowledge Intelligence','knowledge-explorer':'Knowledge Explorer','publication-composer':'Publication Composer','page-assembly':'Template & Page Assembly',records:'Project Records'})[id]||id}
function label(v){return String(v||'').replace(/[_-]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
