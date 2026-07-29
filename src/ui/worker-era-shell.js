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
    id: `audit:${stableId(`${pageUrl}|${checkedUrl}|${status || category}`)}`,
    category: status === 404 ? 'broken' : redirected ? 'link-maintenance' : 'link-opportunity',
    severity: severity === 'critical' || severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
    title: normalized.page_title || normalized.pagetitle || pageUrl || 'Link finding',
    summary: `${label} returned ${status || category || 'an error'}.`,
    recommendation: replacement && replacement !== checkedUrl ? `Replace the checked URL with ${replacement}.` : 'Review the checked URL and repair, replace, or remove it as appropriate.',
    action: 'Open affected page',
    pageUrl,
    targetUrl: checkedUrl,
    replacementUrl: replacement,
    context: normalized.context || ''
  });
}

function recordExportFindings(records) {
  return records.flatMap((record) => {
    const title = record.title || record.id;
    const values = [];
    if (!(record.sources || []).length) values.push(externalFinding({ id:`record:${record.id}:unsourced`, category:'unsourced', severity:'high', title, summary:`${title} has no direct source attached.`, recommendation:'Add at least one source or an explicit curatorial note.', action:'Open record', recordId:record.id }));
    return values;
  });
}

function indexFindings(value) {
  const pages = Array.isArray(value.pages) ? value.pages : Array.isArray(value.entities?.pages) ? value.entities.pages : [];
  const errors = Array.isArray(value.errors) ? value.errors : [];
  const unlinked = Array.isArray(value.graphs?.unlinkedShipMentions) ? value.graphs.unlinkedShipMentions : [];
  return [
    ...pages.filter((page) => (page.sources || page.citations || 0) === 0).map((page) => externalFinding({ id:`index:${stableId(page.url || page.path)}:unsourced`, category:'unsourced', severity:'high', title:page.title || page.url || page.path || 'Indexed page', summary:'The indexed page has no detected sources or citations.', recommendation:'Open the page and add or repair source references.', action:'Open affected page', pageUrl:page.url || page.path || '' })),
    ...errors.map((item) => externalFinding({ id:`index-error:${stableId(JSON.stringify(item))}`, category:'metadata', severity:'medium', title:item.title || item.url || 'Indexer error', summary:item.message || item.error || 'The indexer reported an error.', recommendation:'Review the page and rerun Curator Indexer after correcting the issue.', action:'Open affected page', pageUrl:item.url || '' })),
    ...unlinked.map((item) => externalFinding({ id:`index-unlinked:${stableId(JSON.stringify(item))}`, category:'link-opportunity', severity:'low', title:item.ship || item.title || 'Unlinked ship mention', summary:item.context || 'A ship mention was detected without a link.', recommendation:'Link the mention to the relevant ship guide when editorially appropriate.', action:'Open affected page', pageUrl:item.url || item.pageUrl || '' }))
  ];
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (quoted && char === '"' && next === '"') { field += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && char === ',') { row.push(field); field = ''; continue; }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.length)) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((value) => value.trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function externalFinding(input) {
  return {
    id: input.id,
    category: input.category || 'finding',
    severity: input.severity || 'medium',
    title: input.title || 'Finding',
    summary: input.summary || '',
    recommendation: input.recommendation || '',
    action: input.action || 'Open',
    pageUrl: input.pageUrl || '',
    targetUrl: input.targetUrl || '',
    replacementUrl: input.replacementUrl || '',
    recordId: input.recordId || '',
    context: input.context || '',
    sourceType: input.sourceType || ''
  };
}

function finding(record, category, severity, summary, recommendation, action) {
  return { id:`${record.id}:${category}`,recordId:record.id,category,severity,title:record.title || record.id,summary,recommendation,action,pageUrl:record.url || record.data?.url || '' };
}
function missingCoreMetadata(record) { return ['title','type','status'].filter((key) => !record[key]); }
function countBy(values, key) { return values.reduce((acc, value) => { acc[value[key]] = (acc[value[key]] || 0) + 1; return acc; }, {}); }
function labelCategory(value) { return String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function stableId(value) { let hash=0; for (const char of String(value||'')) hash=((hash<<5)-hash)+char.charCodeAt(0)|0; return Math.abs(hash).toString(36); }
function dedupeFindings(values) { return [...new Map(values.filter(Boolean).map((item) => [item.id, item])).values()]; }
function metric(value, label) { return `<div class="cos-worker-metric"><strong>${Number(value).toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`; }
function csvCell(value) { const text=String(value??''); return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text; }
function downloadText(text, filename, type) { const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=filename; link.click(); URL.revokeObjectURL(url); }
function cssEscape(value) { return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
function escapeHtml(value) { return String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function renderNav() { return MODULES.map(([group,label],index)=>`${index===0||MODULES[index-1][0]!==group?`<div class="cos-worker-nav-group">${group}</div>`:''}<button type="button" data-worker-view="${viewName(label)}" class="${index===0?'active':''}">${label}</button>`).join(''); }
function viewName(label) { return label==='Findings'?'dashboard':label==='Registry'?'registry':label==='Graph'?'graph':label==='Intelligence'?'intelligence':label==='Review Queue'?'review':'developer'; }
function renderBriefing(history) { const latest=history[0]; if (!latest) return '<article class="cos-worker-briefing"><span class="cos-eyebrow">Scan briefing</span><h2>No scans imported yet</h2><p>Run one of the site tools below, export its findings, and import them here. CuratorOS will remember the previous run and compare what changed.</p></article>'; return `<article class="cos-worker-briefing"><div class="cos-worker-briefing-head"><div><span class="cos-eyebrow">Latest scan briefing</span><h2>${escapeHtml(latest.fileName)}</h2><p>${new Date(latest.importedAt).toLocaleString()} · ${latest.count} current findings · ${latest.newCount||0} new · ${latest.persistentCount||0} persistent · ${latest.verifiedCount||latest.resolvedCount||0} verified fixed · ${latest.regressionCount||0} regressions</p></div><button type="button" data-findings-clear-history>Clear history</button></div><div class="cos-worker-scan-history">${history.slice(0,4).map((item)=>`<div><strong>${escapeHtml(item.fileName)}</strong><span>${new Date(item.importedAt).toLocaleDateString()}</span><small>${item.count} findings · ${item.verifiedCount||item.resolvedCount||0} verified</small></div>`).join('')}</div></article>`; }
function renderFinding(item, handled) { return `<article class="cos-worker-finding ${escapeHtml(item.severity)}"><div class="cos-worker-finding-head"><div><span class="cos-worker-finding-category">${escapeHtml(labelCategory(item.category))}</span><h2>${escapeHtml(item.title)}</h2><small>${escapeHtml(item.recordId || item.pageUrl || item.targetUrl || item.sourceType || '')}</small></div><span class="cos-worker-finding-severity">${escapeHtml(item.severity)}</span></div><p><strong>What CuratorOS found:</strong> ${escapeHtml(item.summary)}</p><p><strong>Why it matters:</strong> ${escapeHtml(impactFor(item))}</p><p><strong>Recommended next step:</strong> ${escapeHtml(item.recommendation)}</p>${item.context?`<p><strong>Context:</strong> ${escapeHtml(item.context)}</p>`:''}${item.targetUrl?`<p><strong>Checked URL:</strong> <a href="${escapeHtml(safeUrl(item.targetUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.targetUrl)}</a></p>`:''}${item.replacementUrl?`<p><strong>Suggested replacement:</strong> <a href="${escapeHtml(safeUrl(item.replacementUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.replacementUrl)}</a></p>`:''}<div class="cos-worker-actions">${item.recordId?`<button type="button" data-finding-open="${escapeHtml(item.recordId)}">${escapeHtml(item.action || 'Open record')}</button>`:''}${item.pageUrl?`<a class="cos-worker-action-link" href="${escapeHtml(safeUrl(item.pageUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.action || 'Open affected page')}</a>`:''}<button type="button" data-finding-action="${handled?'reopen':'handle'}" data-finding-id="${escapeHtml(item.id)}">${handled?'Reopen finding':'Mark handled'}</button></div></article>`; }
function safeUrl(value) { try { const url=new URL(String(value), location.href); return ['http:','https:'].includes(url.protocol)?url.href:'#'; } catch { return '#'; } }
function impactFor(item) { if(item.category==='broken')return'A broken source or reference link interrupts research and weakens confidence in the page.'; if(item.category==='unsourced')return'Claims without visible evidence are harder to verify and maintain.'; if(item.category==='metadata')return'Missing metadata reduces search quality, linking, and future publishing options.'; if(item.category==='isolated')return'Unlinked records are difficult to discover and do not contribute to the project knowledge graph.'; if(item.category==='link-maintenance')return'The link works, but pointing directly to its final destination reduces redirect dependence and future maintenance risk.'; return'Addressing this improves clarity, discoverability, and long-term site maintenance.'; }
function openCommandPalette(root,setView){ root.querySelector('.cos-worker-command-overlay')?.remove(); const overlay=document.createElement('div'); overlay.className='cos-worker-command-overlay'; overlay.innerHTML=`<div class="cos-worker-command-box"><input type="search" placeholder="Type a command…" autofocus><div>${[['Open findings','dashboard'],['Open registry','registry'],['Open knowledge graph','graph'],['Open intelligence','intelligence'],['Open review queue','review'],['Open developer mode','developer']].map(([label,view])=>`<button type="button" data-command-view="${view}">${label}</button>`).join('')}</div></div>`; root.append(overlay); const input=overlay.querySelector('input'); const render=()=>overlay.querySelectorAll('[data-command-view]').forEach((button)=>button.hidden=!button.textContent.toLowerCase().includes(input.value.toLowerCase())); input.addEventListener('input',render); overlay.addEventListener('click',(event)=>{ const button=event.target.closest('[data-command-view]'); if(button){setView(button.dataset.commandView);overlay.remove();} else if(event.target===overlay)overlay.remove();}); input.addEventListener('keydown',(event)=>{if(event.key==='Escape')overlay.remove();if(event.key==='Enter'){overlay.querySelector('[data-command-view]:not([hidden])')?.click();}}); setTimeout(()=>input.focus(),0); }
