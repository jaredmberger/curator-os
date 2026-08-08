const RQ_CATALOG_KEY='curatoros.rebuilt.catalog';
const RQ_STATE_KEY='curatoros.research.queue.state';
const rqButton=document.querySelector('#research-queue');
const rqApp=document.querySelector('#app');
let rqFilter='open';
let rqType='all';
let rqSearch='';

rqButton?.addEventListener('click',()=>{rqActivate();rqRender();});
window.addEventListener('curatoros:records-changed',()=>{if(rqButton?.classList.contains('active'))rqRender();});

const RQ_FIELDS=[
 ['originalOperator','Original operator',5],['builder','Builder',5],['launchDate','Launch date',5],['maidenVoyageDate','Maiden voyage',4],['grossTonnage','Gross tonnage',4],['length','Length',4],['beam','Beam',3],['fate','Fate',5],['routes','Route / service',3],['serviceEras','Service period',3],['completedDate','Completed date',2]
];

function rqActivate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));rqButton?.classList.add('active');}
function rqRecords(){try{const v=JSON.parse(localStorage.getItem(RQ_CATALOG_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function rqState(){try{const v=JSON.parse(localStorage.getItem(RQ_STATE_KEY)||'{}');return v&&typeof v==='object'?v:{}}catch{return{}}}
function rqSaveState(v){localStorage.setItem(RQ_STATE_KEY,JSON.stringify(v));}
function rqShips(records){return records.filter(r=>r?.type==='ship'||String(r?.id||'').startsWith('ship:'))}
function rqHas(v){return Array.isArray(v)?v.length>0:v!==undefined&&v!==null&&String(v).trim()!==''}
function rqTitle(r){return r?.title||r?.name||r?.id||'Untitled ship'}
function rqEvidence(record,field){const e=record?.fieldEvidence?.[field]||record?.evidence?.[field];return !!e}
function rqRelationships(record,type){return Array.isArray(record.relationships)&&record.relationships.some(r=>(r.relationship||r.type)===type)}
function rqTasks(records){const state=rqState(),tasks=[];for(const record of rqShips(records)){
 for(const [field,label,weight] of RQ_FIELDS){if(!rqHas(record.data?.[field]))tasks.push(rqTask(record,'missing-field',field,label,weight,`Find and record ${label.toLowerCase()}.`));else if(!rqEvidence(record,field))tasks.push(rqTask(record,'evidence-gap',field,label,Math.max(1,weight-1),`Attach field-level evidence for ${label.toLowerCase()}.`));}
 const builder=record.data?.builder;if(rqHas(builder)&&!rqRelationships(record,'built_by'))tasks.push(rqTask(record,'relationship-gap','builder','Builder relationship',2,`Link ${String(builder)} as the builder relationship.`));
 const operator=record.data?.originalOperator||record.data?.operator;if(rqHas(operator)&&!rqRelationships(record,'operated_by'))tasks.push(rqTask(record,'relationship-gap','originalOperator','Operator relationship',2,`Link ${String(operator)} as the operator relationship.`));
 }
 return tasks.map(task=>({...task,state:state[task.id]||{status:'open'}})).sort((a,b)=>b.priority-a.priority||rqTitle(a.record).localeCompare(rqTitle(b.record)));
}
function rqTask(record,type,field,label,weight,action){const sparse=RQ_FIELDS.filter(([f])=>!rqHas(record.data?.[f])).length;const priority=weight+(sparse>=6?3:sparse>=3?1:0);return{id:`${record.id}|${type}|${field}`,record,type,field,label,priority,action};}
function rqPriority(n){return n>=7?'Critical':n>=5?'High':n>=3?'Medium':'Routine'}
function rqRender(){if(!rqApp)return;const all=rqTasks(rqRecords());const state=rqState();const visible=all.filter(t=>{const status=t.state.status||'open';if(rqFilter!=='all'&&status!==rqFilter)return false;if(rqType!=='all'&&t.type!==rqType)return false;if(rqSearch&&!`${rqTitle(t.record)} ${t.label} ${t.action}`.toLowerCase().includes(rqSearch.toLowerCase()))return false;return true});const open=all.filter(t=>(t.state.status||'open')==='open').length;const progress=all.filter(t=>t.state.status==='in-progress').length;const done=Object.values(state).filter(s=>s.status==='done').length;rqApp.innerHTML=`
<section class="panel research-queue-hero"><div><span class="eyebrow">Corpus action layer · v0.7</span><h3>Research Queue</h3><p>Turn corpus weaknesses into concrete curatorial work. Each task points back to a real Ship Record and names the fact, evidence, or relationship that needs attention.</p></div><div class="research-queue-stat"><strong>${open}</strong><span>open tasks</span></div></section>
<section class="metrics">${rqMetric(open,'Open')}${rqMetric(progress,'In progress')}${rqMetric(done,'Completed')}${rqMetric(all.filter(t=>t.priority>=5&&(t.state.status||'open')!=='done').length,'High priority')}</section>
<section class="panel research-queue-controls"><label><span>Search</span><input id="rq-search" type="search" value="${rqEsc(rqSearch)}" placeholder="Ship or research need…"></label><label><span>Status</span><select id="rq-filter"><option value="open">Open</option><option value="in-progress">In progress</option><option value="done">Completed</option><option value="all">All</option></select></label><label><span>Task type</span><select id="rq-type"><option value="all">All types</option><option value="missing-field">Missing facts</option><option value="evidence-gap">Evidence gaps</option><option value="relationship-gap">Relationship gaps</option></select></label></section>
<section class="panel"><div class="research-queue-heading"><div><span class="eyebrow">Prioritized work</span><h4>${visible.length} task${visible.length===1?'':'s'}</h4></div><small>Priority combines field importance with overall record sparsity.</small></div><div class="research-queue-list">${visible.length?visible.slice(0,250).map(rqCard).join(''):'<p class="empty">No tasks match these filters.</p>'}</div>${visible.length>250?`<p class="summary">Showing the first 250 of ${visible.length} matching tasks. Narrow the filters to focus the queue.</p>`:''}</section>`;rqBind();}
function rqCard(task){const status=task.state.status||'open';return `<article class="research-task"><div class="research-task-main"><div class="badges"><span class="badge">${rqEsc(rqPriority(task.priority))}</span><span class="badge">${rqEsc(rqLabel(task.type))}</span><span class="badge">${rqEsc(rqLabel(status))}</span></div><h4>${rqEsc(rqTitle(task.record))}</h4><strong>${rqEsc(task.label)}</strong><p>${rqEsc(task.action)}</p>${task.state.note?`<small>Note: ${rqEsc(task.state.note)}</small>`:''}</div><div class="research-task-actions"><button type="button" data-rq-open="${rqEsc(task.record.id)}" data-rq-field="${rqEsc(task.field)}" data-rq-label="${rqEsc(task.label)}" data-rq-kind="${rqEsc(task.type)}">Open Ship Record</button>${status!=='in-progress'?`<button type="button" data-rq-status="in-progress" data-rq-id="${rqEsc(task.id)}">Start</button>`:''}${status!=='done'?`<button type="button" data-rq-status="done" data-rq-id="${rqEsc(task.id)}">Mark resolved</button>`:`<button type="button" data-rq-status="open" data-rq-id="${rqEsc(task.id)}">Reopen</button>`}</div></article>`;}
function rqBind(){const f=document.querySelector('#rq-filter');if(f)f.value=rqFilter;const t=document.querySelector('#rq-type');if(t)t.value=rqType;document.querySelector('#rq-search')?.addEventListener('input',e=>{rqSearch=e.target.value;rqRender();document.querySelector('#rq-search')?.focus()});f?.addEventListener('change',e=>{rqFilter=e.target.value;rqRender()});t?.addEventListener('change',e=>{rqType=e.target.value;rqRender()});document.querySelectorAll('[data-rq-status]').forEach(b=>b.addEventListener('click',()=>rqSetStatus(b.dataset.rqId,b.dataset.rqStatus)));document.querySelectorAll('[data-rq-open]').forEach(b=>b.addEventListener('click',()=>rqOpenRecord(b.dataset.rqOpen,b.dataset.rqField,b.dataset.rqLabel,b.dataset.rqKind)));}
function rqSetStatus(id,status){const s=rqState();s[id]={...(s[id]||{}),status,updatedAt:new Date().toISOString()};rqSaveState(s);rqRender();}
function rqOpenRecord(id,field,labelText,kind){sessionStorage.setItem('curatoros.openRecordId',id);sessionStorage.setItem('curatoros.recordFieldFocus',JSON.stringify({recordId:id,field:field||'',label:labelText||'',kind:kind||'',requestedAt:new Date().toISOString()}));window.CuratorOSNavigate?.open?.('records');}
function rqMetric(v,l){return `<div class="metric"><strong>${v}</strong><span>${rqEsc(l)}</span></div>`}
function rqLabel(v){return String(v||'').replace(/[_-]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
function rqEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
