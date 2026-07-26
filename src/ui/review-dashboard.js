import { assessPublicationReadiness } from './publication-preview.js';

const SEVERITY_ORDER = Object.freeze({ blocker: 0, warning: 1, info: 2 });

export function analyzeReviewQueue(records = []) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const titleGroups = duplicateTitleGroups(records);

  return records.map((record) => {
    const issues = [];
    const readiness = assessPublicationReadiness(record);

    readiness.blockers.forEach((label) => issues.push(issue(`publication-${slug(label)}`, label, 'blocker', 'publication')));
    readiness.warnings.forEach((label) => issues.push(issue(`publication-${slug(label)}`, label, 'warning', 'publication')));

    if ((record.relationships || []).some((item) => item.target && !byId.has(item.target))) {
      issues.push(issue('broken-relationship', 'Broken relationship', 'blocker', 'relationship'));
    }

    if (record.type === 'ship' && !hasRelationshipOrData(record, 'built_by', 'builder')) {
      issues.push(issue('missing-builder', 'Missing ship builder', 'blocker', 'relationship'));
    }

    if (record.type === 'ship' && !hasRelationshipOrData(record, 'operated_by', 'operator')) {
      issues.push(issue('missing-operator', 'Missing ship operator', 'blocker', 'relationship'));
    }

    if (['source', 'object', 'photo', 'media'].includes(record.type) && isOrphaned(record, records)) {
      issues.push(issue('orphaned-record', 'Orphaned record', 'warning', 'relationship'));
    }

    if (titleGroups.get(normalize(record.title))?.length > 1) {
      issues.push(issue('duplicate-title', 'Duplicate-looking title', 'warning', 'duplicate'));
    }

    const uniqueIssues = [...new Map(issues.map((item) => [item.id, item])).values()]
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.label.localeCompare(b.label));

    return { record, issues: uniqueIssues };
  }).filter((item) => item.issues.length);
}

