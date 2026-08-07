const SHIP_CATALOG_KEY='curatoros.rebuilt.catalog';
const SHIP_CHANGE_KEY='curatoros.project.pendingChanges';
const shipObserver=new MutationObserver(()=>enhanceShipRecordUI());
shipObserver.observe(document.body,{childList:true,subtree:true});
window.addEventListener('curatoros:records-changed',enhanceShipRecordUI);
setTimeout(enhanceShipRecordUI,0);

const SHIP_SECTIONS=[
  {title:'Core identity',fields:[
    ['prefix','Prefix'],['alternateNames','Alternative / later names','list'],['originalOperator','Original operator'],['operatorHistory','Operator history','list'],['builder','Built by'],['yardNumber','Yard number'],['buildLocation','Built at'],['registry','Registry / flag'],['homePort','Home port'],['shipClass','Ship class'],['sisterShips','Sister ships','list']
  ]},
  {title:'Construction & dates',fields:[
    ['orderedDate','Ordered'],['keelLaidDate','Keel laid'],['launchDate','Launched'],['completedDate','Completed'],['enteredServiceDate','Entered service'],['maidenVoyageDate','Maiden voyage']
  ]},
  {title:'Dimensions & machinery',fields:[
    ['grossTonnage','Gross tonnage'],['grossTonnageContext','Tonnage context'],['netTonnage','Net tonnage'],['displacement','Displacement'],['length','Length'],['lengthContext','Length context'],['beam','Beam'],['beamContext','Beam context'],['draft','Draft'],['propulsion','Propulsion'],['engines','Engines'],['power','Power'],['serviceSpeed','Service speed'],['maximumSpeed','Maximum speed'],['funnels','Funnels'],['masts','Masts']
  ]},
  {title:'Capacity & service',fields:[
    ['passengerCapacity','Passenger capacity'],['crew','Crew'],['routes','Routes','list'],['serviceEras','Service eras','multiline'],['wartimeService','Wartime service','multiline'],['majorRefits','Major refits','multiline'],['majorIncidents','Major incidents','multiline'],['notableCaptains','Notable captains','list'],['serviceNotes','Service notes','multiline']
  ]},
  {title:'End of service & fate',fields:[
    ['serviceEndDate','Service ended'],['withdrawnDate','Withdrawn'],['fate','Fate'],['fateDate','Fate date'],['fateLocation','Fate location']
  ]}
];

function enhanceShipRecordUI(){
  enhanceCreateControls();
  const inspector=document.querySelector('#project-record-inspector');
  if(inspector&&!inspector.dataset.shipEnhanced){
    const id=shipRecordIdFromInspector(inspector);
    const record=readShipRecords().find(r=>r.id===id);
    if(record&&isShipRecord(record))enhanceShipInspector(inspector,record);
  }
}

function enhanceCreateControls(){
  const panel=document.querySelector('.pending-change-panel');
  if(!panel||panel.dataset.shipCreateEnhanced)return;
  panel.dataset.shipCreateEnhanced='true';
  const actions=panel.querySelector('.pending-change-actions');
  const generic=actions?.querySelector('[data-create-record]');
  if(!actions||!generic)return;
  const ship=document.createElement('button');
  ship.type='button';ship.textContent='Create Ship Record';ship.dataset.createShipRecord='true';
  ship.addEventListener('click',()=>openShipEditor(null));
  actions.insertBefore(ship,generic);
}

