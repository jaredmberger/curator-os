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

  const clickHandler = (event) => {
    const workspaceButton = event.target.closest('[data-workspace-mode]');
    if (workspaceButton) {
      setWorkspace(workspaceButton.dataset.workspaceMode);
      return;
    }
    const suiteButton = event.target.closest('[data-suite-url]');
    if (suiteButton) {
      window.location.href = suiteButton.dataset.suiteUrl;
      return;
    }
    const collapseToggle = event.target.closest('[data-finding-collapse]');
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
    if (event.target.closest('[data-findings-collapse-all]')) {
      dashboard.querySelectorAll('.cos-worker-finding').forEach((card) => setFindingCollapsed(card, true));
      return;
    }
    if (event.target.closest('[data-findings-expand-all]')) {
      dashboard.querySelectorAll('.cos-worker-finding').forEach((card) => setFindingCollapsed(card, false));
      return;
    }
    const viewButton = event.target.closest('[data-worker-view]');
    if (viewButton) setView(viewButton.dataset.workerView);
    const filterButton = event.target.closest('[data-worker-filter]');
    if (filterButton) { state.filter = filterButton.dataset.workerFilter; updateDashboard(); }
    if (event.target.closest('[data-catalog-import]')) catalogInput.click();
    if (event.target.closest('[data-findings-import]')) {
      findingsInput.dataset.requestedSource = '';
      findingsInput.accept = '.json,.csv,application/json,text/csv';
      findingsInput.click();
    }
    const toolImport = event.target.closest('[data-tool-import]');
    if (toolImport) {
      const source = toolImport.dataset.toolImport || '';
      findingsInput.dataset.requestedSource = source;
      findingsInput.accept = toolAccept(source);
      findingsInput.click();
    }
    if (event.target.closest('[data-findings-export]')) exportVisibleFindings();
    if (event.target.closest('[data-findings-clear-filters]')) { state.search = ''; state.category = ''; state.severity = ''; updateDashboard(); }
    if (event.target.closest('[data-findings-clear-history]') && confirm('Clear saved scan history?')) { saveScanHistory([]); state.notice = 'Scan history cleared.'; updateDashboard(); }
    if (event.target.closest('[data-findings-clear-imported]') && confirm('Clear all imported findings?')) {
      saveImported([]);
      state.notice = 'Imported findings cleared.';
      updateDashboard();
    }
    const findingButton = event.target.closest('[data-finding-action]');
    if (findingButton) applyFindingAction(findingButton.dataset.findingAction, findingButton.dataset.findingId);
    const openRecord = event.target.closest('[data-finding-open]');
    if (openRecord) openFindingRecord(openRecord.dataset.findingOpen);
    if (event.target.closest('[data-worker-open-registry]')) { setWorkspace('knowledge'); setView('registry'); }
    if (event.target.closest('[data-worker-open-review]')) { setWorkspace('knowledge'); setView('review'); }
    if (event.target.closest('[data-worker-command]')) openCommandPalette(root, setView);
    if (event.target.closest('[data-worker-backup]')) context.onQuickBackup?.();
  };

  const safariWorkspaceHandler = (event) => setWorkspace(event.detail?.mode);
  const safariViewHandler = (event) => setView(event.detail?.view);
  const safariFindingActionHandler = (event) => applyFindingAction(event.detail?.action, event.detail?.id);
  const safariOpenRecordHandler = (event) => openFindingRecord(event.detail?.id);

  const inputHandler = (event) => {
    if (event.target.matches('[data-findings-search]')) {
      state.search = event.target.value;
      requestAnimationFrame(updateDashboard);
    }
  };

  const changeHandler = (event) => {
    if (event.target.matches('[data-findings-category]')) { state.category = event.target.value; updateDashboard(); }
    if (event.target.matches('[data-findings-severity]')) { state.severity = event.target.value; updateDashboard(); }
  };

  root.addEventListener('click', clickHandler);
  root.addEventListener('curatoros:safari-workspace', safariWorkspaceHandler);
  root.addEventListener('curatoros:safari-view', safariViewHandler);
  root.addEventListener('curatoros:safari-finding-action', safariFindingActionHandler);
  root.addEventListener('curatoros:safari-open-record', safariOpenRecordHandler);
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
      const verifiedArchive = verifiedFindings();
      const previouslyVerifiedIds = new Set(verifiedArchive.filter((item) => item.sourceType === sourceType).map((item) => item.id));
      const regressionIds = [...currentIds].filter((id) => previouslyVerifiedIds.has(id));
      const regressions = new Set(regressionIds);
      const parsedWithRegression = parsed.map((item) => regressions.has(item.id) ? { ...item, regression: true } : item);
      const preserved = current.filter((item) => item.sourceType !== sourceType);
      const merged = dedupeFindings([...preserved, ...parsedWithRegression]);
      const snapshot = {
        id: `${Date.now()}-${stableId(file.name)}`,
        importedAt: new Date().toISOString(),
        fileName: file.name,
        sourceType,
        count: parsedWithRegression.length,
        high: parsedWithRegression.filter((item) => item.severity === 'high').length,
        newCount: [...currentIds].filter((id) => !previousIds.has(id) && !previouslyVerifiedIds.has(id)).length,
        persistentCount: [...currentIds].filter((id) => previousIds.has(id)).length,
        verifiedCount: verified.length,
        resolvedCount: verified.length,
        regressionCount: regressionIds.length,
        findingIds: [...currentIds],
        verifiedFindings: verified.map((item) => ({ id:item.id, title:item.title, pageUrl:item.pageUrl || '', targetUrl:item.targetUrl || '', category:item.category || '', verifiedAt:item.verifiedAt }))
      };
      saveScanHistory([snapshot, ...history]);
      saveVerified(dedupeFindings([...verified, ...verifiedArchive.filter((item) => item.sourceType !== sourceType || !currentIds.has(item.id))]));
      saveImported(merged);
      const handled = handledIds();
      for (const id of verifiedIds) handled.delete(id);
      saveHandled(handled);
      state.filter = 'open';
      if (!parsed.length) {
        state.notice = `Imported ${file.name}. No actionable findings remain for ${sourceType}. ${snapshot.verifiedCount} fix${snapshot.verifiedCount === 1 ? '' : 'es'} verified.`;
      } else {
        state.notice = `Imported ${parsedWithRegression.length} finding${parsedWithRegression.length === 1 ? '' : 's'} from ${file.name}. ${snapshot.newCount} new, ${snapshot.persistentCount} persistent, ${snapshot.verifiedCount} verified fixed, ${snapshot.regressionCount} regression${snapshot.regressionCount === 1 ? '' : 's'}.`;
      }
    } catch (error) {
      state.notice = `Could not import ${file.name}: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      findingsInput.value = '';
      findingsInput.accept = '.json,.csv,application/json,text/csv';
      findingsInput.dataset.requestedSource = '';
      updateDashboard();
    }
  });

  catalogInput.addEventListener('change', async () => {
    const file = catalogInput.files?.[0];
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      if (!value || !Array.isArray(value.records)) throw new Error('Expected a CuratorOS catalog with a records array.');
      const records = value.records;
      let imported = false;
      if (typeof context.onCatalogImport === 'function') {
        await context.onCatalogImport(value, file);
        imported = true;
      } else if (typeof context.recordService?.replaceAll === 'function') {
        await context.recordService.replaceAll(records);
        imported = true;
      } else if (typeof context.recordService?.import === 'function') {
        await context.recordService.import(value);
        imported = true;
      }
      if (!imported) {
        state.notice = `${file.name} is a valid CuratorOS catalog with ${records.length.toLocaleString()} records, but this build does not yet expose a catalog-loading hook. Use the Registry import control for now.`;
        setWorkspace('knowledge');
        return;
      }
      state.notice = `Loaded ${records.length.toLocaleString()} catalog record${records.length === 1 ? '' : 's'} from ${file.name}.`;
      setWorkspace('knowledge');
    } catch (error) {
      state.notice = `Could not load ${file.name}: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      catalogInput.value = '';
      updateDashboard();
    }
  });

  const unsubscribe = context.recordService?.subscribe?.(() => updateDashboard()) || (() => {});
  updateDashboard();
  renderWorkspaceChrome();
  setView(state.workspace === 'knowledge' ? 'registry' : 'dashboard');
  return { updateDashboard, setView, setWorkspace, destroy() { unsubscribe(); root.removeEventListener('click', clickHandler); root.removeEventListener('curatoros:safari-workspace', safariWorkspaceHandler); root.removeEventListener('curatoros:safari-view', safariViewHandler); root.removeEventListener('curatoros:safari-finding-action', safariFindingActionHandler); root.removeEventListener('curatoros:safari-open-record', safariOpenRecordHandler); dashboard.removeEventListener('input', inputHandler); dashboard.removeEventListener('change', changeHandler); } };
}