export function renderReviewDashboard(records = []) {
  const queue = analyzeReviewQueue(records);
  const counts = summarize(queue);
  const severitySummary = ['blocker', 'warning', 'info'].map((severity) => `<button type="button" data-review-severity="${severity}"><strong>${counts.severity.get(severity) || 0}</strong><span>${titleCase(severity)}s</span></button>`).join('');
  const categorySummary = [...counts.category.entries()].map(([category, count]) => `<button type="button" data-review-category="${escapeHtml(category)}"><strong>${count}</strong><span>${escapeHtml(titleCase(category))}</span></button>`).join('');
  const typeOptions = [...new Set(records.map((record) => record.type))].sort().map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');
  const rows = queue.map(({ record, issues }) => {
    const severities = [...new Set(issues.map((item) => item.severity))].join(' ');
    const categories = [...new Set(issues.map((item) => item.category))].join(' ');
    return `<button type="button" class="cos-review-row" data-review-record="${escapeHtml(record.id)}" data-review-type="${escapeHtml(record.type)}" data-review-severity="${escapeHtml(severities)}" data-review-category="${escapeHtml(categories)}"><span><strong>${escapeHtml(record.title || record.id)}</strong><small>${escapeHtml(record.id)} · ${escapeHtml(record.type)} · ${escapeHtml(record.status)}</small></span><span>${issues.map((item) => `<em data-severity="${item.severity}">${escapeHtml(item.label)}</em>`).join('')}</span></button>`;
  }).join('');

  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-review-dashboard-dialog><div class="cos-authoring-form cos-review-dashboard"><header><div><span class="cos-eyebrow">Publication health</span><h2>Review dashboard</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header><p class="cos-authoring-help">Find publication blockers, warnings, duplicates, orphaned records, and broken links.</p><div class="cos-review-controls"><label>Record type<select data-review-type-filter><option value="all">All types</option>${typeOptions}</select></label><button type="button" data-review-reset>Clear filters</button></div><div class="cos-review-summary"><button type="button" data-review-reset><strong>${queue.length}</strong><span>All flagged records</span></button>${severitySummary}${categorySummary}</div><div class="cos-review-list" data-review-list>${rows || '<p class="cos-muted">No review issues found.</p>'}</div><footer><button type="button" data-close-dialog>Close</button></footer></div></dialog>`;
}

export function installReviewDashboard(root, context) {
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };
  toolbar.insertAdjacentHTML('beforeend', '<button type="button" data-open-review-dashboard>Review</button>');

  function mount() {
    root.querySelector('[data-review-dashboard-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderReviewDashboard(context.recordService.all()));
  }

  function applyFilters(dialog) {
    const type = dialog.querySelector('[data-review-type-filter]')?.value || 'all';
    const severity = dialog.dataset.reviewSeverity || 'all';
    const category = dialog.dataset.reviewCategory || 'all';
    dialog.querySelectorAll('[data-review-record]').forEach((row) => {
      const typeMatch = type === 'all' || row.dataset.reviewType === type;
      const severityMatch = severity === 'all' || row.dataset.reviewSeverity.split(' ').includes(severity);
      const categoryMatch = category === 'all' || row.dataset.reviewCategory.split(' ').includes(category);
      row.hidden = !(typeMatch && severityMatch && categoryMatch);
    });
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-review-dashboard]')) {
      mount();
      root.querySelector('[data-review-dashboard-dialog]')?.showModal();
      return;
    }
    const dialog = event.target.closest('[data-review-dashboard-dialog]');
    if (!dialog) return;
    const severity = event.target.closest('[data-review-severity]');
    const category = event.target.closest('[data-review-category]');
    if (severity) dialog.dataset.reviewSeverity = severity.dataset.reviewSeverity;
    if (category) dialog.dataset.reviewCategory = category.dataset.reviewCategory;
    if (event.target.closest('[data-review-reset]')) {
      dialog.dataset.reviewSeverity = 'all';
      dialog.dataset.reviewCategory = 'all';
      const select = dialog.querySelector('[data-review-type-filter]');
      if (select) select.value = 'all';
    }
    if (severity || category || event.target.closest('[data-review-reset]')) {
      applyFilters(dialog);
      return;
    }
    const row = event.target.closest('[data-review-record]');
    if (row) {
      context.onSelect?.(row.dataset.reviewRecord);
      dialog.close();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) dialog.close();
  });

  root.addEventListener('change', (event) => {
    const dialog = event.target.closest('[data-review-dashboard-dialog]');
    if (dialog && event.target.matches('[data-review-type-filter]')) applyFilters(dialog);
  });

  return { refresh: mount, destroy() { root.querySelector('[data-open-review-dashboard]')?.remove(); root.querySelector('[data-review-dashboard-dialog]')?.remove(); } };
}

function issue(id, label, severity, category) { return { id, label, severity, category }; }
function hasRelationshipOrData(record, relationship, dataKey) { return (record.relationships || []).some((item) => item.relationship === relationship && item.target) || text(record.data?.[dataKey]); }
function isOrphaned(record, records) { return !(record.relationships || []).length && !records.some((item) => (item.relationships || []).some((relationship) => relationship.target === record.id)); }
function duplicateTitleGroups(records) { const groups = new Map(); records.forEach((record) => { const key = normalize(record.title); if (!key) return; groups.set(key, [...(groups.get(key) || []), record]); }); return groups; }
function summarize(queue) { const severity = new Map(); const category = new Map(); queue.forEach(({ issues }) => issues.forEach((item) => { severity.set(item.severity, (severity.get(item.severity) || 0) + 1); category.set(item.category, (category.get(item.category) || 0) + 1); })); return { severity, category }; }
function slug(value) { return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function normalize(value) { return text(value).toLowerCase().replace(/\s+/g, ' '); }
function titleCase(value) { return String(value).replace(/(^|[-_\s])\w/g, (match) => match.toUpperCase()).replace(/[-_]/g, ' '); }
function text(value) { return String(value || '').trim(); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
