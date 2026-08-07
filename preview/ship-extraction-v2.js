const SESSION_KEY='curatoros.extraction.lastSession';
const CATALOG_KEY='curatoros.rebuilt.catalog';

const FIELD_TRANSLATION={
  builder:'builder',
  operator:'originalOperator',
  launchDate:'launchDate',
  maidenVoyage:'maidenVoyageDate',
  grossTonnage:'grossTonnage',
  length:'length',
  beam:'beam',
  speed:'serviceSpeed',
  yardNumber:'yardNumber',
  country:'registry',
  routeFocus:'routes',
  fate:'fate',
  class:'shipClass',
  passengers:'passengerCapacity',
  crew:'crew'
};

const observer=new MutationObserver(enhanceShipExtractionApproval);
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('curatoros:records-changed',enhanceShipExtractionApproval);
setTimeout(enhanceShipExtractionApproval,0);

function enhanceShipExtractionApproval(){
  const button=document.querySelector('#approve-extraction');
  const type=document.querySelector('#extract-type')?.value;
  if(!button||type!=='ship'||button.dataset.canonicalShipApproval==='true')return;

  const replacement=button.cloneNode(true);
  replacement.dataset.canonicalShipApproval='true';
  replacement.textContent='Save Canonical Ship Record';
  replacement.addEventListener('click',saveCanonicalShipRecord);
  button.replaceWith(replacement);

  const panel=replacement.closest('.extraction-approve');
  const copy=panel?.querySelector('p');
  if(copy)copy.textContent='Selected facts will be mapped into Ship Record schema v2 and saved to the permanent Project Records store after review. The ship guide Key Facts block is treated as the primary structured source; unknown or unsupported fields remain blank.';
}

async function saveCanonicalShipRecord(){
  const session=readJson(SESSION_KEY,null);
  if(!session)return alert('No extraction session is available.');

  session.recordTitle=document.querySelector('#extract-title')?.value.trim()||session.recordTitle;
  session.status=document.querySelector('#extract-status')?.value||session.status||'review';

  const selected=(session.candidates||[]).filter(candidate=>candidate.include&&candidate.field!=='unmapped'&&String(candidate.normalizedValue||'').trim());
  if(!selected.length)return alert('Select at least one mapped candidate before saving.');

  const records=readRecords();
  const existing=findExistingShip(records,session);
  const id=existing?.id||`ship:${slug(session.recordTitle)}`;
  const now=new Date().toISOString();
  const sourceId=`source.page-${slug(session.url||session.filename||session.recordTitle)}`;
  const source={id:sourceId,title:`Website page: ${session.title||session.recordTitle}`,url:session.url||undefined,sourceType:'website-page'};

  const record=existing?clone(existing):{
    id,
    title:session.recordTitle,
    type:'ship',
    status:session.status,
    summary:'',
    tags:[],
    data:{},
    fieldEvidence:{},
    relationships:[],
    sources:[],
    notes:[],
    metadata:{shipSchemaVersion:2},
    origin:{kind:'webpage-extraction',source:session.url||session.filename||'local HTML'}
  };

  record.id=id;
  record.title=session.recordTitle;
  record.type='ship';
  record.status=session.status;
  record.data=record.data&&typeof record.data==='object'?record.data:{};
  record.fieldEvidence=record.fieldEvidence&&typeof record.fieldEvidence==='object'?record.fieldEvidence:{};
  record.relationships=Array.isArray(record.relationships)?record.relationships:[];
  record.sources=Array.isArray(record.sources)?record.sources:[];
  record.notes=Array.isArray(record.notes)?record.notes:[];
  record.metadata={...(record.metadata||{}),shipSchemaVersion:2,lastExtractedAt:now,extractionState:'reviewed'};

  for(const candidate of selected){
    if(candidate.field==='summary'){
      record.summary=String(candidate.normalizedValue).trim();
      continue;
    }
    const targetField=targetFieldForCandidate(candidate);
    if(!targetField)continue;
    const value=normalizeForShipField(targetField,candidate.normalizedValue);
    if(value===undefined||value===null||value===''||(Array.isArray(value)&&!value.length))continue;

    mergeShipValue(record.data,targetField,value);
    record.fieldEvidence[targetField]={
      status:evidenceStatus(candidate),
      sources:[sourceId],
      extractedFrom:{label:candidate.rawLabel||targetField,sourceKind:candidate.sourceKind||'page'}
    };
    attachRelationship(record,targetField,candidate,value,sourceId);
  }

  if(session.url)record.data.pageUrl=session.url;
  if(!record.sources.some(item=>(typeof item==='string'?item:item?.id)===sourceId))record.sources.push(source);
  record.notes.push({kind:'extraction',body:`Ship facts extracted and reviewed from ${session.url||session.filename||'source HTML'} on ${now.slice(0,10)}. Ship-guide Key Facts were parsed as structured facts; unsupported fields were left blank.`});

  const next=existing?records.map(item=>item.id===existing.id?record:item):[...records,record];
  const store=window.CuratorOSProjectRecordsStore;
  if(!store)return alert('Permanent Project Records store is not available.');

  try{
    await store.save(next,`${existing?'extract-update':'extract-create'}:${id}`);
    session.recordId=id;
    session.existingRecordId=id;
    session.approvedAt=now;
    session.canonicalShipSchemaVersion=2;
    localStorage.setItem(SESSION_KEY,JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'canonical-ship-extraction'}}));
    alert(`${record.title} was saved as a permanent canonical Ship Record (schema v2).`);
  }catch(error){
    alert(`The Ship Record could not be saved permanently. ${error instanceof Error?error.message:String(error)}`);
  }
}