function parseImportedJson(value) {
  if (!value || typeof value !== 'object') throw new Error('The JSON root must be an object.');
  if (Array.isArray(value)) return value.map(auditRowFinding).filter(Boolean);
  if (Array.isArray(value.rows)) return value.rows.map(auditRowFinding).filter(Boolean);
  if (Array.isArray(value.pages) || Array.isArray(value.entities?.pages)) return indexFindings(value);
  if (Array.isArray(value.records)) return recordExportFindings(value.records);
  if (Array.isArray(value.errors) || Array.isArray(value.graphs?.unlinkedShipMentions)) return indexFindings(value);
  throw new Error('Expected a Curator Speed report, site-index export, or Site Health results.');
}

function parseAuditCsv(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!rows.length) return [];
  return rows.map(auditRowFinding).filter(Boolean);
}

function auditRowFinding(row) {
  const normalized = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [String(key).trim().toLowerCase(), value]));
  const severity = String(normalized.severity || '').toLowerCase();
  const category = String(normalized.category || '').toUpperCase();
  const status = Number.parseInt(normalized.status || '', 10);
  const redirected = String(normalized.redirected || '').toLowerCase() === 'true' || category === 'REDIRECT';
  const targetUrl = normalized.target_url || normalized.target || normalized.url || '';
  const pageUrl = normalized.page_url || normalized.page || normalized.source_url || '';
  const replacementUrl = normalized.replacement_url || normalized.replacement || '';
  if (redirected && status >= 200 && status < 300) return null;
  if (!severity && !category && !targetUrl && !pageUrl) return null;
  return {
    id: normalized.id || `finding-${stableId([category,severity,pageUrl,targetUrl,replacementUrl,normalized.message || normalized.summary].join('|'))}`,
    severity: ['high','medium','low'].includes(severity) ? severity : category.includes('BROKEN') || status >= 400 ? 'high' : category.includes('REDIRECT') ? 'low' : 'medium',
    category: normalizeCategory(category || normalized.type || 'finding'),
    title: normalized.title || normalized.message || normalized.summary || `${category || 'Imported'} finding`,
    summary: normalized.summary || normalized.message || '',
    recommendation: normalized.recommendation || normalized.fix || normalized.action || '',
    pageUrl,
    targetUrl,
    replacementUrl,
    recordId: normalized.record_id || normalized.record || '',
    context: normalized.context || normalized.details || '',
    sourceType: normalized.source_type || normalized.source || ''
  };
}

