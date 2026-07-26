const MODULES = [
  ['home', 'Dashboard'],
  ['archive', 'Registry'],
  ['knowledge', 'Graph'],
  ['knowledge', 'Intelligence'],
  ['editorial', 'Review Queue'],
  ['administration', 'Developer Mode']
];

export function installWorkerEraShell(root, context = {}) {
  const shell = root.querySelector('.cos-catalog-shell');
  if (!shell) return { destroy() {} };

  shell.classList.add('cos-worker-shell');
  shell.insertAdjacentHTML('afterbegin', `<aside class="cos-worker-sidebar">
    <div class="cos-worker-brand"><span class="cos-eyebrow">Ocean Liner Curator</span><strong>CuratorOS</strong><small>Voyage IV · The Curator</small></div>
    <nav>${renderNav()}</nav>
    <footer>Institutional workspace for the Ocean Liner Curator archive.</footer>
  </aside>`);

  const catalogSidebar = shell.querySelector('.cos-catalog-sidebar');
  const inspector = shell.querySelector('.cos-catalog-inspector');
  const workspace = document.createElement('section');
  workspace.className = 'cos-worker-workspace';
  shell.insertBefore(workspace, catalogSidebar);
  workspace.append(catalogSidebar, inspector);

  const header = document.createElement('header');
  header.className = 'cos-worker-topbar';
  header.innerHTML = `<div><span class="cos-eyebrow">Institutional workspace</span><h1 data-worker-title>Command Center</h1></div><div class="cos-worker-top-actions"><button type="button" data-worker-command>⌘ Command</button><button type="button" data-worker-backup>Quick Backup</button></div>`;
  workspace.insertBefore(header, workspace.firstChild);

  const dashboard = document.createElement('section');
  dashboard.className = 'cos-worker-dashboard';
  workspace.insertBefore(dashboard, catalogSidebar);

  const state = { view: 'dashboard' };

  function updateDashboard() {
    const records = context.recordService?.all?.() || [];
    const byType = countBy(records, 'type');
    const review = records.filter((record) => record.status === 'review').length;
    const unsourced = records.filter((record) => !(record.sources || []).length).length;
    dashboard.innerHTML = `<div class="cos-worker-metrics">
      ${metric(byType.ship || 0, 'Ships')}${metric(byType.company || 0, 'Organizations')}${metric(byType.source || 0, 'Sources')}${metric((byType.photo || 0) + (byType.media || 0), 'Media')}${metric(review, 'Review queue')}
    </div>
    <div class="cos-worker-dashboard-grid">
      <article class="cos-worker-panel cos-worker-brief"><span class="cos-eyebrow">Captain’s Brief</span><h2>${records.length ? 'The archive is ready for curatorial work.' : 'Begin by importing the live archive.'}</h2><p>${records.length ? `${records.length.toLocaleString()} records are available locally. ${review} need review and ${unsourced} have no direct source attached.` : 'Use Import GitHub to build the live Ocean Liner Curator registry from the public repository.'}</p><div class="cos-worker-actions"><button type="button" data-worker-open-registry>Open Registry</button><button type="button" data-worker-open-review>Review Priorities</button></div></article>
      <article class="cos-worker-panel"><span class="cos-eyebrow">Archive Health</span><h2>${healthScore(records)}%</h2><p>Explainable coverage score based on sources, relationships, confidence, and review status.</p><div class="cos-worker-progress"><span style="width:${healthScore(records)}%"></span></div></article>
      <article class="cos-worker-panel"><span class="cos-eyebrow">Editorial memory</span><h2>${review} records awaiting review</h2><p>${unsourced} records currently have no direct source attached. Use the Registry to strengthen provenance and relationships.</p></article>
      <article class="cos-worker-panel"><span class="cos-eyebrow">Repository workflow</span><h2>Live GitHub ingestion</h2><p>Import, review, merge, back up, and validate the archive without leaving your iPad.</p></article>
    </div>`;
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
    title.textContent = isDashboard ? 'Command Center' : view === 'registry' ? 'The Registry' : view === 'review' ? 'Review Queue' : view === 'graph' ? 'Knowledge Graph' : view === 'intelligence' ? 'Archive Intelligence' : 'Developer Mode';
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

function renderNav() {
  let last = '';
  return MODULES.map(([group, label]) => {
    const view = label === 'Dashboard' ? 'dashboard' : label === 'Registry' ? 'registry' : label === 'Review Queue' ? 'review' : label === 'Graph' ? 'graph' : label === 'Intelligence' ? 'intelligence' : 'developer';
    const heading = group !== last ? `<span class="cos-worker-nav-group">${group}</span>` : '';
    last = group;
    return `${heading}<button type="button" data-worker-view="${view}">${label}</button>`;
  }).join('');
}
function countBy(values, key) { return values.reduce((out, item) => { const value = item[key] || 'unknown'; out[value] = (out[value] || 0) + 1; return out; }, {}); }
function metric(value, label) { return `<div class="cos-worker-metric"><strong>${Number(value).toLocaleString()}</strong><span>${label}</span></div>`; }
function healthScore(records) { if (!records.length) return 0; const score = records.reduce((sum, record) => sum + (record.sources?.length ? 30 : 0) + (record.relationships?.length ? 25 : 0) + (record.metadata?.confidence && record.metadata.confidence !== 'unknown' ? 25 : 0) + (record.status === 'published' ? 20 : 10), 0); return Math.min(100, Math.round(score / records.length)); }
function openCommandPalette(root, setView) {
  const existing = root.querySelector('[data-worker-command-overlay]');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'cos-worker-command-overlay';
  overlay.dataset.workerCommandOverlay = '';
  overlay.innerHTML = `<div class="cos-worker-command-box"><input type="search" placeholder="Search CuratorOS or choose a workspace…" autofocus><div>${['dashboard','registry','review','graph','intelligence','developer'].map((view) => `<button type="button" data-command-view="${view}">${view.replace(/^./, (c) => c.toUpperCase())}</button>`).join('')}</div></div>`;
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