function enhanceShipInspector(inspector,record){
  inspector.dataset.shipEnhanced='true';
  const card=inspector.querySelector('.record-inspector-card');if(!card)return;
  const header=card.querySelector('.record-inspector-header');
  header?.querySelector('.eyebrow')?.replaceChildren(document.createTextNode('Canonical Ship Record'));
  card.querySelectorAll('.record-inspector-section').forEach(section=>{
    const heading=section.querySelector('h4')?.textContent?.trim().toLowerCase()||'';
    if(heading==='structured data'||heading==='identity')section.remove();
  });
  const facts=renderShipFacts(record);
  const summary=card.querySelector('.record-inspector-section');
  if(summary)summary.insertAdjacentHTML('afterend',facts);else header?.insertAdjacentHTML('afterend',facts);
  const actions=card.querySelector('.record-inspector-actions');
  if(actions){
    const generic=[...actions.querySelectorAll('button')].find(b=>/edit permanent record/i.test(b.textContent||''));if(generic)generic.remove();
    const edit=document.createElement('button');edit.type='button';edit.textContent='Edit Ship Record';edit.className='ship-record-primary';edit.addEventListener('click',()=>openShipEditor(record.id));actions.prepend(edit);
  }
}

function renderShipFacts(record){
  const data=shipData(record);
  return `<section class="ship-record-overview"><div class="ship-record-title-row"><div><span class="eyebrow">The ship · Schema v2</span><h4>${esc(record.title||'Unnamed ship')}</h4></div><div class="ship-record-keyfacts">${quickFact('Original operator',data.originalOperator||data.shippingLine)}${quickFact('Built by',data.builder)}${quickFact('Launched',data.launchDate)}${quickFact('Fate',data.fate)}</div></div>${SHIP_SECTIONS.map(section=>renderFactSection(section,data,record)).join('')}</section>`;
}

function renderFactSection(section,data,record){
  const values=section.fields.map(([key,labelText])=>[key,labelText,displayShipValue(data[key])]).filter(([, ,value])=>value);
  if(!values.length)return'';
  return `<section class="ship-record-section"><h4>${esc(section.title)}</h4><dl class="ship-record-facts">${values.map(([key,labelText,value])=>`<div><dt>${esc(labelText)}</dt><dd>${esc(value)}${renderEvidenceMarker(record,key)}</dd></div>`).join('')}</dl></section>`;
}
function renderEvidenceMarker(record,key){
  const evidence=record?.fieldEvidence?.[key];if(!evidence)return'';
  const status=typeof evidence==='string'?evidence:evidence.status||evidence.confidence||'evidence attached';
  const sources=Array.isArray(evidence.sources)?evidence.sources.length:0;
  return `<small class="ship-field-evidence">${esc(status)}${sources?` · ${sources} source${sources===1?'':'s'}`:''}</small>`;
}
function quickFact(labelText,value){const shown=displayShipValue(value)||'—';return `<div><span>${esc(labelText)}</span><strong>${esc(shown)}</strong></div>`;}

function openShipEditor(recordId){
  const existing=recordId?readShipRecords().find(r=>r.id===recordId):null;
  const record=existing||{id:'',title:'',type:'ship',status:'review',summary:'',data:{},sources:[],relationships:[],notes:[],fieldEvidence:{},tags:[]};
  const data=shipData(record);
  document.querySelector('#ship-record-editor')?.remove();
  const dialog=document.createElement('dialog');dialog.id='ship-record-editor';
  dialog.innerHTML=`<form class="ship-record-editor-card"><header class="ship-record-editor-header"><div><span class="eyebrow">${existing?'Edit canonical ship record':'New canonical ship record'} · Schema v2</span><h3>${esc(existing?.title||'Create Ship Record')}</h3><p>The record is the ship. Record concrete facts first; provenance and confidence support individual facts underneath.</p></div><button type="button" data-close-ship aria-label="Close">×</button></header>
  <section class="ship-editor-section ship-editor-identity"><h4>Record identity</h4><div class="ship-editor-grid">${input('Ship name','ship-title',record.title||'')}${input('Record ID','ship-id',record.id||'',!!existing)}${select('Status','ship-status',record.status||'review',['draft','review','published','archived'])}${input('Public page','ship-page',data.pageUrl||record.url||'')}</div>${textarea('Summary','ship-summary',record.summary||'',3)}</section>
  ${SHIP_SECTIONS.map(section=>editorSection(section,data)).join('')}
  <details class="ship-editor-advanced"><summary>Evidence, relationships & curatorial notes</summary><p>Attach evidence to individual field keys such as <code>launchDate</code>, <code>grossTonnage</code>, or <code>originalOperator</code>. Evidence explains why a fact is trusted; it does not replace the fact.</p>${textarea('Field evidence — JSON object','ship-field-evidence',JSON.stringify(record.fieldEvidence||{},null,2),9)}${textarea('Sources — JSON array','ship-sources',JSON.stringify(record.sources||[],null,2),7)}${textarea('Relationships — JSON array','ship-relationships',JSON.stringify(record.relationships||[],null,2),7)}${textarea('Curatorial notes — JSON array','ship-notes',JSON.stringify(record.notes||[],null,2),7)}</details>
  <div class="record-editor-error" role="alert" hidden></div><footer class="ship-record-editor-actions"><button type="button" data-close-ship>Cancel</button><button type="submit" class="ship-record-primary">${existing?'Save Ship Record':'Create Ship Record'}</button></footer></form>`;
  document.body.append(dialog);
  dialog.querySelectorAll('[data-close-ship]').forEach(b=>b.addEventListener('click',closeShipEditor));
  dialog.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();saveShipRecord(record,dialog,!!existing);});
  dialog.addEventListener('cancel',closeShipEditor);dialog.showModal();
}

