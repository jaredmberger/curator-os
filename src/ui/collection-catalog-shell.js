import { installRecordAuthoringDialogs } from './record-authoring-dialogs.js';

const ICONS = {
  ship: '🚢',
  company: '⚑',
  organization: '⚙',
  person: '●',
  object: '◆',
  photo: '▣',
  source: '⌘'
};

export class RecordService {
  constructor(options = {}) {
    this.storage = options.storage || globalThis.localStorage;
    this.storageKey = options.storageKey || CuratorStorage.DEFAULT_KEY;
    this.seedRecords = Array.isArray(options.seedRecords) ? options.seedRecords : [];
    this.historyLimit = Number(options.historyLimit || 50);
    this.database = this.load();
    this.history = [];
    this.future = [];
    this.listeners = new Set();
  }

  load() {
    let database = CuratorStorage.load(this.storage, this.storageKey);
    if (!database.records.length && this.seedRecords.length) {
      database = CuratorDatabase.createDatabase(this.seedRecords);
      if (this.storage?.setItem) CuratorStorage.save(database, this.storage, this.storageKey);
    }
    CuratorDatabase.assertDatabase(database);
    return database;
  }

  all() { return CuratorDatabase.clone(this.database.records); }
  get(id) { return CuratorDatabase.clone(this.database.records.find((record) => record.id === id) || null); }

  incoming(id) {
    if (!id) return [];
    return CuratorRelationships.incoming(this.database, id).map((relationship) => ({ ...relationship, sourceRecord: this.get(relationship.source) }));
  }

  resolveRelationships(record) {
    if (!record) return { outgoing: [], incoming: [] };
    const outgoing = (record.relationships || []).map((relationship) => ({ ...CuratorDatabase.clone(relationship), targetRecord: this.get(relationship.target) }));
    return { outgoing, incoming: this.incoming(record.id) };
  }

