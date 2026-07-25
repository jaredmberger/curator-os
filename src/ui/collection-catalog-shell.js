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
    return CuratorRelationships.incoming(this.database, id).map((relationship) => ({
      ...relationship,
      sourceRecord: this.get(relationship.source)
    }));
  }

  resolveRelationships(record) {
    if (!record) return { outgoing: [], incoming: [] };
    const outgoing = (record.relationships || []).map((relationship) => ({
      ...CuratorDatabase.clone(relationship),
      targetRecord: this.get(relationship.target)
    }));
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
      metadata: {
        ...current.metadata,
        ...(editablePatch.metadata || {}),
        created: current.metadata?.created,
        updated: new Date().toISOString()
      }
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

  undo() {
    if (!this.history.length) return false;
    this.future.push(this.snapshot());
    this.database = this.history.pop();
    this.persist();
    this.notify({ type: 'undo' });
    return true;
  }

  redo() {
    if (!this.future.length) return false;
    this.history.push(this.snapshot());
    this.database = this.future.pop();
    this.persist();
    this.notify({ type: 'redo' });
    return true;
  }

  get canUndo() { return this.history.length > 0; }
  get canRedo() { return this.future.length > 0; }
}

export class DraftService {
  constructor(recordService, options = {}) {
    this.recordService = recordService;
    this.delay = Number(options.delay || 450);
    this.drafts = new Map();
    this.timers = new Map();
    this.listeners = new Set();
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify(event) { this.listeners.forEach((listener) => listener(event)); }

  begin(id) {
    const record = this.recordService.get(id);
    if (!record) throw new Error(`Record not found: ${id}`);
    this.drafts.set(id, { record, dirty: false, errors: [] });
    return CuratorDatabase.clone(record);
  }

  get(id) {
    const draft = this.drafts.get(id);
    return draft ? CuratorDatabase.clone(draft) : null;
  }

  patch(id, patch = {}) {
    const draft = this.drafts.get(id) || { record: this.begin(id), dirty: false, errors: [] };
    draft.record = {
      ...draft.record,
      ...CuratorDatabase.clone(patch),
      metadata: { ...draft.record.metadata, ...(patch.metadata || {}) }
    };
    draft.errors = CuratorDatabase.validateRecord({
      ...draft.record,
      metadata: { ...draft.record.metadata, schemaVersion: CuratorDatabase.SCHEMA_VERSION }
    });
    draft.dirty = true;
    this.drafts.set(id, draft);
    this.schedule(id);
    this.notify({ type: 'draft', id, draft: this.get(id) });
    return this.get(id);
  }

  schedule(id) {
    clearTimeout(this.timers.get(id));
    this.timers.set(id, setTimeout(() => this.save(id), this.delay));
  }

  save(id) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    const draft = this.drafts.get(id);
    if (!draft || !draft.dirty) return this.recordService.get(id);
    if (draft.errors.length) {
      this.notify({ type: 'invalid', id, errors: [...draft.errors] });
      return false;
    }
    const saved = this.recordService.update(id, draft.record);
    this.drafts.set(id, { record: saved, dirty: false, errors: [] });
    this.notify({ type: 'saved', id, record: saved });
    return saved;
  }

  discard(id) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.drafts.delete(id);
    this.notify({ type: 'discarded', id });
  }
}

export class SearchService {
  constructor(recordService = new RecordService()) { this.recordService = recordService; }

