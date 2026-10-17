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
 draw(rows);el('rows').replaceChildren();
 for(const r of [...rows].reverse().slice(0,90)){const tr=document.createElement('tr');for(const v of [r.date,fmt(r.impressions),fmt(r.clicks),r.average_position.toFixed(1)]){const td=document.createElement('td');td.textContent=v;tr.append(td)}el('rows').append(tr)}
 el('data-note').textContent=rows.length?'Latest reporting date '+last.date+' · '+rows.length+' dates · Source '+d.source+' · Last stored '+d.updatedAt:'No stored Search Console data. An authenticated ingest is required.';
}
el('load').addEventListener('click',async()=>{try{el('status').textContent='Loading…';const r=await fetch('/api/search-visibility',{headers:{Authorization:'Bearer '+el('token').value.trim()},cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'HTTP '+r.status);render(d);el('status').textContent='Loaded'}catch(e){el('status').textContent='Unable to load: '+e.message}});
