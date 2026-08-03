const ROUTES={
  findings:{selector:'[data-view="findings"]',kind:'view',view:'findings'},
  records:{selector:'[data-view="records"]',kind:'view',view:'records'},
  help:{selector:'[data-view="help"]',kind:'view',view:'help'},
  'guided-workflow':{selector:'#guided-workflow',kind:'workspace'},
  'extract-knowledge':{selector:'#extract-knowledge',kind:'workspace'},
  'batch-extract-knowledge':{selector:'#batch-extract-knowledge',kind:'workspace'},
  'site-sync':{selector:'#site-sync',kind:'workspace'},
  'entity-resolution':{selector:'#entity-resolution',kind:'workspace'},
  'knowledge-graph':{selector:'#knowledge-graph',kind:'workspace'},
  'knowledge-intelligence':{selector:'#knowledge-intelligence',kind:'workspace'},
  'evidence-ledger':{selector:'#evidence-ledger',kind:'workspace'},
  'knowledge-explorer':{selector:'#knowledge-explorer',kind:'workspace'},
  'publication-composer':{selector:'#publication-composer',kind:'workspace'},
  'page-assembly':{selector:'#page-assembly',kind:'workspace'}
};

window.CuratorOSNavigate={open,register};
window.addEventListener('curatoros:navigate-workspace',event=>open(event.detail?.workspace));

const handlers=new Map();
function register(workspace,handler){if(typeof handler==='function')handlers.set(workspace,handler);}

function open(workspace){
  const route=ROUTES[workspace];
  if(!route){console.warn('CuratorOS navigation: unknown workspace',workspace);return false;}
  try{
    const explicit=handlers.get(workspace);
    if(explicit){explicit();finish(route.selector);return true;}
    const target=document.querySelector(route.selector);
    if(!target){console.warn('CuratorOS navigation: target not found',workspace,route.selector);return false;}
    if(route.kind==='view'){
      target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      finish(route.selector);
      return true;
    }
    target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    setTimeout(()=>{
      if(!target.classList.contains('active')){
        try{target.click();}catch(error){console.warn('CuratorOS navigation fallback failed',workspace,error);}
      }
      finish(route.selector);
    },0);
    return true;
  }catch(error){
    console.error('CuratorOS navigation failed',workspace,error);
    return false;
  }
}

function finish(selector){
  const target=document.querySelector(selector);
  document.querySelectorAll('.nav .active').forEach(el=>{if(el!==target)el.classList.remove('active');});
  if(target)target.classList.add('active');
  requestAnimationFrame(()=>{
    document.querySelector('.main')?.scrollTo?.({top:0,behavior:'auto'});
    window.scrollTo?.({top:0,behavior:'auto'});
  });
}