function indexFindings(value) {
  const pages = value.pages || value.entities?.pages || [];
  const findings = [];
  for (const page of pages) {
    if (page.missingTitle || !page.title) findings.push(importedFinding(page, 'metadata', 'medium', 'Page is missing a title.', 'Add a clear title element.'));
    if (page.missingDescription || !page.description) findings.push(importedFinding(page, 'metadata', 'medium', 'Page is missing a meta description.', 'Add a concise description.'));
  }
  for (const item of value.errors || []) findings.push({ id:`finding-${stableId(JSON.stringify(item))}`,severity:'high',category:'indexer',title:item.title || item.message || 'Indexer error',summary:item.message || '',recommendation:item.recommendation || 'Review the indexer error.',pageUrl:item.pageUrl || item.url || '',targetUrl:item.targetUrl || '',replacementUrl:'',recordId:'',context:item.context || '',sourceType:'indexer' });
  return findings;
}

function recordExportFindings(records) {
  return records.flatMap((record) => {
    const findings = [];
    if (!(record.sources || []).length) findings.push(finding(record, 'unsourced', 'high', `${record.title || record.id} has no direct source attached.`, 'Add at least one source or curatorial note.', 'Open record'));
    return findings;
  });
}

function importedFinding(page, category, severity, summary, recommendation) {
  const pageUrl = page.url || page.canonical || page.path || '';
  return { id:`finding-${stableId([category,pageUrl,summary].join('|'))}`,severity,category,title:page.title || pageUrl || 'Indexed page',summary,recommendation,pageUrl,targetUrl:'',replacementUrl:'',recordId:page.recordId || '',context:'',sourceType:'indexer' };
}

function renderBriefing(history) {
  if (!history.length) return '';
  const latest = history[0];
  return `<section class="cos-worker-panel"><span class="cos-eyebrow">Latest scan</span><h2>${escapeHtml(latest.fileName || latest.sourceType || 'Imported scan')}</h2><p>${latest.count || 0} findings · ${latest.newCount || 0} new · ${latest.persistentCount || 0} persistent · ${latest.verifiedCount || 0} verified · ${latest.regressionCount || 0} regressions</p></section>`;
}

