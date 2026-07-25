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
    this.database = this.load();
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

  all() {
    return CuratorDatabase.clone(this.database.records);
  }

  get(id) {
    return CuratorDatabase.clone(this.database.records.find((record) => record.id === id) || null);
  }

  replace(records) {
    this.database = CuratorDatabase.createDatabase(records);
    if (this.storage?.setItem) CuratorStorage.save(this.database, this.storage, this.storageKey);
    return this.all();
  }
}

export class SearchService {
  constructor(recordService = new RecordService()) {
    this.recordService = recordService;
  }

  search(query = '', filters = {}) {
    const needle = query.trim().toLowerCase();
    return this.recordService.all().filter((record) => {
      const haystack = [
        record.id,
        record.title,
        record.type,
        record.status,
        record.summary,
        record.metadata?.confidence,
        ...(record.tags || [])
      ].join(' ').toLowerCase();
      const queryMatches = !needle || haystack.includes(needle);
      const typeMatches = !filters.type || filters.type === 'all' || record.type === filters.type;
      const statusMatches = !filters.status || filters.status === 'all' || record.status === filters.status;
      return queryMatches && typeMatches && statusMatches;
    });
  }
}

export class NavigationService {
  constructor() {
    this.activeModule = 'catalog';
    this.listeners = new Set();
  }

