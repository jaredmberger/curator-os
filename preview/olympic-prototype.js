import './ship-schema-validation-set.js';

const OLYMPIC_CATALOG_KEY='curatoros.rebuilt.catalog';
const OLYMPIC_ID='ship:rms-olympic';

const OLYMPIC_PROTOTYPE={
  id:OLYMPIC_ID,
  title:'RMS Olympic',
  type:'ship',
  status:'review',
  summary:'Lead ship of the Olympic class and a long-serving White Star Line transatlantic liner. This reference record is mapped from the current Ocean Liner Curator RMS Olympic ship guide to test the canonical Ship Record schema against a real vessel.',
  tags:['canonical-prototype','white-star-line','olympic-class'],
  data:{
    prefix:'RMS',
    alternateNames:['HMT Olympic (wartime usage)','Old Reliable (nickname)'],
    originalOperator:'White Star Line',
    operatorHistory:['White Star Line — 1911–1934','Cunard-White Star — 1934–1935'],
    builder:'Harland & Wolff',
    buildLocation:'Belfast, Northern Ireland',
    shipClass:'Olympic class',
    sisterShips:['RMS Titanic','HMHS Britannic'],
    launchDate:'October 20, 1910',
    completedDate:'May 31, 1911',
    enteredServiceDate:'1911',
    maidenVoyageDate:'June 14, 1911 — Southampton → Cherbourg → Queenstown → New York',
    grossTonnage:'45,324 GRT',
    grossTonnageContext:'As entered service; figures vary across later refits.',
    length:'~882 ft',
    lengthContext:'Commonly cited; exact figure depends on measurement convention.',
    beam:'~92 ft',
    beamContext:'Commonly cited; exact figure depends on measurement convention.',
    routes:['Southampton ↔ New York','Often via Cherbourg and Queenstown; ports varied'],
    serviceEras:'1911–1914: White Star Line transatlantic passenger service\nFirst World War: requisitioned troop transport\nPostwar–1934: returned to White Star passenger service with successive refits\n1934–1935: Cunard-White Star service',
    wartimeService:'Requisitioned during the First World War and operated as a troop transport, often styled HMT Olympic in wartime context. In May 1918 Olympic rammed and sank the German submarine U-103 while carrying troops.',
    majorRefits:'Received substantial safety-related modifications after the loss of Titanic and was modernized in stages after the First World War. Exact figures can vary by service era and refit state.',
    majorIncidents:'May 1918 — rammed and sank German submarine U-103 while serving as a troop transport.',
    serviceNotes:'Transatlantic passenger liner; service period 1911–1935. Tonnage, speed and capacity should be treated as versioned values because Olympic was repeatedly modified.',
    serviceEndDate:'April 12, 1935',
    fate:'Sold for scrap; dismantled 1935–1937',
    pageUrl:'https://oceanliners.net/ships/rms-olympic'
  },
  fieldEvidence:{
    originalOperator:{status:'documented',sources:['olc:rms-olympic-guide']},
    builder:{status:'documented',sources:['olc:rms-olympic-guide']},
    launchDate:{status:'documented',sources:['olc:rms-olympic-guide']},
    completedDate:{status:'documented',sources:['olc:rms-olympic-guide']},
    maidenVoyageDate:{status:'documented',sources:['olc:rms-olympic-guide']},
    grossTonnage:{status:'documented with measurement context',sources:['olc:rms-olympic-guide']},
    length:{status:'commonly cited; measurement convention applies',sources:['olc:rms-olympic-guide']},
    beam:{status:'commonly cited; measurement convention applies',sources:['olc:rms-olympic-guide']},
    fate:{status:'documented',sources:['olc:rms-olympic-guide']}
  },
  sources:[
    {id:'olc:rms-olympic-guide',title:'RMS Olympic — Ship Guide | Ocean Liner Curator',url:'https://oceanliners.net/ships/rms-olympic',role:'reference-record source'}
  ],
  relationships:[
    {relationship:'built by',target:'Harland & Wolff'},
    {relationship:'operated by',target:'White Star Line'},
    {relationship:'later operated by',target:'Cunard-White Star'},
    {relationship:'sister ship of',target:'RMS Titanic'},
    {relationship:'sister ship of',target:'HMHS Britannic'}
  ],
  notes:[
    {kind:'schema reference',body:'RMS Olympic is the reference implementation used to evaluate the human-facing canonical Ship Record schema.'},
    {kind:'measurement caution',body:'Tonnage, speed and capacity vary across refits and should be represented with service-era or measurement context rather than as timeless values.'}
  ],
  metadata:{shipSchemaVersion:2,canonicalPrototype:true,prototypeSource:'https://oceanliners.net/ships/rms-olympic'},
  origin:{kind:'curatoros-reference-record',source:'Ocean Liner Curator RMS Olympic ship guide'}
};

const observer=new MutationObserver(enhanceOlympicPrototypeControls);
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('curatoros:records-changed',enhanceOlympicPrototypeControls);
setTimeout(enhanceOlympicPrototypeControls,0);

function enhanceOlympicPrototypeControls(){
  const panel=document.querySelector('.pending-change-panel');
  if(!panel||panel.dataset.olympicPrototypeEnhanced)return;
  panel.dataset.olympicPrototypeEnhanced='true';
  const actions=panel.querySelector('.pending-change-actions');if(!actions)return;
  const existing=readRecords().find(record=>record.id===OLYMPIC_ID);
  const button=document.createElement('button');button.type='button';button.dataset.olympicPrototype='true';
  if(existing&&!existing.metadata?.canonicalPrototype){
    button.textContent='RMS Olympic canonical record already exists';button.disabled=true;
  }else if(existing?.metadata?.shipSchemaVersion>=2){
    button.textContent='RMS Olympic schema v2 loaded';button.disabled=true;
  }else{
    button.textContent=existing?'Upgrade RMS Olympic reference to v2':'Install RMS Olympic reference record';
    button.addEventListener('click',()=>saveReference(existing));
  }
  actions.prepend(button);
  const note=document.createElement('p');note.className='olympic-prototype-note';
  note.innerHTML='<strong>Schema reference:</strong> RMS Olympic is the concrete test case for Ship Record schema v2. Installation now uses the permanent Project Records store.';
  panel.querySelector('div')?.append(note);markPrototypeCard();
}

async function saveReference(existing){
  const store=window.CuratorOSProjectRecordsStore;if(!store)return alert('Permanent Project Records store is not available.');
  const records=readRecords();
  if(existing&&!existing.metadata?.canonicalPrototype)return;
  const next=existing?records.map(record=>record.id===OLYMPIC_ID?structuredClone(OLYMPIC_PROTOTYPE):record):[...records,structuredClone(OLYMPIC_PROTOTYPE)];
  try{
    await store.save(next,existing?'upgrade:ship:rms-olympic-schema-v2':'install:ship:rms-olympic-schema-v2');
    window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'olympic-schema-v2'}}));
  }catch(error){alert(`RMS Olympic could not be saved permanently. ${error instanceof Error?error.message:String(error)}`);}
}

function markPrototypeCard(){
  const button=document.querySelector(`[data-record-id="${OLYMPIC_ID}"]`);if(!button||button.dataset.prototypeMarked)return;
  button.dataset.prototypeMarked='true';const badges=button.querySelector('.badges');
  if(badges)badges.insertAdjacentHTML('beforeend','<span class="badge">Schema reference</span>');
}
function readRecords(){try{const value=JSON.parse(localStorage.getItem(OLYMPIC_CATALOG_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[];}}
