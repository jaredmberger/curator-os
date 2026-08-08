const observer=new MutationObserver(cleanCurrentSurface);
observer.observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
window.addEventListener('curatoros:workspace-opened',cleanCurrentSurface);
setTimeout(cleanCurrentSurface,0);

function cleanCurrentSurface(){
  document.querySelectorAll('[data-save-derived]').forEach(button=>button.remove());
  document.querySelectorAll('.intelligence-opportunities .eyebrow').forEach(el=>{
    if(/derived knowledge/i.test(el.textContent||''))el.textContent='Corpus-derived patterns';
  });
  document.querySelectorAll('.intelligence-opportunities h4').forEach(el=>{
    if(/research\s*&\s*publication opportunities/i.test(el.textContent||''))el.textContent='Research opportunities';
  });
  document.querySelectorAll('.intelligence-card small').forEach(el=>{
    if(/suggested page pattern:/i.test(el.textContent||''))el.textContent=el.textContent.replace(/Suggested page pattern:/i,'Suggested research pattern:');
  });
}
