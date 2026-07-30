import { renderToolWorkflowCards, toolAccept } from './tool-workflows.js';
import { parseExternalScan } from './scan-import-adapter.js';

const MODULES = [
  ['home', 'Findings'],
  ['archive', 'Registry'],
  ['knowledge', 'Graph'],
  ['knowledge', 'Intelligence'],
  ['editorial', 'Review Queue'],
  ['administration', 'Developer Mode']
];

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
  header.innerHTML = `
    <div>
      <span class="cos-eyebrow">Actionable site maintenance</span>
      <h1 data-worker-title>Findings</h1>
    </div>
    <div class="cos-worker-top-actions">
      <a class="cos-worker-link" href="https://site-health.oceanliners.net/">Site Health</a>
      <a class="cos-worker-link" href="https://curator-indexer.oceanliners.net/">Curator Indexer</a>
      <a class="cos-worker-link" href="https://speed.oceanliners.net/">Curator Speed</a>
      <a class="cos-worker-link" href="https://page-studio.oceanliners.net/">Page Studio</a>
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

  const state = { view: 'dashboard', filter: 'open', category: '', severity: '', search: '', notice: '' };

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
      <div class="cos-worker-actions"><button type="button" data-catalog-import>Load catalog</button><button type="button" data-findings-import>Import any scan</button><button type="button" data-findings-export>Export visible work list</button><button type="button" data-worker-filter="open" class="${state.filter === 'open' ? 'active' : ''}">Open findings</button><button type="button" data-worker-filter="handled" class="${state.filter === 'handled' ? 'active' : ''}">Handled</button></div>
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

  const clickHandler = (event) => {
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
      if (result) result.click();
      else { state.notice = `Record ${id} is not currently loaded in the Registry.`; setView('dashboard'); updateDashboard(); }
    }
    if (event.target.closest('[data-worker-open-registry]')) setView('registry');
    if (event.target.closest('[data-worker-open-review]')) setView('review');
    if (event.target.closest('[data-worker-command]')) openCommandPalette(root, setView);
    if (event.target.closest('[data-worker-backup]')) context.onQuickBackup?.();
  };

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
        setView('registry');
        return;
      }
      state.notice = `Loaded ${records.length.toLocaleString()} catalog record${records.length === 1 ? '' : 's'} from ${file.name}.`;
      setView('registry');
    } catch (error) {
      state.notice = `Could not load ${file.name}: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      catalogInput.value = '';
      updateDashboard();
    }
  });

  const unsubscribe = context.recordService?.subscribe?.(() => updateDashboard()) || (() => {});
  updateDashboard();
  setView('dashboard');
  return { updateDashboard, setView, destroy() { unsubscribe(); root.removeEventListener('click', clickHandler); dashboard.removeEventListener('input', inputHandler); dashboard.removeEventListener('change', changeHandler); } };
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
  if (!normalized.checked_url && !normalized.url) return null;
  if (severity === 'good' || category === 'GOOD') return null;
  if (status >= 200 && status < 300 && !redirected) return null;

  const pageUrl = normalized.page_url || normalized.pageurl || '';
  const checkedUrl = normalized.checked_url || normalized.url || '';
  const finalUrl = normalized.final_url || normalized.finalurl || '';
  const replacement = normalized.replacement_url || normalized.replacementurl || '';
  const label = normalized.anchor_text || normalized.anchor || checkedUrl;

  if (redirected && status >= 200 && status < 300) {
    const destination = finalUrl || (replacement && replacement !== checkedUrl ? replacement : '');
    return externalFinding({
      id: `audit:${stableId(`${pageUrl}|${checkedUrl}|REDIRECT`)}`,
      category: 'link-maintenance',
      severity: 'low',
      title: normalized.page_title || normalized.pagetitle || pageUrl || 'Redirected link',
      summary: `${label} redirects successfully and the final destination returned ${status}.`,
      recommendation: destination ? `No immediate action is required. During routine maintenance, update the link to point directly to ${destination}.` : 'No immediate action is required. The link is working; updating it is optional maintenance.',
      action: 'Open affected page',
      pageUrl,
      targetUrl: checkedUrl,
      replacementUrl: destination,
      context: normalized.context || ''
    });
  }

  return externalFinding({
    id: `audit:${stableId(`${pageUrl}|${checkedUrl}|${status || category || severity}`)}`,
    category: status >= 400 || category === 'BROKEN' ? 'broken' : 'link-maintenance',
    severity: severity === 'high' || status >= 500 ? 'high' : severity === 'medium' || status >= 400 ? 'medium' : 'low',
    title: normalized.page_title || normalized.pagetitle || pageUrl || checkedUrl || 'Link finding',
    summary: `${label} returned ${status || category || severity || 'an error'}.`,
    recommendation: replacement && replacement !== checkedUrl ? `Update the link to ${replacement}.` : 'Review the link and replace or remove it if it is no longer valid.',
    action: 'Open affected page',
    pageUrl,
    targetUrl: checkedUrl,
    replacementUrl: replacement && replacement !== checkedUrl ? replacement : '',
    context: normalized.context || ''
  });
}