  search(query = '', filters = {}) {
    const needle = query.trim().toLowerCase();
    return this.recordService.all().filter((record) => {
      const haystack = [record.id, record.title, record.type, record.status, record.summary, record.metadata?.confidence, ...(record.tags || [])].join(' ').toLowerCase();
      return (!needle || haystack.includes(needle))
        && (!filters.type || filters.type === 'all' || record.type === filters.type)
        && (!filters.status || filters.status === 'all' || record.status === filters.status);
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
  return `<button class="cos-record-card${selected ? ' is-selected' : ''}" type="button" data-record-id="${escapeHtml(record.id)}" aria-pressed="${selected}">
    <span class="cos-record-icon" aria-hidden="true">${ICONS[record.type] || '•'}</span>
    <span class="cos-record-body"><span class="cos-record-title">${escapeHtml(record.title)}</span><span class="cos-record-meta">${escapeHtml(record.type)} · ${escapeHtml(record.status)} · ${escapeHtml(record.metadata?.confidence || 'unknown')}</span><span class="cos-record-tags">${tags}</span></span>
  </button>`;
}

export function renderInspector(record, context = {}) {
  if (!record) return `<div class="cos-empty-state"><strong>No record selected</strong><span>Select a catalog record to open its dossier.</span></div>`;
  const relationships = context.relationships || { outgoing: [], incoming: [] };
  const sources = context.sources || record.sources || [];
  const editing = Boolean(context.editing);
  const draft = context.draft?.record || record;
  const errors = context.draft?.errors || [];
  return `<div class="cos-inspector-breadcrumb">Collection Catalog <span>›</span> ${escapeHtml(record.type)} <span>›</span> ${escapeHtml(record.title)}</div>
    <header class="cos-inspector-header"><span class="cos-record-icon" aria-hidden="true">${ICONS[record.type] || '•'}</span><div><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.id)}</p></div><div class="cos-inspector-actions"><button type="button" class="cos-edit-button" data-edit-record>${editing ? 'Close editor' : 'Edit record'}</button><button type="button" class="cos-edit-button" data-edit-structured>Structured data</button></div></header>
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

function renderProvenanceSummary(record, relationships, sources) {
  const linkedClaims = [...relationships.outgoing, ...relationships.incoming].length;
  return `<section class="cos-provenance-summary" aria-label="Provenance summary"><span><b>Confidence</b>${escapeHtml(record.metadata?.confidence || 'unknown')}</span><span><b>Reviewed</b>${escapeHtml(record.metadata?.reviewed || 'Not reviewed')}</span><span><b>Sources</b>${sources.length}</span><span><b>Linked claims</b>${linkedClaims}</span></section>`;
}

function renderRelationshipSection(relationships) {
  return renderSection('Relationships', `<h3>Outgoing</h3>${renderRelationshipList(relationships.outgoing || [], 'targetRecord')}<h3>Incoming</h3>${renderRelationshipList(relationships.incoming || [], 'sourceRecord')}`, true);
}

function renderRelationshipList(values, recordKey) {
  if (!values.length) return '<p class="cos-muted">None recorded.</p>';
  return `<ul class="cos-provenance-list">${values.map((value) => { const linkedRecord = value[recordKey]; const label = linkedRecord?.title || value.target || value.source || 'Unknown record'; const type = value.relationship || 'related_to'; const confidence = value.confidence || 'unknown'; const sourceCount = (value.sourceIds || []).length; return `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(type)} · ${escapeHtml(confidence)} · ${sourceCount} source${sourceCount === 1 ? '' : 's'}</span>${value.note ? `<p>${escapeHtml(value.note)}</p>` : ''}</li>`; }).join('')}</ul>`;
}

function renderSourceSection(sources = []) {
  if (!sources.length) return renderSection('Sources', '<p class="cos-muted">None recorded.</p>');
  return renderSection('Sources', `<ul class="cos-provenance-list">${sources.map((source) => { const title = source.title || source.label || source.id || 'Untitled source'; const id = source.id || 'unidentified'; const details = [source.type, source.date, source.url].filter(Boolean).join(' · '); return `<li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(id)}${details ? ` · ${escapeHtml(details)}` : ''}</span>${source.note ? `<p>${escapeHtml(source.note)}</p>` : ''}</li>`; }).join('')}</ul>`, true);
}

function renderListSection(title, values = []) {
  return renderSection(title, values.length ? `<ul>${values.map((value) => `<li>${escapeHtml(typeof value === 'string' ? value : JSON.stringify(value))}</li>`).join('')}</ul>` : '<p class="cos-muted">None recorded.</p>');
}
function renderSection(title, content, open = false) { return `<details class="cos-inspector-section"${open ? ' open' : ''}><summary>${escapeHtml(title)}</summary><div>${content}</div></details>`; }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }

export function mountCollectionCatalogShell(root, options = {}) {
  if (!root) throw new Error('Collection Catalog root element is required.');
  const recordService = options.recordService || new RecordService(options);
  const draftService = options.draftService || new DraftService(recordService, options);
  const searchService = options.searchService || new SearchService(recordService);
  const navigationService = options.navigationService || new NavigationService();
  const state = { query: '', type: 'all', status: 'all', results: searchService.search(), selectedId: null, cursor: 0, editing: false };

  root.innerHTML = `<div class="cos-app-shell"><aside class="cos-sidebar" aria-label="CuratorOS navigation"><div class="cos-brand"><span>⚓</span><strong>CuratorOS</strong></div><nav>${['Captain', 'Collection Catalog', 'Atlas', 'Publications', 'Sources', 'Media', 'Tasks', 'Settings'].map((label) => `<button type="button" data-module="${label === 'Collection Catalog' ? 'catalog' : label.toLowerCase().replaceAll(' ', '-')}">${label}</button>`).join('')}</nav><footer><span>Database <b>Healthy</b></span><span>Schema <b>v${CuratorDatabase.SCHEMA_VERSION}</b></span><span>Build <b>5.3 alpha</b></span></footer></aside><main class="cos-catalog-pane"><header class="cos-toolbar"><div><span class="cos-eyebrow">Voyage III</span><h1>Collection Catalog</h1></div><div class="cos-toolbar-actions"><button type="button" data-new-record>New record</button><button type="button" data-undo disabled>Undo</button><button type="button" data-redo disabled>Redo</button></div><label class="cos-search"><span class="sr-only">Search records</span><input type="search" placeholder="Search records…" autocomplete="off" data-catalog-search></label></header><div class="cos-filter-bar"><label>Type<select data-filter-type><option value="all">All</option><option value="ship">Ships</option><option value="company">Companies</option><option value="organization">Organizations</option><option value="person">People</option><option value="object">Objects</option><option value="photo">Photos</option><option value="source">Sources</option></select></label><label>Status<select data-filter-status><option value="all">All</option><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="archived">Archived</option></select></label><span data-result-count></span></div><section class="cos-record-list" aria-label="Catalog records" data-record-list></section></main><aside class="cos-inspector-pane" aria-label="Record inspector" data-inspector></aside></div>`;

  const searchInput = root.querySelector('[data-catalog-search]');
  const typeSelect = root.querySelector('[data-filter-type]');
  const statusSelect = root.querySelector('[data-filter-status]');
  const list = root.querySelector('[data-record-list]');
  const inspector = root.querySelector('[data-inspector]');
  const count = root.querySelector('[data-result-count]');
  const undoButton = root.querySelector('[data-undo]');
  const redoButton = root.querySelector('[data-redo]');

  const dialogs = installRecordAuthoringDialogs(root, {
    recordService,
    selectedId: state.selectedId,
    onCreated(record) { state.selectedId = record.id; state.editing = false; updateResults(); },
    onUpdated() { updateResults(); }
  });

  function updateResults() {
    state.results = searchService.search(state.query, { type: state.type, status: state.status });
    state.cursor = Math.min(state.cursor, Math.max(0, state.results.length - 1));
    if (state.selectedId && !state.results.some((record) => record.id === state.selectedId)) { state.selectedId = null; state.editing = false; }
    dialogs.setSelectedId(state.selectedId);
    render();
  }

  function render() {
    count.textContent = `${state.results.length} record${state.results.length === 1 ? '' : 's'}`;
    list.innerHTML = state.results.length ? state.results.map((record) => renderRecordCard(record, record.id === state.selectedId)).join('') : `<div class="cos-empty-state"><strong>No matching records</strong><span>Change the search or filters.</span></div>`;
    const selectedRecord = recordService.get(state.selectedId);
    inspector.innerHTML = renderInspector(selectedRecord, { relationships: recordService.resolveRelationships(selectedRecord), sources: recordService.resolveSources(selectedRecord), editing: state.editing, draft: draftService.get(state.selectedId) });
    undoButton.disabled = !recordService.canUndo;
    redoButton.disabled = !recordService.canRedo;
    dialogs.setSelectedId(state.selectedId);
  }

  function selectAt(index) {
    if (!state.results.length) return;
    state.cursor = Math.max(0, Math.min(index, state.results.length - 1));
    state.selectedId = state.results[state.cursor].id;
    state.editing = false;
    dialogs.setSelectedId(state.selectedId);
    render();
    list.querySelector(`[data-record-id="${CSS.escape(state.selectedId)}"]`)?.focus();
  }

  function patchFromForm(form) {
    const values = new FormData(form);
    return { title: String(values.get('title') || ''), summary: String(values.get('summary') || ''), status: String(values.get('status') || 'draft'), tags: String(values.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean), metadata: { confidence: String(values.get('confidence') || 'unknown') } };
  }

  searchInput.addEventListener('input', (event) => { state.query = event.target.value; updateResults(); });
  typeSelect.addEventListener('change', (event) => { state.type = event.target.value; updateResults(); });
  statusSelect.addEventListener('change', (event) => { state.status = event.target.value; updateResults(); });
  list.addEventListener('click', (event) => { const card = event.target.closest('[data-record-id]'); if (!card) return; state.cursor = state.results.findIndex((record) => record.id === card.dataset.recordId); state.selectedId = card.dataset.recordId; state.editing = false; dialogs.setSelectedId(state.selectedId); render(); });
  inspector.addEventListener('click', (event) => { if (event.target.closest('[data-edit-record]')) { state.editing = !state.editing; if (state.editing && state.selectedId && !draftService.get(state.selectedId)) draftService.begin(state.selectedId); render(); return; } if (event.target.closest('[data-discard-draft]')) { draftService.discard(state.selectedId); state.editing = false; render(); } });
  inspector.addEventListener('input', (event) => { const form = event.target.closest('[data-record-editor]'); if (!form || !state.selectedId) return; draftService.patch(state.selectedId, patchFromForm(form)); render(); });
  inspector.addEventListener('submit', (event) => { const form = event.target.closest('[data-record-editor]'); if (!form || !state.selectedId) return; event.preventDefault(); draftService.patch(state.selectedId, patchFromForm(form)); const saved = draftService.save(state.selectedId); if (saved) updateResults(); else render(); });
  undoButton.addEventListener('click', () => { if (recordService.undo()) updateResults(); });
  redoButton.addEventListener('click', () => { if (recordService.redo()) updateResults(); });
  recordService.subscribe(() => updateResults());
  draftService.subscribe((event) => { if (event.id === state.selectedId) render(); });
  root.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => navigationService.open(button.dataset.module)));
  root.addEventListener('keydown', (event) => { const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement; const modifier = event.metaKey || event.ctrlKey; if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) recordService.redo(); else recordService.undo(); updateResults(); return; } if (event.key === '/' && !isTyping) { event.preventDefault(); searchInput.focus(); return; } if (event.key === 'Escape') { if (state.editing) { draftService.discard(state.selectedId); state.editing = false; } else { state.selectedId = null; dialogs.setSelectedId(null); } render(); searchInput.blur(); return; } if (!isTyping && event.key === 'ArrowDown') { event.preventDefault(); selectAt(state.cursor + 1); } if (!isTyping && event.key === 'ArrowUp') { event.preventDefault(); selectAt(state.cursor - 1); } if (!isTyping && event.key === 'Enter' && state.results[state.cursor]) { state.selectedId = state.results[state.cursor].id; dialogs.setSelectedId(state.selectedId); render(); } });

  render();
  return { state, recordService, draftService, searchService, navigationService, dialogs, destroy() { dialogs.destroy(); root.innerHTML = ''; } };
}