function targetFieldForCandidate(candidate){
  const label=String(candidate.rawLabel||'').toLowerCase();
  if(/operator later|later operator|owner\s*\/\s*later operator/.test(label))return'operatorHistory';
  if(/completed/.test(label))return'completedDate';
  if(/service period/.test(label))return'serviceNotes';
  if(/service type/.test(label))return'serviceNotes';
  if(/service nickname|nickname/.test(label))return'alternateNames';
  return FIELD_TRANSLATION[candidate.field]||'';
}

function attachRelationship(record,field,candidate,value,sourceId){
  if(field!=='builder'&&field!=='originalOperator')return;
  const relationship=field==='builder'?'built by':'operated by';
  const target=candidate.entityTarget||String(value);
  if(record.relationships.some(item=>item.relationship===relationship&&item.target===target))return;
  record.relationships.push({relationship,target,confidence:candidate.confidence||'probable',sourceIds:[sourceId],note:`Extracted from ${candidate.rawLabel||field}`});
}

function mergeShipValue(data,field,value){
  if(field==='serviceNotes'){
    const incoming=Array.isArray(value)?value.join(' · '):String(value);
    const current=String(data[field]||'').trim();
    if(!current)data[field]=incoming;
    else if(!current.includes(incoming))data[field]=`${current} · ${incoming}`;
    return;
  }
  if(field==='operatorHistory'||field==='alternateNames'||field==='routes'){
    const incoming=Array.isArray(value)?value:[value];
    const current=Array.isArray(data[field])?data[field]:data[field]?[data[field]]:[];
    data[field]=[...new Set([...current,...incoming].map(item=>String(item).trim()).filter(Boolean))];
    return;
  }
  data[field]=value;
}

function normalizeForShipField(field,value){
  const text=String(value??'').replace(/\s+/g,' ').trim();
  if(!text)return'';
  if(field==='routes'||field==='operatorHistory'||field==='alternateNames')return text.split(/\s*[;|]\s*/).map(item=>item.trim()).filter(Boolean);
  return text;
}

function evidenceStatus(candidate){
  if(candidate.sourceKind==='table')return'documented from ship guide fact table';
  const confidence=String(candidate.confidence||'probable').toLowerCase();
  if(confidence==='high')return'documented';
  if(confidence==='low')return'needs review';
  return'probable';
}

function findExistingShip(records,session){
  const requested=session.existingRecordId||session.recordId||'';
  const normalizedTitle=entityKey(session.recordTitle);
  return records.find(record=>record.id===requested)||records.find(record=>record.type==='ship'&&session.url&&record.data?.pageUrl===session.url)||records.find(record=>record.type==='ship'&&entityKey(record.title)===normalizedTitle)||null;
}

function readRecords(){const value=readJson(CATALOG_KEY,[]);return Array.isArray(value)?value:[];}
function readJson(key,fallback){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback;}catch{return fallback;}}
function clone(value){return JSON.parse(JSON.stringify(value));}
function entityKey(value){return String(value??'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();}
function slug(value){return String(value??'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unnamed';}