function indexFindings(value) {
  const pages = Array.isArray(value.pages) ? value.pages : Array.isArray(value.entities?.pages) ? value.entities.pages : [];
  const errors = Array.isArray(value.errors) ? value.errors : [];
  const unlinked = Array.isArray(value.graphs?.unlinkedShipMentions) ? value.graphs.unlinkedShipMentions : [];
  const findings = [];
  for (const error of errors) {
    const url = error.url || error.pageUrl || '';
    findings.push(externalFinding({ id:`index:${stableId(JSON.stringify(error))}`,category:'crawl',severity:'high',title:error.title || url || 'Indexer crawl error',summary:error.message || error.error || 'Curator Indexer reported a crawl error.',recommendation:'Open the affected page and confirm it is reachable and indexable.',action:'Open affected page',pageUrl:url,context:error.context || '' }));
  }
  for (const page of pages) {
    if (page.error) findings.push(externalFinding({ id:`index:${stableId(`${page.url}|${page.error}`)}`,category:'crawl',severity:'high',title:page.title || page.url || 'Page crawl error',summary:String(page.error),recommendation:'Open the page and repair the crawl or rendering failure.',action:'Open affected page',pageUrl:page.url || '' }));
    if (!page.sourceCount && !page.sources?.length) findings.push(externalFinding({ id:`index:${stableId(`${page.url}|sources`)}`,category:'unsourced',severity:'medium',title:page.title || page.url || 'Unsourced page',summary:'The index export did not detect a source or citation on this page.',recommendation:'Review the page and add or clarify its source section if appropriate.',action:'Open affected page',pageUrl:page.url || '' }));
  }
  for (const item of unlinked) findings.push(externalFinding({ id:`index:${stableId(JSON.stringify(item))}`,category:'link-opportunity',severity:'low',title:item.pageTitle || item.shipName || item.pageUrl || 'Unlinked ship mention',summary:`${item.shipName || 'A ship mention'} appears without a link.`,recommendation:item.targetUrl ? `Link the mention to ${item.targetUrl}.` : 'Review the mention and link it to the appropriate ship guide.',action:'Open affected page',pageUrl:item.pageUrl || '',targetUrl:item.targetUrl || '',context:item.context || '' }));
  return findings;
}

function recordExportFindings(records) {
  return records.flatMap((record) => {
    const findings = [];
    if (!(record.sources || []).length) findings.push(finding(record, 'unsourced', 'high', `${record.title || record.id} has no direct source attached.`, 'Add at least one source or curatorial evidence note.', 'Open record and add source'));
    if (record.status === 'review' || record.status === 'draft') findings.push(finding(record, 'review', record.status === 'draft' ? 'high' : 'medium', `${record.title || record.id} is still marked ${record.status}.`, 'Complete review and update its publication state.', 'Open record for review'));
    return findings;
  });
}

function externalFinding(input) {
  return { id:input.id,recordId:input.recordId || '',title:input.title || 'Finding',summary:input.summary || '',recommendation:input.recommendation || '',category:input.category || 'finding',severity:input.severity || 'medium',action:input.action || 'Open affected page',pageUrl:input.pageUrl || '',targetUrl:input.targetUrl || '',replacementUrl:input.replacementUrl || '',context:input.context || '',source:'imported' };
}

function finding(record, category, severity, summary, recommendation, action) {
  return { id:`local:${record.id}:${category}`,recordId:record.id,title:record.title || record.id,summary,recommendation,category,severity,action,pageUrl:record.metadata?.url || record.data?.url || '',targetUrl:'',replacementUrl:'',context:'',source:'catalog' };
}

function renderFinding(item, handled) {
  const details = [item.pageUrl ? `<p><strong>Affected page:</strong> <a href="${escapeHtml(item.pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.pageUrl)}</a></p>` : '', item.targetUrl ? `<p><strong>Checked URL:</strong> <a href="${escapeHtml(item.targetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.targetUrl)}</a></p>` : '', item.replacementUrl ? `<p><strong>Suggested destination:</strong> <a href="${escapeHtml(item.replacementUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.replacementUrl)}</a></p>` : '', item.context ? `<p><strong>Context:</strong> ${escapeHtml(item.context)}</p>` : ''].join('');
  const primary = item.recordId ? `<button type="button" data-finding-open="${escapeHtml(item.recordId)}">${escapeHtml(item.action)}</button>` : item.pageUrl ? `<a class="cos-worker-action-link" href="${escapeHtml(item.pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.action)}</a>` : '';
  const pageStudio = item.pageUrl ? `<a class="cos-worker-action-link" href="${pageStudioHref(item)}" target="_blank" rel="noopener noreferrer">Edit in Page Studio</a>` : '';
  return `<article class="cos-worker-finding ${escapeHtml(item.severity)}" data-finding-id="${escapeHtml(item.id)}"><div class="cos-worker-finding-head"><div><span class="cos-worker-finding-category">${escapeHtml(labelCategory(item.category))}</span><h2>${escapeHtml(item.title)}</h2><small>${escapeHtml(item.id)}${item.regression ? ' · regression' : ''}</small></div><span class="cos-worker-finding-severity">${escapeHtml(item.severity)}</span></div><p>${escapeHtml(item.summary)}</p>${details}<p><strong>Recommended action:</strong> ${escapeHtml(item.recommendation)}</p><div class="cos-worker-actions">${primary}${pageStudio}<button type="button" data-finding-action="${handled ? 'reopen' : 'handle'}" data-finding-id="${escapeHtml(item.id)}">${handled ? 'Reopen finding' : 'Mark handled'}</button></div></article>`;
}

function pageStudioHref(item) {
  const params = new URLSearchParams();
  params.set('source', 'curatoros');
  params.set('target', item.pageUrl || '');
  params.set('findingId', item.id || '');
  params.set('findingTitle', item.title || 'CuratorOS finding');
  params.set('findingSummary', item.summary || '');
  params.set('recommendation', item.recommendation || '');
  params.set('category', item.category || '');
  params.set('severity', item.severity || '');
  if (item.targetUrl) params.set('checkedUrl', item.targetUrl);
  if (item.replacementUrl) params.set('replacementUrl', item.replacementUrl);
  if (item.context) params.set('context', item.context);
  return `https://page-studio.oceanliners.net/?${params.toString()}`;
}

function renderNav() {
  const groups = { home:'Home',archive:'Archive',knowledge:'Knowledge',editorial:'Editorial',administration:'Administration' };
  let group = '';
  return MODULES.map(([next, label], index) => { const view = ['dashboard','registry','graph','intelligence','review','developer'][index]; const heading = next !== group ? `<span class="cos-worker-nav-group">${groups[next]}</span>` : ''; group = next; return `${heading}<button type="button" data-worker-view="${view}" class="${view === 'dashboard' ? 'active' : ''}">${label}</button>`; }).join('');
}