  open(moduleName) {
    this.activeModule = moduleName;
    this.listeners.forEach((listener) => listener(moduleName));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export function renderRecordCard(record, selected = false) {
  const tags = (record.tags || []).map((tag) => `<span class="cos-tag">${escapeHtml(tag)}</span>`).join('');
  return `
    <button class="cos-record-card${selected ? ' is-selected' : ''}" type="button" data-record-id="${escapeHtml(record.id)}" aria-pressed="${selected}">
      <span class="cos-record-icon" aria-hidden="true">${ICONS[record.type] || '•'}</span>
      <span class="cos-record-body">
        <span class="cos-record-title">${escapeHtml(record.title)}</span>
        <span class="cos-record-meta">${escapeHtml(record.type)} · ${escapeHtml(record.status)} · ${escapeHtml(record.metadata?.confidence || 'unknown')}</span>
        <span class="cos-record-tags">${tags}</span>
      </span>
    </button>`;
}

export function renderInspector(record) {
  if (!record) {
    return `<div class="cos-empty-state"><strong>No record selected</strong><span>Select a catalog record to open its dossier.</span></div>`;
  }

  return `
    <div class="cos-inspector-breadcrumb">Collection Catalog <span>›</span> ${escapeHtml(record.type)} <span>›</span> ${escapeHtml(record.title)}</div>
    <header class="cos-inspector-header">
      <span class="cos-record-icon" aria-hidden="true">${ICONS[record.type] || '•'}</span>
      <div><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.id)}</p></div>
    </header>
    ${renderSection('Summary', `<p>${escapeHtml(record.summary || 'No summary recorded.')}</p>`, true)}
    ${renderListSection('Relationships', record.relationships)}
    ${renderListSection('Sources', record.sources)}
    ${renderListSection('Media', record.media)}
    ${renderListSection('Notes', record.notes)}
    ${renderSection('Metadata', `<dl>${Object.entries(record.metadata || {}).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}</dl>`)}
  `;
}

function renderListSection(title, values = []) {
  const content = values.length
    ? `<ul>${values.map((value) => `<li>${escapeHtml(typeof value === 'string' ? value : JSON.stringify(value))}</li>`).join('')}</ul>`
    : '<p class="cos-muted">None recorded.</p>';
  return renderSection(title, content);
}

function renderSection(title, content, open = false) {
  return `<details class="cos-inspector-section"${open ? ' open' : ''}><summary>${escapeHtml(title)}</summary><div>${content}</div></details>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function mountCollectionCatalogShell(root, options = {}) {
  if (!root) throw new Error('Collection Catalog root element is required.');

  const recordService = options.recordService || new RecordService(options);
  const searchService = options.searchService || new SearchService(recordService);
  const navigationService = options.navigationService || new NavigationService();
  const state = {
    query: '',
    type: 'all',
    status: 'all',
    results: searchService.search(),
    selectedId: null,
    cursor: 0
  };

  root.innerHTML = `
    <div class="cos-app-shell">
      <aside class="cos-sidebar" aria-label="CuratorOS navigation">
        <div class="cos-brand"><span>⚓</span><strong>CuratorOS</strong></div>
        <nav>
          ${['Captain', 'Collection Catalog', 'Atlas', 'Publications', 'Sources', 'Media', 'Tasks', 'Settings']
            .map((label) => `<button type="button" data-module="${label === 'Collection Catalog' ? 'catalog' : label.toLowerCase().replaceAll(' ', '-')}">${label}</button>`)
            .join('')}
        </nav>
        <footer><span>Database <b>Healthy</b></span><span>Schema <b>v${CuratorDatabase.SCHEMA_VERSION}</b></span><span>Build <b>5.3 alpha</b></span></footer>
      </aside>
      <main class="cos-catalog-pane">
        <header class="cos-toolbar">
          <div><span class="cos-eyebrow">Voyage III</span><h1>Collection Catalog</h1></div>
          <label class="cos-search"><span class="sr-only">Search records</span><input type="search" placeholder="Search records…" autocomplete="off" data-catalog-search></label>
        </header>
        <div class="cos-filter-bar">
          <label>Type<select data-filter-type><option value="all">All</option><option value="ship">Ships</option><option value="company">Companies</option><option value="organization">Organizations</option><option value="person">People</option><option value="object">Objects</option><option value="photo">Photos</option><option value="source">Sources</option></select></label>
          <label>Status<select data-filter-status><option value="all">All</option><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
          <span data-result-count></span>
        </div>
        <section class="cos-record-list" aria-label="Catalog records" data-record-list></section>
      </main>
      <aside class="cos-inspector-pane" aria-label="Record inspector" data-inspector></aside>
    </div>`;

  const searchInput = root.querySelector('[data-catalog-search]');
  const typeSelect = root.querySelector('[data-filter-type]');
  const statusSelect = root.querySelector('[data-filter-status]');
  const list = root.querySelector('[data-record-list]');
  const inspector = root.querySelector('[data-inspector]');
  const count = root.querySelector('[data-result-count]');

  function updateResults() {
    state.results = searchService.search(state.query, { type: state.type, status: state.status });
    state.cursor = Math.min(state.cursor, Math.max(0, state.results.length - 1));
    if (state.selectedId && !state.results.some((record) => record.id === state.selectedId)) state.selectedId = null;
    render();
  }

  function render() {
    count.textContent = `${state.results.length} record${state.results.length === 1 ? '' : 's'}`;
    list.innerHTML = state.results.length
      ? state.results.map((record) => renderRecordCard(record, record.id === state.selectedId)).join('')
      : `<div class="cos-empty-state"><strong>No matching records</strong><span>Change the search or filters.</span></div>`;
    inspector.innerHTML = renderInspector(recordService.get(state.selectedId));
  }

  function selectAt(index) {
    if (!state.results.length) return;
    state.cursor = Math.max(0, Math.min(index, state.results.length - 1));
    state.selectedId = state.results[state.cursor].id;
    render();
    list.querySelector(`[data-record-id="${CSS.escape(state.selectedId)}"]`)?.focus();
  }

  searchInput.addEventListener('input', (event) => { state.query = event.target.value; updateResults(); });
  typeSelect.addEventListener('change', (event) => { state.type = event.target.value; updateResults(); });
  statusSelect.addEventListener('change', (event) => { state.status = event.target.value; updateResults(); });
  list.addEventListener('click', (event) => {
    const card = event.target.closest('[data-record-id]');
    if (!card) return;
    state.cursor = state.results.findIndex((record) => record.id === card.dataset.recordId);
    state.selectedId = card.dataset.recordId;
    render();
  });

  root.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => navigationService.open(button.dataset.module)));

  root.addEventListener('keydown', (event) => {
    const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      searchInput.focus();
      return;
    }
    if (event.key === 'Escape') {
      state.selectedId = null;
      render();
      searchInput.blur();
      return;
    }
    if (!isTyping && event.key === 'ArrowDown') {
      event.preventDefault();
      selectAt(state.cursor + 1);
    }
    if (!isTyping && event.key === 'ArrowUp') {
      event.preventDefault();
      selectAt(state.cursor - 1);
    }
    if (!isTyping && event.key === 'Enter' && state.results[state.cursor]) {
      state.selectedId = state.results[state.cursor].id;
      render();
    }
  });

  render();
  return { state, recordService, searchService, navigationService, destroy() { root.innerHTML = ''; } };
}
