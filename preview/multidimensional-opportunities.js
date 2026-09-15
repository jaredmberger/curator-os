const MD_BUTTON=document.querySelector('#knowledge-intelligence');
const MD_APP=document.querySelector('#app');
const MD_COLLECTIONS_KEY='curatoros.knowledge.collections';
const MD_FEEDS={
  builders:'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-builders.json',
  operators:'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-operators.json',
  classes:'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-classes-sisters.json',
  yards:'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-yards.json',
  eras:'https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/data/curatoros-eras.json'
};
function mdEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function mdNorm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function mdCollections(){try{const v=JSON.parse(localStorage.getItem(MD_COLLECTIONS_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}

function buildShipIndex(feeds){
  const map=new Map();
  const ensure=(path,name='')=>{if(!path)return null;if(!map.has(path))map.set(path,{path,name,builders:new Set(),operators:new Set(),yards:new Set(),classes:new Set(),eras:new Set(),startYear:null,endYear:null});const rec=map.get(path);if(name&&!rec.name)rec.name=name;return rec;};
  for(const ship of feeds.builders?.ships||[]){const r=ensure(ship.path,ship.name);for(const b of ship.builders||[])if(b?.name)r.builders.add(b.name);}
  for(const ship of feeds.operators?.ships||[]){const r=ensure(ship.path,ship.name);if(ship.operator)r.operators.add(ship.operator);}
  for(const cls of feeds.classes?.classes||[]){for(const ship of cls.ships||[]){const r=ensure(ship.path,ship.name);if(cls.name)r.classes.add(cls.name);}}
  for(const ship of feeds.yards?.ships||[]){const r=ensure(ship.path,ship.name);for(const a of ship.assignments||[])if(a?.location)r.yards.add(a.location);}
  for(const era of feeds.eras?.eras||[]){for(const ship of era.ships||[]){const r=ensure(ship.path,ship.name);if(era.name)r.eras.add(era.name);if(ship.serviceStartYear&&!r.startYear)r.startYear=Number(ship.serviceStartYear);if(ship.serviceEndYear&&!r.endYear)r.endYear=Number(ship.serviceEndYear);}}
  return [...map.values()];
}

function groupBy(ships,keyFn,labelFn,type){
  const groups=new Map();
  for(const ship of ships){for(const key of keyFn(ship)||[]){if(!key)continue;const id=mdNorm(`${type}:${key}`);if(!groups.has(id))groups.set(id,{id,type,label:labelFn(key),ships:[]});groups.get(id).ships.push(ship);}}
  return [...groups.values()];
}

function score(group){
  const ships=group.ships;
  const builders=new Set(),operators=new Set(),yards=new Set(),classes=new Set(),eras=new Set();
  const years=[];
  for(const s of ships){s.builders.forEach(x=>builders.add(x));s.operators.forEach(x=>operators.add(x));s.yards.forEach(x=>yards.add(x));s.classes.forEach(x=>classes.add(x));s.eras.forEach(x=>eras.add(x));if(Number.isFinite(s.startYear))years.push(s.startYear);}
  const coverage=Math.min(30,ships.length*3);
  const crossEntity=Math.min(25,(builders.size>1?6:0)+(operators.size>1?6:0)+(yards.size>1?5:0)+(classes.size>0?4:0)+(eras.size>1?4:0));
  const geography=Math.min(15,yards.size*3);
  const chronology=years.length>=3?Math.min(15,Math.max(...years)-Math.min(...years)>=20?15:8):0;
  const cohesion=Math.min(15,(classes.size?8:0)+(group.type==='builder-operator'?7:0));
  const total=Math.min(100,coverage+crossEntity+geography+chronology+cohesion);
  const reasons=[];
  if(ships.length>=5)reasons.push(`${ships.length} documented ships`);
  if(builders.size>1)reasons.push(`${builders.size} builders`);
  if(operators.size>1)reasons.push(`${operators.size} operators`);
  if(yards.size>1)reasons.push(`${yards.size} yards/locations`);
  if(classes.size)reasons.push(`${classes.size} explicit class${classes.size===1?'':'es'}`);
  if(years.length>=3)reasons.push(`${Math.min(...years)}–${Math.max(...years)} chronology`);
  return {...group,score:total,reasons,dimensions:{builders:builders.size,operators:operators.size,yards:yards.size,classes:classes.size,eras:eras.size},years};
}

function derive(feeds){
  const ships=buildShipIndex(feeds);
  const candidates=[];
  candidates.push(...groupBy(ships,s=>[...s.operators],x=>`${x} — broader fleet context`,'operator'));
  candidates.push(...groupBy(ships,s=>[...s.builders],x=>`${x} — builder context`,'builder'));
  candidates.push(...groupBy(ships,s=>[...s.yards],x=>`${x} — place-based collection`,'yard'));
  candidates.push(...groupBy(ships,s=>[...s.classes],x=>`${x} class`,'class'));
  const pairs=new Map();
  for(const ship of ships){for(const o of ship.operators)for(const b of ship.builders){const key=`${o}|${b}`;if(!pairs.has(key))pairs.set(key,{id:mdNorm(`builder-operator:${key}`),type:'builder-operator',label:`${o} × ${b}`,ships:[]});pairs.get(key).ships.push(ship);}}
  candidates.push(...pairs.values());
  return candidates.map(score).filter(x=>x.ships.length>=3&&x.score>=20).sort((a,b)=>b.score-a.score||b.ships.length-a.ships.length||a.label.localeCompare(b.label));
}

function saveOpportunity(item){
  const list=mdCollections();const key=`multidimensional:${item.id}`;const existing=list.find(x=>x?.derivedFrom?.id===key);
  const payload={id:existing?.id||`collection-${Date.now()}`,name:item.label,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),query:{},recordIds:[],recordCount:item.ships.length,derivedFrom:{kind:'multidimensional-opportunity',id:key,ideaType:item.type,score:item.score,reason:item.reasons.join(' · '),suggestedTemplate:'research collection'}};
  localStorage.setItem(MD_COLLECTIONS_KEY,JSON.stringify(existing?list.map(x=>x.id===existing.id?payload:x):[...list,payload]));
  alert(`Saved “${payload.name}” as a knowledge collection.`);
}

function card(item,index){
  const names=item.ships.slice(0,6).map(s=>s.name).filter(Boolean);
  return `<article class="intelligence-card"><div class="badges"><span class="badge">Score ${item.score}</span><span class="badge">${mdEsc(item.type)}</span></div><h4>${mdEsc(item.label)}</h4><p>${mdEsc(item.reasons.join(' · ')||'Multi-dimensional site evidence')}</p><div class="intelligence-members">${names.map(n=>`<span>${mdEsc(n)}</span>`).join('')}${item.ships.length>names.length?`<span>+${item.ships.length-names.length} more</span>`:''}</div><div class="actions"><button type="button" data-save-md="${index}">Save as knowledge collection</button></div></article>`;
}

async function installMultidimensional(){
  if(!MD_APP||document.querySelector('#multidimensional-opportunities'))return;
  const anchor=document.querySelector('#relationship-opportunities')||document.querySelector('#site-era-intelligence')||document.querySelector('.intelligence-metrics');if(!anchor)return;
  const panel=document.createElement('section');panel.className='panel intelligence-opportunities';panel.id='multidimensional-opportunities';panel.innerHTML='<span class="eyebrow">Cross-dimensional intelligence</span><h4>Ranked content opportunities</h4><p>Joining builder, operator, class, yard, and chronology…</p>';anchor.insertAdjacentElement('afterend',panel);
  try{
    const entries=Object.entries(MD_FEEDS);const responses=await Promise.all(entries.map(([,url])=>fetch(url,{cache:'no-store',credentials:'omit'})));if(responses.some(r=>!r.ok))throw new Error('feed unavailable');
    const payloads=await Promise.all(responses.map(r=>r.json()));const feeds=Object.fromEntries(entries.map(([key],i)=>[key,payloads[i]]));const ranked=derive(feeds);
    panel.innerHTML=`<div class="intelligence-section-head"><div><span class="eyebrow">Cross-dimensional intelligence</span><h4>Ranked content opportunities</h4></div><span>Transparent scoring</span></div><p>Scores combine documented coverage, cross-entity richness, geographic concentration, chronology, and class/relationship cohesion. They rank research leads; they do not decide what should be published.</p><section class="metrics intelligence-metrics"><article><strong>${ranked.length}</strong><span>Qualified opportunities</span></article><article><strong>${ranked.filter(x=>x.score>=60).length}</strong><span>High-priority (60+)</span></article><article><strong>${ranked.filter(x=>x.dimensions.yards>1).length}</strong><span>Multi-location opportunities</span></article><article><strong>${ranked.filter(x=>x.dimensions.classes>0).length}</strong><span>Class-informed opportunities</span></article></section><h4 style="margin-top:1.2rem">Highest-ranked opportunities</h4><div class="intelligence-grid">${ranked.slice(0,20).map(card).join('')||'<p class="empty">No opportunities currently meet the scoring threshold.</p>'}</div><details style="margin-top:1rem"><summary>How scoring works</summary><p>Coverage contributes up to 30 points; cross-entity richness up to 25; geography up to 15; chronology up to 15; and class/relationship cohesion up to 15. Every card lists the evidence dimensions responsible for its score.</p></details>`;
    panel.querySelectorAll('[data-save-md]').forEach(btn=>btn.addEventListener('click',()=>{saveOpportunity(ranked[Number(btn.dataset.saveMd)]);btn.textContent='Saved';btn.disabled=true;}));
  }catch{panel.innerHTML='<span class="eyebrow">Cross-dimensional intelligence</span><h4>Ranked content opportunities</h4><p class="empty">Multidimensional scoring is temporarily unavailable. Existing Corpus Intelligence remains fully functional.</p>'}
}
MD_BUTTON?.addEventListener('click',()=>setTimeout(installMultidimensional,140));
window.addEventListener('curatoros:records-changed',()=>{if(MD_BUTTON?.classList.contains('active')){document.querySelector('#multidimensional-opportunities')?.remove();setTimeout(installMultidimensional,140)}});
