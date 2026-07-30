import { renderToolWorkflowCards, toolAccept } from './tool-workflows.js';
import { parseExternalScan } from './scan-import-adapter.js';

const MODULES = {
  operations: [
    ['home', 'Findings'],
    ['operations', 'Guided Session'],
    ['administration', 'Developer Mode']
  ],
  knowledge: [
    ['archive', 'Registry'],
    ['knowledge', 'Graph'],
    ['knowledge', 'Intelligence'],
    ['editorial', 'Review Queue']
  ]
};

const WORKSPACE_KEY = 'curatoros.workspace.mode';
const FINDINGS_KEY = 'curatoros.findings.handled';
const IMPORTED_FINDINGS_KEY = 'curatoros.findings.imported';
const SCAN_HISTORY_KEY = 'curatoros.scan.history';
const VERIFIED_FINDINGS_KEY = 'curatoros.findings.verified';

export function installWorkerEraShell(root, context = {}) {
  const shell = root.querySelector('.cos-catalog-shell');
  if (!shell) return { destroy() {} };

  shell.classList.add('cos-worker-shell');
  shell.insertAdjacentHTML('afterbegin', `<aside class="cos-worker-sidebar">
    <div class="cos-worker-brand"><span class="cos-eyebrow">Ocean Liner Curator</span><strong>CuratorOS</strong><small>Voyage IV · The Curator</small></div>
    <div class="cos-workspace-switch" role="group" aria-label="CuratorOS workspace">
      <button type="button" data-workspace-mode="operations">Site Operations</button>
      <button type="button" data-workspace-mode="knowledge">Knowledge Records</button>
    </div>
    <div class="cos-workspace-summary" data-workspace-summary></div>
    <nav data-worker-nav></nav>
    <footer>Maintain the live site or work on the structured knowledge underneath it.</footer>
  </aside>`);

  const catalogSidebar = shell.querySelector('.cos-catalog-sidebar');
  const inspector = shell.querySelector('.cos-catalog-inspector');
  const workspace = document.createElement('section');
  workspace.className = 'cos-worker-workspace';
  shell.insertBefore(workspace, catalogSidebar);
  workspace.append(catalogSidebar, inspector);

  const header = document.createElement('header');
  header.className = 'cos-worker-topbar';
  header.innerHTML = `
    <div>
      <span class="cos-eyebrow" data-worker-eyebrow>Actionable site maintenance</span>
      <h1 data-worker-title>Findings</h1>
    </div>
    <div class="cos-worker-top-actions">
      <button type="button" class="cos-worker-link" data-suite-url="https://site-health.oceanliners.net/">Site Health</button>
      <button type="button" class="cos-worker-link" data-suite-url="https://curator-indexer.oceanliners.net/">Curator Indexer</button>
      <button type="button" class="cos-worker-link" data-suite-url="https://speed.oceanliners.net/">Curator Speed</button>
      <button type="button" class="cos-worker-link" data-suite-url="https://page-studio.oceanliners.net/">Page Studio</button>
      <button type="button" data-worker-command>⌘ Command</button>
      <button type="button" data-worker-backup>Quick Backup</button>
    </div>
  `;
  workspace.insertBefore(header, workspace.firstChild);

  const dashboard = document.createElement('section');
  dashboard.className = 'cos-worker-dashboard';
  workspace.insertBefore(dashboard, catalogSidebar);

  const findingsInput = document.createElement('input');
  findingsInput.type = 'file';
  findingsInput.accept = '.json,.csv,application/json,text/csv';
  findingsInput.hidden = true;
  findingsInput.dataset.findingsImportFile = '';
  findingsInput.dataset.requestedSource = '';
  dashboard.before(findingsInput);

  const catalogInput = document.createElement('input');
  catalogInput.type = 'file';
  catalogInput.accept = '.json,application/json';
  catalogInput.hidden = true;
  catalogInput.dataset.catalogImportFile = '';
  dashboard.before(catalogInput);

  const savedMode = localStorage.getItem(WORKSPACE_KEY);
  const state = { workspace: savedMode === 'knowledge' ? 'knowledge' : 'operations', view: 'dashboard', filter: 'open', category: '', severity: '', search: '', notice: '' };
  let filterRenderQueued = false;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function handledIds() {
    return new Set(Array.isArray(readJson(FINDINGS_KEY, [])) ? readJson(FINDINGS_KEY, []) : []);
  }

  function saveHandled(set) {
    localStorage.setItem(FINDINGS_KEY, JSON.stringify([...set]));
  }

  function importedFindings() {
    const value = readJson(IMPORTED_FINDINGS_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveImported(findings) {
    localStorage.setItem(IMPORTED_FINDINGS_KEY, JSON.stringify(findings));
  }

  function scanHistory() {
    const value = readJson(SCAN_HISTORY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveScanHistory(history) {
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  }

  function verifiedFindings() {
    const value = readJson(VERIFIED_FINDINGS_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveVerified(findings) {
    localStorage.setItem(VERIFIED_FINDINGS_KEY, JSON.stringify(findings.slice(0, 100)));
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
    const imported = importedFindings();
    const findings = dedupeFindings([...buildFindings(records), ...imported]);
    const handled = handledIds();
    const open = findings.filter((item) => !handled.has(item.id));
    const statusPool = state.filter === 'handled' ? findings.filter((item) => handled.has(item.id)) : open;
    const categories = [...new Set(findings.map((item) => item.category).filter(Boolean))].sort();
    const visible = statusPool.filter((item) => {
      if (state.category && item.category !== state.category) return false;
      if (state.severity && item.severity !== state.severity) return false;
      if (state.search) {
        const haystack = [item.title,item.summary,item.recommendation,item.context,item.pageUrl,item.targetUrl,item.replacementUrl,item.recordId].join(' ').toLowerCase();
        if (!haystack.includes(state.search.toLowerCase())) return false;
      }
      return true;
    });
    const counts = countBy(open, 'category');
    const history = scanHistory();
    dashboard.innerHTML = `${state.notice ? `<div class="cos-worker-notice" role="status">${escapeHtml(state.notice)}</div>` : ''}<div class="cos-worker-findings-hero">
      <div><span class="cos-eyebrow">What should I improve today?</span><h2>${open.length ? `${open.length} actionable finding${open.length === 1 ? '' : 's'}` : 'No open findings in the local catalog'}</h2><p>${records.length || imported.length ? 'Each item explains what CuratorOS found, why it matters, and what to do next.' : 'Load a catalog or import scan results to begin.'}</p></div>
      <div class="cos-worker-actions"><button type="button" data-catalog-import>Load catalog</button><button type="button" data-findings-import>Import any scan</button><button type="button" data-findings-export>Export visible work list</button><button type="button" data-worker-filter="open" class="${state.filter === 'open' ? 'active' : ''}">Open findings</button><button type="button" data-worker-filter="handled" class="${state.filter === 'handled' ? 'active' : ''}">Handled</button><button type="button" data-findings-collapse-all>Collapse all</button><button type="button" data-findings-expand-all>Expand all</button></div>
    </div>
    ${renderBriefing(history)}
    <section class="cos-worker-scan-launchers"><div class="cos-worker-scan-intro"><span class="cos-eyebrow">Start with a scan</span><h2>Choose the tool you need</h2><p>Each scanner now has its own Run and Import action, while Import any scan remains available as a fallback.</p></div>${renderToolWorkflowCards()}</section>
    <div class="cos-worker-metrics">
      ${metric(counts.broken || 0, 'Broken links')}${metric(counts['link-maintenance'] || 0, 'Link maintenance')}${metric(counts['link-opportunity'] || 0, 'Link opportunities')}${metric(counts.unsourced || 0, 'Missing sources')}${metric(counts.metadata || 0, 'Missing metadata')}${metric(open.length, 'Open findings')}
    </div>
    <div class="cos-worker-findings-toolbar"><input type="search" data-findings-search placeholder="Search page, ship, URL, or issue…" value="${escapeHtml(state.search)}"><select data-findings-category><option value="">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}"${state.category === category ? ' selected' : ''}>${escapeHtml(labelCategory(category))}</option>`).join('')}</select><select data-findings-severity><option value="">All priorities</option>${['high','medium','low'].map((severity) => `<option value="${severity}"${state.severity === severity ? ' selected' : ''}>${severity.replace(/^./, (c) => c.toUpperCase())}</option>`).join('')}</select><button type="button" data-findings-clear-filters>Clear filters</button></div>
    <div class="cos-worker-findings-summary">Showing ${visible.length.toLocaleString()} of ${statusPool.length.toLocaleString()} ${state.filter === 'handled' ? 'handled' : 'open'} findings.</div>
    <div class="cos-worker-findings-list">${visible.length ? visible.map((item) => renderFinding(item, handled.has(item.id))).join('') : `<article class="cos-worker-panel"><h2>${state.filter === 'handled' ? 'No handled findings match these filters.' : 'No open findings match these filters.'}</h2><p>${statusPool.length ? 'Clear or adjust the filters to see the remaining findings.' : records.length || imported.length ? 'The currently loaded catalog and imported scans have no matching actionable findings.' : 'Load a catalog or import scan results to get started.'}</p></article>`}</div>`;
  }

  function refreshFindingResults() {
    const records = context.recordService?.all?.() || [];
    const findings = dedupeFindings([...buildFindings(records), ...importedFindings()]);
    const handled = handledIds();
    const open = findings.filter((item) => !handled.has(item.id));
    const statusPool = state.filter === 'handled' ? findings.filter((item) => handled.has(item.id)) : open;
    const visible = statusPool.filter((item) => {
      if (state.category && item.category !== state.category) return false;
      if (state.severity && item.severity !== state.severity) return false;
      if (state.search) {
        const haystack = [item.title,item.summary,item.recommendation,item.context,item.pageUrl,item.targetUrl,item.replacementUrl,item.recordId].join(' ').toLowerCase();
        if (!haystack.includes(state.search.toLowerCase())) return false;
      }
      return true;
    });
    const summary = dashboard.querySelector('.cos-worker-findings-summary');
    const list = dashboard.querySelector('.cos-worker-findings-list');
    if (summary) summary.textContent = `Showing ${visible.length.toLocaleString()} of ${statusPool.length.toLocaleString()} ${state.filter === 'handled' ? 'handled' : 'open'} findings.`;
    if (list) list.innerHTML = visible.length ? visible.map((item) => renderFinding(item, handled.has(item.id))).join('') : `<article class="cos-worker-panel"><h2>${state.filter === 'handled' ? 'No handled findings match these filters.' : 'No open findings match these filters.'}</h2><p>${statusPool.length ? 'Clear or adjust the filters to see the remaining findings.' : records.length || importedFindings().length ? 'The currently loaded catalog and imported scans have no matching actionable findings.' : 'Load a catalog or import scan results to get started.'}</p></article>`;
  }

  function queueFindingResultsRefresh() {
    if (filterRenderQueued) return;
    filterRenderQueued = true;
    requestAnimationFrame(() => {
      filterRenderQueued = false;
      refreshFindingResults();
    });
  }

  function renderWorkspaceChrome() {
    shell.dataset.workspaceMode = state.workspace;
    localStorage.setItem(WORKSPACE_KEY, state.workspace);
    shell.querySelectorAll('[data-workspace-mode]').forEach((button) => button.classList.toggle('active', button.dataset.workspaceMode === state.workspace));
    const summary = shell.querySelector('[data-workspace-summary]');
    if (summary) summary.innerHTML = state.workspace === 'operations'
      ? '<strong>Site Operations</strong><span>Scan, prioritize, repair, and verify the live website.</span>'
      : '<strong>Knowledge Records</strong><span>Build, review, and connect the structured knowledge behind the site.</span>';
    const nav = shell.querySelector('[data-worker-nav]');
    if (nav) nav.innerHTML = renderNav(state.workspace);
    header.querySelector('[data-worker-eyebrow]').textContent = state.workspace === 'operations' ? 'Actionable site maintenance' : 'Structured knowledge and provenance';
    header.querySelector('.cos-worker-top-actions').hidden = state.workspace === 'knowledge';
  }

  function setWorkspace(mode) {
    state.workspace = mode === 'knowledge' ? 'knowledge' : 'operations';
    renderWorkspaceChrome();
    setView(state.workspace === 'knowledge' ? 'registry' : 'dashboard');
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
    title.textContent = isDashboard ? 'Findings' : view === 'registry' ? 'Knowledge Records' : view === 'review' ? 'Review Queue' : view === 'graph' ? 'Knowledge Graph' : view === 'intelligence' ? 'Archive Intelligence' : view === 'session' ? 'Guided Session' : 'Developer Mode';
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
    root.dispatchEvent(new CustomEvent('curatoros:worker-view', { detail: { view, workspace: state.workspace } }));
    if (view === 'session') root.dispatchEvent(new CustomEvent('curatoros:open-guided-session'));
  }

  function applyFindingAction(action, id) {
    if (!id || !['handle', 'reopen'].includes(action)) return;
    const handled = handledIds();
    if (action === 'handle') handled.add(id);
    if (action === 'reopen') handled.delete(id);
    saveHandled(handled);
    state.notice = action === 'handle' ? 'Finding marked handled.' : 'Finding reopened.';
    updateDashboard();
  }

  function openFindingRecord(id) {
    if (!id) return;
    setWorkspace('knowledge');
    const result = shell.querySelector(`[data-record-id="${cssEscape(id)}"]`);
    if (result) result.click();
    else {
      state.notice = `Record ${id} is not currently loaded in the Registry.`;
      setWorkspace('operations');
      updateDashboard();
    }
  }

  const runControlAction = (control) => {
    if (!(control instanceof Element)) return;
    const workspaceButton = control.closest('[data-workspace-mode]');
    if (workspaceButton) { setWorkspace(workspaceButton.dataset.workspaceMode); return; }
    const suiteButton = control.closest('[data-suite-url]');
    if (suiteButton) { window.location.href = suiteButton.dataset.suiteUrl; return; }
    const collapseToggle = control.closest('[data-finding-collapse]');
    if (collapseToggle) {
      const card = collapseToggle.closest('.cos-worker-finding');
      const body = card?.querySelector('[data-finding-body]');
      if (card && body) {
        const collapsed = card.dataset.collapsed === 'true';
        card.dataset.collapsed = collapsed ? 'false' : 'true';
        body.hidden = !collapsed;
        collapseToggle.textContent = collapsed ? 'Collapse' : 'Expand';
        collapseToggle.setAttribute('aria-expanded', String(collapsed));
      }
      return;
    }
    if (control.closest('[data-findings-collapse-all]')) { dashboard.querySelectorAll('.cos-worker-finding').forEach((card) => setFindingCollapsed(card, true)); return; }
    if (control.closest('[data-findings-expand-all]')) { dashboard.querySelectorAll('.cos-worker-finding').forEach((card) => setFindingCollapsed(card, false)); return; }
    const viewButton = control.closest('[data-worker-view]');
    if (viewButton) { setView(viewButton.dataset.workerView); return; }
    const filterButton = control.closest('[data-worker-filter]');
    if (filterButton) { state.filter = filterButton.dataset.workerFilter; updateDashboard(); return; }
    if (control.closest('[data-findings-export]')) { exportVisibleFindings(); return; }
    if (control.closest('[data-findings-clear-filters]')) { state.search = ''; state.category = ''; state.severity = ''; updateDashboard(); return; }
    if (control.closest('[data-findings-clear-history]') && confirm('Clear saved scan history?')) { saveScanHistory([]); state.notice = 'Scan history cleared.'; updateDashboard(); return; }
    if (control.closest('[data-findings-clear-imported]') && confirm('Clear all imported findings?')) { saveImported([]); state.notice = 'Imported findings cleared.'; updateDashboard(); return; }
    const findingButton = control.closest('[data-finding-action]');
    if (findingButton) { applyFindingAction(findingButton.dataset.findingAction, findingButton.dataset.findingId); return; }
    const openRecord = control.closest('[data-finding-open]');
    if (openRecord) { openFindingRecord(openRecord.dataset.findingOpen); return; }
    if (control.closest('[data-worker-open-registry]')) { setWorkspace('knowledge'); setView('registry'); return; }
    if (control.closest('[data-worker-open-review]')) { setWorkspace('knowledge'); setView('review'); return; }
    if (control.closest('[data-worker-command]')) { openCommandPalette(root, setView); return; }
    if (control.closest('[data-worker-backup]')) { context.onQuickBackup?.(); return; }
  };

  const clickHandler = (event) => runControlAction(event.target);
  const safariControlHandler = (event) => runControlAction(event.detail?.control);

  const inputHandler = (event) => {
    if (event.target.matches('[data-findings-search]')) {
      state.search = event.target.value;
      queueFindingResultsRefresh();
    }
  };

  const changeHandler = (event) => {
    if (event.target.matches('[data-findings-category]')) { state.category = event.target.value; refreshFindingResults(); }
    if (event.target.matches('[data-findings-severity]')) { state.severity = event.target.value; refreshFindingResults(); }
  };

  root.addEventListener('click', clickHandler);
  root.addEventListener('curatoros:safari-control', safariControlHandler);
  dashboard.addEventListener('input', inputHandler);
  dashboard.addEventListener('change', changeHandler);

  function exportVisibleFindings() {
    const records = context.recordService?.all?.() || [];
    const findings = dedupeFindings([...buildFindings(records), ...importedFindings()]);
    const handled = handledIds();
    const pool = state.filter === 'handled' ? findings.filter((item) => handled.has(item.id)) : findings.filter((item) => !handled.has(item.id));
    const visible = pool.filter((item) => (!state.category || item.category === state.category) && (!state.severity || item.severity === state.severity) && (!state.search || [item.title,item.summary,item.recommendation,item.context,item.pageUrl,item.targetUrl,item.replacementUrl,item.recordId].join(' ').toLowerCase().includes(state.search.toLowerCase())));
    if (!visible.length) {
      state.notice = 'There are no visible findings to export.';
      updateDashboard();
      return;
    }
    const headers = ['status','severity','category','title','summary','recommendation','page_url','target_url','replacement_url','record_id','context'];
    const rows = visible.map((item) => [state.filter,item.severity,item.category,item.title,item.summary,item.recommendation,item.pageUrl || '',item.targetUrl || '',item.replacementUrl || '',item.recordId || '',item.context || '']);
    const csv = ['\uFEFF' + headers.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');
    downloadText(csv, `curatoros-${state.filter}-findings-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8');
    state.notice = `Exported ${visible.length} visible finding${visible.length === 1 ? '' : 's'}.`;
    updateDashboard();
  }

  findingsInput.addEventListener('change', async () => {
    const file = findingsInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const isSiteHealth = file.name.toLowerCase().endsWith('.csv');
      const value = isSiteHealth ? null : JSON.parse(text);
      if (value?.records && Array.isArray(value.records)) throw new Error('This is a CuratorOS catalog. Use Load catalog instead.');
      const requestedSource = findingsInput.dataset.requestedSource || '';
      if (requestedSource === 'site-health' && !isSiteHealth) throw new Error('Choose the CSV exported by Site Health.');
      if (requestedSource === 'speed' && value?.type !== 'curator-performance-scan') throw new Error('Choose a Curator Speed JSON report.');
      if (requestedSource === 'indexer' && value?.type === 'curator-performance-scan') throw new Error('Choose site-index.json from Curator Indexer.');
      const parsedResult = parseExternalScan(value, isSiteHealth, () => parseAuditCsv(text), parseImportedJson);
      const sourceType = parsedResult.sourceType;
      const parsed = parsedResult.findings.map((item) => ({ ...item, sourceType }));
      const history = scanHistory();
      const previous = history.find((item) => item.sourceType === sourceType);
      const current = importedFindings();
      const previousSourceFindings = current.filter((item) => item.sourceType === sourceType);
      const previousById = new Map(previousSourceFindings.map((item) => [item.id, item]));
      const previousIds = new Set(previous?.findingIds || previousSourceFindings.map((item) => item.id));
      const currentIds = new Set(parsed.map((item) => item.id));
      const verifiedIds = previous ? [...previousIds].filter((id) => !currentIds.has(id)) : [];
      const verified = verifiedIds.map((id) => {
        const found = previousById.get(id) || { id, title: 'Verified finding', pageUrl: '', targetUrl: '', category: 'finding' };
        return { ...found, verifiedAt: new Date().toISOString(), sourceType };
      });
      if (verified.length) saveVerified([...verified, ...verifiedFindings()]);
      const retained = current.filter((item) => item.sourceType !== sourceType);
      saveImported([...retained, ...parsed]);
      saveScanHistory([{ sourceType, importedAt: new Date().toISOString(), findingIds: [...currentIds], count: parsed.length, verifiedCount: verified.length }, ...history.filter((item) => item.sourceType !== sourceType)]);
      state.notice = `Imported ${parsed.length} finding${parsed.length === 1 ? '' : 's'} from ${sourceLabel(sourceType)}${verified.length ? ` and verified ${verified.length} previously open finding${verified.length === 1 ? '' : 's'}` : ''}.`;
      updateDashboard();
    } catch (error) {
      state.notice = error instanceof Error ? error.message : String(error);
      updateDashboard();
    } finally {
      findingsInput.value = '';
      findingsInput.dataset.requestedSource = '';
    }
  });

  catalogInput.addEventListener('change', async () => {
    const file = catalogInput.files?.[0];
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      const records = Array.isArray(value?.records) ? value.records : Array.isArray(value) ? value : null;
      if (!records) throw new Error('Choose a CuratorOS catalog JSON file.');
      context.onCatalogImport?.(value);
      state.notice = `Loaded ${records.length} catalog record${records.length === 1 ? '' : 's'}.`;
      updateDashboard();
    } catch (error) {
      state.notice = error instanceof Error ? error.message : String(error);
      updateDashboard();
    } finally {
      catalogInput.value = '';
    }
  });

  renderWorkspaceChrome();
  setView(state.view);
  updateDashboard();

  return {
    destroy() {
      root.removeEventListener('click', clickHandler);
      root.removeEventListener('curatoros:safari-control', safariControlHandler);
      dashboard.removeEventListener('input', inputHandler);
      dashboard.removeEventListener('change', changeHandler);
    }
  };
}

function renderNav(workspace) {
  const groups = MODULES[workspace] || [];
  return groups.map(([view, label]) => `<button type="button" data-worker-view="${view}">${label}</button>`).join('');
}

function renderBriefing(history) {
  if (!history.length) return '';
  const latest = history[0];
  return `<section class="cos-worker-panel"><span class="cos-eyebrow">Latest import</span><h2>${escapeHtml(sourceLabel(latest.sourceType))}</h2><p>${Number(latest.count || 0).toLocaleString()} findings imported${latest.verifiedCount ? ` · ${Number(latest.verifiedCount).toLocaleString()} verified` : ''}.</p><div class="cos-worker-actions"><button type="button" data-findings-clear-history>Clear history</button><button type="button" data-findings-clear-imported>Clear imported findings</button></div></section>`;
}

function metric(value, label) {
  return `<div><strong>${Number(value || 0).toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`;
}

function finding(record, category, severity, summary, recommendation, actionLabel) {
  return {
    id: `${record.id}:${category}`,
    recordId: record.id,
    title: record.title || record.id,
    category,
    severity,
    summary,
    recommendation,
    actionLabel
  };
}

function missingCoreMetadata(record) {
  const missing = [];
  if (!record.title) missing.push('title');
  if (!record.type) missing.push('type');
  if (!record.status) missing.push('status');
  return missing;
}

function renderFinding(item, handled) {
  const id = escapeHtml(item.id);
  const recordId = escapeHtml(item.recordId || '');
  return `<article class="cos-worker-finding" data-collapsed="false"><div class="cos-worker-finding-head"><div><span class="cos-worker-priority ${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span><span class="cos-worker-category">${escapeHtml(labelCategory(item.category))}</span><h3>${escapeHtml(item.title)}</h3></div><button type="button" data-finding-collapse aria-expanded="true">Collapse</button></div><div data-finding-body><p>${escapeHtml(item.summary || '')}</p>${item.recommendation ? `<div class="cos-worker-recommendation"><strong>Recommended action</strong><span>${escapeHtml(item.recommendation)}</span></div>` : ''}${item.context ? `<p class="cos-worker-context">${escapeHtml(item.context)}</p>` : ''}<div class="cos-worker-actions">${recordId ? `<button type="button" data-finding-open="${recordId}">${escapeHtml(item.actionLabel || 'Open record')}</button>` : ''}<button type="button" data-finding-action="${handled ? 'reopen' : 'handle'}" data-finding-id="${id}">${handled ? 'Reopen' : 'Mark handled'}</button>${item.pageUrl ? `<a href="${escapeHtml(item.pageUrl)}" target="_blank" rel="noopener">Open page</a>` : ''}${item.targetUrl ? `<a href="${escapeHtml(item.targetUrl)}" target="_blank" rel="noopener">Check target</a>` : ''}${item.replacementUrl ? `<a href="${escapeHtml(item.replacementUrl)}" target="_blank" rel="noopener">Suggested replacement</a>` : ''}</div></div></article>`;
}

function setFindingCollapsed(card, collapsed) {
  const body = card.querySelector('[data-finding-body]');
  const button = card.querySelector('[data-finding-collapse]');
  if (!body) return;
  card.dataset.collapsed = collapsed ? 'true' : 'false';
  body.hidden = collapsed;
  if (button) {
    button.textContent = collapsed ? 'Expand' : 'Collapse';
    button.setAttribute('aria-expanded', String(!collapsed));
  }
}

function dedupeFindings(items) {
  const map = new Map();
  for (const item of items) if (item?.id && !map.has(item.id)) map.set(item.id, item);
  return [...map.values()];
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item?.[key];
    if (value) acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function labelCategory(value) {
  return String(value || 'finding').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function sourceLabel(value) {
  if (value === 'site-health') return 'Site Health';
  if (value === 'speed') return 'Curator Speed';
  if (value === 'indexer') return 'Curator Indexer';
  return 'Imported scan';
}

function openCommandPalette(root, setView) {
  const command = prompt('Open view: findings, session, registry, graph, intelligence, review, or developer');
  if (!command) return;
  const normalized = command.trim().toLowerCase();
  const views = { findings: 'dashboard', session: 'session', registry: 'registry', graph: 'graph', intelligence: 'intelligence', review: 'review', developer: 'developer' };
  const view = views[normalized];
  if (view) setView(view);
  else root.dispatchEvent(new CustomEvent('curatoros:command', { detail: { command } }));
}

function parseAuditCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => value.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

function parseImportedJson(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.findings)) return value.findings;
  if (Array.isArray(value?.pages)) return value.pages;
  return [];
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/["\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