function editorSection(section,data){return `<section class="ship-editor-section"><h4>${esc(section.title)}</h4><div class="ship-editor-grid">${section.fields.map(([key,labelText,kind])=>kind==='multiline'?textarea(labelText,`ship-${key}`,displayEditorValue(data[key],kind),3):input(labelText,`ship-${key}`,displayEditorValue(data[key],kind),'',kind==='list'?'One per line or comma-separated':'')).join('')}</div></section>`;}

async function saveShipRecord(before,dialog,isEdit){
  const errorBox=dialog.querySelector('.record-editor-error');
  try{
    const title=value(dialog,'#ship-title').trim();if(!title)throw new Error('Ship name is required.');
    const id=value(dialog,'#ship-id').trim()||makeShipId(title);const records=readShipRecords();
    if(!isEdit&&records.some(r=>r.id===id))throw new Error(`A Project Record with ID ${id} already exists.`);
    const oldData=before.data&&typeof before.data==='object'?before.data:{};const data={...oldData};
    for(const section of SHIP_SECTIONS){for(const [key,,kind] of section.fields){const raw=value(dialog,`#ship-${key}`).trim();if(raw)data[key]=kind==='list'?parseList(raw):raw;else delete data[key];}}
    const page=value(dialog,'#ship-page').trim();if(page)data.pageUrl=page;else delete data.pageUrl;
    const now=new Date().toISOString();
    const after={...before,id,title,type:'ship',status:value(dialog,'#ship-status')||'review',summary:value(dialog,'#ship-summary').trim(),data,fieldEvidence:parseObject(value(dialog,'#ship-field-evidence'),'Field evidence'),sources:parseArray(value(dialog,'#ship-sources'),'Sources'),relationships:parseArray(value(dialog,'#ship-relationships'),'Relationships'),notes:parseArray(value(dialog,'#ship-notes'),'Curatorial notes'),metadata:{...(before.metadata||{}),shipSchemaVersion:2,[isEdit?'permanentlyEditedAt':'permanentlyCreatedAt']:now},origin:before.origin||{kind:'curatoros-native',createdAt:now}};
    const next=isEdit?records.map(r=>r.id===before.id?after:r):[...records,after];const store=window.CuratorOSProjectRecordsStore;if(!store)throw new Error('Permanent Project Records store is not available.');
    await store.save(next,`${isEdit?'edit':'create'}:${id}`);
    const changes=readShipChanges().filter(c=>c.recordId!==id);changes.push({id:`change:${id}:${Date.now()}`,recordId:id,title,changedAt:now,before:isEdit?before:null,after,fields:isEdit?changedShipFields(before,after):['created'],permanent:true});localStorage.setItem(SHIP_CHANGE_KEY,JSON.stringify(changes));
    closeShipEditor();document.querySelector('#project-record-inspector')?.remove();window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'ship-record-save'}}));
  }catch(error){if(errorBox){errorBox.hidden=false;errorBox.textContent=error instanceof Error?error.message:String(error);}}
}

