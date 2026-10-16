const $=id=>document.getElementById(id);let state=null;
const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value);return n};
const status=s=>$('status').textContent=s;
async function request(method,body){const r=await fetch('/api/stewardship-review',{method,headers:{Authorization:'Bearer '+$('token').value.trim(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const x=await r.json();if(!r.ok)throw Error(x.error||'HTTP '+r.status);return x}
async function load(){try{status('Loading…');state=await request('GET');render();status('Loaded')}catch(e){state=null;$('cases').replaceChildren();status('Unable to load: '+e.message)}}
function render(){
 const items=state.cases||[],filter=$('filter').value;
 $('total').textContent=items.length;$('active').textContent=items.filter(x=>x.lifecycle==='active').length;
 $('awaiting').textContent=items.filter(x=>x.lifecycle==='active'&&!x.review).length;
 $('freshness').textContent='Last updated: '+(state.updatedAt||'not yet ingested')+' · Audit: '+state.auditHealth;
 $('cases').replaceChildren();
 for(const item of items.filter(x=>filter==='all'||(filter==='pending'?x.lifecycle==='active'&&!x.review:!!x.review))){
  const box=text('article','');box.className='case';
  const title=text('h3',item.description||item.type);box.append(title);
  box.append(text('small',item.scope+' · '+item.severity+' · '+item.lifecycle+' · first seen '+item.firstSeen));
  if(item.review)box.append(text('p','Decision: '+item.review.decision+' — '+item.review.reason+' ('+item.review.reviewer+')'));
  const details=document.createElement('details');details.append(text('summary','Inspect evidence'));details.append(text('pre',JSON.stringify(item.evidence,null,2)));box.append(details);
  const form=document.createElement('form');form.className='grid';
  const select=document.createElement('select');for(const val of ['acknowledged','investigate','deferred','dismissed']){const o=document.createElement('option');o.value=val;o.textContent=val;select.append(o)}
  const reviewer=document.createElement('input');reviewer.placeholder='Reviewer';reviewer.required=true;reviewer.maxLength=120;
  const reason=document.createElement('textarea');reason.placeholder='Evidence-based reason or next step';reason.required=true;reason.maxLength=2000;
  const save=text('button','Save review decision');save.type='submit';
  form.append(select,reviewer,reason,save);form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{await request('POST',{action:select.value,id:item.id,reviewer:reviewer.value,reason:reason.value,version:state.version});await load()}catch(err){status(err.message);save.disabled=false}});
  box.append(form);$('cases').append(box);
 }
}
$('load').addEventListener('click',load);$('clear').addEventListener('click',()=>{$('token').value='';state=null;$('cases').replaceChildren();status('Token cleared')});$('filter').addEventListener('change',()=>{if(state)render()});
