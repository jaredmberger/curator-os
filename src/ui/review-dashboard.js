const DEFAULT_CHECKS = Object.freeze([
  { id: 'missing-summary', label: 'Missing summary', test: (record) => !text(record.summary) },
  { id: 'unknown-confidence', label: 'Unknown confidence', test: (record) => (record.metadata?.confidence || 'unknown') === 'unknown' },
  { id: 'unreviewed', label: 'Not reviewed', test: (record) => !record.metadata?.reviewed },
  { id: 'no-sources', label: 'No sources', test: (record) => !(record.sources || []).length && !(record.relationships || []).some((item) => (item.sourceIds || []).length) },
  { id: 'broken-relationship', label: 'Broken relationship', test: (record, byId) => (record.relationships || []).some((item) => item.target && !byId.has(item.target)) }
]);

export function analyzeReviewQueue(records = [], checks = DEFAULT_CHECKS) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return records.map((record) => {
    const issues = checks.filter((check) => check.test(record, byId)).map((check) => ({ id: check.id, label: check.label }));
    return { record, issues };
  }).filter((item) => item.issues.length);
}

export function renderReviewDashboard(records = []) {
  const queue = analyzeReviewQueue(records);
  const counts = new Map();
  queue.forEach((item) => item.issues.forEach((issue) => counts.set(issue.id, { label: issue.label, count: (counts.get(issue.id)?.count || 0) + 1 })));
  const summary = [...counts.entries()].map(([id, value]) => `<button type="button" data-review-filter="${escapeHtml(id)}"><strong>${value.count}</strong><span>${escapeHtml(value.label)}</span></button>`).join('');
  const rows = queue.map(({ record, issues }) => `<button type="button" class="cos-review-row" data-review-record="${escapeHtml(record.id)}" data-review-issues="${escapeHtml(issues.map((issue) => issue.id).join(' '))}"><span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.id)} · ${escapeHtml(record.type)} · ${escapeHtml(record.status)}</small></span><span>${issues.map((issue) => `<em>${escapeHtml(issue.label)}</em>`).join('')}</span></button>`).join('');
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-review-dashboard-dialog><div class="cos-authoring-form cos-review-dashboard"><header><div><span class="cos-eyebrow">Collection health</span><h2>Review dashboard</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header><p class="cos-authoring-help">Find records that need curatorial attention before publication.</p><div class="cos-review-summary"><button type="button" data-review-filter="all"><strong>${queue.length}</strong><span>All flagged records</span></button>${summary}</div><div class="cos-review-list" data-review-list>${rows || '<p class="cos-muted">No review issues found.</p>'}</div><footer><button type="button" data-close-dialog>Close</button></footer></div></dialog>`;
}

export function installReviewDashboard(root, context) {
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };
  toolbar.insertAdjacentHTML('beforeend', '<button type="button" data-open-review-dashboard>Review</button>');

  function mount() {
    root.querySelector('[data-review-dashboard-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderReviewDashboard(context.recordService.all()));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-review-dashboard]')) {
      mount();
      root.querySelector('[data-review-dashboard-dialog]')?.showModal();
      return;
    }
    const filter = event.target.closest('[data-review-filter]');
    if (filter) {
      const selected = filter.dataset.reviewFilter;
      root.querySelectorAll('[data-review-record]').forEach((row) => {
        row.hidden = selected !== 'all' && !row.dataset.reviewIssues.split(' ').includes(selected);
      });
      return;
    }
    const row = event.target.closest('[data-review-record]');
    if (row) {
      context.onSelect?.(row.dataset.reviewRecord);
      row.closest('dialog')?.close();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  return { refresh: mount, destroy() { root.querySelector('[data-open-review-dashboard]')?.remove(); root.querySelector('[data-review-dashboard-dialog]')?.remove(); } };
}

function text(value) { return String(value || '').trim(); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
