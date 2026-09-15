const BUTTON=document.querySelector('#knowledge-intelligence');
const APP=document.querySelector('#app');
const CATALOG_KEY='curatoros.rebuilt.catalog';
const FEED_URL='https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-yards.json';

function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function norm(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function normShip(value){return norm(value).replace(/^(rms|ss|s s|mv|ms|hmhs|hmt|hms|ts|rmmv|qsmv)\s+/,'').replace(/\bship guide\b/g,'').trim();}
function records(){try{const value=JSON.parse(localStorage.getItem(CATALOG_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function title(record){return record?.title||record?.name||record?.data?.name||record?.id||'Untitled record'}
function relType(rel){return rel?.relationship||rel?.type||''}
function relTarget(rel){return rel?.target||rel?.id||rel?.recordId||''}
function values(value){if(Array.isArray(value))return value.flatMap(values).filter(Boolean);if(value&&typeof value==='object')return values(value.name||value.value||value.label||'');const text=String(value??'').trim();return text?[text]:[]}

function matchShip(site,ships){
  let matches=ships.filter(record=>norm(title(record))===norm(site.name));
  if(matches.length===1)return matches[0];
  matches=ships.filter(record=>normShip(title(record))===normShip(site.name));
  return matches.length===1?matches[0]:null;
}

function reconcile(payload){
  const all=records();
  const ships=all.filter(record=>record?.type==='ship'||String(record?.id||'').startsWith('ship:'));
  const byId=new Map(all.map(record=>[record?.id,record]));
  const result={matched:0,unmatched:[],fieldMissing:[],fieldMismatch:[],relationshipMissing:[],relationshipMismatch:[],agreement:0};
  for(const site of payload?.ships||[]){
    if(!site.assignments?.length)continue;
    const local=matchShip(site,ships);
    if(!local){result.unmatched.push(site);continue}
    result.matched++;
    const expected=[...new Set(site.assignments.map(a=>a.location).filter(Boolean))];
    const localField=values(local?.data?.yard||local?.data?.shipyard||local?.data?.builderLocation||local?.data?.buildLocation||local?.data?.builtAt);
    if(localField.length){
      const ok=expected.every(location=>localField.some(value=>norm(value)===norm(location)));
      if(ok)result.agreement++;else result.fieldMismatch.push({site,local,expected,actual:localField});
    }else result.fieldMissing.push({site,local,expected});

    const rels=(local?.relationships||[]).filter(rel=>relType(rel)==='built_at');
    if(!rels.length){result.relationshipMissing.push({site,local,expected});continue}
    const targets=rels.map(rel=>{const target=relTarget(rel);return byId.get(target)?title(byId.get(target)):target}).filter(Boolean);
    const ok=expected.every(location=>targets.some(value=>norm(value)===norm(location)));
    if(!ok)result.relationshipMismatch.push({site,local,expected,actual:targets});
  }
  return result;
}

function reviewList(items,kind){
  if(!items.length)return '<p class="empty">No items in this category.</p>';
  return `<div class="intelligence-list">${items.slice(0,30).map(item=>{
    const expected=(item.expected||[]).join(' · ');const actual=(item.actual||[]).join(' · ');
    const detail=kind==='unmatched'?'No matching CuratorOS ship record':kind==='field-missing'?`Documented yard: ${expected}`:kind==='relationship-missing'?`Expected built_at: ${expected}`:`Site: ${expected}${actual?` · CuratorOS: ${actual}`:''}`;
    return `<article><div><strong>${esc(item.site?.name||'Unknown ship')}</strong><small>${esc(detail)}</small></div><span class="badge">Review</span></article>`;
  }).join('')}</div>`;
}

function saveCollection(yard){
  const local=records();
  const wanted=new Set((yard.ships||[]).map(ship=>normShip(ship.name)));
  const shipIds=local.filter(record=>(record?.type==='ship'||String(record?.id||'').startsWith('ship:'))&&wanted.has(normShip(title(record)))).map(record=>record.id).filter(Boolean);
  const key='curatoros.knowledge.collections';
  let collections=[];try{collections=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(collections))collections=[]}catch{}
  collections.push({id:`yard-${yard.id}-${Date.now()}`,title:`${yard.name} — documented builds`,type:'yard-cluster',recordIds:[...new Set(shipIds)],createdAt:new Date().toISOString(),source:'yard-intelligence'});
  localStorage.setItem(key,JSON.stringify(collections));
  window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'yard-intelligence-collection'}}));
}

