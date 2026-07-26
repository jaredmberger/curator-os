import { assessPublicationReadiness } from './publication-preview.js';

const RECORD_TYPES = Object.freeze(['ship', 'company', 'organization', 'person', 'object', 'photo', 'media', 'source']);
const RECORD_STATUSES = Object.freeze(['draft', 'review', 'published', 'archived']);
const CONFIDENCE_LEVELS = Object.freeze(['unknown', 'tentative', 'probable', 'verified']);

const DEFAULT_VIEWS = Object.freeze([
  { id: 'needs-review', label: 'Needs review', test: (record) => !record.metadata?.reviewed || record.status === 'review' },
  { id: 'missing-sources', label: 'Missing sources', test: (record) => !(record.sources || []).length && !(record.relationships || []).some((item) => (item.sourceIds || []).length) },
  { id: 'recently-updated', label: 'Recently updated', sort: 'updated' },
  { id: 'unpublished-ships', label: 'Unpublished ships', test: (record) => record.type === 'ship' && record.status !== 'published' }
]);

export class AdvancedSearchService {
  constructor(recordService, options = {}) {
    if (!recordService) throw new Error('RecordService is required.');
    this.recordService = recordService;
    this.storage = options.storage || globalThis.localStorage;
    this.storageKey = options.storageKey || 'curatoros.saved-search-views';
    this.recentKey = options.recentKey || 'curatoros.recent-records';
  }

  search(query = '', filters = {}) {
    const records = this.recordService.all();
    const needle = text(query).toLowerCase();
    let results = records.filter((record) => {
      const readiness = assessPublicationReadiness(record);
      const haystack = flatten([
        record.id, record.title, record.type, record.status, record.summary,
        record.metadata, record.tags, record.data, record.notes, record.sources,
        record.relationships, readiness.status, readiness.blockers, readiness.warnings
      ]).toLowerCase();
      return (!needle || haystack.includes(needle))
        && match(filters.type, record.type)
        && match(filters.status, record.status)
        && match(filters.confidence, record.metadata?.confidence || 'unknown')
        && (!filters.tag || (record.tags || []).some((tag) => tag.toLowerCase() === filters.tag.toLowerCase()))
        && match(filters.readiness, readiness.status);
    });
    if (filters.view === 'recently-updated') results = [...results].sort((a, b) => dateValue(b.metadata?.updated) - dateValue(a.metadata?.updated));
    return results;
  }

  applyView(id) {
    const view = this.views().find((item) => item.id === id);
    if (!view) return this.recordService.all();
    let records = this.recordService.all();
    if (view.test) records = records.filter(view.test);
    if (view.sort === 'updated') records = [...records].sort((a, b) => dateValue(b.metadata?.updated) - dateValue(a.metadata?.updated));
    return records;
  }

  views() { return [...DEFAULT_VIEWS, ...this.savedViews()]; }
  savedViews() { return readJson(this.storage, this.storageKey, []); }
  saveView(view) {
    const normalized = { id: text(view.id) || slug(view.label), label: text(view.label), query: text(view.query), filters: view.filters || {} };
    const existing = this.savedViews().filter((item) => item.id !== normalized.id);
    writeJson(this.storage, this.storageKey, [...existing, normalized]);
    return normalized;
  }
  recordRecent(id) {
    const values = [id, ...readJson(this.storage, this.recentKey, []).filter((item) => item !== id)].slice(0, 12);
    writeJson(this.storage, this.recentKey, values);
    return values;
  }
  recentRecords() { return readJson(this.storage, this.recentKey, []).map((id) => this.recordService.get(id)).filter(Boolean); }
}

