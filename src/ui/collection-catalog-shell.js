export const mockRecords = [
  {
    id: 'SHIP-000001',
    type: 'ship',
    title: 'RMS Olympic',
    summary: 'Lead ship of the Olympic class and a long-serving White Star liner.',
    status: 'verified',
    confidence: 96,
    tags: ['White Star Line', 'Olympic class'],
    relationships: ['Operated by White Star Line', 'Built by Harland & Wolff'],
    sources: ['Builder records', 'Contemporary newspapers'],
    media: ['Exterior profile', 'Promenade deck'],
    notes: ['Inspector content is read-only in PR #3.'],
    metadata: { created: '2026-07-25', updated: '2026-07-25', schema: 'v1' }
  },
  {
    id: 'SHIP-000002',
    type: 'ship',
    title: 'RMS Titanic',
    summary: 'Second Olympic-class liner, lost on her maiden voyage in April 1912.',
    status: 'verified',
    confidence: 99,
    tags: ['White Star Line', 'Olympic class'],
    relationships: ['Sister ship of RMS Olympic', 'Built by Harland & Wolff'],
    sources: ['British inquiry', 'American inquiry'],
    media: ['Launch photograph', 'General arrangement plan'],
    notes: [],
    metadata: { created: '2026-07-25', updated: '2026-07-25', schema: 'v1' }
  },
  {
    id: 'COMP-000001',
    type: 'company',
    title: 'White Star Line',
    summary: 'British shipping company associated with some of the best-known North Atlantic liners.',
    status: 'reviewed',
    confidence: 94,
    tags: ['Shipping line', 'United Kingdom'],
    relationships: ['Operated RMS Olympic', 'Operated RMS Titanic'],
    sources: ['Company records'],
    media: ['House flag'],
    notes: [],
    metadata: { created: '2026-07-25', updated: '2026-07-25', schema: 'v1' }
  },
  {
    id: 'ORG-000001',
    type: 'organization',
    title: 'Harland & Wolff',
    summary: 'Belfast shipbuilding firm responsible for the Olympic-class liners.',
    status: 'reviewed',
    confidence: 93,
    tags: ['Shipbuilder', 'Belfast'],
    relationships: ['Built RMS Olympic', 'Built RMS Titanic'],
    sources: ['Builder records'],
    media: ['Shipyard photograph'],
    notes: [],
    metadata: { created: '2026-07-25', updated: '2026-07-25', schema: 'v1' }
  }
];

const ICONS = {
  ship: '🚢',
  company: '⚑',
  organization: '⚙',
  person: '●',
  object: '◆',
  photo: '▣',
  source: '⌘'
};

export class SearchService {
  constructor(records = mockRecords) {
    this.records = records;
  }

  search(query = '', filters = {}) {
    const needle = query.trim().toLowerCase();
    return this.records.filter((record) => {
      const haystack = [record.id, record.title, record.type, record.status, ...(record.tags || [])]
        .join(' ')
        .toLowerCase();
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
        <span class="cos-record-meta">${escapeHtml(record.type)} · ${escapeHtml(record.status)} · ${Number(record.confidence || 0)}%</span>
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
    ? `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`
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

  const searchService = options.searchService || new SearchService();
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
        <footer><span>Database <b>Healthy</b></span><span>Schema <b>v1</b></span><span>Build <b>5.3 alpha</b></span></footer>
      </aside>
      <main class="cos-catalog-pane">
        <header class="cos-toolbar">
          <div><span class="cos-eyebrow">Voyage III</span><h1>Collection Catalog</h1></div>
          <label class="cos-search"><span class="sr-only">Search records</span><input type="search" placeholder="Search records…" autocomplete="off" data-catalog-search></label>
        </header>
        <div class="cos-filter-bar">
          <label>Type<select data-filter-type><option value="all">All</option><option value="ship">Ships</option><option value="company">Companies</option><option value="organization">Organizations</option></select></label>
          <label>Status<select data-filter-status><option value="all">All</option><option value="verified">Verified</option><option value="reviewed">Reviewed</option></select></label>
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
    inspector.innerHTML = renderInspector(state.results.find((record) => record.id === state.selectedId));
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
  return { state, searchService, navigationService, destroy() { root.innerHTML = ''; } };
}
