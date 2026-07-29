const HISTORY_KEY = 'curatoros.scan.history';
const IMPORTED_KEY = 'curatoros.findings.imported';
const WORKFLOW_KEY = 'curatoros.findings.workflow.v1';
const FRESH_DAYS = 14;
const STALE_DAYS = 30;

const CHECKS = [
  { id:'site-health', title:'Site Health', sourceType:'Site Health CSV', href:'https://site-health.oceanliners.net/', runLabel:'Run link scan', importLabel:'Import CSV', importSource:'site-health', purpose:'Broken links, redirects, and source-link maintenance.' },
  { id:'indexer', title:'Curator Indexer', sourceType:'JSON scan/index', href:'https://curator-indexer.oceanliners.net/', runLabel:'Build site index', importLabel:'Import index', importSource:'indexer', purpose:'Coverage, crawl failures, missing sources, and linking opportunities.' },
  { id:'speed', title:'Curator Speed', sourceType:'Curator Speed JSON', href:'https://speed.oceanliners.net/', runLabel:'Run performance scan', importLabel:'Import report', importSource:'speed', purpose:'Page-level performance and delivery findings.' }
];

export function installSiteAssuranceReadiness(root) {
  if (!root) return { refresh() {}, destroy() {} };
  installStyles();
  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(root); });
  };
  const observer = new MutationObserver(refresh);
  observer.observe(root, { childList:true, subtree:true });
  window.addEventListener('storage', refresh);
  refresh();
  return { refresh, destroy() { observer.disconnect(); window.removeEventListener('storage', refresh); } };
}

function render(root) {
  const anchor = root.querySelector('.cos-worker-scan-launchers');
  if (!anchor) return;
  const existing = root.querySelector('[data-site-assurance-readiness]');
  const panel = existing || document.createElement('section');
  panel.dataset.siteAssuranceReadiness = '';
  panel.className = 'cos-assurance';

  const history = readArray(HISTORY_KEY);
  const imported = readArray(IMPORTED_KEY);
  const workflow = readObject(WORKFLOW_KEY);
  const latestBySource = new Map();
  for (const item of history) if (item?.sourceType && !latestBySource.has(item.sourceType)) latestBySource.set(item.sourceType, item);

  const checkStates = CHECKS.map((check) => describeCheck(check, latestBySource.get(check.sourceType)));
  const missing = checkStates.filter((item) => item.state === 'missing').length;
  const stale = checkStates.filter((item) => item.state === 'stale').length;
  const aging = checkStates.filter((item) => item.state === 'aging').length;
  const current = checkStates.filter((item) => item.state === 'current').length;
  const decisions = Object.values(workflow);
  const regressed = decisions.filter((item) => item?.state === 'regressed').length;
  const verified = decisions.filter((item) => item?.state === 'verified').length;
  const handled = decisions.filter((item) => item?.state === 'handled').length;
  const highOpen = imported.filter((item) => item?.severity === 'high' && !isClosedDecision(workflow[item.id])).length;
  const openImported = imported.filter((item) => !isClosedDecision(workflow[item.id])).length;
  const readiness = readinessState({ missing, stale, aging, regressed, highOpen });

  panel.innerHTML = `<div class="cos-assurance__head"><div><span class="cos-eyebrow">Unified site assurance</span><h2>${escapeHtml(readiness.title)}</h2><p>${escapeHtml(readiness.detail)}</p></div><span class="cos-assurance__badge ${readiness.level}">${escapeHtml(readiness.label)}</span></div>
    <div class="cos-assurance__summary">${metric(current,'current scans')}${metric(missing+stale,'missing or stale')}${metric(highOpen,'high-priority open')}${metric(regressed,'regressions')}${metric(verified,'verified')}${metric(handled,'handled')}</div>
    <div class="cos-assurance__checks">${checkStates.map(renderCheck).join('')}<article class="cos-assurance__check work-queue"><div class="cos-assurance__check-head"><strong>Repair and verification queue</strong><span class="cos-assurance__state ${regressed?'stale':openImported?'aging':'current'}">${regressed?`${regressed} regressed`:openImported?`${openImported} open`:'clear'}</span></div><p>Review findings, open affected pages in Page Studio, publish repairs, and rerun the relevant scanner to verify them.</p><small>${verified} verified · ${handled} handled · ${openImported} active imported finding${openImported===1?'':'s'}</small></article></div>
    <div class="cos-assurance__foot"><p><strong>How readiness is calculated:</strong> scans are current for ${FRESH_DAYS} days, aging through day ${STALE_DAYS}, and stale afterward. This panel summarizes imported evidence; it does not claim silent synchronization or automatic production checks.</p></div>`;
  if (!existing) anchor.before(panel);
}

function describeCheck(check, snapshot) {
  if (!snapshot?.importedAt) return { ...check, state:'missing', label:'not imported', detail:'No scan history is available.' };
  const age = ageInDays(snapshot.importedAt);
  const state = age <= FRESH_DAYS ? 'current' : age <= STALE_DAYS ? 'aging' : 'stale';
  const label = state === 'current' ? 'current' : state === 'aging' ? `${age} days old` : `stale · ${age} days`;
  const detail = `${snapshot.count||0} findings · ${snapshot.newCount||0} new · ${snapshot.verifiedCount??snapshot.resolvedCount??0} verified · ${snapshot.regressionCount||0} regressions`;
  return { ...check, snapshot, age, state, label, detail };
}

