const VALIDATION_CATALOG_KEY='curatoros.rebuilt.catalog';

const VALIDATION_SHIPS=[
  {
    id:'ship:rms-carpathia',title:'RMS Carpathia',type:'ship',status:'review',
    summary:'Cunard working liner whose 1912 rescue of Titanic survivors made an otherwise practical passenger ship historically exceptional.',
    tags:['schema-validation','ordinary-liner','cunard'],
    data:{
      prefix:'RMS',originalOperator:'Cunard Line',operatorHistory:['Cunard Line'],builder:'C.S. Swan & Hunter',buildLocation:'Wallsend-on-Tyne, England',
      keelLaidDate:'10 September 1901',launchDate:'6 August 1902',completedDate:'February 1903 (commonly cited)',enteredServiceDate:'1903',
      maidenVoyageDate:'5 May 1903 — Liverpool → Queenstown → Boston',grossTonnage:'13,555 GRT',grossTonnageContext:'Commonly cited figure',
      length:'558 ft',lengthContext:'Commonly cited',beam:'64 ft',beamContext:'Commonly cited',draft:'about 34 ft',
      propulsion:'Twin-screw',engines:'Two quadruple-expansion steam engines (commonly cited)',serviceSpeed:'about 14 knots (commonly cited)',
      passengerCapacity:'about 1,800 total as built (commonly cited)',routes:['Liverpool ↔ Boston','Later seasonal Liverpool ↔ New York','Winter Mediterranean service'],
      serviceEras:'1903–1912: regular Cunard North Atlantic service.\n15 April 1912: rescued Titanic survivors.\n1912–1918: returned to commercial service until wartime loss.',
      majorIncidents:'15 April 1912 — rescued survivors of RMS Titanic.',serviceEndDate:'17 July 1918',fate:'Torpedoed and sunk by SM U-55',fateDate:'17 July 1918',fateLocation:'south of Ireland',
      pageUrl:'https://oceanliners.net/ships/rms-carpathia'
    },
    fieldEvidence:{
      originalOperator:{status:'documented',sources:['https://oceanliners.net/ships/rms-carpathia']},
      launchDate:{status:'documented',sources:['https://oceanliners.net/ships/rms-carpathia']},
      grossTonnage:{status:'commonly cited',sources:['https://oceanliners.net/ships/rms-carpathia']},
      fate:{status:'documented',sources:['https://oceanliners.net/ships/rms-carpathia']}
    },
    sources:[{title:'RMS Carpathia — Ship Guide | Ocean Liner Curator',url:'https://oceanliners.net/ships/rms-carpathia',role:'validation source'}],
    relationships:[{relationship:'operated by',target:'Cunard Line'},{relationship:'built by',target:'C.S. Swan & Hunter'},{relationship:'involved in event',target:'RMS Titanic rescue'}],
    notes:[{kind:'validation',body:'Straightforward liner case: tests whether a conventional single-operator record remains clear and compact.'}],
    metadata:{shipSchemaVersion:2,schemaValidationCase:'ordinary-liner'},origin:{kind:'curatoros-validation',source:'Ocean Liner Curator RMS Carpathia ship guide'}
  },
  {
    id:'ship:ss-malta-1865',title:'SS Malta',type:'ship',status:'review',
    summary:'Mid-Victorian Cunard steamship representing the smaller iron screw liners that carried passengers, mails, and cargo before the later express-liner era.',
    tags:['schema-validation','sparse-record','cunard','1865'],
    data:{
      prefix:'SS',originalOperator:'Cunard Line',operatorHistory:['Cunard Line'],builder:'J. & G. Thomson',buildLocation:'Glasgow, Scotland',launchDate:'1865',
      serviceEras:'Mid-Victorian Cunard service carrying passengers, mails, and cargo across the North Atlantic.',
      pageUrl:'https://oceanliners.net/ships/ss-malta'
    },
    fieldEvidence:{
      originalOperator:{status:'documented',sources:['https://oceanliners.net/ships/ships']},
      builder:{status:'documented',sources:['https://oceanliners.net/ships/ships']},
      launchDate:{status:'year documented; exact date not asserted',sources:['https://oceanliners.net/ships/ships']}
    },
    sources:[{title:'Ship Archive — SS Malta entry | Ocean Liner Curator',url:'https://oceanliners.net/ships/ships',role:'validation source'}],
    relationships:[{relationship:'operated by',target:'Cunard Line'},{relationship:'built by',target:'J. & G. Thomson'}],
    notes:[{kind:'validation',body:'Sparse-record case: intentionally leaves unsupported dimensions, machinery, capacity, route details, fate, and exact dates blank. Unknown is valid data.'}],
    metadata:{shipSchemaVersion:2,schemaValidationCase:'sparse-record'},origin:{kind:'curatoros-validation',source:'Ocean Liner Curator ship archive entry'}
  },
  {
    id:'ship:ss-leviathan',title:'SS Leviathan',type:'ship',status:'review',
    summary:'German-built giant liner that moved through three distinct identities: Vaterland, USS Leviathan, and SS Leviathan.',
    tags:['schema-validation','multi-operator','renamed-ship','united-states-lines'],
    data:{
      prefix:'SS',alternateNames:['SS Vaterland','USS Leviathan'],originalOperator:'Hamburg America Line (HAPAG)',operatorHistory:['Hamburg America Line (HAPAG) — as Vaterland','United States Navy / U.S. wartime service — as USS Leviathan','United States Lines — as SS Leviathan'],
      builder:'Blohm & Voss',buildLocation:'Hamburg, Germany',launchDate:'3 April 1913',completedDate:'29 April 1914',maidenVoyageDate:'14 May 1914 — as Vaterland',
      grossTonnage:'~54,000+ GRT',grossTonnageContext:'Reported figures vary by period and measurement; German and American phases should not be flattened.',
      length:'~950 ft',lengthContext:'Approximate overall length',routes:['North Atlantic — Vaterland era','New York ↔ Europe, often via Cherbourg / Southampton — U.S. passenger era'],
      serviceEras:'1914: German passenger liner Vaterland.\n1917–1919: seized and operated as U.S. troop transport USS Leviathan.\n1923–1934: American passenger liner SS Leviathan under United States Lines.',
      wartimeService:'Seized by the United States in 1917 and operated as troop transport USS Leviathan during World War I.',
      majorRefits:'Extensively refitted before return to civilian passenger service in the 1920s.',serviceEndDate:'1930s passenger career; intermittent late sailings',
      fate:'Sold for scrap in 1938; broken up at Rosyth, Scotland after World War II',pageUrl:'https://oceanliners.net/ships/ss-leviathan'
    },
    fieldEvidence:{
      alternateNames:{status:'documented',sources:['https://oceanliners.net/ships/ss-leviathan']},
      originalOperator:{status:'documented',sources:['https://oceanliners.net/ships/ss-leviathan']},
      operatorHistory:{status:'documented by service phase',sources:['https://oceanliners.net/ships/ss-leviathan']},
      grossTonnage:{status:'period-dependent',sources:['https://oceanliners.net/ships/ss-leviathan']}
    },
    sources:[{title:'SS Leviathan — Ship Guide | Ocean Liner Curator',url:'https://oceanliners.net/ships/ss-leviathan',role:'validation source'}],
    relationships:[{relationship:'built by',target:'Blohm & Voss'},{relationship:'originally operated by',target:'Hamburg America Line (HAPAG)'},{relationship:'later operated by',target:'United States Lines'},{relationship:'same vessel as',target:'SS Vaterland'},{relationship:'wartime identity',target:'USS Leviathan'}],
    notes:[{kind:'validation',body:'Identity-transition case: tests renamed identities, multiple operators, wartime role, and period-dependent measurements without splitting one physical vessel into unrelated records.'}],
    metadata:{shipSchemaVersion:2,schemaValidationCase:'renamed-multi-operator'},origin:{kind:'curatoros-validation',source:'Ocean Liner Curator SS Leviathan ship guide'}
  }
];

