const ROUTES={
  findings:'[data-view="findings"]',
  records:'[data-view="records"]',
  help:'[data-view="help"]',
  'guided-workflow':'#guided-workflow',
  'extract-knowledge':'#extract-knowledge',
  'batch-extract-knowledge':'#batch-extract-knowledge',
  'site-sync':'#site-sync',
  'entity-resolution':'#entity-resolution',
  'knowledge-graph':'#knowledge-graph',
  'knowledge-intelligence':'#knowledge-intelligence',
  'evidence-ledger':'#evidence-ledger',
  'knowledge-explorer':'#knowledge-explorer',
  'publication-composer':'#publication-composer',
  'page-assembly':'#page-assembly'
};

window.CuratorOSNavigate={open};
window.addEventListener('curatoros:navigate-workspace',event=>open(event.detail?.workspace));

function open(workspace){
  const selector=ROUTES[workspace];
  if(!selector){console.warn('CuratorOS navigation: unknown workspace',workspace);return false;}
  const target=document.querySelector(selector);
  if(!target){console.warn('CuratorOS navigation: target not found',workspace,selector);return false;}
  document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));
  target.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch'}));
  target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
  if(!target.classList.contains('active'))target.click();
  requestAnimationFrame(()=>{
    if(!target.classList.contains('active'))target.classList.add('active');
    document.querySelector('.main')?.scrollTo?.({top:0,behavior:'smooth'});
    window.scrollTo?.({top:0,behavior:'smooth'});
  });
  return true;
}
