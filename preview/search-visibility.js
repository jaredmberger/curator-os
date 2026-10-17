import {analyzeSearch} from './search-recovery-analysis.mjs';
const el=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString('en-US');
function draw(rows){
 const svg=el('chart'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();
 if(!rows.length)return;
 const values=rows.map(r=>r.impressions),max=Math.max(...values,1),left=52,right=744,top=12,bottom=209;
 const add=(name,attrs,content)=>{const node=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);if(content!==undefined)node.textContent=content;svg.append(node);return node};
 for(let k=0;k<=4;k++){const y=top+(bottom-top)*k/4;add('line',{x1:left,y1:y,x2:right,y2:y,class:'chart-grid'});add('text',{x:0,y:y+4,fill:'#b7c5b9','font-size':12},fmt(Math.round(max*(1-k/4))))}
 const points=rows.map((r,i)=>[left+(right-left)*(rows.length===1?.5:i/(rows.length-1)),bottom-(r.impressions/max)*(bottom-top)]);
 add('polyline',{points:points.map(p=>p.join(',')).join(' '),class:'chart-line'});
 add('text',{x:left,y:243,fill:'#c6ccbf','font-size':12},rows[0].date);
 add('text',{x:650,y:243,fill:'#c6ccbf','font-size':12},rows.at(-1).date);
}
function render(d){
 const rows=d.rows||[],last=rows.at(-1),week=rows.slice(-7),average=week.length?week.reduce((s,r)=>s+r.impressions,0)/week.length:null;
 el('impressions').textContent=last?fmt(last.impressions):'—';el('clicks').textContent=last?fmt(last.clicks):'—';
 el('average').textContent=average===null?'—':fmt(Math.round(average));el('position').textContent=last?last.average_position.toFixed(1):'—';
 const insight=analyzeSearch(d);
 const formatMean=x=>x===null?'Not enough history':fmt(Math.round(x));
 el('pre-baseline').textContent=formatMean(insight.preMean);
 el('post-baseline').textContent=formatMean(insight.postMean);
 el('recent-7').textContent=formatMean(insight.recent7);
 el('prior-7').textContent=formatMean(insight.prior7);
 el('trend').textContent=insight.change===null?'Not enough consecutive data':(insight.change>=0?'+':'')+(insight.change*100).toFixed(1)+'% versus previous 7 days';
 el('recovery').textContent=insight.ratio===null?'Unavailable':(insight.ratio*100).toFixed(1)+'% of pre-drop impression level';
 const labels={'no-data':'No data','stale':'Stale — inspect synchronization','current':'Recent data'};
 el('freshness').textContent=labels[insight.freshness]+' · '+(insight.dataAgeDays===null?'no report date':insight.dataAgeDays+' days since latest report')+
   (insight.ingestAgeHours===null?'':' · '+Math.round(insight.ingestAgeHours)+' hours since ingestion');
 const states={'sustained-gain-candidate':'Significant 7-day improvement to review','sustained-decline-candidate':'Significant 7-day decline to review','no-clear-shift':'No major 7-day shift','insufficient-data':'Awaiting complete consecutive reporting windows'};
 el('signal').textContent=states[insight.milestone];
 draw(rows);el('rows').replaceChildren();
 for(const r of [...rows].reverse().slice(0,90)){const tr=document.createElement('tr');for(const v of [r.date,fmt(r.impressions),fmt(r.clicks),r.average_position.toFixed(1)]){const td=document.createElement('td');td.textContent=v;tr.append(td)}el('rows').append(tr)}
 el('data-note').textContent=rows.length?'Latest reporting date '+last.date+' · '+rows.length+' dates · Source '+d.source+' · Last stored '+d.updatedAt:'No stored Search Console data. An authenticated ingest is required.';
}
el('load').addEventListener('click',async()=>{try{el('status').textContent='Loading…';const r=await fetch('/api/search-visibility',{headers:{Authorization:'Bearer '+el('token').value.trim()},cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'HTTP '+r.status);render(d);el('status').textContent='Loaded'}catch(e){el('status').textContent='Unable to load: '+e.message}});

async function loadWatchtower(token){
 const status=el('watchtower-status'),events=el('watchtower-events');
 status.textContent='Loading Watchtower observations…';events.replaceChildren();
 try{
  let response;
  try{
   const url=new URL('api/search-intelligence-bridge',window.location.origin+'/');
   response=await fetch(url.toString(),{method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store'});
  }catch(e){throw Error('Network request could not start ('+(e?.name||'network error')+'). Check host and browser network protections.');}
  const type=response.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw Error('Bridge returned HTTP '+response.status+' as '+(type||'unknown content type')+' (possibly a Cloudflare challenge or redirect).');
  let data;try{data=await response.json()}catch{throw Error('Bridge returned invalid JSON (HTTP '+response.status+').');}
  if(!response.ok||!data.ok)throw Error((data.error||'Bridge error')+' (HTTP '+response.status+').');
  const triage=data.triage||{};
  el('watchtower-triage').textContent=(triage.technical?.length||0)+' technical review candidates · '+(triage.ranking?.length||0)+' ranking observations · '+(triage.other?.length||0)+' unclassified. Ranking movements are not indexing problems.';
  el('watchtower-latest').textContent=data.latestDate||'Unknown';
  el('watchtower-count').textContent=String(data.snapshotCount);
  status.textContent=data.latestRange?
   'Watchtower reporting range: '+data.latestRange.startDate+' to '+data.latestRange.endDate+
   ' · checked '+new Date(data.observedAt).toLocaleString():
   'Watchtower has no reporting range available.';
  if(!data.events.length){const p=document.createElement('p');p.textContent='No Watchtower events in the current response.';events.append(p);}
  for(const item of data.events){
   const p=document.createElement('p');p.className='date-note';
   p.textContent=(item.snapshotDate||'Undated')+' · '+item.type+' · '+item.label+(item.path?' · '+item.path:'');
   events.append(p);
  }
 }catch(e){el('watchtower-latest').textContent='—';el('watchtower-count').textContent='—';
  el('watchtower-triage').textContent='Classification unavailable';
  status.textContent='Watchtower could not be loaded: '+e.message;
 }
}
const oldLoad=el('load');
oldLoad.addEventListener('click',()=>{if(el('token').value.trim())void loadWatchtower(el('token').value.trim())});
