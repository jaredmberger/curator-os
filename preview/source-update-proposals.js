const CHANGE_KEY = 'curatoros.project.pendingChanges';
const IMPORT_KEY = 'curatoros.project.lastImport';

let observer;
start();

function start() {
  observer = new MutationObserver(() => {
    enhancePendingPanel();
    enhanceChangeReview();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('curatoros:records-changed', () => window.setTimeout(enhancePendingPanel, 0));
  enhancePendingPanel();
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function readChanges() {
  const changes = readJson(CHANGE_KEY, []);
  return Array.isArray(changes) ? changes : [];
}

function enhancePendingPanel() {
  const actions = document.querySelector('.pending-change-actions');
  if (!actions || actions.querySelector('[data-source-proposal]')) return;
  const changes = readChanges();
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.sourceProposal = '';
  button.textContent = 'Review source updates';
  button.disabled = !changes.length;
  button.addEventListener('click', openSourceProposal);
  actions.insertBefore(button, actions.firstChild);
}

function enhanceChangeReview() {
  const footer = document.querySelector('#project-change-review .record-editor-actions');
  if (!footer || footer.querySelector('[data-source-proposal]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.sourceProposal = '';
  button.textContent = 'Review source updates';
  button.addEventListener('click', () => {
    closeDialog('#project-change-review');
    openSourceProposal();
  });
  footer.insertBefore(button, footer.lastElementChild);
}

function openSourceProposal() {
  const changes = readChanges();
  if (!changes.length) return;
  closeDialog('#source-update-proposal');

  const proposal = buildProposal(changes);
  const dialog = document.createElement('dialog');
  dialog.id = 'source-update-proposal';
  dialog.innerHTML = `
    <section class="source-proposal-card">
      <header class="source-proposal-header">
        <div>
          <span class="eyebrow">Proposed source-file updates</span>
          <h3>${proposal.changeCount} record change${proposal.changeCount === 1 ? '' : 's'} across ${proposal.files.length} source group${proposal.files.length === 1 ? '' : 's'}</h3>
          <p>Review what CuratorOS would ask a source-file publisher to change. No website or GitHub file is modified here.</p>
        </div>
        <button type="button" data-close-source-proposal aria-label="Close">×</button>
      </header>

      <section class="source-proposal-summary">
        <div><strong>${proposal.files.length}</strong><span>Source groups</span></div>
        <div><strong>${proposal.operations.length}</strong><span>Field operations</span></div>
        <div><strong>${proposal.unresolved.length}</strong><span>Unresolved origins</span></div>
      </section>

      ${proposal.files.map(renderSourceGroup).join('')}
      ${proposal.unresolved.length ? renderUnresolved(proposal.unresolved) : ''}

      <footer class="source-proposal-actions">
        <button type="button" data-copy-proposal>Copy proposal JSON</button>
        <button type="button" data-download-proposal>Download proposal</button>
        <button type="button" data-close-source-proposal>Close</button>
      </footer>
    </section>`;

  document.body.append(dialog);
  dialog.querySelectorAll('[data-close-source-proposal]').forEach((button) => button.addEventListener('click', () => closeDialog('#source-update-proposal')));
  dialog.querySelector('[data-copy-proposal]')?.addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(proposal, null, 2));
      event.currentTarget.textContent = 'Copied';
    } catch {
      alert('The proposal could not be copied on this device.');
    }
  });
  dialog.querySelector('[data-download-proposal]')?.addEventListener('click', () => downloadProposal(proposal));
  dialog.addEventListener('cancel', () => closeDialog('#source-update-proposal'));
  dialog.showModal();
}

function buildProposal(changes) {
  const sourceImport = readJson(IMPORT_KEY, null);
  const groups = new Map();
  const unresolved = [];
  const operations = [];

  for (const change of changes) {
    const filename = change.origin?.filename || sourceImport?.filename || '';
    const sourceIndex = Number.isInteger(change.origin?.sourceIndex) ? change.origin.sourceIndex : null;
    const sourceType = change.origin?.sourceType || sourceImport?.format || 'unknown';
    const recordProposal = {
      recordId: change.recordId,
      title: change.title,
      sourceIndex,
      sourceType,
      changedAt: change.changedAt,
      changedFields: change.fields || [],
      operations: buildFieldOperations(change.before || {}, change.after || {}),
      before: change.before,
      after: change.after
    };
    operations.push(...recordProposal.operations.map((operation) => ({ ...operation, recordId: change.recordId, filename: filename || null })));

    if (!filename) {
      unresolved.push({ ...recordProposal, reason: 'No source filename is attached to this record.' });
      continue;
    }
    if (!groups.has(filename)) groups.set(filename, { filename, sourceType, records: [] });
    groups.get(filename).records.push(recordProposal);
  }

  const files = [...groups.values()].map((group) => ({
    ...group,
    recordCount: group.records.length,
    strategy: chooseStrategy(group.sourceType),
    safety: group.records.every((record) => record.sourceIndex !== null)
      ? 'Records have source indexes, but the original file must still be reloaded before applying updates.'
      : 'One or more records lack a source index; match records by stable ID before applying.'
  }));

  return {
    format: 'curatoros-source-update-proposal',
    formatVersion: 1,
    project: 'Ocean Liner Curator',
    createdAt: new Date().toISOString(),
    sourceImport,
    changeCount: changes.length,
    files,
    unresolved,
    operations,
    instructions: [
      'Reload the current source file before applying this proposal.',
      'Match each proposed update by stable record ID; use sourceIndex only as a secondary hint.',
      'Preview and validate the regenerated file before replacing any website data.',
      'Publish through a GitHub branch and pull request rather than writing directly to main.'
    ]
  };
}

function buildFieldOperations(before, after) {
  const fields = ['title','type','status','summary','tags','data','sources','relationships','notes'];
  const operations = [];
  for (const field of fields) {
    const oldValue = before[field] ?? null;
    const newValue = after[field] ?? null;
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    operations.push({
      op: oldValue === null ? 'add' : newValue === null ? 'remove' : 'replace',
      path: `/${field}`,
      before: oldValue,
      after: newValue,
      summary: summarizeDifference(field, oldValue, newValue)
    });
  }
  return operations;
}

function summarizeDifference(field, before, after) {
  if (Array.isArray(before) || Array.isArray(after)) {
    return `${label(field)}: ${Array.isArray(before) ? before.length : 0} item(s) → ${Array.isArray(after) ? after.length : 0} item(s)`;
  }
  if (isObject(before) || isObject(after)) {
    const beforeKeys = isObject(before) ? Object.keys(before) : [];
    const afterKeys = isObject(after) ? Object.keys(after) : [];
    const changed = unique([...beforeKeys, ...afterKeys]).filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
    return `${label(field)}: ${changed.length} nested field${changed.length === 1 ? '' : 's'} changed${changed.length ? ` (${changed.join(', ')})` : ''}`;
  }
  return `${label(field)}: “${displayScalar(before)}” → “${displayScalar(after)}”`;
}

function renderSourceGroup(group) {
  return `
    <details class="source-proposal-file" open>
      <summary>
        <span><strong>${escapeHtml(group.filename)}</strong><small>${escapeHtml(group.sourceType)} · ${group.recordCount} changed record${group.recordCount === 1 ? '' : 's'}</small></span>
        <span>${escapeHtml(group.strategy)}</span>
      </summary>
      <p class="source-proposal-safety">${escapeHtml(group.safety)}</p>
      <div class="source-proposal-records">
        ${group.records.map(renderRecordDiff).join('')}
      </div>
    </details>`;
}

function renderRecordDiff(record) {
  return `
    <article class="source-record-diff">
      <header>
        <div><strong>${escapeHtml(record.title || record.recordId)}</strong><p>${escapeHtml(record.recordId)}</p></div>
        <span>${record.sourceIndex === null ? 'ID match required' : `Source index ${record.sourceIndex}`}</span>
      </header>
      <div class="source-field-diffs">
        ${record.operations.map((operation) => `
          <details>
            <summary><span class="source-op source-op-${escapeHtml(operation.op)}">${escapeHtml(operation.op)}</span>${escapeHtml(operation.summary)}</summary>
            <div class="source-before-after">
              <section><h5>Before</h5><pre>${escapeHtml(formatValue(operation.before))}</pre></section>
              <section><h5>After</h5><pre>${escapeHtml(formatValue(operation.after))}</pre></section>
            </div>
          </details>`).join('') || '<p>No supported field differences were found.</p>'}
      </div>
    </article>`;
}

function renderUnresolved(records) {
  return `
    <details class="source-proposal-file source-proposal-unresolved" open>
      <summary><span><strong>Unresolved source origins</strong><small>${records.length} record${records.length === 1 ? '' : 's'}</small></span></summary>
      <p>These changes can still be exported, but CuratorOS cannot yet assign them to a specific website file.</p>
      <ul>${records.map((record) => `<li><strong>${escapeHtml(record.title || record.recordId)}</strong> — ${escapeHtml(record.reason)}</li>`).join('')}</ul>
    </details>`;
}

function chooseStrategy(sourceType) {
  if (sourceType === 'site-index') return 'Update matching indexed entry';
  if (sourceType === 'olc-manifest') return 'Update matching manifest collection';
  if (sourceType === 'curatoros' || sourceType === 'array') return 'Replace matching normalized record';
  return 'Resolve adapter before applying';
}

function downloadProposal(proposal) {
  const blob = new Blob([JSON.stringify(proposal, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `curatoros-source-update-proposal-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatValue(value) {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
function displayScalar(value) { return value == null ? 'empty' : String(value); }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function unique(values) { return [...new Set(values)]; }
function label(value) { return String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function closeDialog(selector) { const dialog = document.querySelector(selector); if (!dialog) return; try { dialog.close(); } catch {} dialog.remove(); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[character])); }
