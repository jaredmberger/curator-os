const DRAFTS_KEY='curatoros.publication.drafts';
const SITE_INDEX_KEY='curatoros.siteCorpus.index';
const app=document.querySelector('#app');
const button=document.querySelector('#page-assembly');
let selectedDraftId='';
let family='hero';
let includeProvenance=true;

const FAMILIES={
  hero:{label:'Hero / article',description:'For feature pages, essays, and pages led by a title and introductory hero.'},
  hub:{label:'Hub / directory',description:'For browse-first index, fleet, builder, and collection pages.'},
  'logo-mount':{label:'Logo-mount / reference',description:'For compact reference and quick-answer style pages with the house logo treatment.'}
};

button?.addEventListener('click',()=>{activate();render();});
function activate(){document.querySelectorAll('.nav .active').forEach(el=>el.classList.remove('active'));button?.classList.add('active');}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function drafts(){const v=readJson(DRAFTS_KEY,[]);return Array.isArray(v)?v:[]}
function siteIndex(){const v=readJson(SITE_INDEX_KEY,[]);return Array.isArray(v)?v:[]}
function title(d){return d?.title||d?.slug||d?.id||'Untitled draft'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function attr(v){return esc(v).replace(/`/g,'&#096;')}
function label(v){return String(v||'').replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g,m=>m.toUpperCase())}
function slug(v){return String(v||'page').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'page'}

function render(){
  if(!app)return;
  const list=drafts();
  if(!selectedDraftId&&list.length)selectedDraftId=list[list.length-1].id;
  const draft=list.find(d=>d.id===selectedDraftId)||null;
  const collision=draft?findCollision(draft):null;
  app.innerHTML=`
    <section class="panel assembly-hero"><div><span class="eyebrow">Template & Page Assembly</span><h3>Shape a publication brief into an OceanLiners.net page package</h3><p>Choose a saved Publication Composer brief, map it to a house layout family, inspect the generated HTML, and download a review package. Nothing is published automatically.</p></div><div class="assembly-stat"><strong>${list.length}</strong><span>saved briefs</span></div></section>
    <section class="panel assembly-setup"><div class="assembly-grid">
      <label><span>Publication brief</span><select id="assembly-draft"><option value="">Choose a saved brief</option>${list.map(d=>`<option value="${attr(d.id)}"${d.id===selectedDraftId?' selected':''}>${esc(title(d))}</option>`).join('')}</select></label>
      <label><span>House layout family</span><select id="assembly-family">${Object.entries(FAMILIES).map(([k,v])=>`<option value="${k}"${k===family?' selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
      <label class="assembly-check"><input id="assembly-provenance" type="checkbox" ${includeProvenance?'checked':''}><span>Include provenance / source section</span></label>
    </div>${draft?`<p class="assembly-family-note">${esc(FAMILIES[family].description)}</p>`:''}</section>
    ${draft?renderDraft(draft,collision):'<section class="panel"><p class="empty">Save a Publication Composer brief first, then return here to assemble it into a site-shaped page.</p></section>'}`;
  bind(draft);
}

function renderDraft(draft,collision){
  const html=assembleHtml(draft,family,includeProvenance);
  const path=normalizePath(draft.slug||slug(draft.title));
  return `<section class="metrics">${metric(draft.recordCount||draft.records?.length||0,'Source records')}${metric(draft.sourceCount||0,'Sources')}${metric(draft.relationshipCount||0,'Relationships')}${metric(collision?1:0,'Path collisions')}</section>
  <section class="panel assembly-summary"><div><span class="eyebrow">Assembly target</span><h4>${esc(draft.title)}</h4><p>${esc(FAMILIES[family].label)} · ${esc(path)}</p></div><div class="badges">${collision?'<span class="badge">Path already exists</span>':'<span class="badge">New path</span>'}<span class="badge">Review required</span></div></section>
  ${collision?`<section class="panel assembly-warning"><strong>Existing site path detected.</strong><p>The loaded site manifest already contains ${esc(collision.url||collision.path||path)}. Treat this package as an update candidate rather than a new page.</p></section>`:''}
  <section class="panel"><span class="eyebrow">Generated page package</span><h4>Review HTML</h4><details open class="assembly-preview"><summary>Show generated HTML</summary><pre>${esc(html)}</pre></details><div class="actions"><button id="assembly-copy" type="button">Copy HTML</button><button id="assembly-download-html" type="button">Download HTML</button><button id="assembly-download-package" type="button">Download review package</button></div></section>`;
}

function assembleHtml(draft,layout,withProvenance){
  const path=normalizePath(draft.slug||slug(draft.title));
  const records=draft.records||[];
  const body=records.map(r=>`<article class="olc-record-card" data-record-id="${attr(r.id||'')}"><h3>${esc(r.title||r.id||'Record')}</h3>${r.summary?`<p>${esc(r.summary)}</p>`:''}${facts(r)}</article>`).join('\n');
  const provenance=withProvenance?`<section class="olc-provenance"><span class="eyebrow">Sources & provenance</span><h2>Research basis</h2><p>This draft was assembled from ${records.length} CuratorOS Project Record${records.length===1?'':'s'} and preserves the publication brief as its source package.</p></section>`:'';
  const mainClass=`layout-${layout}`;
  const hero=layout==='hub'?`<header class="hub-hero"><span class="eyebrow">Ocean Liner Curator</span><h1>${esc(draft.title)}</h1><p>${esc(draft.editorialAngle||'Browse this curated knowledge collection.')}</p></header>`:layout==='logo-mount'?`<header class="reference-hero"><div class="logo-mount" aria-hidden="true">★</div><span class="eyebrow">Ocean Liner Curator reference</span><h1>${esc(draft.title)}</h1><p>${esc(draft.editorialAngle||'A curator-reviewed reference page assembled from structured project knowledge.')}</p></header>`:`<header class="feature-hero"><span class="eyebrow">Ocean Liner Curator</span><h1>${esc(draft.title)}</h1><p>${esc(draft.editorialAngle||'A curator-reviewed page assembled from structured project knowledge.')}</p></header>`;
  const sections=(draft.sections||[]).map(s=>`<section id="${attr(s.id||slug(s.heading))}" class="olc-section"><h2>${esc(s.heading||'Section')}</h2>${s.purpose?`<p class="editorial-purpose">${esc(s.purpose)}</p>`:''}${sectionNeedsCards(s.id)?body:''}</section>`).join('\n');
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${esc(draft.title)} | Ocean Liner Curator</title>\n<meta name="description" content="${attr(draft.editorialAngle||`Curated Ocean Liner Curator reference page: ${draft.title}.`)}">\n<link rel="canonical" href="https://oceanliners.net${attr(path)}">\n<style>body{margin:0;background:#0a1110;color:#f3efe6;font-family:Georgia,serif}.olc-page{width:min(1180px,calc(100% - 28px));margin:0 auto;padding:28px 0 72px}.feature-hero,.hub-hero,.reference-hero,.olc-section,.olc-record-card,.olc-provenance{border:1px solid rgba(191,164,106,.35);border-radius:18px;background:rgba(255,255,255,.035)}.feature-hero,.hub-hero,.reference-hero,.olc-section,.olc-provenance{padding:24px;margin-bottom:18px}.hub-hero{text-align:center;padding:38px 24px}.reference-hero{display:grid;gap:10px}.logo-mount{width:74px;height:74px;border:1px solid #bfa46a;border-radius:50%;display:grid;place-items:center;font-size:34px}.eyebrow{color:#bfa46a;text-transform:uppercase;letter-spacing:.12em;font-size:.78rem}.olc-section .olc-record-card{padding:18px;margin-top:12px}.editorial-purpose{opacity:.72;font-style:italic}a{color:#d8c28e}@media(max-width:700px){.olc-page{width:min(100% - 18px,1180px)}.feature-hero,.hub-hero,.reference-hero,.olc-section,.olc-provenance{padding:18px}}</style>\n</head>\n<body>\n<main class="olc-page ${mainClass}">\n${hero}\n${sections}\n${provenance}\n</main>\n</body>\n</html>`;
}
function sectionNeedsCards(id){return ['directory','browse','ships','record-highlights','featured','chronology','comparison-table','research-table','custom-main'].includes(id)}
function facts(r){const entries=Object.entries(r.data||{}).filter(([,v])=>v!==''&&v!=null).slice(0,10);return entries.length?`<dl>${entries.map(([k,v])=>`<dt>${esc(label(k))}</dt><dd>${esc(display(v))}</dd>`).join('')}</dl>`:''}
function display(v){return typeof v==='object'?JSON.stringify(v):String(v??'')}
function normalizePath(v){const s=String(v||'').trim();if(/^https?:\/\//i.test(s)){try{return new URL(s).pathname}catch{}}return '/'+s.replace(/^\/+|\.html?$/gi,'')}
function findCollision(draft){const path=normalizePath(draft.slug||slug(draft.title));return siteIndex().find(p=>normalizePath(p.url||p.path||p.canonical||p.href||'')===path)||null}
function metric(v,l){return `<div class="metric"><strong>${v}</strong><span>${esc(l)}</span></div>`}
function bind(draft){document.querySelector('#assembly-draft')?.addEventListener('change',e=>{selectedDraftId=e.target.value;render()});document.querySelector('#assembly-family')?.addEventListener('change',e=>{family=e.target.value;render()});document.querySelector('#assembly-provenance')?.addEventListener('change',e=>{includeProvenance=e.target.checked;render()});if(!draft)return;const html=assembleHtml(draft,family,includeProvenance);document.querySelector('#assembly-copy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(html)}catch{prompt('Copy HTML',html)}});document.querySelector('#assembly-download-html')?.addEventListener('click',()=>download(html,`${slug(draft.slug||draft.title)}.html`,'text/html'));document.querySelector('#assembly-download-package')?.addEventListener('click',()=>download(JSON.stringify({format:'curatoros-page-assembly-package',formatVersion:1,createdAt:new Date().toISOString(),layoutFamily:family,provenanceIncluded:includeProvenance,draftId:draft.id||'',publicationBrief:draft,targetPath:normalizePath(draft.slug||draft.title),siteCollision:!!findCollision(draft),html},null,2),`${slug(draft.slug||draft.title)}-page-assembly.json`,'application/json'))}
function download(content,name,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)}