const MODULES = [
  ['home', 'Findings'],
  ['archive', 'Registry'],
  ['knowledge', 'Graph'],
  ['knowledge', 'Intelligence'],
  ['editorial', 'Review Queue'],
  ['administration', 'Developer Mode']
];

const FINDINGS_KEY = 'curatoros.findings.handled';

export function installWorkerEraShell(root, context = {}) {
  const shell = root.querySelector('.cos-catalog-shell');
  if (!shell) return { destroy() {} };

  shell.classList.add('cos-worker-shell');
  shell.insertAdjacentHTML('afterbegin', `<aside class="cos-worker-sidebar">
    <div class="cos-worker-brand"><span class="cos-eyebrow">Ocean Liner Curator</span><strong>CuratorOS</strong><small>Voyage IV · The Curator</small></div>
    <nav>${renderNav()}</nav>
    <footer>Find problems, discover gaps, and improve OceanLiners.net.</footer>
  </aside>`);

  const catalogSidebar = shell.querySelector('.cos-catalog-sidebar');
  const inspector = shell.querySelector('.cos-catalog-inspector');
  const workspace = document.createElement('section');
  workspace.className = 'cos-worker-workspace';
  shell.insertBefore(workspace, catalogSidebar);
  workspace.append(catalogSidebar, inspector);

  const header = document.createElement('header');
  header.className = 'cos-worker-topbar';
  header.innerHTML = `<div><span class="cos-eyebrow">Actionable site maintenance</span><h1 data-worker-title>Findings</h1></div><div class="cos-worker-top-actions"><button type="button" data-worker-command>⌘ Command</button><button type="button" data-worker-backup>Quick Backup</button></div>`;
  workspace.insertBefore(header, workspace.firstChild);

  const dashboard = document.createElement('section');
  dashboard.className = 'cos-worker-dashboard';
  workspace.insertBefore(dashboard, catalogSidebar);

  const state = { view: 'dashboard', filter: 'open' };

  function handledIds() {
    try { return new Set(JSON.parse(localStorage.getItem(FINDINGS_KEY) || '[]')); }
    catch { return new Set(); }
  }

  function saveHandled(set) {
    localStorage.setItem(FINDINGS_KEY, JSON.stringify([...set]));
  }

  function buildFindings(records) {
    const inbound = new Map();
    for (const record of records) for (const rel of record.relationships || []) if (rel.target) inbound.set(rel.target, (inbound.get(rel.target) || 0) + 1);
    const findings = [];
    for (const record of records) {
      const title = record.title || record.id;
      if (!(record.sources || []).length) findings.push(finding(record, 'unsourced', 'high', `${title} has no direct source attached.`, 'Add at least one source or a curatorial note that explains the evidence basis.', 'Open record and add source'));
      if (record.status === 'review' || record.status === 'draft') findings.push(finding(record, 'review', record.status === 'draft' ? 'high' : 'medium', `${title} is still marked ${record.status}.`, 'Review the record, confirm its evidence and metadata, then publish or archive it.', 'Open record for review'));
      const missing = missingCoreMetadata(record);
      if (missing.length) findings.push(finding(record, 'metadata', 'medium', `${title} is missing ${missing.join(', ')}.`, 'Fill the missing fields so the record can support stronger search, linking, and publication output.', 'Open record and complete fields'));
      if ((inbound.get(record.id) || 0) === 0 && record.type !== 'source') findings.push(finding(record, 'isolated', 'medium', `${title} has no inbound relationships from other local records.`, 'Link it from a related ship, company, object, photo, or source record where the connection is documented.', 'Open record and add relationship'));
    }
    return findings;
  }

  function updateDashboard() {
    const records = context.recordService?.all?.() || [];
    const findings = buildFindings(records);
    const handled = handledIds();
    const open = findings.filter((item) => !handled.has(item.id));
    const visible = state.filter === 'handled' ? findings.filter((item) => handled.has(item.id)) : open;
    const counts = countBy(open, 'category');
    dashboard.innerHTML = `<div class="cos-worker-findings-hero">
      <div><span class="cos-eyebrow">What should I improve today?</span><h2>${open.length ? `${open.length} actionable finding${open.length === 1 ? '' : 's'}` : 'No open findings in the local catalog'}</h2><p>${records.length ? 'Each item explains what CuratorOS found, why it matters, and what to do next.' : 'Import or create records to begin generating actionable findings.'}</p></div>
      <div class="cos-worker-actions"><button type="button" data-worker-filter="open" class="${state.filter === 'open' ? 'active' : ''}">Open findings</button><button type="button" data-worker-filter="handled" class="${state.filter === 'handled' ? 'active' : ''}">Handled</button></div>
    </div>
    <div class="cos-worker-metrics">
      ${metric(counts.unsourced || 0, 'Missing sources')}${metric(counts.review || 0, 'Needs review')}${metric(counts.metadata || 0, 'Missing metadata')}${metric(counts.isolated || 0, 'Isolated records')}${metric(open.length, 'Open findings')}
    </div>
    <div class="cos-worker-findings-list">${visible.length ? visible.map((item) => renderFinding(item, handled.has(item.id))).join('') : `<article class="cos-worker-panel"><h2>${state.filter === 'handled' ? 'Nothing has been marked handled yet.' : 'You are caught up for this local dataset.'}</h2><p>${records.length ? 'Import a site index or run a live scan to surface link failures, unlinked ship mentions, and content gaps.' : 'Use Import GitHub or create records to populate CuratorOS.'}</p></article>`}</div>`;
  }

  function setView(view) {
    state.view = view;
    shell.querySelectorAll('[data-worker-view]').forEach((button) => button.classList.toggle('active', button.dataset.workerView === view));
    const title = shell.querySelector('[data-worker-title]');
    const isDashboard = view === 'dashboard';
    const isCatalog = ['registry', 'review', 'developer'].includes(view);
    dashboard.hidden = !isDashboard;
    catalogSidebar.hidden = !isCatalog;
    inspector.hidden = !isCatalog;
    title.textContent = isDashboard ? 'Findings' : view === 'registry' ? 'The Registry' : view === 'review' ? 'Review Queue' : view === 'graph' ? 'Knowledge Graph' : view === 'intelligence' ? 'Archive Intelligence' : 'Developer Mode';
    if (isCatalog) {
      if (view === 'review') {
        const status = catalogSidebar.querySelector('[data-catalog-status]');
        if (status) { status.value = 'review'; status.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      if (view === 'registry' || view === 'developer') {
        const status = catalogSidebar.querySelector('[data-catalog-status]');
        if (status) { status.value = 'all'; status.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    }
    root.dispatchEvent(new CustomEvent('curatoros:worker-view', { detail: { view } }));
  }

  root.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-worker-view]');
    if (viewButton) setView(viewButton.dataset.workerView);
    const filterButton = event.target.closest('[data-worker-filter]');
    if (filterButton) { state.filter = filterButton.dataset.workerFilter; updateDashboard(); }
    const findingButton = event.target.closest('[data-finding-action]');
    if (findingButton) {
      const handled = handledIds();
      const id = findingButton.dataset.findingId;
      if (findingButton.dataset.findingAction === 'handle') handled.add(id);
      if (findingButton.dataset.findingAction === 'reopen') handled.delete(id);
      saveHandled(handled);
      updateDashboard();
    }
    const openRecord = event.target.closest('[data-finding-open]');
    if (openRecord) {
      setView('registry');
      const id = openRecord.dataset.findingOpen;
      const result = shell.querySelector(`[data-record-id="${cssEscape(id)}"]`);
      result?.click();
    }
    if (event.target.closest('[data-worker-open-registry]')) setView('registry');
    if (event.target.closest('[data-worker-open-review]')) setView('review');
    if (event.target.closest('[data-worker-command]')) openCommandPalette(root, setView);
    if (event.target.closest('[data-worker-backup]')) context.onQuickBackup?.();
  });

  const unsubscribe = context.recordService?.subscribe?.(() => updateDashboard()) || (() => {});
  updateDashboard();
  setView('dashboard');
  return { updateDashboard, setView, destroy() { unsubscribe(); } };
}

function finding(record, category, severity, summary, recommendation, action) {
  return { id: `${category}:${record.id}`, recordId: record.id, category, severity, title: record.title || record.id, recordType: record.type || 'record', summary, recommendation, action };
}
function missingCoreMetadata(record) {
  const missing = [];
  if (!record.summary) missing.push('summary');
  if (!record.metadata?.confidence || record.metadata.confidence === 'unknown') missing.push('confidence');
  if (record.type === 'ship') {
    if (!record.data?.builder) missing.push('builder');
    if (!record.data?.operator) missing.push('shipping line');
    if (!record.data?.launchDate && !record.data?.year) missing.push('launch year');
  }
  return missing;
}
function renderFinding(item, isHandled) {
  return `<article class="cos-worker-finding ${item.severity}"><div class="cos-worker-finding-head"><div><span class="cos-worker-finding-category">${escapeHtml(item.category)}</span><h2>${escapeHtml(item.title)}</h2><small>${escapeHtml(item.recordType)} · ${escapeHtml(item.recordId)}</small></div><span class="cos-worker-finding-severity">${escapeHtml(item.severity)}</span></div><p><strong>What CuratorOS found:</strong> ${escapeHtml(item.summary)}</p><p><strong>What to do next:</strong> ${escapeHtml(item.recommendation)}</p><div class="cos-worker-actions"><button type="button" data-finding-open="${escapeHtml(item.recordId)}">${escapeHtml(item.action)}</button><button type="button" data-finding-action="${isHandled ? 'reopen' : 'handle'}" data-finding-id="${escapeHtml(item.id)}">${isHandled ? 'Reopen finding' : 'Mark handled'}</button></div></article>`;
}
function renderNav() {
  let last = '';
  return MODULES.map(([group, label]) => {
    const view = label === 'Findings' ? 'dashboard' : label === 'Registry' ? 'registry' : label === 'Review Queue' ? 'review' : label === 'Graph' ? 'graph' : label === 'Intelligence' ? 'intelligence' : 'developer';
    const heading = group !== last ? `<span class="cos-worker-nav-group">${group}</span>` : '';
    last = group;
    return `${heading}<button type="button" data-worker-view="${view}">${label}</button>`;
  }).join('');
}
function countBy(values, key) { return values.reduce((out, item) => { const value = item[key] || 'unknown'; out[value] = (out[value] || 0) + 1; return out; }, {}); }
function metric(value, label) { return `<div class="cos-worker-metric"><strong>${Number(value).toLocaleString()}</strong><span>${label}</span></div>`; }
function cssEscape(value) { return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
function escapeHtml(value) { return String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function openCommandPalette(root, setView) {
  const existing = root.querySelector('[data-worker-command-overlay]');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'cos-worker-command-overlay';
  overlay.dataset.workerCommandOverlay = '';
  overlay.innerHTML = `<div class="cos-worker-command-box"><input type="search" placeholder="Search CuratorOS or choose a workspace…" autofocus><div>${['dashboard','registry','review','graph','intelligence','developer'].map((view) => `<button type="button" data-command-view="${view}">${view === 'dashboard' ? 'Findings' : view.replace(/^./, (c) => c.toUpperCase())}</button>`).join('')}</div></div>`;
  root.append(overlay);
  overlay.addEventListener('click', (event) => {
    const command = event.target.closest('[data-command-view]');
    if (command) { setView(command.dataset.commandView); overlay.remove(); }
    if (event.target === overlay) overlay.remove();
  });
  overlay.querySelector('input').addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    overlay.querySelectorAll('[data-command-view]').forEach((button) => button.hidden = !button.textContent.toLowerCase().includes(query));
  });
}
