const recordsButton=document.querySelector('[data-view="records"]');
const app=document.querySelector('#app');

recordsButton?.addEventListener('click',()=>{
  document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));
  recordsButton.classList.add('active');
  if(app)app.innerHTML='<section class="panel"><span class="eyebrow">Permanent knowledge corpus</span><h3>Loading Project Records…</h3></section>';
});

window.addEventListener('curatoros:research-state-loaded',()=>document.documentElement.dataset.researchState='permanent');
window.addEventListener('curatoros:research-store-status',event=>{
  document.documentElement.dataset.researchState=event.detail?.permanent?'permanent':'cache';
});

setTimeout(()=>recordsButton?.click(),0);
