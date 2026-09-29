
const BUTTON=document.querySelector('#overview');
const APP=document.querySelector('#app');

const KEYS={
  records:'curatoros.rebuilt.catalog',
  recordMeta:'curatoros.project.storeMeta',
  researchMeta:'curatoros.research.storeMeta',
  queueState:'curatoros.research.queue.state',
  queueCustom:'curatoros.research.queue.custom',
  conclusions:'curatoros.research.conclusions',
  promotions:'curatoros.knowledge.promotions',
  pendingChanges:'curatoros.project.pendingChanges'
};

const QUEUE_FIELDS=['originalOperator','builder','launchDate','maidenVoyageDate','grossTonnage','length','beam','fate','routes','serviceEras','completedDate'];

BUTTON?.addEventListener('click',function(){activate();render();});
window.addEventListener('curatoros:records-changed',refreshIfOpen);
window.addEventListener('curatoros:research-queue-changed',refreshIfOpen);
window.addEventListener('curatoros:conclusions-changed',refreshIfOpen);
window.addEventListener('curatoros:promotions-changed',refreshIfOpen);
window.addEventListener('curatoros:project-store-status',refreshIfOpen);
window.addEventListener('curatoros:research-store-status',refreshIfOpen);

function activate(){
  document.querySelectorAll('.nav .active').forEach(function(x){x.classList.remove('active');});
  if(BUTTON)BUTTON.classList.add('active');
}
function refreshIfOpen(){if(BUTTON&&BUTTON.classList.contains('active'))render();}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function records(){var v=read(KEYS.records,[]);return Array.isArray(v)?v:[];}
function array(key){var v=read(key,[]);return Array.isArray(v)?v:[];}
function object(key){var v=read(key,{});return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
function has(v){return Array.isArray(v)?v.length>0:v!=null&&String(v).trim()!=='';}
function hasEvidence(r,f){return !!(r&&((r.fieldEvidence&&r.fieldEvidence[f])||(r.evidence&&r.evidence[f])));}
function hasRel(r,t){return Array.isArray(r&&r.relationships)&&r.relationships.some(function(x){return (x.relationship||x.type)===t;});}

function queueCount(){
  var state=object(KEYS.queueState),count=0;
  records().filter(function(x){return x&&((x.type==='ship')||String(x.id||'').startsWith('ship:'));}).forEach(function(r){
    QUEUE_FIELDS.forEach(function(field){
      var missing=!has(r&&r.data&&r.data[field]);
      var gap=!missing&&!hasEvidence(r,field);
      if(!missing&&!gap)return;
      var type=missing?'missing-field':'evidence-gap';
      var id=String(r.id)+'|'+type+'|'+field;
      if(((state[id]&&state[id].status)||'open')!=='done')count++;
    });
    if(has(r&&r.data&&r.data.builder)&&!hasRel(r,'built_by')){
      var id=String(r.id)+'|relationship-gap|builder';
      if(((state[id]&&state[id].status)||'open')!=='done')count++;
    }
  });
  count+=array(KEYS.queueCustom).filter(function(x){return !['done','removed'].includes((x&&x.status)||'open');}).length;
  return count;
}

function localSummary(){
  var all=records();
  var ships=all.filter(function(x){return x&&((x.type==='ship')||String(x.id||'').startsWith('ship:'));}).length;
  var conclusions=array(KEYS.conclusions);
  var promotions=array(KEYS.promotions);
  return{
    records:all.length,
    ships:ships,
    queue:queueCount(),
    conclusions:conclusions.filter(function(x){return ((x&&x.status)||'candidate')==='candidate';}).length,
    ready:promotions.filter(function(x){return x&&x.status==='ready';}).length,
    pendingChanges:array(KEYS.pendingChanges).length,
    projectPermanent:object(KEYS.recordMeta).permanent===true,
    researchPermanent:object(KEYS.researchMeta).permanent===true
  };
}

async function fetchSystem(){
  var controller=new AbortController();
  var timer=setTimeout(function(){controller.abort();},7000);
  try{
    var response=await fetch('/api/device/v1/status',{cache:'no-store',credentials:'same-origin',signal:controller.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    var payload=await response.json();
    if(payload&&payload.contractVersion!==1)throw new Error('Unsupported device status contract');
    return payload;
  }catch{return null;}finally{clearTimeout(timer);}
}

function stateLabel(v){return ({healthy:'Healthy',attention:'Attention',degraded:'Degraded',partial:'Partial',unknown:'Unknown'})[v]||'Unknown';}
function publicLabel(v){return ({online:'Online',suspect:'Suspect',offline:'Offline',unknown:'Unknown'})[v]||'Unknown';}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}

function attentionItems(local,system){
  var items=[];
  if(!local.projectPermanent)items.push({kind:'warning',title:'Project Records are not confirmed durable',detail:'CuratorOS is currently relying on a local/cache state for Project Records.',workspace:'records',action:'Open Project Records'});
  if(!local.researchPermanent)items.push({kind:'warning',title:'Research State is not confirmed durable',detail:'Research workflow state is currently local/cache rather than confirmed KV.',workspace:'research-queue',action:'Open Research Queue'});
  if(system&&system.system&&system.system.state&&system.system.state!=='healthy')items.push({kind:'system',title:'System state: '+stateLabel(system.system.state),detail:String(system.system.activeIncidentCount||0)+' active incident'+(system.system.activeIncidentCount===1?'':'s')+' · public site '+publicLabel(system.system.publicSite).toLowerCase()+'.',href:'https://ops.oceanlinercurator.com/',action:'Open Curator Ops'});
  if(system&&system.devices&&Number(system.devices.stale||0)>0)items.push({kind:'system',title:String(system.devices.stale)+' hardware device'+(system.devices.stale===1?'':'s')+' stale',detail:'A physical CuratorOS device has stopped reporting within its expected interval.',href:'https://ops.oceanlinercurator.com/devices',action:'Review devices'});
  if(local.conclusions>0)items.push({kind:'work',title:String(local.conclusions)+' conclusion'+(local.conclusions===1?'':'s')+' awaiting review',detail:'Supported research conclusions are waiting for a curatorial decision.',workspace:'conclusion-review',action:'Review conclusions'});
  if(local.ready>0)items.push({kind:'work',title:String(local.ready)+' promotion package'+(local.ready===1?'':'s')+' ready',detail:'Reviewed knowledge is waiting for final incorporation.',workspace:'incorporation-review',action:'Open incorporation review'});
  if(local.pendingChanges>0)items.push({kind:'work',title:String(local.pendingChanges)+' pending record change'+(local.pendingChanges===1?'':'s'),detail:'Project Record changes are staged and waiting to be resolved in the records workflow.',workspace:'records',action:'Open Project Records'});
  return items;
}

function attentionCard(item){
  var action=item.href
    ?'<a href="'+esc(item.href)+'" target="_blank" rel="noopener">'+esc(item.action)+'</a>'
    :'<button type="button" data-overview-open="'+esc(item.workspace)+'">'+esc(item.action)+'</button>';
  return '<article class="overview-attention-card '+esc(item.kind)+'"><div><strong>'+esc(item.title)+'</strong><p>'+esc(item.detail)+'</p></div>'+action+'</article>';
}

function bind(){
  document.querySelectorAll('[data-overview-open]').forEach(function(button){
    button.addEventListener('click',function(){if(window.CuratorOSNavigate)window.CuratorOSNavigate.open(button.dataset.overviewOpen);});
  });
  var refresh=document.querySelector('[data-overview-refresh]');
  if(refresh)refresh.addEventListener('click',render);
}

async function render(){
  if(!APP)return;
  activate();
  var local=localSummary();
  APP.innerHTML='<section class="panel overview-loading"><span class="eyebrow">Operator overview</span><h3>CuratorOS at a glance</h3><p>Loading current operational state…</p></section>';
  var system=await fetchSystem();
  if(!BUTTON||!BUTTON.classList.contains('active'))return;
  var attention=attentionItems(local,system);
  var systemState=(system&&system.system&&system.system.state)||'unknown';
  var incidents=Number((system&&system.system&&system.system.activeIncidentCount)||0);
  var devices=system&&system.devices;
  var healthy=systemState==='healthy';

  APP.innerHTML=
    '<section class="overview-hero panel"><div><span class="eyebrow">Operator overview</span><h3>'+(healthy?'Ready to work':system?'Review before continuing':'System status unavailable')+'</h3><p>'+(healthy?'CuratorOS has no confirmed operational issue requiring attention.':'System health and research work are separated here so transient noise does not become a false alarm.')+'</p></div><button type="button" data-overview-refresh>Refresh</button></section>'+
    '<section class="overview-status-grid">'+
      '<article class="overview-status-card '+esc(systemState)+'"><span>System</span><strong>'+esc(stateLabel(systemState))+'</strong><small>'+(system?String(incidents)+' active incident'+(incidents===1?'':'s'):'Status endpoint unavailable')+'</small><a href="https://ops.oceanlinercurator.com/" target="_blank" rel="noopener">Curator Ops →</a></article>'+
      '<article class="overview-status-card"><span>Public site</span><strong>'+esc(publicLabel((system&&system.system&&system.system.publicSite)||'unknown'))+'</strong><small>OceanLiners.net availability</small><a href="https://oceanliners.net/" target="_blank" rel="noopener">Open site →</a></article>'+
      '<article class="overview-status-card"><span>Physical devices</span><strong>'+((devices&&devices.available===false)?'Unavailable':String(Number((devices&&devices.online)||0))+' online')+'</strong><small>'+String(Number((devices&&devices.quiet)||0))+' quiet · '+String(Number((devices&&devices.stale)||0))+' stale</small><a href="https://ops.oceanlinercurator.com/devices" target="_blank" rel="noopener">Review devices →</a></article>'+
      '<article class="overview-status-card"><span>Permanent corpus</span><strong>'+String(local.records)+'</strong><small>'+String(local.ships)+' ship records · '+(local.projectPermanent?'durable KV confirmed':'cache/local state')+'</small><button type="button" data-overview-open="records">Project Records →</button></article>'+
    '</section>'+
    '<section class="panel overview-attention"><div class="overview-section-head"><div><span class="eyebrow">Needs attention</span><h3>'+(attention.length?String(attention.length)+' item'+(attention.length===1?'':'s')+' worth looking at':'Nothing urgent')+'</h3></div></div><div class="overview-attention-list">'+(attention.length?attention.map(attentionCard).join(''):'<p class="overview-clear">No confirmed system issue, pending curatorial decision, or durability warning is currently surfaced here.</p>')+'</div></section>'+
    '<section class="overview-work-grid">'+
      '<article class="panel overview-work-card"><span class="eyebrow">Research work</span><strong>'+String(local.queue)+'</strong><h4>Open Research Queue items</h4><p>Missing facts, evidence gaps, relationship gaps, and active discovery work.</p><button type="button" data-overview-open="research-queue">Open Research Queue</button></article>'+
      '<article class="panel overview-work-card"><span class="eyebrow">Curatorial decisions</span><strong>'+String(local.conclusions)+'</strong><h4>Conclusions awaiting review</h4><p>Investigation results waiting for an explicit accept, return, or dismiss decision.</p><button type="button" data-overview-open="conclusion-review">Open Conclusion Review</button></article>'+
      '<article class="panel overview-work-card"><span class="eyebrow">Final knowledge gate</span><strong>'+String(local.ready)+'</strong><h4>Ready for incorporation</h4><p>Promotion packages that have completed review and are ready for final incorporation.</p><button type="button" data-overview-open="incorporation-review">Open Incorporation Review</button></article>'+
    '</section>'+
    '<section class="panel overview-actions"><span class="eyebrow">Continue working</span><h3>Common next actions</h3><div class="overview-action-grid">'+
      '<button type="button" data-overview-open="records"><strong>Project Records</strong><span>Browse or edit the permanent corpus.</span></button>'+
      '<button type="button" data-overview-open="extract-knowledge"><strong>Extract Knowledge</strong><span>Turn a ship guide into structured knowledge.</span></button>'+
      '<button type="button" data-overview-open="site-sync"><strong>Site / Knowledge Sync</strong><span>Compare the public site with the institutional corpus.</span></button>'+
      '<button type="button" data-overview-open="research-desk"><strong>Research Desk</strong><span>Look for patterns and research opportunities.</span></button>'+
    '</div></section>';
  bind();
}

setTimeout(function(){if(BUTTON)BUTTON.click();},0);
