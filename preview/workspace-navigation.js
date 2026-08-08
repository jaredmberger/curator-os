const ROUTES={
  records:{selector:'[data-view="records"]'},
  'extract-knowledge':{selector:'#extract-knowledge'},
  'batch-extract-knowledge':{selector:'#batch-extract-knowledge'},
  'site-sync':{selector:'#site-sync'},
  'entity-resolution':{selector:'#entity-resolution'},
  'knowledge-graph':{selector:'#knowledge-graph'},
  'knowledge-intelligence':{selector:'#knowledge-intelligence'},
  'evidence-ledger':{selector:'#evidence-ledger'},
  'research-desk':{selector:'#research-desk'},
  'research-queue':{selector:'#research-queue'},
  'conclusion-review':{selector:'#conclusion-review'},
  'knowledge-promotion':{selector:'#knowledge-promotion'},
  'incorporation-review':{selector:'#incorporation-review'}
};
window.CuratorOSNavigate={open,register};window.addEventListener('curatoros:navigate-workspace',event=>open(event.detail?.workspace));const handlers=new Map();
function register(workspace,handler){if(typeof handler==='function')handlers.set(workspace,handler)}
function open(workspace){const route=ROUTES[workspace];if(!route){console.warn('CuratorOS navigation: workspace is not part of the current product surface',workspace);return false}try{const explicit=handlers.get(workspace);if(explicit){explicit();finish(route.selector,workspace);return true}const target=document.querySelector(route.selector);if(!target){console.warn('CuratorOS navigation: target not found',workspace,route.selector);return false}target.click();finish(route.selector,workspace);return true}catch(error){console.error('CuratorOS navigation failed',workspace,error);return false}}
function finish(selector,workspace){const target=document.querySelector(selector);document.querySelectorAll('.nav .active').forEach(el=>{if(el!==target)el.classList.remove('active')});if(target)target.classList.add('active');window.dispatchEvent(new CustomEvent('curatoros:workspace-opened',{detail:{workspace}}));requestAnimationFrame(()=>{document.querySelector('.main')?.scrollTo?.({top:0,behavior:'auto'});window.scrollTo?.({top:0,behavior:'auto'})})}
function readHandoff(){const params=new URLSearchParams(location.search),workspace=String(params.get('workspace')||'').trim();if(!workspace||!ROUTES[workspace])return null;return{workspace,subject:String(params.get('subject')||'').trim(),page:String(params.get('page')||'').trim(),action:String(params.get('action')||'').trim(),source:String(params.get('source')||'').trim(),recommendation:String(params.get('recommendation')||'').trim()}}
function applyHandoff(){const handoff=readHandoff();if(!handoff)return;try{sessionStorage.setItem('curatoros.handoff',JSON.stringify({...handoff,receivedAt:new Date().toISOString()}))}catch{}let attempts=0;const timer=setInterval(()=>{attempts+=1;if(open(handoff.workspace)){clearInterval(timer);window.dispatchEvent(new CustomEvent('curatoros:handoff',{detail:handoff}));return}if(attempts>=40)clearInterval(timer)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyHandoff);else applyHandoff();
