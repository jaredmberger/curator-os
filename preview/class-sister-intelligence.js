const BUTTON=document.querySelector('#knowledge-intelligence');
const APP=document.querySelector('#app');
const CATALOG_KEY='curatoros.rebuilt.catalog';
const COLLECTIONS_KEY='curatoros.knowledge.collections';
const FEED_URL='https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-classes-sisters.json';

function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function normShip(v){return norm(v).replace(/^(rms|ss|s s|mv|ms|hmhs|hmt|hms|ts|rmmv|qsmv)\s+/,'').trim();}
function read(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function title(r){return r?.title||r?.name||r?.data?.name||r?.id||'Untitled record'}
function relType(r){return r?.relationship||r?.type||''}
function relTarget(r){return r?.target||r?.id||r?.recordId||''}
function valueList(v){if(Array.isArray(v))return v.flatMap(valueList).filter(Boolean);if(v&&typeof v==='object')return valueList(v.name||v.value||v.label||'');const t=String(v??'').trim();return t?[t]:[]}
function shipRecords(){return read(CATALOG_KEY).filter(r=>r?.type==='ship'||String(r?.id||'').startsWith('ship:'))}
function matchShip(name,ships){let x=ships.filter(r=>norm(title(r))===norm(name));if(x.length===1)return x[0];x=ships.filter(r=>normShip(title(r))===normShip(name));return x.length===1?x[0]:null}

function analyze(payload){
  const all=read(CATALOG_KEY),ships=all.filter(r=>r?.type==='ship'||String(r?.id||'').startsWith('ship:'));const byId=new Map(all.map(r=>[r?.id,r]));
  const classRows=[],sisterRows=[];
  for(const group of payload?.classes||[]){
    for(const siteShip of group.ships||[]){
      const local=matchShip(siteShip.name,ships);if(!local){classRows.push({state:'unmatched',siteShip,group});continue}
      const values=valueList(local?.data?.shipClass||local?.data?.className||local?.data?.class);
      const fieldOk=values.some(v=>norm(v.replace(/-class$/i,''))===norm(group.name));
      classRows.push({state:fieldOk?'aligned':values.length?'mismatch':'missing',siteShip,group,local,actual:values});
    }
  }
  for(const link of payload?.sisterLinks||[]){
    const a=matchShip(link.a?.name,ships),b=matchShip(link.b?.name,ships);
    if(!a||!b){sisterRows.push({state:'unmatched',link,a,b});continue}
    const aLinks=(a.relationships||[]).filter(r=>relType(r)==='sister_ship').map(relTarget);
    const bLinks=(b.relationships||[]).filter(r=>relType(r)==='sister_ship').map(relTarget);
    const linked=aLinks.includes(b.id)||bLinks.includes(a.id);
    sisterRows.push({state:linked?'aligned':'missing',link,a,b});
  }
  return{classRows,sisterRows,classAligned:classRows.filter(x=>x.state==='aligned'),classMissing:classRows.filter(x=>x.state==='missing'),classMismatch:classRows.filter(x=>x.state==='mismatch'),classUnmatched:classRows.filter(x=>x.state==='unmatched'),sisterAligned:sisterRows.filter(x=>x.state==='aligned'),sisterMissing:sisterRows.filter(x=>x.state==='missing'),sisterUnmatched:sisterRows.filter(x=>x.state==='unmatched')};
}

function rows(items,kind){if(!items.length)return '<p class="empty">No items in this category.</p>';return `<div class="intelligence-list">${items.slice(0,40).map(x=>{if(kind==='sister')return `<article><div><strong>${esc(x.link.a?.name)} ↔ ${esc(x.link.b?.name)}</strong><small>Explicit sister-ship wording · evidence from ${esc(x.link.evidenceFrom||'ship guide')}</small></div><span class="badge">Review</span></article>`;const actual=(x.actual||[]).join(' · ');return `<article><div><strong>${esc(x.siteShip?.name||'Unknown ship')}</strong><small>Expected class: ${esc(x.group?.name||'Unknown')}${actual?` · CuratorOS: ${esc(actual)}`:''}</small></div><span class="badge">Review</span></article>`}).join('')}</div>`}

function saveClass(group){
  if(!group)return;const ships=shipRecords(),ids=(group.ships||[]).map(s=>matchShip(s.name,ships)?.id).filter(Boolean);if(!ids.length)return;
  const list=read(COLLECTIONS_KEY),key=`class:${group.id}`,existing=list.find(x=>x.derivedFrom?.id===key);const now=new Date().toISOString();
  const item={id:existing?.id||`collection-${Date.now()}`,name:`${group.name} class`,createdAt:existing?.createdAt||now,updatedAt:now,query:{},recordIds:ids,recordCount:ids.length,derivedFrom:{kind:'class-intelligence',id:key,ideaType:'ship-class',reason:`${ids.length} site guides explicitly identify membership in the ${group.name} class.`,suggestedTemplate:'class comparison'}};
  localStorage.setItem(COLLECTIONS_KEY,JSON.stringify(existing?list.map(x=>x.id===existing.id?item:x):[...list,item]));alert(`Saved “${item.name}” as a knowledge collection.`);
}

async function install(){
  if(!APP||document.querySelector('#site-class-sister-intelligence'))return;const anchor=document.querySelector('#relationship-opportunities')||document.querySelector('#site-operator-intelligence')||document.querySelector('#site-builder-intelligence');if(!anchor)return;
  const panel=document.createElement('section');panel.className='panel';panel.id='site-class-sister-intelligence';panel.innerHTML='<span class="eyebrow">Ship-to-ship intelligence</span><h4>Classes & sister ships</h4><p>Loading explicit class and sister-ship evidence…</p>';anchor.insertAdjacentElement('afterend',panel);
  try{
    const response=await fetch(FEED_URL,{cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json(),a=analyze(payload),s=payload.summary||{},groups=(payload.classes||[]).filter(g=>g.shipCount>=2);
    panel.innerHTML=`<span class="eyebrow">Ship-to-ship intelligence</span><h4>Classes & sister ships</h4><p>This layer uses only explicit wording in Ocean Liner Curator ship guides. Shared builder, operator, dimensions, dates, or naming patterns are never used to infer class membership or sisterhood.</p><section class="metrics intelligence-metrics"><article><strong>${Number(s.canonicalClasses||0)}</strong><span>Explicit classes</span></article><article><strong>${Number(s.guidesWithExplicitClass||0)}</strong><span>Guides naming a class</span></article><article><strong>${Number(s.explicitSisterLinks||0)}</strong><span>Resolved sister links</span></article><article><strong>${a.classAligned.length}</strong><span>Class fields aligned</span></article><article><strong>${a.classMissing.length}</strong><span>Missing class fields</span></article><article><strong>${a.sisterMissing.length}</strong><span>Missing sister_ship links</span></article></section><details><summary>Missing class fields (${a.classMissing.length})</summary>${rows(a.classMissing,'class')}</details><details><summary>Class field mismatches (${a.classMismatch.length})</summary>${rows(a.classMismatch,'class')}</details><details><summary>Missing sister_ship relationships (${a.sisterMissing.length})</summary>${rows(a.sisterMissing,'sister')}</details><details><summary>Unmatched class/sister evidence (${a.classUnmatched.length+a.sisterUnmatched.length})</summary>${rows(a.classUnmatched,'class')}${rows(a.sisterUnmatched,'sister')}</details><h4 style="margin-top:1.2rem">Documented class groups</h4><div class="intelligence-grid">${groups.map(g=>`<article class="intelligence-card"><div class="badges"><span class="badge">Ship class</span><span class="badge">${g.shipCount} ships</span></div><h4>${esc(g.name)} class</h4><p>${(g.ships||[]).map(s=>esc(s.name)).join(' · ')}</p><div class="actions"><button type="button" data-save-class="${esc(g.id)}">Save as knowledge collection</button></div></article>`).join('')||'<p class="empty">No multi-ship class groups are explicitly documented yet.</p>'}</div><small>${Number(s.unresolvedSisterMentions||0)} unresolved prose mentions remain diagnostics only and are not treated as relationships.</small>`;
    panel.querySelectorAll('[data-save-class]').forEach(b=>b.addEventListener('click',()=>saveClass((payload.classes||[]).find(g=>g.id===b.dataset.saveClass))));
  }catch{panel.innerHTML='<span class="eyebrow">Ship-to-ship intelligence</span><h4>Classes & sister ships</h4><p class="empty">The published class/sister feed is temporarily unavailable. Existing Corpus Intelligence remains fully functional.</p>'}
}

BUTTON?.addEventListener('click',()=>setTimeout(install,0));
window.addEventListener('curatoros:records-changed',()=>{if(BUTTON?.classList.contains('active')){document.querySelector('#site-class-sister-intelligence')?.remove();setTimeout(install,0)}});