  resolveSources(record) {
    if (!record) return [];
    const direct = (record.sources || []).map((source) => CuratorDatabase.clone(source));
    const relationshipSourceIds = (record.relationships || []).flatMap((relationship) => relationship.sourceIds || []);
    const byId = new Map(direct.map((source) => [source.id, source]));
    relationshipSourceIds.forEach((sourceId) => {
      if (!byId.has(sourceId)) {
        const sourceRecord = this.get(sourceId);
        byId.set(sourceId, sourceRecord || { id: sourceId, title: sourceId });
      }
    });
    return [...byId.values()];
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify(event) { this.listeners.forEach((listener) => listener(event)); }
  snapshot() { return CuratorDatabase.clone(this.database); }

  persist() {
    CuratorDatabase.assertDatabase(this.database);
    if (this.storage?.setItem) CuratorStorage.save(this.database, this.storage, this.storageKey);
  }

  commit(nextDatabase, event) {
    this.history.push(this.snapshot());
    if (this.history.length > this.historyLimit) this.history.shift();
    this.future = [];
    this.database = nextDatabase;
    this.persist();
    this.notify(event);
    return event.record ? CuratorDatabase.clone(event.record) : this.all();
  }

  update(id, patch = {}) {
    const current = this.get(id);
    if (!current) throw new Error(`Record not found: ${id}`);
    const editablePatch = CuratorDatabase.clone(patch);
    delete editablePatch.id;
    const updated = CuratorDatabase.createRecord({
      ...current,
      ...editablePatch,
      metadata: { ...current.metadata, ...(editablePatch.metadata || {}), created: current.metadata?.created, updated: new Date().toISOString() }
    });
    const records = this.database.records.map((record) => record.id === id ? updated : record);
    return this.commit(CuratorDatabase.createDatabase(records), { type: 'update', id, record: updated });
  }

  create(input = {}) {
    const record = CuratorDatabase.createRecord(input);
    if (this.get(record.id)) throw new Error(`Record already exists: ${record.id}`);
    return this.commit(CuratorDatabase.createDatabase([...this.database.records, record]), { type: 'create', id: record.id, record });
  }

  remove(id) {
    if (!this.get(id)) return false;
    this.commit(CuratorDatabase.createDatabase(this.database.records.filter((record) => record.id !== id)), { type: 'remove', id });
    return true;
  }

  replace(records) { return this.commit(CuratorDatabase.createDatabase(records), { type: 'replace' }); }
  undo() { if (!this.history.length) return false; this.future.push(this.snapshot()); this.database = this.history.pop(); this.persist(); this.notify({ type: 'undo' }); return true; }
  redo() { if (!this.future.length) return false; this.history.push(this.snapshot()); this.database = this.future.pop(); this.persist(); this.notify({ type: 'redo' }); return true; }
  get canUndo() { return this.history.length > 0; }
  get canRedo() { return this.future.length > 0; }
}

export class DraftService {
  constructor(recordService, options = {}) { this.recordService = recordService; this.delay = Number(options.delay || 450); this.drafts = new Map(); this.timers = new Map(); this.listeners = new Set(); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify(event) { this.listeners.forEach((listener) => listener(event)); }
  begin(id) { const record = this.recordService.get(id); if (!record) throw new Error(`Record not found: ${id}`); this.drafts.set(id, { record, dirty: false, errors: [] }); return CuratorDatabase.clone(record); }
  get(id) { const draft = this.drafts.get(id); return draft ? CuratorDatabase.clone(draft) : null; }
  patch(id, patch = {}) {
    const draft = this.drafts.get(id) || { record: this.begin(id), dirty: false, errors: [] };
    draft.record = { ...draft.record, ...CuratorDatabase.clone(patch), metadata: { ...draft.record.metadata, ...(patch.metadata || {}) } };
    draft.errors = CuratorDatabase.validateRecord({ ...draft.record, metadata: { ...draft.record.metadata, schemaVersion: CuratorDatabase.SCHEMA_VERSION } });
    draft.dirty = true;
    this.drafts.set(id, draft);
    this.schedule(id);
    this.notify({ type: 'draft', id, draft: this.get(id) });
    return this.get(id);
  }
  schedule(id) { clearTimeout(this.timers.get(id)); this.timers.set(id, setTimeout(() => this.save(id), this.delay)); }
  save(id) {
    clearTimeout(this.timers.get(id)); this.timers.delete(id);
    const draft = this.drafts.get(id);
    if (!draft || !draft.dirty) return this.recordService.get(id);
    if (draft.errors.length) { this.notify({ type: 'invalid', id, errors: [...draft.errors] }); return false; }
    const saved = this.recordService.update(id, draft.record);
    this.drafts.set(id, { record: saved, dirty: false, errors: [] });
    this.notify({ type: 'saved', id, record: saved });
    return saved;
  }
  discard(id) { clearTimeout(this.timers.get(id)); this.timers.delete(id); this.drafts.delete(id); this.notify({ type: 'discarded', id }); }
}

export class SearchService {
  constructor(recordService = new RecordService()) { this.recordService = recordService; }
  search(query = '', filters = {}) {
    const needle = query.trim().toLowerCase();
    return this.recordService.all().filter((record) => {
      const haystack = [record.id, record.title, record.type, record.status, record.summary, record.metadata?.confidence, ...(record.tags || [])].join(' ').toLowerCase();
      return (!needle || haystack.includes(needle)) && (!filters.type || filters.type === 'all' || record.type === filters.type) && (!filters.status || filters.status === 'all' || record.status === filters.status);
    });
  }
}

export class NavigationService {
  constructor() { this.activeModule = 'catalog'; this.listeners = new Set(); }
  open(moduleName) { this.activeModule = moduleName; this.listeners.forEach((listener) => listener(moduleName)); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}

export function renderRecordCard(record, selected = false) {
  const tags = (record.tags || []).map((tag) => `<span class="cos-tag">${escapeHtml(tag)}</span>`).join('');
  return `<button class="cos-record-card${selected ? ' is-selected' : ''}" type="button" data-record-id="${escapeHtml(record.id)}" aria-pressed="${selected}"><span class="cos-record-icon" aria-hidden="true">${ICONS[record.type] || '•'}</span><span class="cos-record-body"><span class="cos-record-title">${escapeHtml(record.title)}</span><span class="cos-record-meta">${escapeHtml(record.type)} · ${escapeHtml(record.status)} · ${escapeHtml(record.metadata?.confidence || 'unknown')}</span><span class="cos-record-tags">${tags}</span></span></button>`;
}

export function renderInspector(record, context = {}) {
  if (!record) return `<div class="cos-empty-state"><strong>No record selected</strong><span>Select a catalog record to open its dossier.</span></div>`;
  const relationships = context.relationships || { outgoing: [], incoming: [] };
  const sources = context.sources || record.sources || [];
  const editing = Boolean(context.editing);
  const draft = context.draft?.record || record;
  const errors = context.draft?.errors || [];
  const isBuilder = ['company', 'organization'].includes(record.type) && (record.tags || []).some((tag) => tag.toLowerCase() === 'shipbuilder');
  const isShippingLine = ['company', 'organization'].includes(record.type) && (record.tags || []).some((tag) => tag.toLowerCase() === 'shipping line');
  const previewable = record.type === 'ship' || isBuilder || isShippingLine;
  return `<div class="cos-inspector-breadcrumb">Collection Catalog <span>›</span> ${escapeHtml(record.type)} <span>›</span> ${escapeHtml(record.title)}</div>
    <header class="cos-inspector-header"><span class="cos-record-icon" aria-hidden="true">${ICONS[record.type] || '•'}</span><div><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.id)}</p></div><div class="cos-inspector-actions">${record.type === 'ship' ? '<button type="button" class="cos-edit-button" data-edit-ship>Edit ship</button>' : ''}${isBuilder ? '<button type="button" class="cos-edit-button" data-edit-builder>Edit builder</button>' : ''}${isShippingLine ? '<button type="button" class="cos-edit-button" data-edit-shipping-line>Edit shipping line</button>' : ''}${record.type === 'source' ? '<button type="button" class="cos-edit-button" data-edit-source>Edit source</button>' : ''}${record.type === 'object' ? '<button type="button" class="cos-edit-button" data-edit-reference-object>Edit object</button>' : ''}${['photo', 'media'].includes(record.type) ? '<button type="button" class="cos-edit-button" data-edit-photo-media>Edit media</button>' : ''}${previewable ? '<button type="button" class="cos-edit-button" data-preview-publication>Preview publication</button>' : ''}<button type="button" class="cos-edit-button" data-explore-relationships>Relationships</button><button type="button" class="cos-edit-button" data-edit-record>${editing ? 'Close editor' : 'Edit record'}</button><button type="button" class="cos-edit-button" data-edit-structured>Structured data</button></div></header>
    ${editing ? renderEditor(draft, errors, context.draft?.dirty) : ''}
    ${renderProvenanceSummary(record, relationships, sources)}
    ${renderSection('Summary', `<p>${escapeHtml(record.summary || 'No summary recorded.')}</p>`, true)}
    ${renderRelationshipSection(relationships)}
    ${renderSourceSection(sources)}
    ${renderListSection('Media', record.media)}
    ${renderListSection('Notes', record.notes)}
    ${renderSection('Metadata', `<dl>${Object.entries(record.metadata || {}).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}</dl>`)}`;
}

function renderEditor(record, errors = [], dirty = false) {
  return `<form class="cos-record-editor" data-record-editor novalidate><div class="cos-editor-status" aria-live="polite">${errors.length ? `${errors.length} validation issue${errors.length === 1 ? '' : 's'}` : dirty ? 'Unsaved changes' : 'All changes saved'}</div><label>Title<input name="title" value="${escapeHtml(record.title || '')}" required></label><label>Summary<textarea name="summary" rows="4">${escapeHtml(record.summary || '')}</textarea></label><label>Status<select name="status">${CuratorDatabase.RECORD_STATUSES.map((status) => `<option value="${status}"${record.status === status ? ' selected' : ''}>${status}</option>`).join('')}</select></label><label>Confidence<select name="confidence">${CuratorDatabase.CONFIDENCE_LEVELS.map((confidence) => `<option value="${confidence}"${record.metadata?.confidence === confidence ? ' selected' : ''}>${confidence}</option>`).join('')}</select></label><label>Tags<input name="tags" value="${escapeHtml((record.tags || []).join(', '))}" placeholder="comma separated"></label>${errors.length ? `<ul class="cos-validation-list">${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : ''}<div class="cos-editor-actions"><button type="submit">Save now</button><button type="button" data-discard-draft>Discard</button></div></form>`;
}

function renderProvenanceSummary(record, relationships, sources) { const linkedClaims = [...relationships.outgoing, ...relationships.incoming].length; return `<section class="cos-provenance-summary" aria-label="Provenance summary"><span><b>Confidence</b>${escapeHtml(record.metadata?.confidence || 'unknown')}</span><span><b>Reviewed</b>${escapeHtml(record.metadata?.reviewed || 'Not reviewed')}</span><span><b>Sources</b>${sources.length}</span><span><b>Linked claims</b>${linkedClaims}</span></section>`; }
function renderRelationshipSection(relationships) { return renderSection('Relationships', `<h3>Outgoing</h3>${renderRelationshipList(relationships.outgoing || [], 'targetRecord')}<h3>Incoming</h3>${renderRelationshipList(relationships.incoming || [], 'sourceRecord')}`, true); }
function renderRelationshipList(values, recordKey) { if (!values.length) return '<p class="cos-muted">None recorded.</p>'; return `<ul class="cos-provenance-list">${values.map((value) => { const linkedRecord = value[recordKey]; const label = linkedRecord?.title || value.target || value.source || 'Unknown record'; const type = value.relationship || 'related_to'; const confidence = value.confidence || 'unknown'; const sourceCount = (value.sourceIds || []).length; return `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(type)} · ${escapeHtml(confidence)} · ${sourceCount} source${sourceCount === 1 ? '' : 's'}</span></li>`; }).join('')}</ul>`; }
function renderSourceSection(sources) { return renderSection('Sources', sources.length ? `<ul class="cos-provenance-list">${sources.map((source) => `<li><strong>${escapeHtml(source.title || source.id || 'Untitled source')}</strong><span>${escapeHtml(source.id || source.type || 'source')}</span></li>`).join('')}</ul>` : '<p class="cos-muted">No sources recorded.</p>'); }
function renderListSection(title, values = []) { const list = Array.isArray(values) ? values : []; return renderSection(title, list.length ? `<ul class="cos-simple-list">${list.map((value) => `<li>${escapeHtml(typeof value === 'string' ? value : value.title || value.body || value.id || JSON.stringify(value))}</li>`).join('')}</ul>` : `<p class="cos-muted">No ${title.toLowerCase()} recorded.</p>`); }
function renderSection(title, content, open = false) { return `<details class="cos-inspector-section"${open ? ' open' : ''}><summary>${escapeHtml(title)}</summary><div>${content}</div></details>`; }
function escapeHtml(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }

export function mountCollectionCatalogShell(root, options = {}) {
  if (!root) throw new Error('Catalog root is required.');
  const recordService = options.recordService || new RecordService(options);
  const draftService = options.draftService || new DraftService(recordService);
  const searchService = options.searchService || new SearchService(recordService);
  const navigationService = options.navigationService || new NavigationService();
  const state = { query: '', type: 'all', status: 'all', selectedId: options.selectedId || null, editing: false, results: [] };

  root.innerHTML = `<section class="cos-catalog-shell"><aside class="cos-catalog-sidebar"><header><span class="cos-eyebrow">CuratorOS</span><h1>Collection catalog</h1></header><div class="cos-catalog-controls"><input type="search" placeholder="Search records" data-catalog-search><select data-catalog-type><option value="all">All types</option>${CuratorDatabase.RECORD_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}</select><select data-catalog-status><option value="all">All statuses</option>${CuratorDatabase.RECORD_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join('')}</select></div><div class="cos-toolbar-actions"></div><div class="cos-catalog-results" data-catalog-results></div></aside><main class="cos-catalog-inspector" data-catalog-inspector></main></section>`;
  const results = root.querySelector('[data-catalog-results]');
  const inspector = root.querySelector('[data-catalog-inspector]');

  function render() {
    results.innerHTML = state.results.map((record) => renderRecordCard(record, record.id === state.selectedId)).join('') || '<div class="cos-empty-state"><strong>No matches</strong><span>Try a different search or filter.</span></div>';
    const selected = state.selectedId ? recordService.get(state.selectedId) : null;
    inspector.innerHTML = renderInspector(selected, { editing: state.editing, draft: selected ? draftService.get(selected.id) : null, relationships: recordService.resolveRelationships(selected), sources: recordService.resolveSources(selected) });
  }

  function updateResults() {
    state.results = searchService.search(state.query, { type: state.type, status: state.status });
    if (state.selectedId && !state.results.some((record) => record.id === state.selectedId)) state.selectedId = null;
    if (!state.selectedId && state.results.length) state.selectedId = state.results[0].id;
    render();
  }

  root.addEventListener('input', (event) => {
    if (event.target.matches('[data-catalog-search]')) { state.query = event.target.value; updateResults(); }
    if (event.target.matches('[data-record-editor] input, [data-record-editor] textarea, [data-record-editor] select')) {
      const form = event.target.closest('[data-record-editor]');
      const values = new FormData(form);
      draftService.patch(state.selectedId, { title: values.get('title'), summary: values.get('summary'), status: values.get('status'), tags: String(values.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean), metadata: { confidence: values.get('confidence') } });
    }
  });
  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-catalog-type]')) { state.type = event.target.value; updateResults(); }
    if (event.target.matches('[data-catalog-status]')) { state.status = event.target.value; updateResults(); }
  });
  root.addEventListener('click', (event) => {
    const card = event.target.closest('[data-record-id]');
    if (card) { state.selectedId = card.dataset.recordId; state.editing = false; render(); return; }
    if (event.target.closest('[data-edit-record]')) { state.editing = !state.editing; if (state.editing && state.selectedId) draftService.begin(state.selectedId); render(); return; }
    if (event.target.closest('[data-discard-draft]')) { if (state.selectedId) draftService.discard(state.selectedId); state.editing = false; render(); }
  });
  root.addEventListener('submit', (event) => {
    if (!event.target.matches('[data-record-editor]')) return;
    event.preventDefault();
    if (state.selectedId) draftService.save(state.selectedId);
    state.editing = false;
    updateResults();
  });

  const unsubRecord = recordService.subscribe(() => updateResults());
  const unsubDraft = draftService.subscribe(() => render());
  const dialogs = installRecordAuthoringDialogs(root, { recordService, onCreated(record) { state.selectedId = record.id; state.editing = false; updateResults(); } });
  updateResults();
  return { state, recordService, draftService, searchService, navigationService, dialogs, updateResults, destroy() { unsubRecord(); unsubDraft(); dialogs.destroy(); root.innerHTML = ''; } };
}
