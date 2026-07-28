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
const SCAN_LINKS = [
  {
    id: 'dead-links',
    title: 'Scan broken links',
    description: 'Open the Site Health Auditor, run a crawl, export its CSV, then import that CSV here.',
    href: 'https://site-health.oceanliners.net/',
    button: 'Open link scanner'
  },
  {
    id: 'site-index',
    title: 'Build a fresh site index',
    description: 'Open the Core Indexer, generate site-index.json, then import it here for link opportunities and coverage findings.',
    href: 'https://curator-indexer.oceanliners.net/',
    button: 'Open site indexer'
  }
];

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
    <a
      class="cos-worker-link"
      href="https://site-health.oceanliners.net/"
      target="_blank"
      rel="noopener noreferrer"
    >
      Site Health
    </a>

    <a
      class="cos-worker-link"
      href="https://curator-indexer.oceanliners.net/"
      target="_blank"
      rel="noopener noreferrer"
    >
      Curator Indexer
    </a>

    <button type="button" data-worker-command>
      ⌘ Command
    </button>

    <button type="button" data-worker-backup>
      Quick Backup
    </button>
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
      <div class="cos-worker-actions"><button type="button" data-catalog-import>Load catalog</button><button type="button" data-findings-import>Import scan results</button><button type="button" data-findings-export>Export visible work list</button><button type="button" data-worker-filter="open" class="${state.filter === 'open' ? 'active' : ''}">Open findings</button><button type="button" data-worker-filter="handled" class="${state.filter === 'handled' ? 'active' : ''}">Handled</button></div>
    </div>
    ${renderBriefing(history)}
    <section class="cos-worker-scan-launchers"><div class="cos-worker-scan-intro"><span class="cos-eyebrow">Start with a scan</span><h2>Find real problems on OceanLiners.net</h2><p>Load a CuratorOS catalog into the Registry, or run the proven scanners and import their findings here.</p></div>${SCAN_LINKS.map(renderScanLauncher).join('')}</section>
    <div class="cos-worker-metrics">
      ${metric(counts.broken || 0, 'Broken links')}${metric(counts['link-opportunity'] || 0, 'Link opportunities')}${metric(counts.unsourced || 0, 'Missing sources')}${metric(counts.metadata || 0, 'Missing metadata')}${metric(open.length, 'Open findings')}
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
    if (event.target.closest('[data-findings-import]')) findingsInput.click();
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
      const value = file.name.toLowerCase().endsWith('.csv') ? null : JSON.parse(text);
      if (value?.records && Array.isArray(value.records)) throw new Error('This is a CuratorOS catalog. Use Load catalog instead.');
      const parsed = file.name.toLowerCase().endsWith('.csv') ? parseAuditCsv(text) : parseImportedJson(value);
      if (!parsed.length) {
        state.notice = `Imported ${file.name}. No actionable findings were detected.`;
        return;
      }
      const current = importedFindings();
      const merged = dedupeFindings([...current, ...parsed]);
      const history = scanHistory();
      const sourceType = file.name.toLowerCase().endsWith('.csv') ? 'Site Health CSV' : 'JSON scan/index';
      const previous = history.find((item) => item.sourceType === sourceType);
      const currentIds = new Set(parsed.map((item) => item.id));
      const previousIds = new Set(previous?.findingIds || []);
      const snapshot = {
        id: `${Date.now()}-${stableId(file.name)}`,
        importedAt: new Date().toISOString(),
        fileName: file.name,
        sourceType,
        count: parsed.length,
        high: parsed.filter((item) => item.severity === 'high').length,
        newCount: [...currentIds].filter((id) => !previousIds.has(id)).length,
        persistentCount: [...currentIds].filter((id) => previousIds.has(id)).length,
        resolvedCount: previous ? [...previousIds].filter((id) => !currentIds.has(id)).length : 0,
        findingIds: [...currentIds]
      };
      saveScanHistory([snapshot, ...history]);
      saveImported(merged);
      state.filter = 'open';
      state.notice = `Imported ${parsed.length} finding${parsed.length === 1 ? '' : 's'} from ${file.name}. ${snapshot.newCount} new, ${snapshot.persistentCount} persistent, ${snapshot.resolvedCount} no longer present.`;
    } catch (error) {
      state.notice = `Could not import ${file.name}: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      findingsInput.value = '';
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
  throw new Error('Expected a site-index export or Site Health results.');
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
  if (!normalized.checked_url && !normalized.url) return null;
  if (severity === 'good' || category === 'GOOD') return null;
  const pageUrl = normalized.page_url || normalized.pageurl || '';
  const checkedUrl = normalized.checked_url || normalized.url || '';
  const replacement = normalized.replacement_url || normalized.replacementurl || '';
  const label = normalized.anchor_text || normalized.anchor || checkedUrl;
  return externalFinding({
    id: `audit:${stableId(`${pageUrl}|${checkedUrl}|${category}`)}`,
    category: severity === 'broken' ? 'broken' : 'link-warning',
    severity: severity === 'broken' ? 'high' : 'medium',
    title: normalized.page_title || normalized.pagetitle || pageUrl || 'Link finding',
    summary: `${label} returned ${normalized.status || normalized.category || 'a link warning'}.`,
    recommendation: replacement ? `Replace it with ${replacement}, then recheck the page.` : 'Open the affected page, verify the link manually, and replace or remove it.',
    action: 'Open affected page',
    pageUrl,
    targetUrl: checkedUrl,
    replacementUrl: replacement,
    context: normalized.context || ''
  });
}

function indexFindings(index) {
  const findings = [];
  const errors = index.errors || index.diagnostics?.errors || [];
  for (const error of errors) {
    findings.push(externalFinding({ id:`crawl:${stableId(`${error.url || error.pageUrl}|${error.error || error.message}`)}`, category:'crawl-error', severity:'high', title:error.title || error.url || error.pageUrl || 'Crawl error', summary:error.error || error.message || 'The page could not be crawled.', recommendation:'Open the page, confirm whether it loads, then correct the URL or retry the scan.', action:'Open affected page', pageUrl:error.url || error.pageUrl || '' }));
  }
  for (const mention of index.graphs?.unlinkedShipMentions || []) {
    findings.push(externalFinding({ id:`mention:${stableId(`${mention.pageUrl}|${mention.shipUrl}|${mention.matchedAlias || mention.shipName}`)}`, category:'link-opportunity', severity:Number(mention.count || 1) > 2 ? 'high' : 'medium', title:mention.pageTitle || mention.pageUrl || 'Unlinked ship mention', summary:`${mention.shipName || 'A ship'} is mentioned ${Number(mention.count || 1)} time${Number(mention.count || 1) === 1 ? '' : 's'} without a link.`, recommendation:`Add a link to ${mention.shipUrl || 'the ship guide'} where the mention is editorially useful.`, action:'Open source page', pageUrl:mention.pageUrl || '', targetUrl:mention.shipUrl || '', context:mention.matchedAlias || mention.shipName || '' }));
  }
  const pages = index.pages || index.entities?.pages || [];
  for (const page of pages) {
    if (page.pageType === 'ship-guide' && Array.isArray(page.sourceLinks) && page.sourceLinks.length === 0) findings.push(externalFinding({ id:`sources:${stableId(page.url || page.path)}`, category:'missing-sources', severity:'high', title:page.title || page.path || page.url, summary:'This ship guide has no detected external source links.', recommendation:'Review the guide and add a Sources section or documented citations.', action:'Open ship guide', pageUrl:page.url || '' }));
  }
  return findings;
}

function recordExportFindings(records) {
  return records.flatMap((record) => {
    const title = record.title || record.name || record.id || 'Record';
    const output = [];
    if (!(record.sources || []).length) output.push(externalFinding({ id:`import-unsourced:${stableId(record.id || title)}`, category:'unsourced', severity:'high', title, summary:`${title} has no direct source attached.`, recommendation:'Add at least one source or curatorial evidence note.', action:'Review imported record', recordId:record.id || '' }));
    if (record.status === 'draft' || record.status === 'review') output.push(externalFinding({ id:`import-review:${stableId(record.id || title)}`, category:'review', severity:record.status === 'draft' ? 'high' : 'medium', title, summary:`${title} is marked ${record.status}.`, recommendation:'Review its evidence and metadata before publication.', action:'Review imported record', recordId:record.id || '' }));
    return output;
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (quoted && char === '"' && next === '"') { field += '"'; i++; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && char === ',') { row.push(field); field = ''; continue; }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i++;
      row.push(field); field = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value !== '')) rows.push(row);
  const headers = rows.shift()?.map((value) => value.trim()) || [];
  if (!headers.length) return [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function finding(record, category, severity, summary, recommendation, action) {
  return { id: `${category}:${record.id}`, recordId: record.id, category, severity, title: record.title || record.id, recordType: record.type || 'record', summary, recommendation, action };
}
function externalFinding(value) { return { recordType:'site finding', ...value }; }
function dedupeFindings(findings) { return [...new Map(findings.filter((item) => item?.id).map((item) => [item.id, item])).values()]; }
function stableId(value) { let hash = 2166136261; for (const char of String(value || '')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
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
  const destination = safeUrl(item.pageUrl || item.targetUrl || item.replacementUrl || '');
  const targetUrl = safeUrl(item.targetUrl || '');
  const replacementUrl = safeUrl(item.replacementUrl || '');
  const openAction = item.recordId ? `<button type="button" data-finding-open="${escapeHtml(item.recordId)}">${escapeHtml(item.action)}</button>` : destination ? `<a class="cos-worker-action-link" href="${escapeHtml(destination)}" target="_blank" rel="noopener">${escapeHtml(item.action || 'Open page')}</a>` : '';
  const details = [item.context ? `<p><strong>Context:</strong> ${escapeHtml(item.context)}</p>` : '', targetUrl ? `<p><strong>Checked URL:</strong> <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener">${escapeHtml(targetUrl)}</a></p>` : '', replacementUrl ? `<p><strong>Suggested replacement:</strong> <a href="${escapeHtml(replacementUrl)}" target="_blank" rel="noopener">${escapeHtml(replacementUrl)}</a></p>` : ''].join('');
  return `<article class="cos-worker-finding ${escapeHtml(item.severity)}"><div class="cos-worker-finding-head"><div><span class="cos-worker-finding-category">${escapeHtml(labelCategory(item.category))}</span><h2>${escapeHtml(item.title)}</h2><small>${escapeHtml(item.recordType || 'finding')}${item.recordId ? ` · ${escapeHtml(item.recordId)}` : ''}</small></div><span class="cos-worker-finding-severity">${escapeHtml(item.severity)}</span></div><p><strong>What CuratorOS found:</strong> ${escapeHtml(item.summary)}</p>${details}<p><strong>What to do next:</strong> ${escapeHtml(item.recommendation)}</p><div class="cos-worker-actions">${openAction}<button type="button" data-finding-action="${isHandled ? 'reopen' : 'handle'}" data-finding-id="${escapeHtml(item.id)}">${isHandled ? 'Reopen finding' : 'Mark handled'}</button></div></article>`;
}
function renderScanLauncher(item) {
  return `<article class="cos-worker-scan-card"><span>${escapeHtml(item.title)}</span><p>${escapeHtml(item.description)}</p><a class="cos-worker-action-link" href="${escapeHtml(item.href)}" target="_blank" rel="noopener">${escapeHtml(item.button)}</a></article>`;
}
function renderBriefing(history) {
  const latest = history[0];
  if (!latest) return `<section class="cos-worker-briefing"><div><span class="cos-eyebrow">Since last scan</span><h2>No scan history yet</h2><p>Import a Site Health CSV or site index to begin tracking what is new, persistent, and resolved.</p></div></section>`;
  const when = formatDateTime(latest.importedAt);
  return `<section class="cos-worker-briefing"><div class="cos-worker-briefing-head"><div><span class="cos-eyebrow">Since last scan</span><h2>${latest.newCount} new · ${latest.persistentCount} persistent · ${latest.resolvedCount} resolved</h2><p>${escapeHtml(latest.fileName)} imported ${escapeHtml(when)}. ${latest.high} high-priority finding${latest.high === 1 ? '' : 's'} in this scan.</p></div><button type="button" data-findings-clear-history>Clear history</button></div>${history.length > 1 ? `<div class="cos-worker-scan-history">${history.slice(0,5).map((item) => `<div><strong>${escapeHtml(formatDate(item.importedAt))}</strong><span>${item.count} findings · ${item.newCount} new · ${item.resolvedCount} resolved</span><small>${escapeHtml(item.fileName)}</small></div>`).join('')}</div>` : ''}</section>`;
}
function labelCategory(value) { return String(value || 'finding').replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function csvCell(value) { return `"${String(value ?? '').replaceAll('"','""')}"`; }
function downloadText(text, filename, type) { const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function safeUrl(value) { try { const url = new URL(String(value || ''), location.href); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'at an unknown time' : date.toLocaleString(); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString(); }
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
  const keyHandler = (event) => { if (event.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', keyHandler); } };
  document.addEventListener('keydown', keyHandler);
  overlay.addEventListener('click', (event) => {
    const command = event.target.closest('[data-command-view]');
    if (command) { setView(command.dataset.commandView); overlay.remove(); document.removeEventListener('keydown', keyHandler); }
    if (event.target === overlay) { overlay.remove(); document.removeEventListener('keydown', keyHandler); }
  });
  const input = overlay.querySelector('input');
  requestAnimationFrame(() => input.focus());
  input.addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    overlay.querySelectorAll('[data-command-view]').forEach((button) => button.hidden = !button.textContent.toLowerCase().includes(query));
  });
}
