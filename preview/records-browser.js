const STORAGE_KEY = 'curatoros.rebuilt.catalog';
const IMPORT_KEY = 'curatoros.project.lastImport';
const STORE_META_KEY = 'curatoros.project.storeMeta';
const app = document.querySelector('#app');
const recordsButton = document.querySelector('[data-view="records"]');

const browserState = { search: '', type: '', status: '', sort: 'title-asc', selectedId: '' };

recordsButton?.addEventListener('click', async () => {
  try { await window.CuratorOSProjectRecordsStore?.load?.(); } catch {}
  window.setTimeout(renderProjectRecords, 0);
});
window.addEventListener('curatoros:records-changed', renderProjectRecords);
window.addEventListener('curatoros:project-store-status', renderProjectRecords);

function readRecords() { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function readImportMetadata() { try { return JSON.parse(localStorage.getItem(IMPORT_KEY) || 'null'); } catch { return null; } }
function readStoreMeta() { try { return JSON.parse(localStorage.getItem(STORE_META_KEY) || 'null'); } catch { return null; } }

function renderProjectRecords() {
  if (!app || !recordsButton?.classList.contains('active')) return;
  const records = readRecords();
  const visible = filterAndSort(records);
  const types = unique(records.map((record) => record.type || 'record')).sort();
  const statuses = unique(records.map((record) => record.status || 'unknown')).sort();
  const typeCounts = countBy(records, (record) => record.type || 'record');
  const importMetadata = readImportMetadata();
  const storeMeta = readStoreMeta();

  app.innerHTML = `
    <section class="panel project-records-hero">
      <div>
        <span class="eyebrow">Permanent CuratorOS knowledge corpus</span>
        <h3>${records.length} project record${records.length === 1 ? '' : 's'}</h3>
        <p>Everything shown here is recorded inside CuratorOS. Other workspaces read from this same corpus. The browser copy is only a cache.</p>
      </div>
      ${renderStoreSummary(storeMeta, importMetadata)}
    </section>

    <section class="metrics project-record-metrics">
      ${metric(records.length, 'All permanent records')}
      ${Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type, count]) => metric(count, pluralLabel(type, count))).join('')}
    </section>

    <section class="panel project-records-panel">
      <div class="project-record-filters">
        <label><span>Search</span><input id="record-search" type="search" placeholder="Search title, ID, source, relationship, or field…" value="${escapeHtml(browserState.search)}"></label>
        <label><span>Record type</span><select id="record-type"><option value="">All types</option>${types.map((type) => `<option value="${escapeHtml(type)}"${browserState.type === type ? ' selected' : ''}>${escapeHtml(label(type))} (${typeCounts[type] || 0})</option>`).join('')}</select></label>
        <label><span>Status</span><select id="record-status"><option value="">All statuses</option>${statuses.map((status) => `<option value="${escapeHtml(status)}"${browserState.status === status ? ' selected' : ''}>${escapeHtml(label(status))}</option>`).join('')}</select></label>
        <label><span>Sort</span><select id="record-sort">${sortOption('title-asc', 'Title A–Z')}${sortOption('title-desc', 'Title Z–A')}${sortOption('type', 'Record type')}${sortOption('status', 'Status')}${sortOption('imported-desc', 'Recently imported')}</select></label>
        <button type="button" id="clear-record-filters">Clear</button>
      </div>
      <div class="summary">Showing ${visible.length} of ${records.length} permanent records.</div>
      <div class="project-record-list">${visible.length ? visible.map(renderRecordCard).join('') : '<div class="empty">No project records match these filters.</div>'}</div>
    </section>`;

  bindBrowserControls();
}

function renderStoreSummary(meta, importMetadata) {
  const mode = meta?.mode || 'unknown';
  if (mode === 'remote') return `<div class="project-import-summary"><strong>Permanent store connected</strong><span>${meta.recordCount ?? 0} records · synced ${escapeHtml(formatDate(meta.savedAt || meta.loadedAt))}</span></div>`;
  if (mode === 'cache-pending') return `<div class="project-import-summary"><strong>Permanent save pending</strong><span>The browser has newer records that have not reached permanent storage yet.</span></div>`;
  return `<div class="project-import-summary"><strong>Using local cache</strong><span>${importMetadata ? `Last import: ${escapeHtml(importMetadata.filename || 'project data')}` : 'No permanent store sync recorded yet.'}</span></div>`;
}

function bindBrowserControls() {
  document.querySelector('#record-search')?.addEventListener('input', (event) => { browserState.search = event.target.value; renderProjectRecords(); document.querySelector('#record-search')?.focus(); });
  document.querySelector('#record-type')?.addEventListener('change', (event) => { browserState.type = event.target.value; renderProjectRecords(); });
  document.querySelector('#record-status')?.addEventListener('change', (event) => { browserState.status = event.target.value; renderProjectRecords(); });
  document.querySelector('#record-sort')?.addEventListener('change', (event) => { browserState.sort = event.target.value; renderProjectRecords(); });
  document.querySelector('#clear-record-filters')?.addEventListener('click', () => { browserState.search = ''; browserState.type = ''; browserState.status = ''; browserState.sort = 'title-asc'; renderProjectRecords(); });
  document.querySelectorAll('[data-record-id]').forEach((button) => button.addEventListener('click', () => openRecordInspector(button.dataset.recordId)));
}

function filterAndSort(records) {
  const search = browserState.search.trim().toLowerCase();
  const filtered = records.filter((record) => {
    if (browserState.type && (record.type || 'record') !== browserState.type) return false;
    if (browserState.status && (record.status || 'unknown') !== browserState.status) return false;
    if (!search) return true;
    return recordHaystack(record).includes(search);
  });
  return [...filtered].sort((a, b) => {
    if (browserState.sort === 'title-desc') return recordTitle(b).localeCompare(recordTitle(a));
    if (browserState.sort === 'type') return `${a.type || ''} ${recordTitle(a)}`.localeCompare(`${b.type || ''} ${recordTitle(b)}`);
    if (browserState.sort === 'status') return `${a.status || ''} ${recordTitle(a)}`.localeCompare(`${b.status || ''} ${recordTitle(b)}`);
    if (browserState.sort === 'imported-desc') return String(b.origin?.importedAt || '').localeCompare(String(a.origin?.importedAt || ''));
    return recordTitle(a).localeCompare(recordTitle(b));
  });
}

function renderRecordCard(record) {
  const publicUrl = getPublicUrl(record);
  const origin = record.origin?.filename || record.metadata?.origin || '';
  const relationshipCount = Array.isArray(record.relationships) ? record.relationships.length : 0;
  const sourceCount = Array.isArray(record.sources) ? record.sources.length : 0;
  return `<article class="project-record-card"><button type="button" class="project-record-open" data-record-id="${escapeHtml(record.id || '')}"><div class="project-record-card-head"><div><div class="badges"><span class="badge">${escapeHtml(label(record.type || 'record'))}</span><span class="badge">${escapeHtml(label(record.status || 'unknown'))}</span><span class="badge">Permanent record</span></div><h4>${escapeHtml(recordTitle(record))}</h4></div><span class="record-chevron" aria-hidden="true">›</span></div><p class="record-id">${escapeHtml(record.id || 'No record ID')}</p>${record.summary ? `<p>${escapeHtml(record.summary)}</p>` : ''}<div class="record-card-meta">${origin ? `<span>From ${escapeHtml(origin)}</span>` : ''}<span>${sourceCount} source${sourceCount === 1 ? '' : 's'}</span><span>${relationshipCount} relationship${relationshipCount === 1 ? '' : 's'}</span>${publicUrl ? '<span>Public page linked</span>' : ''}</div></button></article>`;
}

function openRecordInspector(recordId) {
  const record = readRecords().find((item) => item.id === recordId);
  if (!record) return;
  browserState.selectedId = recordId;
  closeInspector();
  const dialog = document.createElement('dialog');
  dialog.id = 'project-record-inspector';
  dialog.innerHTML = `<section class="record-inspector-card"><header class="record-inspector-header"><div><span class="eyebrow">Permanent Project Record</span><h3>${escapeHtml(recordTitle(record))}</h3><div class="badges"><span class="badge">${escapeHtml(label(record.type || 'record'))}</span><span class="badge">${escapeHtml(label(record.status || 'unknown'))}</span><span class="badge">Stored in CuratorOS</span>${record.metadata?.confidence ? `<span class="badge">${escapeHtml(label(record.metadata.confidence))} confidence</span>` : ''}</div></div><button type="button" class="record-inspector-close" data-close-inspector aria-label="Close record">×</button></header>${record.summary ? `<section class="record-inspector-section"><h4>Summary</h4><p>${escapeHtml(record.summary)}</p></section>` : ''}${renderIdentity(record)}${renderStructuredData(record)}${renderRelationships(record.relationships)}${renderSources(record.sources)}${renderNotes(record.notes)}${renderOrigin(record.origin)}${renderRawFields(record)}<footer class="record-inspector-actions">${getPublicUrl(record) ? `<a href="${escapeHtml(normalizePublicUrl(getPublicUrl(record)))}" target="_blank" rel="noopener">Open public page</a>` : ''}<button type="button" data-copy-record>Copy record JSON</button><button type="button" data-close-inspector>Close</button></footer></section>`;
  document.body.append(dialog);
  dialog.querySelectorAll('[data-close-inspector]').forEach((button) => button.addEventListener('click', closeInspector));
  dialog.querySelector('[data-copy-record]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(record, null, 2)); const button = dialog.querySelector('[data-copy-record]'); if (button) button.textContent = 'Copied'; } catch { alert('The record could not be copied on this device.'); } });
  dialog.addEventListener('cancel', closeInspector);
  dialog.showModal();
}

function renderIdentity(record) { const publicUrl = getPublicUrl(record); return `<section class="record-inspector-section"><h4>Identity</h4><dl class="record-detail-grid">${detail('Record ID', record.id)}${detail('Type', label(record.type || 'record'))}${detail('Status', label(record.status || 'unknown'))}${detail('Storage', 'Permanent CuratorOS Project Records')}${detail('Public page', publicUrl || 'Not linked')}</dl></section>`; }
function renderStructuredData(record) { const data = record.data && typeof record.data === 'object' ? record.data : {}; const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ''); if (!entries.length) return ''; return `<section class="record-inspector-section"><h4>Structured data</h4><dl class="record-detail-grid">${entries.map(([key, value]) => detail(label(key), displayValue(value))).join('')}</dl></section>`; }
function renderRelationships(relationships) { if (!Array.isArray(relationships) || !relationships.length) return ''; return `<section class="record-inspector-section"><h4>Relationships <span>${relationships.length}</span></h4><div class="record-inspector-list">${relationships.map((relationship) => `<article><strong>${escapeHtml(label(relationship.relationship || relationship.type || 'related to'))}</strong><p>${escapeHtml(relationship.target || relationship.id || relationship.recordId || 'Unknown target')}</p>${relationship.confidence ? `<small>${escapeHtml(label(relationship.confidence))} confidence</small>` : ''}${relationship.note ? `<p>${escapeHtml(relationship.note)}</p>` : ''}</article>`).join('')}</div></section>`; }
function renderSources(sources) { if (!Array.isArray(sources) || !sources.length) return ''; return `<section class="record-inspector-section"><h4>Sources <span>${sources.length}</span></h4><div class="record-inspector-list">${sources.map((source) => { const item = typeof source === 'string' ? { id: source, title: source } : source; return `<article><strong>${escapeHtml(item.title || item.name || item.id || 'Source')}</strong>${item.id ? `<p>${escapeHtml(item.id)}</p>` : ''}${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open source</a>` : ''}</article>`; }).join('')}</div></section>`; }
function renderNotes(notes) { if (!Array.isArray(notes) || !notes.length) return ''; return `<section class="record-inspector-section"><h4>Curatorial notes <span>${notes.length}</span></h4><div class="record-inspector-list">${notes.map((note) => { const item = typeof note === 'string' ? { body: note } : note; return `<article>${item.kind ? `<strong>${escapeHtml(label(item.kind))}</strong>` : ''}<p>${escapeHtml(item.body || item.note || displayValue(item))}</p></article>`; }).join('')}</div></section>`; }
function renderOrigin(origin) { if (!origin || typeof origin !== 'object') return ''; return `<section class="record-inspector-section"><h4>Origin</h4><dl class="record-detail-grid">${Object.entries(origin).map(([key, value]) => detail(label(key), displayValue(value))).join('')}</dl></section>`; }
function renderRawFields(record) { const reserved = new Set(['id', 'type', 'title', 'status', 'summary', 'tags', 'relationships', 'sources', 'media', 'notes', 'data', 'metadata', 'origin']); const entries = Object.entries(record).filter(([key, value]) => !reserved.has(key) && value !== undefined && value !== null && value !== ''); if (!entries.length && !record.metadata && !record.tags?.length) return ''; return `<details class="record-inspector-section record-raw-fields"><summary>Additional imported fields</summary>${record.tags?.length ? `<p><strong>Tags:</strong> ${escapeHtml(record.tags.join(', '))}</p>` : ''}${record.metadata ? `<pre>${escapeHtml(JSON.stringify(record.metadata, null, 2))}</pre>` : ''}${entries.length ? `<pre>${escapeHtml(JSON.stringify(Object.fromEntries(entries), null, 2))}</pre>` : ''}</details>`; }
function closeInspector() { const dialog = document.querySelector('#project-record-inspector'); if (!dialog) return; try { dialog.close(); } catch {} dialog.remove(); }
function getPublicUrl(record) { return record.data?.pageUrl || record.url || record.path || record.canonical || record.href || ''; }
function normalizePublicUrl(value) { const url = String(value || ''); if (/^https?:\/\//i.test(url)) return url; return `https://oceanliners.net${url.startsWith('/') ? '' : '/'}${url}`; }
function recordHaystack(record) { return JSON.stringify(record).toLowerCase(); }
function recordTitle(record) { return record.title || record.name || record.id || 'Untitled record'; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function countBy(values, getter) { return values.reduce((counts, value) => { const key = getter(value); counts[key] = (counts[key] || 0) + 1; return counts; }, {}); }
function metric(value, labelText) { return `<div class="metric"><strong>${value}</strong><span>${escapeHtml(labelText)}</span></div>`; }
function pluralLabel(type, count) { const name = label(type); return count === 1 ? name : `${name}s`; }
function sortOption(value, text) { return `<option value="${value}"${browserState.sort === value ? ' selected' : ''}>${text}</option>`; }
function label(value) { return String(value || '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function detail(name, value) { return `<dt>${escapeHtml(name)}</dt><dd>${escapeHtml(displayValue(value))}</dd>`; }
function displayValue(value) { if (Array.isArray(value)) return value.map(displayValue).join(', '); if (value && typeof value === 'object') return JSON.stringify(value); return String(value ?? ''); }
function formatDate(value) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[character])); }
