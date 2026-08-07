const OLYMPIC_CATALOG_KEY='curatoros.rebuilt.catalog';
const OLYMPIC_ID='ship:rms-olympic';

const OLYMPIC_PROTOTYPE={
  id:OLYMPIC_ID,
  title:'RMS Olympic',
  type:'ship',
  status:'review',
  summary:'Lead ship of the Olympic class and a long-serving White Star Line transatlantic liner. This prototype is mapped from the current Ocean Liner Curator RMS Olympic ship guide so the canonical Ship Record can be evaluated against a real vessel.',
  tags:['canonical-prototype','white-star-line','olympic-class'],
  data:{
    prefix:'RMS',
    shippingLine:'White Star Line (1911–1934); Cunard-White Star (1934–1935)',
    builder:'Harland & Wolff',
    buildLocation:'Belfast, Northern Ireland',
    shipClass:'Olympic class',
    sisterShips:['RMS Titanic','HMHS Britannic'],
    launchDate:'October 20, 1910',
    completedDate:'May 31, 1911',
    enteredServiceDate:'1911',
    maidenVoyageDate:'June 14, 1911 — Southampton → Cherbourg → Queenstown → New York',
    grossTonnage:'45,324 GRT (as entered service; figures vary across refits)',
    length:'~882 ft (commonly cited; depends on measurement conventions)',
    beam:'~92 ft (commonly cited; depends on measurement conventions)',
    routes:['Southampton ↔ New York','Often via Cherbourg and Queenstown; ports varied'],
    wartimeService:'Requisitioned during the First World War and operated as a troop transport, often styled HMT Olympic in wartime context. In May 1918 Olympic rammed and sank the German submarine U-103 while carrying troops.',
    majorRefits:'Received substantial safety-related modifications after the loss of Titanic and was modernized in stages after the First World War. Exact figures can vary by service era and refit state.',
    serviceNotes:'Transatlantic passenger liner; service period 1911–1935. Common nickname: “Old Reliable.” The guide treats tonnage, speed and capacity as versioned values because Olympic was repeatedly modified.',
    serviceEndDate:'April 12, 1935',
    fate:'Sold for scrap; dismantled 1935–1937',
    pageUrl:'https://oceanliners.net/ships/rms-olympic'
  },
  sources:[
    {title:'RMS Olympic — Ship Guide | Ocean Liner Curator',url:'https://oceanliners.net/ships/rms-olympic',role:'prototype source'}
  ],
  relationships:[
    {relationship:'built by',target:'Harland & Wolff'},
    {relationship:'operated by',target:'White Star Line'},
    {relationship:'later operated by',target:'Cunard-White Star'},
    {relationship:'sister ship of',target:'RMS Titanic'},
    {relationship:'sister ship of',target:'HMHS Britannic'}
  ],
  notes:[
    {kind:'prototype',body:'This is a local evaluation record for the canonical Ship Record interface. It is intentionally not presented as permanently stored institutional data until CuratorOS permanent storage is repaired.'},
    {kind:'measurement caution',body:'The source guide explicitly notes that tonnage, speed and capacity vary across refits and should be treated as versioned rather than timeless figures.'}
  ],
  metadata:{shipSchemaVersion:1,canonicalPrototype:true,prototypeSource:'https://oceanliners.net/ships/rms-olympic'},
  origin:{kind:'curatoros-prototype',source:'Ocean Liner Curator RMS Olympic ship guide'}
};

const observer=new MutationObserver(()=>enhanceOlympicPrototypeControls());
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('curatoros:records-changed',enhanceOlympicPrototypeControls);
setTimeout(enhanceOlympicPrototypeControls,0);

function enhanceOlympicPrototypeControls(){
  const panel=document.querySelector('.pending-change-panel');
  if(!panel||panel.dataset.olympicPrototypeEnhanced)return;
  panel.dataset.olympicPrototypeEnhanced='true';
  const actions=panel.querySelector('.pending-change-actions');
  if(!actions)return;
  const button=document.createElement('button');
  button.type='button';
  const exists=readRecords().some(record=>record.id===OLYMPIC_ID);
  button.textContent=exists?'RMS Olympic prototype loaded':'Load RMS Olympic prototype';
  button.disabled=exists;
  button.dataset.olympicPrototype='true';
  button.addEventListener('click',loadPrototype);
  actions.prepend(button);

  const note=document.createElement('p');
  note.className='olympic-prototype-note';
  note.innerHTML='<strong>Reference prototype:</strong> Load RMS Olympic into the browser cache to inspect the new Ship Record with real ship data. This does not claim permanent storage.';
  panel.querySelector('div')?.append(note);
  markPrototypeCard();
}

function loadPrototype(){
  const records=readRecords();
  if(records.some(record=>record.id===OLYMPIC_ID))return;
  localStorage.setItem(OLYMPIC_CATALOG_KEY,JSON.stringify([...records,structuredClone(OLYMPIC_PROTOTYPE)]));
  window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'olympic-prototype'}}));
}

function markPrototypeCard(){
  const button=document.querySelector(`[data-record-id="${OLYMPIC_ID}"]`);
  if(!button||button.dataset.prototypeMarked)return;
  button.dataset.prototypeMarked='true';
  const badges=button.querySelector('.badges');
  if(badges)badges.insertAdjacentHTML('beforeend','<span class="badge">Reference prototype</span>');
}

function readRecords(){
  try{const value=JSON.parse(localStorage.getItem(OLYMPIC_CATALOG_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[];}
}