function shipData(record){
  const d=record?.data&&typeof record.data==='object'?record.data:{};
  const legacyOperator=d.shippingLine||d.line||d.operator||d.company||'';
  return {...d,shippingLine:legacyOperator,originalOperator:d.originalOperator||legacyOperator,operatorHistory:d.operatorHistory||d.operators||legacyOperator?[legacyOperator]:[],builder:d.builder||d.builtBy||d.shipbuilder||'',launchDate:d.launchDate||d.launched||d.launchYear||'',enteredServiceDate:d.enteredServiceDate||d.enteredService||d.serviceStart||'',grossTonnage:d.grossTonnage||d.tonnage||d.grt||'',serviceSpeed:d.serviceSpeed||d.speed||'',shipClass:d.shipClass||d.class||'',sisterShips:d.sisterShips||d.sisters||[]};
}
function isShipRecord(record){return String(record?.type||'').toLowerCase()==='ship'||String(record?.id||'').startsWith('ship:');}
function shipRecordIdFromInspector(dialog){const dt=[...dialog.querySelectorAll('dt')].find(n=>n.textContent.trim().toLowerCase()==='record id');return dt?.nextElementSibling?.textContent?.trim()||'';}
function readShipRecords(){try{const v=JSON.parse(localStorage.getItem(SHIP_CATALOG_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function readShipChanges(){try{const v=JSON.parse(localStorage.getItem(SHIP_CHANGE_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function changedShipFields(a,b){const fields=['title','status','summary','data','fieldEvidence','sources','relationships','notes'];return fields.filter(k=>JSON.stringify(a?.[k]??null)!==JSON.stringify(b?.[k]??null));}
function makeShipId(title){return `ship:${String(title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unnamed'}`;}
function parseList(v){return v.split(/\n|,/).map(x=>x.trim()).filter(Boolean);}
function parseObject(text,labelText){let parsed;try{parsed=JSON.parse(text||'{}')}catch{throw new Error(`${labelText} must be valid JSON.`)}if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error(`${labelText} must be a JSON object.`);return parsed;}
function parseArray(text,labelText){let parsed;try{parsed=JSON.parse(text||'[]')}catch{throw new Error(`${labelText} must be valid JSON.`)}if(!Array.isArray(parsed))throw new Error(`${labelText} must be a JSON array.`);return parsed;}
function displayShipValue(v){if(v===undefined||v===null||v==='')return'';if(Array.isArray(v))return v.map(displayShipValue).filter(Boolean).join(', ');if(typeof v==='object')return Object.values(v).map(displayShipValue).filter(Boolean).join(' · ');return String(v);}
function displayEditorValue(v,kind){if(v===undefined||v===null)return'';if(kind==='list'&&Array.isArray(v))return v.join('\n');return typeof v==='object'?JSON.stringify(v):String(v);}
function value(root,selector){return root.querySelector(selector)?.value||'';}
function input(labelText,id,val,readonly=false,help=''){return `<label><span>${esc(labelText)}</span><input id="${id}" value="${esc(val)}"${readonly?' readonly':''}>${help?`<small>${esc(help)}</small>`:''}</label>`;}
function textarea(labelText,id,val,rows=4){return `<label class="ship-editor-wide"><span>${esc(labelText)}</span><textarea id="${id}" rows="${rows}">${esc(val)}</textarea></label>`;}
function select(labelText,id,val,options){return `<label><span>${esc(labelText)}</span><select id="${id}">${options.map(o=>`<option value="${o}"${o===val?' selected':''}>${esc(o)}</option>`).join('')}</select></label>`;}
function closeShipEditor(){const d=document.querySelector('#ship-record-editor');if(!d)return;try{d.close()}catch{}d.remove();}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
