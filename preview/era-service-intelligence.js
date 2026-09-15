const BUTTON=document.querySelector('#knowledge-intelligence');
const APP=document.querySelector('#app');
const CATALOG_KEY='curatoros.rebuilt.catalog';
const FEED_URL='https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-eras.json';

function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function norm(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function normShip(value){return norm(value).replace(/^(rms|ss|s s|mv|ms|hmhs|hmt|hms|ts|rmmv|qsmv)\s+/,'').replace(/\bship guide\b/g,'').trim();}
function records(){try{const value=JSON.parse(localStorage.getItem(CATALOG_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function title(record){return record?.title||record?.name||record?.data?.name||record?.id||'Untitled record'}
function firstYear(value){return String(value??'').match(/\b(?:18|19|20)\d{2}\b/)?.[0]||null}
function lastYear(value){const years=[...String(value??'').matchAll(/\b(?:18|19|20)\d{2}\b/g)].map(m=>m[0]);return years.at(-1)||null}

function matchShip(site,ships){
  let matches=ships.filter(record=>norm(title(record))===norm(site.name));
  if(matches.length===1)return matches[0];
  matches=ships.filter(record=>normShip(title(record))===normShip(site.name));
  return matches.length===1?matches[0]:null;
}

function localStart(record){
  const d=record?.data||{};
  return firstYear(d.maidenVoyage||d.enteredService||d.serviceStart||d.completed||d.completion||d.launchDate||d.launched||d.built||'');
}
function localEnd(record){
  const d=record?.data||{};
  return lastYear(d.serviceEnd||d.retired||d.withdrawn||d.fate||d.servicePeriod||d.career||'');
}

function reconcile(payload){
  const localShips=records().filter(record=>record?.type==='ship'||String(record?.id||'').startsWith('ship:'));
  const result={matched:0,unmatched:[],startMissing:[],startMismatch:[],endMissing:[],endMismatch:[],startAgreement:0,endAgreement:0};
  for(const site of payload?.ships||[]){
    const local=matchShip(site,localShips);
    if(!local){result.unmatched.push(site);continue}
    result.matched++;
    if(site.serviceStartYear){
      const actual=localStart(local);
      if(!actual)result.startMissing.push({site,local,expected:site.serviceStartYear});
      else if(String(actual)===String(site.serviceStartYear))result.startAgreement++;
      else result.startMismatch.push({site,local,expected:site.serviceStartYear,actual});
    }
    if(site.serviceEndYear){
      const actual=localEnd(local);
      if(!actual)result.endMissing.push({site,local,expected:site.serviceEndYear});
      else if(String(actual)===String(site.serviceEndYear))result.endAgreement++;
      else result.endMismatch.push({site,local,expected:site.serviceEndYear,actual});
    }
  }
  return result;
}

function reviewList(items,kind){
  if(!items.length)return '<p class="empty">No items in this category.</p>';
  return `<div class="intelligence-list">${items.slice(0,30).map(item=>{
    const detail=kind==='unmatched'?'No matching CuratorOS ship record':kind==='start-missing'?`Site service start: ${item.expected}`:kind==='end-missing'?`Site service end: ${item.expected}`:`Site: ${item.expected} · CuratorOS: ${item.actual}`;
    return `<article><div><strong>${esc(item.site?.name||item.name||'Unknown ship')}</strong><small>${esc(detail)}</small></div><span class="badge">Review</span></article>`;
  }).join('')}</div>`;
}

function saveCollection(group,type){
  const local=records();
  const wanted=new Set((group.ships||[]).map(ship=>normShip(ship.name)));
  const ids=local.filter(record=>(record?.type==='ship'||String(record?.id||'').startsWith('ship:'))&&wanted.has(normShip(title(record)))).map(record=>record.id).filter(Boolean);
  const key='curatoros.knowledge.collections';
  let collections=[];try{collections=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(collections))collections=[]}catch{}
  collections.push({id:`${type}-${norm(group.name).replace(/\s+/g,'-')}-${Date.now()}`,title:type==='era'?`${group.name} — service-era cluster`:`${group.name} — service-start decade`,type:`${type}-cluster`,recordIds:[...new Set(ids)],createdAt:new Date().toISOString(),source:'era-service-intelligence'});
  localStorage.setItem(key,JSON.stringify(collections));
  window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'era-service-intelligence-collection'}}));
}

