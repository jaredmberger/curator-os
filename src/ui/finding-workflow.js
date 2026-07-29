const WORKFLOW_KEY = 'curatoros.findings.workflow.v1';
const HANDLED_KEY = 'curatoros.findings.handled';

export function installFindingWorkflow(root) {
  if (!root) return { refresh() {}, destroy() {}, exportSnapshot: () => ({ version: 1, findings: {} }) };

  installStyles();

  const refresh = () => {
    enhanceToolbar(root);
    root.querySelectorAll('.cos-worker-finding').forEach((card) => enhanceFinding(card));
  };

  const observer = new MutationObserver(refresh);
  observer.observe(root, { childList: true, subtree: true });
  refresh();

  return {
    refresh,
    destroy() { observer.disconnect(); },
    exportSnapshot,
  };
}

function enhanceToolbar(root) {
  const actions = root.querySelector('.cos-worker-findings-hero .cos-worker-actions');
  if (!actions || actions.querySelector('[data-finding-workflow-export]')) return;

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.dataset.findingWorkflowExport = '';
  exportButton.textContent = 'Export finding workflow';
  exportButton.addEventListener('click', () => {
    const payload = exportSnapshot();
    downloadJson(payload, `curatoros-finding-workflow-${new Date().toISOString().slice(0, 10)}.json`);
  });

  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.dataset.findingWorkflowImport = '';
  importButton.textContent = 'Import finding workflow';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.hidden = true;
  input.dataset.findingWorkflowFile = '';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      importSnapshot(value);
      alert('Finding workflow restored. CuratorOS will now refresh the visible findings.');
      location.reload();
    } catch (error) {
      alert(`Could not restore finding workflow: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      input.value = '';
    }
  });

  importButton.addEventListener('click', () => input.click());
  actions.append(exportButton, importButton, input);
}

function enhanceFinding(card) {
  if (card.dataset.findingWorkflowEnhanced === 'true') return;
  const legacyButton = card.querySelector('[data-finding-action][data-finding-id]');
  const id = legacyButton?.dataset.findingId;
  if (!id) return;

  card.dataset.findingWorkflowEnhanced = 'true';
  const saved = readWorkflow()[id] || {};
  const legacyHandled = legacyButton.dataset.findingAction === 'reopen';
  const inferredState = card.textContent.includes('· regression') ? 'regressed' : legacyHandled ? 'handled' : 'open';
  const state = saved.state || inferredState;

  const panel = document.createElement('section');
  panel.className = 'cos-finding-workflow';
  panel.innerHTML = `
    <div class="cos-finding-workflow__heading">
      <div>
        <strong>Curator decision</strong>
        <small data-finding-workflow-updated>${saved.updatedAt ? `Updated ${escapeHtml(formatDateTime(saved.updatedAt))}` : 'Not yet reviewed'}</small>
      </div>
      <label>
        <span>Status</span>
        <select data-finding-workflow-state>
          <option value="open">Open</option>
          <option value="handled">Handled</option>
          <option value="verified">Verified</option>
          <option value="regressed">Regressed</option>
        </select>
      </label>
    </div>
    <label class="cos-finding-workflow__note">
      <span>Curator note</span>
      <textarea rows="3" data-finding-workflow-note placeholder="Record what was checked, changed, deferred, or verified.">${escapeHtml(saved.note || '')}</textarea>
    </label>
    <div class="cos-finding-workflow__actions">
      <button type="button" data-finding-workflow-save>Save decision</button>
      <button type="button" data-finding-workflow-clear>Clear note</button>
    </div>
  `;

  const select = panel.querySelector('[data-finding-workflow-state]');
  const note = panel.querySelector('[data-finding-workflow-note]');
  select.value = state;

  panel.querySelector('[data-finding-workflow-save]').addEventListener('click', () => {
    saveDecision(id, select.value, note.value, card, legacyButton);
  });

  panel.querySelector('[data-finding-workflow-clear]').addEventListener('click', () => {
    note.value = '';
    saveDecision(id, select.value, '', card, legacyButton);
  });

  card.append(panel);
  applyStateClass(card, state);
}

function saveDecision(id, state, note, card, legacyButton) {
  const workflow = readWorkflow();
  workflow[id] = {
    state,
    note: String(note || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  writeWorkflow(workflow);
  syncLegacyHandled(id, state);
  applyStateClass(card, state);

  const updated = card.querySelector('[data-finding-workflow-updated]');
  if (updated) updated.textContent = `Updated ${formatDateTime(workflow[id].updatedAt)}`;

  const shouldBeHandled = state === 'handled' || state === 'verified';
  const legacyIsHandled = legacyButton?.dataset.findingAction === 'reopen';
  if (legacyButton && shouldBeHandled !== legacyIsHandled) legacyButton.click();
}

function syncLegacyHandled(id, state) {
  let handled = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(HANDLED_KEY) || '[]');
    handled = Array.isArray(parsed) ? parsed : [];
  } catch {
    handled = [];
  }
  const set = new Set(handled);
  if (state === 'handled' || state === 'verified') set.add(id);
  else set.delete(id);
  localStorage.setItem(HANDLED_KEY, JSON.stringify([...set]));
}

function applyStateClass(card, state) {
  card.dataset.findingWorkflowState = state;
  card.querySelectorAll('.cos-finding-workflow-state-badge').forEach((item) => item.remove());
  const badge = document.createElement('span');
  badge.className = 'cos-finding-workflow-state-badge';
  badge.textContent = state.replace(/^./, (char) => char.toUpperCase());
  card.querySelector('.cos-worker-finding-head')?.append(badge);
}

function exportSnapshot() {
  return {
    type: 'curatoros-finding-workflow',
    version: 1,
    exportedAt: new Date().toISOString(),
    findings: readWorkflow(),
  };
}

function importSnapshot(value) {
  if (!value || value.type !== 'curatoros-finding-workflow' || value.version !== 1 || !value.findings || typeof value.findings !== 'object') {
    throw new Error('Expected a CuratorOS finding workflow v1 export.');
  }
  writeWorkflow(value.findings);
  const handled = new Set();
  for (const [id, decision] of Object.entries(value.findings)) {
    if (decision?.state === 'handled' || decision?.state === 'verified') handled.add(id);
  }
  localStorage.setItem(HANDLED_KEY, JSON.stringify([...handled]));
}

function readWorkflow() {
  try {
    const value = JSON.parse(localStorage.getItem(WORKFLOW_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeWorkflow(value) {
  localStorage.setItem(WORKFLOW_KEY, JSON.stringify(value));
}

function downloadJson(payload, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'at an unknown time' : date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function installStyles() {
  if (document.querySelector('[data-finding-workflow-styles]')) return;
  const style = document.createElement('style');
  style.dataset.findingWorkflowStyles = '';
  style.textContent = `
    .cos-finding-workflow{margin-top:1rem;padding:1rem;border:1px solid rgba(191,164,106,.35);border-radius:14px;background:rgba(7,16,15,.45)}
    .cos-finding-workflow__heading{display:flex;gap:1rem;align-items:flex-start;justify-content:space-between}
    .cos-finding-workflow__heading>div{display:grid;gap:.2rem}.cos-finding-workflow__heading small{opacity:.72}
    .cos-finding-workflow label{display:grid;gap:.35rem;font-weight:600}.cos-finding-workflow select,.cos-finding-workflow textarea{font:inherit;color:inherit;background:#0b1715;border:1px solid rgba(191,164,106,.45);border-radius:10px;padding:.7rem}
    .cos-finding-workflow__note{margin-top:.8rem}.cos-finding-workflow__actions{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:.75rem}
    .cos-finding-workflow-state-badge{margin-left:auto;align-self:flex-start;padding:.3rem .55rem;border:1px solid rgba(191,164,106,.45);border-radius:999px;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}
    .cos-worker-finding[data-finding-workflow-state="verified"]{opacity:.82}.cos-worker-finding[data-finding-workflow-state="regressed"]{box-shadow:inset 4px 0 0 #b24b4b}
    @media(max-width:720px){.cos-finding-workflow__heading{display:grid}.cos-finding-workflow__heading label{width:100%}.cos-finding-workflow select{width:100%}}
  `;
  document.head.append(style);
}
