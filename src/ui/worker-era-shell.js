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
      <a class="cos-worker-link" href="https://site-health.oceanliners.net/" target="_blank" rel="noopener noreferrer">Site Health</a>
      <a class="cos-worker-link" href="https://curator-indexer.oceanliners.net/" target="_blank" rel="noopener noreferrer">Curator Indexer</a>
      <a class="cos-worker-link" href="https://speed.oceanliners.net/" target="_blank" rel="noopener noreferrer">Curator Speed</a>
      <a class="cos-worker-link" href="https://page-studio.oceanliners.net/" target="_blank" rel="noopener noreferrer">Page Studio</a>
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

  const openExternalLink = (link) => {
    const href = link?.href;
    if (!href) return;
    const opened = window.open(href, '_blank', 'noopener');
    if (!opened) window.location.assign(href);
  };

  const clickHandler = (event) => {
    const externalLink = event.target.closest('a[target="_blank"][href]');
    if (externalLink && shell.contains(externalLink)) {
      event.preventDefault();
      openExternalLink(externalLink);
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

  const blocked = category === 'BLOCKED' || severity === 'blocked' || status === 403 || status === 429;
  return externalFinding({
    id: `audit:${stableId(`${pageUrl}|${checkedUrl}|${status || category}`)}`,
    category: blocked ? 'link-review' : 'broken',
    severity: blocked ? 'medium' : severity === 'warning' ? 'medium' : 'high',
    title: normalized.page_title || normalized.pagetitle || pageUrl || 'Source link finding',
    summary: blocked ? `${label} could not be verified automatically${status ? ` (HTTP ${status})` : ''}.` : `${label} appears unavailable${status ? ` (HTTP ${status})` : ''}.`,
    recommendation: blocked ? 'Review the source manually before changing or removing it.' : replacement ? `Review and replace the link with ${replacement}.` : 'Review the source and replace or remove the unavailable link.',
    action: 'Open affected page',
    pageUrl,
    targetUrl: checkedUrl,
    replacementUrl: replacement,
    context: normalized.context || ''
  });
}

function recordExportFindings(records) {
  return (records || []).flatMap((record) => {
    const findings = [];
    const title = record.title || record.id || 'Untitled record';
    if (!(record.sources || []).length) findings.push(externalFinding({ id:`record:${record.id}:unsourced`, recordId:record.id, category:'unsourced', severity:'high', title, summary:'This record has no direct source attached.', recommendation:'Open the record and attach at least one documented source.', action:'Open record' }));
    if (record.status === 'review' || record.status === 'draft') findings.push(externalFinding({ id:`record:${record.id}:review`, recordId:record.id, category:'review', severity:record.status === 'draft' ? 'high' : 'medium', title, summary:`This record remains marked ${record.status}.`, recommendation:'Review the evidence and metadata, then publish or archive the record.', action:'Open record' }));
    return findings;
  });
}

function indexFindings(value) {
  const pages = Array.isArray(value.pages) ? value.pages : Array.isArray(value.entities?.pages) ? value.entities.pages : [];
  const findings = [];
  for (const page of pages) {
    const pageUrl = page.url || page.canonical || page.path || '';
    const title = page.title || page.h1 || pageUrl || 'Indexed page';
    const sources = page.sourceCount ?? page.sources?.length;
    if (Number(sources) === 0) findings.push(externalFinding({ id:`index:${stableId(`${pageUrl}|sources`)}`, category:'unsourced', severity:'high', title, summary:'The index reports no source references on this page.', recommendation:'Review the page and add or restore its source section.', action:'Open page', pageUrl }));
    if (page.error) findings.push(externalFinding({ id:`index:${stableId(`${pageUrl}|${page.error}`)}`, category:'crawl', severity:'high', title, summary:String(page.error), recommendation:'Open the page and repair the crawl or rendering failure.', action:'Open page', pageUrl }));
    if (!page.title) findings.push(externalFinding({ id:`index:${stableId(`${pageUrl}|title`)}`, category:'metadata', severity:'medium', title, summary:'The indexed page is missing a title.', recommendation:'Add a descriptive HTML title and verify the canonical metadata.', action:'Open page', pageUrl }));
  }
  for (const error of value.errors || []) findings.push(externalFinding({ id:`index:${stableId(JSON.stringify(error))}`, category:'crawl', severity:'high', title:error.title || error.url || 'Indexer error', summary:error.message || error.error || 'Curator Indexer reported a crawl problem.', recommendation:'Open the affected page and correct the reported failure.', action:'Open page', pageUrl:error.url || '' }));
  for (const mention of value.graphs?.unlinkedShipMentions || []) findings.push(externalFinding({ id:`index:${stableId(JSON.stringify(mention))}`, category:'link-opportunity', severity:'low', title:mention.ship || mention.title || 'Unlinked ship mention', summary:`${mention.ship || 'A ship'} is mentioned without an internal guide link.`, recommendation:'Review the page and add an appropriate internal ship-guide link when contextually useful.', action:'Open page', pageUrl:mention.pageUrl || mention.url || '' }));
  return findings;
}

function externalFinding(item) {
  return {
    id:item.id || `finding:${stableId(JSON.stringify(item))}`,
    recordId:item.recordId || '',
    recordType:item.recordType || 'site page',
    category:item.category || 'review',
    severity:['high','medium','low'].includes(item.severity) ? item.severity : 'medium',
    title:item.title || 'Imported finding',
    summary:item.summary || 'An external scanner reported an issue.',
    recommendation:item.recommendation || 'Review the finding and the affected page.',
    action:item.action || 'Review finding',
    pageUrl:item.pageUrl || '',
    targetUrl:item.targetUrl || '',
    replacementUrl:item.replacementUrl || '',
    context:item.context || ''
  };
}

function renderBriefing(history) {
  const latest = history[0];
  return `<section class="cos-worker-briefing"><div class="cos-worker-briefing-head"><div><span class="cos-eyebrow">Scan history</span><h2>${latest ? 'Latest imported assurance snapshot' : 'No scan history yet'}</h2><p>${latest ? `${escapeHtml(latest.fileName)} · ${escapeHtml(latest.sourceType)} · imported ${escapeHtml(formatDate(latest.importedAt))}` : 'Import Site Health, Curator Indexer, or Curator Speed results to begin tracking new, persistent, verified, and regressed findings.'}</p></div><div class="cos-worker-actions"><button type="button" data-findings-clear-history>Clear history</button><button type="button" data-findings-clear-imported>Clear imported findings</button></div></div>${latest ? `<div class="cos-worker-scan-history">${scanStat(latest.newCount, 'New')}${scanStat(latest.persistentCount, 'Persistent')}${scanStat(latest.verifiedCount, 'Verified fixed')}${scanStat(latest.regressionCount, 'Regressions')}${scanStat(latest.count, 'Current findings')}</div>` : ''}</section>`;
}

function scanStat(value, label) { return `<div><strong>${Number(value || 0).toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`; }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'unknown date' : date.toLocaleString(); }
function countBy(items, key) { return items.reduce((acc, item) => { const value = item[key] || 'other'; acc[value] = (acc[value] || 0) + 1; return acc; }, {}); }
function dedupeFindings(items) { return [...new Map(items.map((item) => [item.id, item])).values()]; }
function metric(value, label) { return `<div class="cos-worker-metric"><strong>${Number(value).toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`; }
function labelCategory(value) { return String(value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function safeUrl(value) { try { const url = new URL(value, location.origin); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function cssEscape(value) { return globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, '\\$&'); }
function stableId(value) { let hash = 2166136261; for (const char of String(value || '')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])); }
function csvCell(value) { const text = String(value ?? ''); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function downloadText(text, filename, type) { const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function missingCoreMetadata(record) { const missing = []; if (!record.title) missing.push('title'); if (!record.summary) missing.push('summary'); if (!record.status) missing.push('status'); if (!record.type) missing.push('type'); return missing; }
function finding(record, category, severity, summary, recommendation, action) { return { id:`${record.id}:${category}`, recordId:record.id, recordType:record.type, category, severity, title:record.title || record.id, summary, recommendation, action, pageUrl:record.data?.canonicalUrl || record.data?.url || '', targetUrl:'', replacementUrl:'', context:'' }; }
function renderFinding(item, isHandled) { const pageUrl = safeUrl(item.pageUrl); const targetUrl = safeUrl(item.targetUrl); const replacementUrl = safeUrl(item.replacementUrl); return `<article class="cos-worker-finding ${escapeHtml(item.severity)}"><div class="cos-worker-finding-head"><div><span class="cos-worker-finding-category">${escapeHtml(labelCategory(item.category))}</span><h2>${escapeHtml(item.title)}</h2><small>${escapeHtml(item.recordType || 'site finding')}${item.regression ? ' · regression' : ''}</small></div><span class="cos-worker-finding-severity">${escapeHtml(item.severity)}</span></div><p>${escapeHtml(item.summary)}</p><p><strong>What to do next:</strong> ${escapeHtml(item.recommendation)}</p>${targetUrl ? `<p><strong>Checked URL:</strong> <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(targetUrl)}</a></p>` : ''}${replacementUrl ? `<p><strong>Suggested replacement:</strong> <a href="${escapeHtml(replacementUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(replacementUrl)}</a></p>` : ''}${item.context ? `<p><strong>Context:</strong> ${escapeHtml(item.context)}</p>` : ''}<div class="cos-worker-actions">${item.recordId ? `<button type="button" data-finding-open="${escapeHtml(item.recordId)}">${escapeHtml(item.action || 'Open record')}</button>` : pageUrl ? `<a class="cos-worker-action-link" href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.action || 'Open page')}</a>` : ''}<button type="button" data-finding-action="${isHandled ? 'reopen' : 'handle'}" data-finding-id="${escapeHtml(item.id)}">${isHandled ? 'Reopen finding' : 'Mark handled'}</button></div></article>`; }
function renderNav() { const groups = { home:[], archive:[], knowledge:[], editorial:[], administration:[] }; MODULES.forEach(([group,label]) => groups[group].push(label)); return Object.entries(groups).map(([group,labels]) => `<div class="cos-worker-nav-group">${escapeHtml(labelCategory(group))}</div>${labels.map((label) => `<button type="button" data-worker-view="${label === 'Findings' ? 'dashboard' : label === 'Registry' ? 'registry' : label === 'Graph' ? 'graph' : label === 'Intelligence' ? 'intelligence' : label === 'Review Queue' ? 'review' : 'developer'}" class="${label === 'Findings' ? 'active' : ''}">${escapeHtml(label)}</button>`).join('')}`).join(''); }
function openCommandPalette(root, setView) { const overlay=document.createElement('div'); overlay.className='cos-worker-command-overlay'; overlay.innerHTML=`<div class="cos-worker-command-box"><input type="search" placeholder="Type a command…" autofocus><div>${[['dashboard','Open Findings'],['registry','Open Registry'],['graph','Open Graph'],['intelligence','Open Intelligence'],['review','Open Review Queue'],['developer','Open Developer Mode']].map(([view,label])=>`<button type="button" data-command-view="${view}">${label}</button>`).join('')}</div></div>`; document.body.append(overlay); const input=overlay.querySelector('input'); const render=()=>{ const query=input.value.toLowerCase(); overlay.querySelectorAll('[data-command-view]').forEach((button)=>button.hidden=!button.textContent.toLowerCase().includes(query)); }; input.addEventListener('input',render); overlay.addEventListener('click',(event)=>{ const button=event.target.closest('[data-command-view]'); if(button){ setView(button.dataset.commandView); overlay.remove(); return; } if(event.target===overlay) overlay.remove(); }); input.focus(); }
function parseCsv(text) { const rows=[]; let row=[],field='',quoted=false; for(let i=0;i<text.length;i++){ const char=text[i]; const next=text[i+1]; if(quoted){ if(char==='"'&&next==='"'){field+='"';i++;} else if(char==='"')quoted=false; else field+=char; } else if(char==='"')quoted=true; else if(char===','){row.push(field);field='';} else if(char==='\n'){row.push(field);rows.push(row);row=[];field='';} else if(char!=='\r')field+=char; } row.push(field); if(row.some((value)=>value!==''))rows.push(row); const [headers,...data]=rows; return data.map((values)=>Object.fromEntries(headers.map((header,index)=>[header,values[index]||'']))); }