function renderCheck(item) {
  return `<article class="cos-assurance__check"><div class="cos-assurance__check-head"><strong>${escapeHtml(item.title)}</strong><span class="cos-assurance__state ${item.state}">${escapeHtml(item.label)}</span></div><p>${escapeHtml(item.purpose)}</p><small>${escapeHtml(item.detail)}${item.snapshot?.importedAt?` · imported ${escapeHtml(formatDate(item.snapshot.importedAt))}`:''}</small><div class="cos-worker-actions"><a class="cos-worker-action-link" href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.runLabel)}</a><button type="button" data-tool-import="${escapeHtml(item.importSource)}">${escapeHtml(item.importLabel)}</button></div></article>`;
}

function readinessState(v) {
  if (v.missing) return { level:'blocked', label:'incomplete', title:'Assurance runbook is incomplete', detail:`${v.missing} required scan${v.missing===1?' has':'s have'} not been imported yet.` };
  if (v.stale) return { level:'blocked', label:'refresh needed', title:'Some assurance evidence is stale', detail:`${v.stale} required scan${v.stale===1?' is':'s are'} older than ${STALE_DAYS} days.` };
  if (v.regressed || v.highOpen) return { level:'attention', label:'action needed', title:'Scans are available, but priority work remains', detail:`${v.highOpen} high-priority open finding${v.highOpen===1?'':'s'} and ${v.regressed} regression${v.regressed===1?'':'s'} are recorded.` };
  if (v.aging) return { level:'attention', label:'nearing refresh', title:'Assurance evidence is usable but aging', detail:`${v.aging} scan${v.aging===1?' is':'s are'} approaching the ${STALE_DAYS}-day refresh boundary.` };
  return { level:'ready', label:'current', title:'Latest assurance evidence is current', detail:'All three required scanner reports are present and no high-priority imported finding or regression is recorded.' };
}

function isClosedDecision(decision) { return decision?.state === 'handled' || decision?.state === 'verified'; }
function ageInDays(value) { const time=new Date(value).getTime(); return Number.isFinite(time)?Math.max(0,Math.floor((Date.now()-time)/86400000)):Number.POSITIVE_INFINITY; }
function readArray(key) { try { const value=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(value)?value:[]; } catch { return []; } }
function readObject(key) { try { const value=JSON.parse(localStorage.getItem(key)||'{}'); return value&&typeof value==='object'&&!Array.isArray(value)?value:{}; } catch { return {}; } }
function metric(value,label) { return `<div><strong>${Number(value).toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`; }
function formatDate(value) { const date=new Date(value); return Number.isNaN(date.getTime())?'unknown date':date.toLocaleDateString(); }
function escapeHtml(value) { return String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }

function installStyles() {
  if (document.querySelector('[data-site-assurance-styles]')) return;
  const style=document.createElement('style');
  style.dataset.siteAssuranceStyles='';
  style.textContent=`.cos-assurance{margin:1rem 0;padding:1.15rem;border:1px solid rgba(191,164,106,.4);border-radius:18px;background:linear-gradient(145deg,rgba(14,31,28,.96),rgba(7,16,15,.96));box-shadow:0 18px 40px rgba(0,0,0,.18)}.cos-assurance__head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.cos-assurance__head h2{margin:.25rem 0}.cos-assurance__head p{margin:.35rem 0 0;max-width:70ch}.cos-assurance__badge,.cos-assurance__state{display:inline-flex;align-items:center;border-radius:999px;padding:.35rem .65rem;font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border:1px solid rgba(191,164,106,.45)}.cos-assurance__badge.ready,.cos-assurance__state.current{background:rgba(67,138,99,.2)}.cos-assurance__badge.attention,.cos-assurance__state.aging{background:rgba(191,164,106,.18)}.cos-assurance__badge.blocked,.cos-assurance__state.stale,.cos-assurance__state.missing{background:rgba(178,75,75,.2)}.cos-assurance__summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.6rem;margin:1rem 0}.cos-assurance__summary>div{display:grid;gap:.15rem;padding:.75rem;border:1px solid rgba(191,164,106,.22);border-radius:12px;background:rgba(0,0,0,.14)}.cos-assurance__summary strong{font-size:1.25rem}.cos-assurance__summary span{font-size:.78rem;opacity:.72}.cos-assurance__checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.cos-assurance__check{padding:1rem;border:1px solid rgba(191,164,106,.25);border-radius:14px;background:rgba(255,255,255,.025)}.cos-assurance__check-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem}.cos-assurance__check p{margin:.55rem 0}.cos-assurance__check small{display:block;opacity:.72;margin-bottom:.75rem}.cos-assurance__foot{margin-top:.85rem;padding-top:.75rem;border-top:1px solid rgba(191,164,106,.2);font-size:.82rem;opacity:.8}.cos-assurance__foot p{margin:0}@media(max-width:900px){.cos-assurance__summary{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:680px){.cos-assurance__head{display:grid}.cos-assurance__badge{justify-self:start}.cos-assurance__checks{grid-template-columns:1fr}.cos-assurance__summary{grid-template-columns:repeat(2,minmax(0,1fr))}.cos-assurance__check-head{align-items:flex-start}}`;
  document.head.append(style);
}