export function renderAdvancedSearch(service) {
  const tags = [...new Set(service.recordService.all().flatMap((record) => record.tags || []))].sort();
  const views = service.views().map((view) => `<button type="button" data-search-view="${escapeHtml(view.id)}">${escapeHtml(view.label)}</button>`).join('');
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-advanced-search-dialog><div class="cos-authoring-form"><header><div><span class="cos-eyebrow">Catalog navigation</span><h2>Advanced search</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header><div class="cos-authoring-grid"><label>Search<input type="search" data-advanced-query placeholder="Search facts, notes, sources, relationships…"></label><label>Type<select data-advanced-type><option value="all">All types</option>${RECORD_TYPES.map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label></div><div class="cos-authoring-grid"><label>Status<select data-advanced-status><option value="all">All statuses</option>${RECORD_STATUSES.map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label><label>Confidence<select data-advanced-confidence><option value="all">All confidence levels</option>${CONFIDENCE_LEVELS.map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label></div><div class="cos-authoring-grid"><label>Tag<select data-advanced-tag><option value="">All tags</option>${tags.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}</select></label><label>Readiness<select data-advanced-readiness><option value="all">All readiness states</option><option value="ready">ready</option><option value="warning">warning</option><option value="blocked">blocked</option></select></label></div><section><h3>Saved views</h3><div class="cos-toolbar-actions">${views}</div></section><div data-advanced-results></div><footer><button type="button" data-save-current-view>Save current view</button><button type="button" data-close-dialog>Close</button></footer></div></dialog>`;
}

export function installAdvancedSearch(root, context) {
  const service = context.service || new AdvancedSearchService(context.recordService);
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { destroy() {} };
  toolbar.insertAdjacentHTML('beforeend', '<button type="button" data-open-advanced-search>Search+</button>');

  function mount() {
    root.querySelector('[data-advanced-search-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderAdvancedSearch(service));
    refresh();
  }
  function filters() {
    return {
      type: root.querySelector('[data-advanced-type]')?.value || 'all',
      status: root.querySelector('[data-advanced-status]')?.value || 'all',
      confidence: root.querySelector('[data-advanced-confidence]')?.value || 'all',
      tag: root.querySelector('[data-advanced-tag]')?.value || '',
      readiness: root.querySelector('[data-advanced-readiness]')?.value || 'all'
    };
  }
  function refresh(records = null) {
    const dialog = root.querySelector('[data-advanced-search-dialog]');
    if (!dialog) return;
    const values = records || service.search(dialog.querySelector('[data-advanced-query]')?.value || '', filters());
    dialog.querySelector('[data-advanced-results]').innerHTML = values.map((record) => `<button type="button" class="cos-review-row" data-advanced-record="${escapeHtml(record.id)}"><span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.id)} · ${escapeHtml(record.type)} · ${escapeHtml(record.status)}</small></span></button>`).join('') || '<p class="cos-muted">No matches.</p>';
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-advanced-search]')) { mount(); root.querySelector('[data-advanced-search-dialog]')?.showModal(); return; }
    const view = event.target.closest('[data-search-view]');
    if (view) { refresh(service.applyView(view.dataset.searchView)); return; }
    const row = event.target.closest('[data-advanced-record]');
    if (row) { service.recordRecent(row.dataset.advancedRecord); context.onSelect?.(row.dataset.advancedRecord); row.closest('dialog')?.close(); return; }
    if (event.target.closest('[data-save-current-view]')) {
      const label = prompt('Name this saved view:');
      if (label) service.saveView({ label, query: root.querySelector('[data-advanced-query]')?.value || '', filters: filters() });
      mount(); root.querySelector('[data-advanced-search-dialog]')?.showModal(); return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });
  root.addEventListener('input', (event) => { if (event.target.closest('[data-advanced-search-dialog]')) refresh(); });
  root.addEventListener('change', (event) => { if (event.target.closest('[data-advanced-search-dialog]')) refresh(); });
  return { service, destroy() { root.querySelector('[data-open-advanced-search]')?.remove(); root.querySelector('[data-advanced-search-dialog]')?.remove(); } };
}

function match(filter, value) { return !filter || filter === 'all' || filter === value; }
function flatten(value) { if (value == null) return ''; if (Array.isArray(value)) return value.map(flatten).join(' '); if (typeof value === 'object') return Object.values(value).map(flatten).join(' '); return String(value); }
function dateValue(value) { const parsed = Date.parse(value || ''); return Number.isNaN(parsed) ? 0 : parsed; }
function readJson(storage, key, fallback) { try { const value = storage?.getItem?.(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function writeJson(storage, key, value) { storage?.setItem?.(key, JSON.stringify(value)); }
function slug(value) { return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function text(value) { return String(value || '').trim(); }
function escapeHtml(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }