export function buildRelationshipExplorer(records = [], selectedId = null) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const selected = selectedId ? byId.get(selectedId) || null : records[0] || null;
  if (!selected) return { selected: null, groups: [], orphaned: [] };

  const links = [];
  for (const relationship of selected.relationships || []) {
    links.push({
      direction: 'outgoing',
      relationship: relationship.relationship || 'related_to',
      record: byId.get(relationship.target) || null,
      targetId: relationship.target,
      confidence: relationship.confidence || 'unknown',
      broken: Boolean(relationship.target && !byId.has(relationship.target))
    });
  }
  for (const record of records) {
    for (const relationship of record.relationships || []) {
      if (relationship.target !== selected.id) continue;
      links.push({
        direction: 'incoming',
        relationship: relationship.relationship || 'related_to',
        record,
        targetId: record.id,
        confidence: relationship.confidence || 'unknown',
        broken: false
      });
    }
  }

  const grouped = new Map();
  for (const link of links) {
    const key = `${link.direction}:${link.relationship}`;
    if (!grouped.has(key)) grouped.set(key, { direction: link.direction, relationship: link.relationship, links: [] });
    grouped.get(key).links.push(link);
  }

  const orphaned = records.filter((record) => {
    const outgoing = (record.relationships || []).length;
    const incoming = records.some((other) => (other.relationships || []).some((item) => item.target === record.id));
    return !outgoing && !incoming;
  });

  return {
    selected,
    groups: [...grouped.values()].sort((a, b) => `${a.direction}:${a.relationship}`.localeCompare(`${b.direction}:${b.relationship}`)),
    orphaned
  };
}

export function renderRelationshipExplorer(records = [], selectedId = null) {
  const view = buildRelationshipExplorer(records, selectedId);
  if (!view.selected) return '<dialog class="cos-authoring-dialog" data-relationship-explorer-dialog><div class="cos-authoring-form"><p class="cos-muted">No records are available.</p><footer><button type="button" data-close-dialog>Close</button></footer></div></dialog>';
  const groups = view.groups.map((group) => `<section class="cos-relationship-group"><h3>${escapeHtml(labelDirection(group.direction))}: ${escapeHtml(formatRelationship(group.relationship))}</h3><div class="cos-relationship-links">${group.links.map((link) => `<button type="button" data-explore-record="${escapeHtml(link.targetId)}" class="cos-relationship-link${link.broken ? ' is-broken' : ''}"><span><strong>${escapeHtml(link.record?.title || link.targetId || 'Unresolved record')}</strong><small>${escapeHtml(link.record?.type || 'unresolved')} · ${escapeHtml(link.confidence)}</small></span><em>${link.broken ? 'Broken target' : 'Open'}</em></button>`).join('')}</div></section>`).join('');
  const orphaned = view.orphaned.length ? `<details class="cos-relationship-orphans"><summary>${view.orphaned.length} orphaned record${view.orphaned.length === 1 ? '' : 's'}</summary>${view.orphaned.map((record) => `<button type="button" data-explore-record="${escapeHtml(record.id)}">${escapeHtml(record.title)} <small>${escapeHtml(record.type)}</small></button>`).join('')}</details>` : '';
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-relationship-explorer-dialog><div class="cos-authoring-form"><header><div><span class="cos-eyebrow">Catalog relationships</span><h2>Relationship explorer</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header><p class="cos-authoring-help">Explore incoming and outgoing links for <strong>${escapeHtml(view.selected.title)}</strong>.</p><div class="cos-relationship-explorer">${groups || '<p class="cos-muted">No relationships recorded for this item.</p>'}${orphaned}</div><footer><button type="button" data-close-dialog>Close</button></footer></div></dialog>`;
}

export function installRelationshipExplorer(root, context) {
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };
  toolbar.insertAdjacentHTML('beforeend', '<button type="button" data-open-relationship-explorer>Relationships</button>');

  function selectedId() { return context.getSelectedId?.() || context.recordService.all()[0]?.id || null; }
  function mount(id = selectedId()) {
    root.querySelector('[data-relationship-explorer-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderRelationshipExplorer(context.recordService.all(), id));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-relationship-explorer], [data-explore-relationships]')) {
      mount();
      root.querySelector('[data-relationship-explorer-dialog]')?.showModal();
      return;
    }
    const link = event.target.closest('[data-explore-record]');
    if (link) {
      const id = link.dataset.exploreRecord;
      if (!context.recordService.get(id)) return;
      context.onSelect?.(id);
      mount(id);
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  return { refresh: mount, destroy() { root.querySelector('[data-open-relationship-explorer]')?.remove(); root.querySelector('[data-relationship-explorer-dialog]')?.remove(); } };
}

function labelDirection(value) { return value === 'incoming' ? 'Incoming' : 'Outgoing'; }
function formatRelationship(value) { return String(value || 'related_to').replaceAll('_', ' '); }
function escapeHtml(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
