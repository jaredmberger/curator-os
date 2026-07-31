import { importOlcCatalog, detectOlcCatalog } from '../src/core/olc-catalog-importer.js';

const STORAGE_KEY = 'curatoros.rebuilt.catalog';
const ORIGIN_KEY = 'curatoros.project.lastImport';
const input = document.querySelector('#catalog-file');
const button = document.querySelector('#load-catalog');

if (button) {
  button.textContent = 'Import project data';
  button.title = 'Import site-index.json, an OLC manifest, or a CuratorOS record export';
}

input?.addEventListener('change', handleProjectImport, true);

async function handleProjectImport(event) {
  event.stopImmediatePropagation();
  const file = input.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const prepared = prepareImport(parsed, file.name);
    showImportReview(prepared, file.name);
  } catch (error) {
    showImportError(error instanceof Error ? error.message : String(error));
  } finally {
    input.value = '';
  }
}

function prepareImport(value, filename) {
  const adapted = adaptSiteIndex(value);
  const imported = importOlcCatalog(adapted.value);
  const records = imported.records.map((record, index) => ({
    ...record,
    origin: {
      sourceType: adapted.format,
      filename,
      sourceIndex: index,
      importedAt: new Date().toISOString()
    }
  }));

  if (!records.length) {
    throw new Error('No usable project records were found in this file.');
  }

  return {
    records,
    format: adapted.format,
    report: imported.report,
    notes: adapted.notes
  };
}

function adaptSiteIndex(value) {
  const detected = detectOlcCatalog(value);
  if (detected !== 'unknown') {
    return { value, format: detected, notes: [] };
  }

  const candidates = firstArray(value, ['pages', 'entries', 'items', 'documents', 'urls', 'index']);
  if (!candidates) {
    throw new Error('This JSON file does not contain a recognized CuratorOS catalog, OLC manifest, or site-index page array.');
  }

  const notes = [];
  const records = candidates.map((entry, index) => pageEntryToRecord(entry, index, notes)).filter(Boolean);
  return { value: records, format: 'site-index', notes };
}

function firstArray(value, keys) {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) if (Array.isArray(value[key])) return value[key];
  for (const nested of Object.values(value)) {
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue;
    for (const key of keys) if (Array.isArray(nested[key])) return nested[key];
  }
  return null;
}

function pageEntryToRecord(entry, index, notes) {
  if (typeof entry === 'string') {
    const title = titleFromPath(entry);
    return { id: entry, type: inferPageType(entry), title, status: 'published', url: entry };
  }
  if (!entry || typeof entry !== 'object') return null;

  const url = entry.url || entry.path || entry.href || entry.canonical || entry.loc || '';
  const title = entry.title || entry.name || entry.label || entry.ship || titleFromPath(url);
  if (!title) {
    notes.push(`Entry ${index + 1} was skipped because it has no title, name, or usable path.`);
    return null;
  }

  const type = entry.type || entry.kind || entry.recordType || inferPageType(url, entry);
  return {
    ...entry,
    id: entry.id || entry.slug || url || title,
    type,
    title,
    status: entry.status || 'published',
    url,
    data: {
      ...(entry.data && typeof entry.data === 'object' ? entry.data : {}),
      pageUrl: url || undefined,
      section: entry.section || entry.category || undefined
    }
  };
}

function inferPageType(url = '', entry = {}) {
  const text = `${url} ${entry.section || ''} ${entry.category || ''}`.toLowerCase();
  if (/builder|shipyard/.test(text)) return 'company';
  if (/shipping[-_ ]?line|company|operator/.test(text)) return 'company';
  if (/reference[-_ ]?object|collection[-_ ]?object/.test(text)) return 'object';
  if (/photo|image|media/.test(text)) return 'photo';
  if (/source|bibliograph|citation/.test(text)) return 'source';
  if (/person|captain|designer|architect/.test(text)) return 'person';
  return 'ship';
}

