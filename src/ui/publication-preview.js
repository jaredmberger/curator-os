const CORE_TYPES = new Set(['ship', 'company', 'organization']);

export function assessPublicationReadiness(record = {}) {
  const blockers = [];
  const warnings = [];
  const data = record.data || {};
  const relationships = record.relationships || [];
  const hasSources = (record.sources || []).length || relationships.some((item) => (item.sourceIds || []).length);

  if (!text(record.title)) blockers.push('Missing title');
  if (!text(record.summary)) blockers.push('Missing summary');
  if ((record.metadata?.confidence || 'unknown') === 'unknown') blockers.push('Confidence is unknown');
  if (!hasSources) warnings.push('No linked sources');
  if (!record.metadata?.reviewed) warnings.push('Record has not been reviewed');

  if (record.type === 'ship') {
    if (!relationships.some((item) => item.relationship === 'built_by') && !text(data.builder)) blockers.push('Missing builder');
    if (!relationships.some((item) => item.relationship === 'operated_by') && !text(data.operator)) blockers.push('Missing operator');
    if (!text(data.launchDate)) warnings.push('Missing launch date');
    if (!text(data.maidenVoyage)) warnings.push('Missing maiden voyage');
    if (!text(data.grossTonnage)) warnings.push('Missing gross tonnage');
  }

  if (isBuilder(record)) {
    if (!text(data.country)) warnings.push('Missing country');
    if (!text(data.founded)) warnings.push('Missing founded date');
    if (!text(data.yard)) warnings.push('Missing primary yard');
  }

  if (isShippingLine(record)) {
    if (!text(data.country)) warnings.push('Missing country');
    if (!text(data.founded)) warnings.push('Missing founded date');
    if (!text(data.routeFocus)) warnings.push('Missing route focus');
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ready'
  };
}

export function buildPublicationPreview(record = {}, records = []) {
  const byId = new Map(records.map((item) => [item.id, item]));
  const readiness = assessPublicationReadiness(record);
  const details = publicationDetails(record, byId);
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    summary: record.summary,
    status: record.status,
    confidence: record.metadata?.confidence || 'unknown',
    details,
    sources: resolvedSources(record, byId),
    readiness
  };
}

export function renderPublicationPreview(record, records = []) {
  const preview = buildPublicationPreview(record, records);
  const checklist = [
    ...preview.readiness.blockers.map((item) => `<li data-severity="blocker"><strong>Blocker</strong><span>${escapeHtml(item)}</span></li>`),
    ...preview.readiness.warnings.map((item) => `<li data-severity="warning"><strong>Warning</strong><span>${escapeHtml(item)}</span></li>`)
  ].join('') || '<li data-severity="ready"><strong>Ready</strong><span>No publication issues found.</span></li>';
  const details = preview.details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  const sources = preview.sources.map((source) => `<li><strong>${escapeHtml(source.title || source.id)}</strong><span>${escapeHtml(source.id)}</span></li>`).join('') || '<li>No linked sources.</li>';

  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-publication-preview-dialog>
    <div class="cos-authoring-form cos-publication-preview">
      <header><div><span class="cos-eyebrow">Publication workspace</span><h2>Publication preview</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">Preview the canonical record without publishing or changing its data.</p>
      <section><span class="cos-eyebrow">${escapeHtml(preview.type)}</span><h3>${escapeHtml(preview.title || preview.id)}</h3><p>${escapeHtml(preview.summary || 'No summary recorded.')}</p></section>
      <section><h3>Readiness</h3><p data-publication-status="${preview.readiness.status}">${preview.readiness.ready ? 'No blockers' : `${preview.readiness.blockers.length} blocker${preview.readiness.blockers.length === 1 ? '' : 's'}`}</p><ul class="cos-publication-checklist">${checklist}</ul></section>
      <section><h3>Canonical details</h3><dl>${details || '<div><dt>Details</dt><dd>No type-specific details recorded.</dd></div>'}</dl></section>
      <section><h3>Sources</h3><ul>${sources}</ul></section>
      <footer><button type="button" data-close-dialog>Close</button></footer>
    </div>
  </dialog>`;
}

export function installPublicationPreview(root, context) {
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };
  toolbar.insertAdjacentHTML('beforeend', '<button type="button" data-open-publication-preview>Preview</button>');

  function selectedRecord() {
    const id = context.getSelectedId?.();
    const record = id ? context.recordService.get(id) : null;
    return record && CORE_TYPES.has(record.type) ? record : null;
  }

  function mount(record) {
    root.querySelector('[data-publication-preview-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderPublicationPreview(record, context.recordService.all()));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-publication-preview], [data-preview-publication]')) {
      const record = selectedRecord();
      if (!record) return;
      mount(record);
      root.querySelector('[data-publication-preview-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  return { destroy() { root.querySelector('[data-open-publication-preview]')?.remove(); root.querySelector('[data-publication-preview-dialog]')?.remove(); } };
}

function publicationDetails(record, byId) {
  const data = record.data || {};
  if (record.type === 'ship') return pairs([
    ['Builder', titleFor(data.builder || relationshipTarget(record, 'built_by'), byId)],
    ['Operator', titleFor(data.operator || relationshipTarget(record, 'operated_by'), byId)],
    ['Yard number', data.yardNumber], ['Launch date', data.launchDate], ['Maiden voyage', data.maidenVoyage],
    ['Gross tonnage', data.grossTonnage], ['Length', data.length], ['Beam', data.beam], ['Service speed', data.speed], ['Fate', data.fate]
  ]);
  if (isBuilder(record)) return pairs([['City', data.city], ['Country', data.country], ['Founded', data.founded], ['Closed', data.closed], ['Primary yard', data.yard], ['Parent company', data.parentCompany]]);
  if (isShippingLine(record)) return pairs([['Country', data.country], ['Headquarters', data.headquarters], ['Founded', data.founded], ['Ceased', data.ceased], ['Parent company', data.parentCompany], ['Successor', data.successor], ['Route focus', data.routeFocus], ['House flag', data.houseFlag]]);
  return pairs(Object.entries(data));
}

function resolvedSources(record, byId) {
  const ids = new Set((record.sources || []).map((source) => source.id).filter(Boolean));
  (record.relationships || []).forEach((item) => (item.sourceIds || []).forEach((id) => ids.add(id)));
  return [...ids].map((id) => byId.get(id) || { id, title: id });
}

function relationshipTarget(record, kind) { return (record.relationships || []).find((item) => item.relationship === kind)?.target || ''; }
function titleFor(id, byId) { return byId.get(id)?.title || id || ''; }
function isBuilder(record) { return ['company', 'organization'].includes(record.type) && (record.tags || []).some((tag) => tag.toLowerCase() === 'shipbuilder'); }
function isShippingLine(record) { return ['company', 'organization'].includes(record.type) && (record.tags || []).some((tag) => tag.toLowerCase() === 'shipping line'); }
function pairs(values) { return values.filter(([, value]) => text(value)).map(([label, value]) => [label, String(value)]); }
function text(value) { return String(value || '').trim(); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