const observer=new MutationObserver(enhanceValidationControls);
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('curatoros:records-changed',enhanceValidationControls);
setTimeout(enhanceValidationControls,0);

function enhanceValidationControls(){
  const panel=document.querySelector('.pending-change-panel');
  if(!panel||panel.dataset.shipValidationEnhanced)return;
  const actions=panel.querySelector('.pending-change-actions');if(!actions)return;
  panel.dataset.shipValidationEnhanced='true';
  const button=document.createElement('button');button.type='button';button.dataset.shipValidationSet='true';button.textContent='Install 3-ship schema validation set';
  button.addEventListener('click',installValidationSet);actions.prepend(button);
  const note=document.createElement('p');note.className='olympic-prototype-note';note.innerHTML='<strong>Schema v2 validation:</strong> Carpathia tests a conventional record; SS Malta tests legitimate unknowns; Leviathan tests renamed identities and operator/service phases.';
  panel.querySelector('div')?.append(note);
}

async function installValidationSet(){
  const store=window.CuratorOSProjectRecordsStore;if(!store)return;
  const records=readRecords();
  const existingIds=new Set(records.map(r=>r.id));
  const additions=VALIDATION_SHIPS.filter(r=>!existingIds.has(r.id));
  if(!additions.length){alert('All three schema validation records already exist.');return;}
  await store.save([...records,...additions],`install:ship-schema-validation:${additions.length}`);
  window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'ship-schema-validation'}}));
}

function readRecords(){try{const value=JSON.parse(localStorage.getItem(VALIDATION_CATALOG_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