async function install(){
  if(!APP||document.querySelector('#site-era-service-intelligence'))return;
  const anchor=document.querySelector('#site-yard-intelligence')||document.querySelector('#site-class-sister-intelligence')||document.querySelector('#site-operator-intelligence')||document.querySelector('#site-builder-intelligence')||document.querySelector('.intelligence-metrics');
  if(!anchor)return;
  const panel=document.createElement('section');panel.className='panel';panel.id='site-era-service-intelligence';panel.innerHTML='<span class="eyebrow">Temporal knowledge feed</span><h4>Era & service-period intelligence</h4><p>Loading structured service chronology from Ocean Liner Curator…</p>';anchor.insertAdjacentElement('afterend',panel);
  try{
    const response=await fetch(FEED_URL,{cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();const r=reconcile(payload);const s=payload.summary||{};const eras=(payload.eras||[]).slice(0,10);const decades=(payload.decades||[]).slice(0,10);
    panel.innerHTML=`<span class="eyebrow">Temporal knowledge feed</span><h4>Era & service-period intelligence</h4><p>Service starts come from structured launch/completion/maiden-service evidence; service ends are used only when explicitly documented. Era labels are analytical groupings, not replacements for the underlying dates.</p><section class="metrics intelligence-metrics"><article><strong>${Number(s.guidesWithServiceStart||0)}</strong><span>Guides with service start</span></article><article><strong>${Number(s.guidesWithExplicitServiceEnd||0)}</strong><span>Explicit service ends</span></article><article><strong>${Number(s.eras||0)}</strong><span>Analytical eras</span></article><article><strong>${Number(s.decades||0)}</strong><span>Start decades</span></article><article><strong>${r.matched}</strong><span>Local ships matched</span></article><article><strong>${r.startMismatch.length+r.endMismatch.length}</strong><span>Date mismatches</span></article></section><details><summary>Missing local service-start dates (${r.startMissing.length})</summary>${reviewList(r.startMissing,'start-missing')}</details><details><summary>Service-start mismatches (${r.startMismatch.length})</summary>${reviewList(r.startMismatch,'start-mismatch')}</details><details><summary>Missing local service-end dates (${r.endMissing.length})</summary>${reviewList(r.endMissing,'end-missing')}</details><details><summary>Service-end mismatches (${r.endMismatch.length})</summary>${reviewList(r.endMismatch,'end-mismatch')}</details><details><summary>Unmatched site ships (${r.unmatched.length})</summary>${reviewList(r.unmatched,'unmatched')}</details><h4 style="margin-top:1.2rem">Era clusters</h4><div class="intelligence-list">${eras.map(group=>`<article><div><strong>${esc(group.name)}</strong><small>Grouped by documented service-start year</small></div><span>${Number(group.shipCount||0)} ships</span><button type="button" class="secondary" data-era="${esc(group.name)}">Save collection</button></article>`).join('')}</div><details style="margin-top:1rem"><summary>Service-start decades</summary><div class="intelligence-list">${decades.map(group=>`<article><div><strong>${esc(group.name)}</strong><small>Documented service starts</small></div><span>${Number(group.shipCount||0)} ships</span><button type="button" class="secondary" data-decade="${esc(group.name)}">Save collection</button></article>`).join('')}</div></details><small>Dataset generated: ${esc(payload.generatedAt||'unknown')}</small>`;
    panel.querySelectorAll('[data-era]').forEach(button=>button.addEventListener('click',()=>{const group=(payload.eras||[]).find(g=>g.name===button.dataset.era);if(!group)return;saveCollection(group,'era');button.textContent='Saved';button.disabled=true;}));
    panel.querySelectorAll('[data-decade]').forEach(button=>button.addEventListener('click',()=>{const group=(payload.decades||[]).find(g=>g.name===button.dataset.decade);if(!group)return;saveCollection(group,'decade');button.textContent='Saved';button.disabled=true;}));
  }catch{panel.innerHTML='<span class="eyebrow">Temporal knowledge feed</span><h4>Era & service-period intelligence</h4><p class="empty">The published era feed is temporarily unavailable. Local Corpus Intelligence remains fully functional.</p>'}
}

BUTTON?.addEventListener('click',()=>setTimeout(install,0));
window.addEventListener('curatoros:records-changed',()=>{if(BUTTON?.classList.contains('active')){document.querySelector('#site-era-service-intelligence')?.remove();setTimeout(install,0)}});
