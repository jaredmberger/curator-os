const BUTTON=document.querySelector('#knowledge-intelligence');
const APP=document.querySelector('#app');
const CATALOG_KEY='curatoros.rebuilt.catalog';
const FEED_URL='https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-operators.json';

function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));}
function norm(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function normShip(value){return norm(value).replace(/^(rms|ss|s s|mv|ms|hmhs|hmt|hms|ts|rmmv|qsmv)\s+/,'').replace(/\bship guide\b/g,'').trim();}
function records(){try{const value=JSON.parse(localStorage.getItem(CATALOG_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function title(record){return record?.title||record?.name||record?.data?.name||record?.id||'Untitled record'}
function year(value){return String(value??'').match(/\b(?:18|19|20)\d{2}\b/)?.[0]||null}
function values(value){if(Array.isArray(value))return value.flatMap(values).filter(Boolean);if(value&&typeof value==='object')return values(value.name||value.value||value.label||'');const text=String(value??'').trim();return text?[text]:[]}
function relType(rel){return rel?.relationship||rel?.type||''}
function relTarget(rel){return rel?.target||rel?.id||rel?.recordId||''}

function matchShip(site,ships){
  let candidates=ships.filter(record=>norm(title(record))===norm(site.name));
  if(candidates.length===1)return candidates[0];
  candidates=ships.filter(record=>normShip(title(record))===normShip(site.name));
  if(candidates.length===1)return candidates[0];
  if(site.launchYear){const byYear=candidates.filter(record=>year(record?.data?.launchDate||record?.data?.launched||record?.data?.built)===String(site.launchYear));if(byYear.length===1)return byYear[0];}
  return null;
}

function aliasMap(payload){
  const map=new Map();
  for(const operator of payload?.operators||[]){
    if(!operator?.name)continue;
    [operator.name,...(operator.rawValues||[])].forEach(value=>{const key=norm(value);if(key)map.set(key,operator.name)});
  }
  return map;
}
function canonical(value,map){const text=String(value??'').trim();if(!text)return'';return map.get(norm(text))||map.get(norm(text.split(';')[0]))||map.get(norm(text.split('/')[0]))||text;}

function reconcile(payload){
  const all=records();
  const ships=all.filter(record=>record?.type==='ship'||String(record?.id||'').startsWith('ship:'));
  const byId=new Map(all.map(record=>[record?.id,record]));
  const aliases=aliasMap(payload);
  const result={matched:0,agreement:0,fieldMissing:[],fieldMismatch:[],relationshipMissing:[],relationshipMismatch:[],unmatched:[]};
  for(const site of payload?.ships||[]){
    const local=matchShip(site,ships);
    if(!local){result.unmatched.push(site);continue}
    result.matched++;
    const expected=site.operator;
    if(!expected)continue;
    const localValues=values(local?.data?.originalOperator||local?.data?.operator);
    if(!localValues.length)result.fieldMissing.push({site,local,expected});
    else if(localValues.some(value=>norm(canonical(value,aliases))===norm(expected)))result.agreement++;
    else result.fieldMismatch.push({site,local,expected,actual:localValues});

    const rels=(local?.relationships||[]).filter(rel=>relType(rel)==='operated_by');
    if(!rels.length)result.relationshipMissing.push({site,local,expected});
    else{
      const targets=rels.map(rel=>{const target=relTarget(rel);return byId.get(target)?title(byId.get(target)):target}).filter(Boolean);
      if(!targets.some(value=>norm(canonical(value,aliases))===norm(expected)))result.relationshipMismatch.push({site,local,expected,actual:targets});
    }
  }
  return result;
}

function list(items,kind){
  if(!items.length)return '<p class="empty">No items in this category.</p>';
  return `<div class="intelligence-list">${items.slice(0,30).map(item=>{
    const actual=(item.actual||[]).join(' · ');
    const detail=kind==='unmatched'?'No matching CuratorOS ship record':kind==='field-missing'?`Site operator: ${item.expected}`:kind==='relationship-missing'?`Expected operated_by: ${item.expected}`:`Site: ${item.expected}${actual?` · CuratorOS: ${actual}`:''}`;
    return `<article><div><strong>${esc(item.site?.name||'Unknown ship')}</strong><small>${esc(detail)}</small></div><span class="badge">Review</span></article>`;
  }).join('')}</div>`;
}

async function install(){
  if(!APP||document.querySelector('#site-operator-intelligence'))return;
  const anchor=document.querySelector('#site-builder-intelligence')||document.querySelector('.intelligence-metrics');
  if(!anchor)return;
  const panel=document.createElement('section');panel.className='panel';panel.id='site-operator-intelligence';panel.innerHTML='<span class="eyebrow">Site knowledge feed</span><h4>Shipping-line intelligence</h4><p>Loading canonical operator data from Ocean Liner Curator…</p>';anchor.insertAdjacentElement('afterend',panel);
  try{
    const response=await fetch(FEED_URL,{cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json();const r=reconcile(payload);const summary=payload.summary||{};const top=(payload.operators||[]).slice(0,10);
    panel.innerHTML=`<span class="eyebrow">Site knowledge feed</span><h4>Shipping-line intelligence</h4><p>Operator identities are derived from the public ship guides. Findings below are review suggestions only; permanent CuratorOS records are never rewritten automatically.</p><section class="metrics intelligence-metrics"><article><strong>${Number(summary.canonicalOperators||0)}</strong><span>Canonical operators</span></article><article><strong>${Number(summary.guidesWithOperator||0)}</strong><span>Guides with operator data</span></article><article><strong>${Number(summary.guidesMissingOperator||0)}</strong><span>Missing site operators</span></article><article><strong>${r.matched}</strong><span>Ship records matched</span></article><article><strong>${r.agreement}</strong><span>Operator fields aligned</span></article><article><strong>${r.relationshipMissing.length}</strong><span>Missing operated_by links</span></article></section><details><summary>Missing operated_by relationships (${r.relationshipMissing.length})</summary>${list(r.relationshipMissing,'relationship-missing')}</details><details><summary>Operator field mismatches (${r.fieldMismatch.length})</summary>${list(r.fieldMismatch,'field-mismatch')}</details><details><summary>operated_by relationship mismatches (${r.relationshipMismatch.length})</summary>${list(r.relationshipMismatch,'relationship-mismatch')}</details><details><summary>Missing local operator fields (${r.fieldMissing.length})</summary>${list(r.fieldMissing,'field-missing')}</details><details><summary>Unmatched site ships (${r.unmatched.length})</summary>${list(r.unmatched,'unmatched')}</details><h4 style="margin-top:1.2rem">Most represented operators</h4><div class="intelligence-list">${top.map(operator=>`<article><div><strong>${esc(operator.name)}</strong><small>${esc((operator.rawValues||[]).slice(0,2).join(' · '))}</small></div><span>${Number(operator.shipCount||0)} ships</span></article>`).join('')}</div><small>Dataset generated: ${esc(payload.generatedAt||'unknown')}</small>`;
  }catch{panel.innerHTML='<span class="eyebrow">Site knowledge feed</span><h4>Shipping-line intelligence</h4><p class="empty">The published operator feed is temporarily unavailable. Local Corpus Intelligence remains fully functional.</p>'}
}

BUTTON?.addEventListener('click',()=>setTimeout(install,0));
window.addEventListener('curatoros:records-changed',()=>{if(BUTTON?.classList.contains('active')){document.querySelector('#site-operator-intelligence')?.remove();setTimeout(install,0)}});