function titleFromPath(path = '') {
  const clean = String(path).split('?')[0].split('#')[0].replace(/\/$/, '');
  const last = clean.split('/').filter(Boolean).pop() || '';
  return decodeURIComponent(last)
    .replace(/\.html?$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function showImportReview(prepared, filename) {
  closeDialog();
  const { records, report, format, notes } = prepared;
  const typeCounts = countBy(records, (record) => record.type || 'record');
  const warningCount = (report.warnings?.length || 0) + notes.length;
  const dialog = document.createElement('dialog');
  dialog.id = 'project-import-review';
  dialog.innerHTML = `
    <form method="dialog" class="project-import-card">
      <span class="eyebrow">Project import review</span>
      <h3>${escapeHtml(filename)}</h3>
      <p>CuratorOS recognized this as <strong>${escapeHtml(format)}</strong>. Nothing has been replaced yet.</p>
      <div class="metrics">
        ${metric(records.length, 'Records ready')}
        ${metric(report.skipped?.length || 0, 'Skipped')}
        ${metric(warningCount, 'Warnings')}
        ${metric(report.errors?.length || 0, 'Errors')}
      </div>
      <section class="panel">
        <h4>Records by type</h4>
        <div class="badges">${Object.entries(typeCounts).sort().map(([type, count]) => `<span class="badge">${escapeHtml(type)}: ${count}</span>`).join('')}</div>
      </section>
      ${renderIssues('Warnings', [...(report.warnings || []).map(issueText), ...notes])}
      ${renderIssues('Skipped entries', (report.skipped || []).map(issueText))}
      ${renderIssues('Errors', (report.errors || []).map(issueText))}
      <p><strong>Importing will replace the current local project index.</strong> A copy of the previous records will be saved automatically as a local pre-import snapshot.</p>
      <div class="actions">
        <button type="button" data-cancel-import>Cancel</button>
        <button type="button" data-confirm-import>Import ${records.length} records</button>
      </div>
    </form>`;
  document.body.append(dialog);
  dialog.querySelector('[data-cancel-import]')?.addEventListener('click', closeDialog);
  dialog.querySelector('[data-confirm-import]')?.addEventListener('click', () => commitImport(prepared, filename));
  dialog.addEventListener('cancel', closeDialog);
  dialog.showModal();
}

function commitImport(prepared, filename) {
  const previous = localStorage.getItem(STORAGE_KEY);
  if (previous) localStorage.setItem('curatoros.snapshot.beforeProjectImport', previous);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prepared.records));
  localStorage.setItem(ORIGIN_KEY, JSON.stringify({
    filename,
    format: prepared.format,
    recordCount: prepared.records.length,
    importedAt: new Date().toISOString(),
    report: prepared.report
  }));
  closeDialog();
  location.reload();
}

function showImportError(message) {
  closeDialog();
  const dialog = document.createElement('dialog');
  dialog.id = 'project-import-review';
  dialog.innerHTML = `<section class="project-import-card"><span class="eyebrow">Import could not continue</span><h3>Project data was not changed</h3><p>${escapeHtml(message)}</p><div class="actions"><button type="button" data-cancel-import>Close</button><button type="button" data-choose-again>Choose another file</button></div></section>`;
  document.body.append(dialog);
  dialog.querySelector('[data-cancel-import]')?.addEventListener('click', closeDialog);
  dialog.querySelector('[data-choose-again]')?.addEventListener('click', () => { closeDialog(); input.click(); });
  dialog.showModal();
}

function renderIssues(title, issues) {
  if (!issues.length) return '';
  return `<details class="panel"><summary>${escapeHtml(title)} (${issues.length})</summary><ul>${issues.slice(0, 100).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>${issues.length > 100 ? `<p>Only the first 100 are shown.</p>` : ''}</details>`;
}

function issueText(issue) {
  if (typeof issue === 'string') return issue;
  return issue.message || issue.reason || JSON.stringify(issue);
}

function countBy(values, getter) {
  return values.reduce((counts, value) => {
    const key = getter(value);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function metric(value, label) {
  return `<div class="metric"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
}

function closeDialog() {
  const dialog = document.querySelector('#project-import-review');
  if (!dialog) return;
  try { dialog.close(); } catch {}
  dialog.remove();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}
