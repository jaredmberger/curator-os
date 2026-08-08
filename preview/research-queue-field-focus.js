const FOCUS_KEY='curatoros.recordFieldFocus';
const SECTION_BY_FIELD={
  originalOperator:'Core identity',builder:'Core identity',launchDate:'Construction & dates',completedDate:'Construction & dates',maidenVoyageDate:'Construction & dates',grossTonnage:'Dimensions & machinery',length:'Dimensions & machinery',beam:'Dimensions & machinery',routes:'Capacity & service',serviceEras:'Capacity & service',fate:'End of service & fate'
};
const observer=new MutationObserver(()=>applyFocus());
observer.observe(document.body,{childList:true,subtree:true});
setTimeout(applyFocus,0);

function readFocus(){try{return JSON.parse(sessionStorage.getItem(FOCUS_KEY)||'null')}catch{return null}}
function applyFocus(){
  const focus=readFocus();if(!focus?.field)return;
  const inspector=document.querySelector('#project-record-inspector');
  const overview=inspector?.querySelector('.ship-record-overview');
  if(!inspector||!overview||inspector.dataset.researchFieldFocused)return;
  const currentTitle=overview.querySelector('.ship-record-title-row h4')?.textContent?.trim()||'';
  if(!currentTitle)return;
  let target=[...overview.querySelectorAll('.ship-record-facts > div')].find(row=>row.querySelector('dt')?.textContent?.trim().toLowerCase()===(focus.label||'').replace(/ relationship$/i,'').trim().toLowerCase());
  if(!target){
    const sectionTitle=SECTION_BY_FIELD[focus.field];
    const section=[...overview.querySelectorAll('.ship-record-section')].find(s=>s.querySelector('h4')?.textContent?.trim()===sectionTitle);
    const list=section?.querySelector('.ship-record-facts');
    if(list){target=document.createElement('div');target.className='research-field-focus research-field-missing';target.innerHTML=`<dt>${esc(focus.label||focus.field)}</dt><dd>Not recorded <small>Research Queue target</small></dd>`;list.append(target);}
  }
  if(!target)return;
  inspector.dataset.researchFieldFocused='true';
  target.classList.add('research-field-focus');
  const note=document.createElement('div');note.className='research-field-focus-note';note.textContent=`Research Queue · ${focus.kind==='evidence-gap'?'Evidence needed':focus.kind==='relationship-gap'?'Relationship needed':'Missing fact'}`;target.prepend(note);
  sessionStorage.removeItem(FOCUS_KEY);
  requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth',block:'center'}));
  setTimeout(()=>target.classList.add('research-field-focus-settled'),2200);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

const style=document.createElement('style');
style.textContent=`
  .research-field-focus{position:relative;border:1px solid rgba(191,164,106,.82)!important;border-radius:10px;padding:.7rem!important;background:rgba(191,164,106,.12)!important;box-shadow:0 0 0 3px rgba(191,164,106,.08);transition:background .8s ease,box-shadow .8s ease}
  .research-field-focus-settled{background:rgba(191,164,106,.06)!important;box-shadow:none}
  .research-field-focus-note{grid-column:1/-1;margin-bottom:.45rem;color:var(--accent,#bfa46a);font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .research-field-missing dd{font-style:italic;opacity:.78}.research-field-missing dd small{display:block;margin-top:.2rem;color:var(--accent,#bfa46a);font-style:normal}
`;
document.head.append(style);