async function install(){
  if(!APP||document.querySelector('#site-yard-intelligence'))return;
  const anchor=document.querySelector('#site-class-sister-intelligence')||document.querySelector('#site-operator-intelligence')||document.querySelector('#site-builder-intelligence')||document.querySelector('.intelligence-metrics');
  if(!anchor)return;
  const panel=document.createElement('section');panel.className='panel';panel.id='site-yard-intelligence';panel.innerHTML='<span class="eyebrow">Geographic knowledge feed</span><h4>Yard & location intelligence</h4><p>Loading documented builder locations from Ocean Liner Curator…</p>';anchor.insertAdjacentElement('afterend',panel);
  try{
    const response=await fetch(FEED_URL,{cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json();const r=reconcile(payload);const s=payload.summary||{};const yards=(payload.yards||[]).filter(y=>y.shipCount>=2).slice(0,20);
    panel.innerHTML=`<span class="eyebrow">Geographic knowledge feed</span><h4>Yard & location intelligence</h4><p>Locations remain ship-specific evidence, separate from builder identity. Reconciliation is review-only; CuratorOS does not rewrite permanent records automatically.</p><section class="metrics intelligence-metrics"><article><strong>${Number(s.canonicalYardLocations||0)}</strong><span>Canonical yard locations</span></article><article><strong>${Number(s.guidesWithDocumentedYard||0)}</strong><span>Guides with yard evidence</span></article><article><strong>${Number(s.guidesWithoutDocumentedYard||0)}</strong><span>Without yard evidence</span></article><article><strong>${Number(s.multiYardShips||0)}</strong><span>Multi-yard ships</span></article><article><strong>${r.matched}</strong><span>Local ships matched</span></article><article><strong>${r.relationshipMissing.length}</strong><span>Missing built_at links</span></article></section><details><summary>Missing built_at relationships (${r.relationshipMissing.length})</summary>${reviewList(r.relationshipMissing,'relationship-missing')}</details><details><summary>Yard field mismatches (${r.fieldMismatch.length})</summary>${reviewList(r.fieldMismatch,'field-mismatch')}</details><details><summary>built_at relationship mismatches (${r.relationshipMismatch.length})</summary>${reviewList(r.relationshipMismatch,'relationship-mismatch')}</details><details><summary>Ships without local yard fields (${r.fieldMissing.length})</summary>${reviewList(r.fieldMissing,'field-missing')}</details><details><summary>Unmatched site ships (${r.unmatched.length})</summary>${reviewList(r.unmatched,'unmatched')}</details><h4 style="margin-top:1.2rem">Geographic clusters</h4><div class="intelligence-list">${yards.map(yard=>`<article><div><strong>${esc(yard.name)}</strong><small>${esc((yard.builders||[]).slice(0,4).join(' · '))}</small></div><span>${Number(yard.shipCount||0)} ships</span><button type="button" class="secondary" data-yard-id="${esc(yard.id)}">Save collection</button></article>`).join('')||'<p class="empty">No repeated yard clusters yet.</p>'}</div><small>Dataset generated: ${esc(payload.generatedAt||'unknown')}</small>`;
    panel.querySelectorAll('[data-yard-id]').forEach(button=>button.addEventListener('click',()=>{const yard=(payload.yards||[]).find(y=>y.id===button.dataset.yardId);if(!yard)return;saveCollection(yard);button.textContent='Saved';button.disabled=true;}));
  }catch{panel.innerHTML='<span class="eyebrow">Geographic knowledge feed</span><h4>Yard & location intelligence</h4><p class="empty">The published yard feed is temporarily unavailable. Local Corpus Intelligence remains fully functional.</p>'}
}

BUTTON?.addEventListener('click',()=>setTimeout(install,0));
window.addEventListener('curatoros:records-changed',()=>{if(BUTTON?.classList.contains('active')){document.querySelector('#site-yard-intelligence')?.remove();setTimeout(install,0)}});