function renderFinding(item, handled) {
  const actions = [];
  if (item.recordId) actions.push(`<button type="button" data-finding-open="${escapeHtml(item.recordId)}">Open record</button>`);
  if (item.pageUrl) actions.push(`<a class="cos-worker-action-link" href="${escapeHtml(item.pageUrl)}">Open affected page</a>`);
  if (item.targetUrl) actions.push(`<a class="cos-worker-action-link" href="${escapeHtml(item.targetUrl)}">Open checked URL</a>`);
  if (item.replacementUrl) actions.push(`<a class="cos-worker-action-link" href="${escapeHtml(item.replacementUrl)}">Open replacement</a>`);
  if (item.pageUrl) actions.push(`<a class="cos-worker-action-link" href="https://page-studio.oceanliners.net/?url=${encodeURIComponent(item.pageUrl)}" data-page-studio-handoff>Edit in Page Studio</a>`);
  actions.push(`<button type="button" data-finding-action="${handled ? 'reopen' : 'handle'}" data-finding-id="${escapeHtml(item.id)}">${handled ? 'Reopen' : 'Mark handled'}</button>`);
  return `<article class="cos-worker-finding severity-${escapeHtml(item.severity)}" data-finding-card data-finding-id="${escapeHtml(item.id)}"><div class="cos-worker-finding-head"><div><span>${escapeHtml(labelCategory(item.category))}</span><h3>${escapeHtml(item.title)}</h3></div><strong>${escapeHtml(item.severity)} priority</strong></div><p>${escapeHtml(item.summary || '')}</p>${item.context ? `<p><strong>Context:</strong> ${escapeHtml(item.context)}</p>` : ''}<p><strong>Recommended action:</strong> ${escapeHtml(item.recommendation || 'Review and resolve this finding.')}</p><div class="cos-worker-actions">${actions.join('')}</div></article>`;
}

function finding(record, category, severity, summary, recommendation, action) {
  return { id:`finding-${stableId(`${record.id}|${category}|${summary}`)}`,severity,category,title:`${action}: ${record.title || record.id}`,summary,recommendation,pageUrl:record.data?.pageUrl || record.metadata?.pageUrl || '',targetUrl:'',replacementUrl:'',recordId:record.id,context:'',sourceType:'catalog' };
}

function normalizeCategory(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('broken')) return 'broken';
  if (text.includes('redirect')) return 'link-maintenance';
  if (text.includes('source')) return 'unsourced';
  if (text.includes('meta')) return 'metadata';
  return text.replace(/[^a-z0-9]+/g, '-') || 'finding';
}

function labelCategory(value) {
  return String(value || 'finding').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function countBy(items, key) {
  return items.reduce((acc, item) => { acc[item[key]] = (acc[item[key]] || 0) + 1; return acc; }, {});
}

function dedupeFindings(items) {
  const seen = new Map();
  for (const item of items) if (item?.id) seen.set(item.id, item);
  return [...seen.values()];
}

function missingCoreMetadata(record) {
  const keys = record.type === 'ship' ? ['builder','operator','launchDate'] : record.type === 'company' ? ['country'] : [];
  return keys.filter((key) => !record.data?.[key]);
}

function renderNav(workspace) {
  return MODULES[workspace].map(([icon,label]) => `<button type="button" data-worker-view="${label === 'Findings' ? 'dashboard' : label === 'Guided Session' ? 'session' : label === 'Developer Mode' ? 'developer' : label === 'Registry' ? 'registry' : label === 'Graph' ? 'graph' : label === 'Intelligence' ? 'intelligence' : 'review'}"><span>${escapeHtml(icon)}</span>${escapeHtml(label)}</button>`).join('');
}

function metric(value, label) {
  return `<article><strong>${Number(value || 0).toLocaleString()}</strong><span>${escapeHtml(label)}</span></article>`;
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

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift()?.map((value) => value.trim()) || [];
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
}

function stableId(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function openCommandPalette(root, setView) {
  const options = [...MODULES.operations, ...MODULES.knowledge];
  const choice = prompt(`Open a CuratorOS view:\n${options.map(([,label],index) => `${index + 1}. ${label}`).join('\n')}`);
  const index = Number(choice) - 1;
  const selected = options[index]?.[1];
  if (!selected) return;
  setView(selected === 'Findings' ? 'dashboard' : selected === 'Guided Session' ? 'session' : selected === 'Developer Mode' ? 'developer' : selected === 'Registry' ? 'registry' : selected === 'Graph' ? 'graph' : selected === 'Intelligence' ? 'intelligence' : 'review');
}
