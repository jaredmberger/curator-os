export function installWorkerEraKnowledgeWorkspaces(root, context = {}) {
  const shell = root.querySelector('.cos-worker-shell');
  const workspace = root.querySelector('.cos-worker-workspace');
  const dashboard = root.querySelector('.cos-worker-dashboard');
  const catalogSidebar = root.querySelector('.cos-catalog-sidebar');
  const inspector = root.querySelector('.cos-catalog-inspector');
  if (!shell || !workspace || !dashboard || !catalogSidebar || !inspector) return { destroy() {} };

  const graphView = document.createElement('section');
  graphView.className = 'cos-worker-knowledge-view';
  graphView.hidden = true;
  workspace.insertBefore(graphView, catalogSidebar);

  const intelligenceView = document.createElement('section');
  intelligenceView.className = 'cos-worker-knowledge-view';
  intelligenceView.hidden = true;
  workspace.insertBefore(intelligenceView, catalogSidebar);

  let selectedGraphId = null;
  let selectedHealthId = null;

  function records() { return context.recordService?.all?.() || []; }
  function byId(id) { return records().find((record) => record.id === id) || null; }
  function relationshipsFor(id) {
    const values = records();
    const outgoing = values.flatMap((record) => (record.relationships || []).filter((rel) => record.id === id).map((rel) => ({ direction: 'outgoing', source: record.id, target: rel.target, type: rel.relationship || 'related_to', confidence: rel.confidence || 'unknown', note: rel.note || '' })));
    const incoming = values.flatMap((record) => (record.relationships || []).filter((rel) => rel.target === id).map((rel) => ({ direction: 'incoming', source: record.id, target: id, type: rel.relationship || 'related_to', confidence: rel.confidence || 'unknown', note: rel.note || '' })));
    return [...outgoing, ...incoming];
  }

  function graphStats() {
    const values = records();
    const relationshipCount = values.reduce((sum, record) => sum + (record.relationships || []).length, 0);
    const orphans = values.filter((record) => !relationshipsFor(record.id).length).length;
    const coverage = values.length ? Math.round(((values.length - orphans) / values.length) * 100) : 0;
    return { entities: values.length, relationships: relationshipCount, orphans, coverage };
  }

  function renderGraph() {
    const values = records();
    const stats = graphStats();
    if (!selectedGraphId && values.length) selectedGraphId = values[0].id;
    const selected = byId(selectedGraphId);
    const rels = selected ? relationshipsFor(selected.id) : [];
    graphView.innerHTML = `<div class="cos-worker-graph-stats">
      ${stat(stats.entities, 'Graph entities')}${stat(stats.relationships, 'Relationships')}${stat(stats.orphans, 'Orphaned entities')}${stat(`${stats.coverage}%`, 'Relationship coverage')}
    </div>
    <div class="cos-worker-graph-layout">
      <article class="cos-worker-panel"><div class="cos-worker-list-toolbar"><input type="search" placeholder="Search the entity registry" data-worker-graph-search><select data-worker-graph-type><option value="all">All entity types</option>${[...new Set(values.map((record) => record.type))].sort().map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}</select></div><div data-worker-graph-list class="cos-worker-entity-list">${renderEntityList(values)}</div></article>
      <article class="cos-worker-panel cos-worker-detail-panel">${selected ? `<span class="cos-eyebrow">${escapeHtml(selected.type)}</span><h2>${escapeHtml(selected.title)}</h2><p>${escapeHtml(selected.summary || 'No summary recorded.')}</p><div class="cos-worker-relationship-list">${rels.length ? rels.map((rel) => `<div class="cos-worker-relationship"><strong>${escapeHtml(rel.type)}</strong><span>${escapeHtml(rel.direction === 'outgoing' ? rel.target : rel.source)}</span><small>${escapeHtml(rel.confidence)}${rel.note ? ` · ${escapeHtml(rel.note)}` : ''}</small></div>`).join('') : '<p class="cos-muted">No relationships recorded.</p>'}</div>` : '<div class="cos-empty-state"><strong>No graph entity selected</strong></div>'}</article>
    </div>`;
  }

  function renderEntityList(values) {
    return values.map((record) => `<button type="button" class="cos-worker-entity${record.id === selectedGraphId ? ' active' : ''}" data-worker-graph-id="${escapeHtml(record.id)}"><span class="cos-eyebrow">${escapeHtml(record.type)}</span><strong>${escapeHtml(record.title)}</strong><small>${relationshipsFor(record.id).length} relationships</small></button>`).join('') || '<div class="cos-empty-state"><strong>No records available</strong></div>';
  }

  function recordHealth(record) {
    const checks = [
      ['Direct source', Boolean(record.sources?.length)],
      ['Relationship', Boolean(record.relationships?.length)],
      ['Known confidence', Boolean(record.metadata?.confidence && record.metadata.confidence !== 'unknown')],
      ['Reviewed', Boolean(record.metadata?.reviewed)],
      ['Publication status', record.status === 'published']
    ];
    const score = Math.round((checks.filter(([, present]) => present).length / checks.length) * 100);
    return { score, checks };
  }

  function renderIntelligence() {
    const values = records().map((record) => ({ record, health: recordHealth(record) })).sort((a, b) => a.health.score - b.health.score || a.record.title.localeCompare(b.record.title));
    if (!selectedHealthId && values.length) selectedHealthId = values[0].record.id;
    const selected = values.find((item) => item.record.id === selectedHealthId) || null;
    const overall = values.length ? Math.round(values.reduce((sum, item) => sum + item.health.score, 0) / values.length) : 0;
    intelligenceView.innerHTML = `<article class="cos-worker-panel cos-worker-health-hero"><div><span class="cos-eyebrow">Knowledge Genome</span><h2>Archive Health</h2><p>Explainable coverage based on provenance, relationships, confidence, review state, and publication readiness.</p></div><div class="cos-worker-health-ring"><strong>${overall}</strong><span>overall</span></div></article>
    <div class="cos-worker-intelligence-grid">
      <article class="cos-worker-panel"><span class="cos-eyebrow">Ranked work</span><h2>Editorial Priorities</h2><div class="cos-worker-priority-list">${values.slice(0, 12).map((item, index) => `<button type="button" data-worker-health-id="${escapeHtml(item.record.id)}"><span>${index + 1}</span><div><strong>${escapeHtml(item.record.title)}</strong><small>${escapeHtml(item.record.type)} · ${item.health.score}% complete</small></div></button>`).join('') || '<p class="cos-muted">No records available.</p>'}</div></article>
      <article class="cos-worker-panel"><span class="cos-eyebrow">Weakest coverage</span><h2>Knowledge Opportunities</h2>${selected ? `<div class="cos-worker-health-explain"><h3>${escapeHtml(selected.record.title)}</h3><strong>${selected.health.score}%</strong>${selected.health.checks.map(([label, present]) => `<div class="cos-worker-health-check ${present ? 'present' : 'missing'}"><b>${escapeHtml(label)}</b><span>${present ? 'Present' : 'Missing'}</span></div>`).join('')}</div>` : '<p class="cos-muted">Choose a record.</p>'}</article>
    </div>`;
  }

  function filterGraphList() {
    const query = graphView.querySelector('[data-worker-graph-search]')?.value.toLowerCase().trim() || '';
    const type = graphView.querySelector('[data-worker-graph-type]')?.value || 'all';
    const filtered = records().filter((record) => (!query || `${record.id} ${record.title} ${record.summary || ''}`.toLowerCase().includes(query)) && (type === 'all' || record.type === type));
    const list = graphView.querySelector('[data-worker-graph-list]');
    if (list) list.innerHTML = renderEntityList(filtered);
  }

  root.addEventListener('click', (event) => {
    const graphEntity = event.target.closest('[data-worker-graph-id]');
    if (graphEntity) { selectedGraphId = graphEntity.dataset.workerGraphId; renderGraph(); }
    const healthEntity = event.target.closest('[data-worker-health-id]');
    if (healthEntity) { selectedHealthId = healthEntity.dataset.workerHealthId; renderIntelligence(); }
  });
  root.addEventListener('input', (event) => { if (event.target.matches('[data-worker-graph-search]')) filterGraphList(); });
  root.addEventListener('change', (event) => { if (event.target.matches('[data-worker-graph-type]')) filterGraphList(); });

  const onView = (event) => {
    const view = event.detail?.view;
    graphView.hidden = view !== 'graph';
    intelligenceView.hidden = view !== 'intelligence';
    if (view === 'graph') renderGraph();
    if (view === 'intelligence') renderIntelligence();
  };
  root.addEventListener('curatoros:worker-view', onView);
  const unsubscribe = context.recordService?.subscribe?.(() => { renderGraph(); renderIntelligence(); }) || (() => {});
  return { renderGraph, renderIntelligence, destroy() { unsubscribe(); root.removeEventListener('curatoros:worker-view', onView); graphView.remove(); intelligenceView.remove(); } };
}

function stat(value, label) { return `<div class="cos-worker-graph-stat"><strong>${Number.isFinite(value) ? Number(value).toLocaleString() : value}</strong><span>${label}</span></div>`; }
function escapeHtml(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