function renderBriefing(history) {
  if (!history.length) return `<section class="cos-worker-briefing"><span class="cos-eyebrow">Assurance briefing</span><h2>No scan history yet</h2><p>Run Site Health, Curator Indexer, or Curator Speed, then import the exported report. CuratorOS will compare each new scan with the previous one.</p></section>`;
  const latest = history[0];
  return `<section class="cos-worker-briefing"><div class="cos-worker-briefing-head"><div><span class="cos-eyebrow">Latest assurance briefing</span><h2>${escapeHtml(latest.fileName)}</h2><p>Imported ${escapeHtml(formatDate(latest.importedAt))} · ${escapeHtml(latest.sourceType)}</p></div><button type="button" data-findings-clear-history>Clear history</button></div><div class="cos-worker-scan-history"><div><strong>${latest.count}</strong><span>current findings</span></div><div><strong>${latest.newCount || 0}</strong><span>new</span></div><div><strong>${latest.persistentCount || 0}</strong><span>persistent</span></div><div><strong>${latest.verifiedCount ?? latest.resolvedCount ?? 0}</strong><span>verified fixed</span></div><div><strong>${latest.regressionCount || 0}</strong><span>regressions</span></div></div><div class="cos-worker-actions"><button type="button" data-findings-clear-imported>Clear imported findings</button></div></section>`;
}

function metric(value, label) { return `<article class="cos-worker-metric"><strong>${value}</strong><span>${label}</span></article>`; }
function countBy(values, key) { return values.reduce((map, value) => { map[value[key]] = (map[value[key]] || 0) + 1; return map; }, {}); }
function missingCoreMetadata(record) { const requirements = { ship:['builder','launchDate'],company:['country'],organization:['country'],person:[],object:['date'],photo:['date'],source:['title'] }; return (requirements[record.type] || []).filter((key) => !record.data?.[key] && !record.metadata?.[key]); }
function dedupeFindings(values) { const map = new Map(); for (const value of values) if (value?.id) map.set(value.id, { ...map.get(value.id), ...value }); return [...map.values()]; }
function labelCategory(value) { return String(value || 'finding').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function stableId(value) { let hash = 2166136261; for (const char of String(value || '')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function cssEscape(value) { return globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|/@])/g, '\\$1'); }
function csvCell(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text; }
function parseCsv(text) { const rows=[];let row=[];let cell='';let quoted=false;for(let i=0;i<text.length;i++){const char=text[i],next=text[i+1];if(char==='"'){if(quoted&&next==='"'){cell+='"';i++;}else quoted=!quoted;}else if(char===','&&!quoted){row.push(cell);cell='';}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=char;}if(cell||row.length){row.push(cell);rows.push(row);}const headers=(rows.shift()||[]).map((value)=>value.trim());return rows.filter((values)=>values.some((value)=>value.trim())).map((values)=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??'']))); }
function downloadText(text, filename, type) { const url=URL.createObjectURL(new Blob([text],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function formatDate(value) { const date=new Date(value); return Number.isNaN(date.getTime()) ? 'an unknown date' : date.toLocaleString(); }
function openCommandPalette(root, setView) { const existing=root.querySelector('.cos-worker-command-overlay');if(existing){existing.remove();return;}const overlay=document.createElement('div');overlay.className='cos-worker-command-overlay';overlay.innerHTML=`<div class="cos-worker-command-box"><input type="search" placeholder="Jump to a workspace…" autofocus><div>${['dashboard','registry','graph','intelligence','review','developer'].map((view)=>`<button type="button" data-command-view="${view}">${view}</button>`).join('')}</div></div>`;overlay.addEventListener('click',(event)=>{const button=event.target.closest('[data-command-view]');if(button){setView(button.dataset.commandView);overlay.remove();}else if(event.target===overlay)overlay.remove();});root.append(overlay);overlay.querySelector('input')?.focus(); }
