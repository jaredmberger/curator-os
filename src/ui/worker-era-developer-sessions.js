const SESSION_KEY = 'curatoros.session.active.v2';
const LATEST_KEY = 'curatoros.session.latest';

export function installWorkerEraDeveloperSessions(root, context = {}) {
  const shell = root.querySelector('.cos-catalog-shell');
  const workspace = root.querySelector('.cos-worker-workspace');
  if (!shell || !workspace) return { destroy() {} };

  const developer = document.createElement('section');
  developer.className = 'cos-worker-developer';
  developer.hidden = true;
  workspace.append(developer);

  const sessionOverlay = document.createElement('div');
  sessionOverlay.className = 'cos-worker-session-overlay';
  sessionOverlay.hidden = true;
  sessionOverlay.innerHTML = `<div class="cos-worker-session-card" role="dialog" aria-modal="true" aria-label="Guided curator session">
    <div class="cos-worker-session-head"><div><span class="cos-eyebrow">Voyage IV · Guided work</span><h2>Tonight’s Session</h2></div><button type="button" data-session-close>Close</button></div>
    <p data-session-mission></p>
    <div class="cos-worker-session-progress"><span></span></div>
    <div data-session-progress-text class="cos-worker-muted"></div>
    <div class="cos-worker-session-toolbar">
      <label>Session size<select data-session-size><option value="3">3 tasks</option><option value="5" selected>5 tasks</option><option value="8">8 tasks</option></select></label>
      <button type="button" data-session-regenerate>Build a new plan</button>
      <button type="button" data-session-resume hidden>Resume saved session</button>
    </div>
    <div data-session-focus class="cos-worker-session-focus"></div>
    <div data-session-tasks></div>
    <label class="cos-worker-session-notes">Captain’s log<textarea rows="5" placeholder="Record what you checked, changed, deferred, or learned…"></textarea></label>
    <div class="cos-worker-actions"><button type="button" data-session-finish>Finish Session</button><button type="button" data-session-abandon>End Without Saving</button></div>
    <div data-session-result></div>
  </div>`;
  root.append(sessionOverlay);

  let activePlan = null;

  function renderDeveloper() {
    const records = context.recordService?.all?.() || [];
    const snapshot = context.recordService?.snapshot?.() || { records };
    const byType = countBy(records, 'type');
    const review = records.filter((record) => record.status === 'review').length;
    const drafts = records.filter((record) => record.status === 'draft').length;
    const relationships = records.reduce((sum, record) => sum + (record.relationships || []).length, 0);
    const unsourced = records.filter((record) => !(record.sources || []).length).length;
    developer.innerHTML = `<div class="cos-worker-developer-grid">
      ${card('Schema version', globalThis.CuratorDatabase?.SCHEMA_VERSION || 'unknown')}
      ${card('Local records', records.length)}
      ${card('Relationships', relationships)}
      ${card('Review queue', review)}
      ${card('Draft records', drafts)}
      ${card('Unsourced records', unsourced)}
    </div>
    <div class="cos-worker-dashboard-grid">
      <article class="cos-worker-panel"><span class="cos-eyebrow">Module Registry</span><h2>CuratorOS 6.0 modules</h2><div class="cos-worker-module-list">${['Collection Catalog','Record Authoring','GitHub Ingestion','Selective Merge','Knowledge Graph','Archive Intelligence','Publication Preview','Snapshots & Backups'].map((name) => `<div><strong>${name}</strong><span>active</span></div>`).join('')}</div></article>
      <article class="cos-worker-panel"><span class="cos-eyebrow">Administration</span><h2>Developer actions</h2><p>Validate the current local database, export a debug bundle, or begin a guided curator session.</p><div class="cos-worker-actions"><button type="button" data-dev-validate>Validate Database</button><button type="button" data-dev-debug>Export Debug Bundle</button><button type="button" data-dev-session>Start Guided Session</button></div><p class="cos-worker-muted">Database contains ${snapshot.records?.length || records.length} records in this browser.</p></article>
    </div>`;
  }

  function buildPlan(limit = 5) {
    const records = context.recordService?.all?.() || [];
    const tasks = [];
    const seen = new Set();
    const add = (task) => {
      if (!task?.id || seen.has(task.id) || tasks.length >= limit) return;
      seen.add(task.id);
      tasks.push(task);
    };

    records.filter((record) => record.status === 'review').forEach((record) => add({
      id: `review:${record.id}`,
      type: 'review',
      recordId: record.id,
      title: `Review ${record.title}`,
      meta: 'Confirm status, confidence, summary, and whether the record is ready to publish.',
      why: 'Review-state records are the clearest path to converting unfinished catalog work into publishable knowledge.',
      actionLabel: 'Open in Registry',
      done: false
    }));

    records.filter((record) => !(record.sources || []).length).forEach((record) => add({
      id: `source:${record.id}`,
      type: 'source',
      recordId: record.id,
      title: `Strengthen provenance for ${record.title}`,
      meta: 'Attach a direct source or add a curatorial note explaining the evidence basis.',
      why: 'A documented evidence basis improves confidence, publication readiness, and future maintenance.',
      actionLabel: 'Open in Registry',
      done: false
    }));

    records.filter((record) => record.status === 'draft').forEach((record) => add({
      id: `draft:${record.id}`,
      type: 'draft',
      recordId: record.id,
      title: `Advance draft ${record.title}`,
      meta: 'Complete one missing field or decide whether the draft should remain active.',
      why: 'Small, deliberate progress keeps drafts from becoming an invisible backlog.',
      actionLabel: 'Open in Registry',
      done: false
    }));

    if (!tasks.length) add({
      id: 'maintenance:backup',
      type: 'maintenance',
      title: 'Create a fresh archive backup',
      meta: 'Preserve the current local catalog before the next work session.',
      why: 'A current backup protects the work already completed and creates a clean recovery point.',
      actionLabel: 'Use Quick Backup',
      done: false
    });

    return {
      version: 2,
      startedAt: new Date().toISOString(),
      mission: tasks.length === 1 ? 'Complete one focused maintenance task.' : `Complete a focused set of ${tasks.length} curatorial tasks.`,
      tasks
    };
  }

  function openSession() {
    const saved = readSession();
    activePlan = saved || buildPlan(Number(sessionOverlay.querySelector('[data-session-size]').value || 5));
    sessionOverlay.hidden = false;
    sessionOverlay.querySelector('[data-session-resume]').hidden = !saved;
    sessionOverlay.querySelector('[data-session-mission]').textContent = activePlan.mission;
    sessionOverlay.querySelector('textarea').value = activePlan.notes || '';
    renderSession();
  }

  function renderSession() {
    if (!activePlan) return;
    const done = activePlan.tasks.filter((task) => task.done).length;
    const percent = activePlan.tasks.length ? Math.round((done / activePlan.tasks.length) * 100) : 0;
    sessionOverlay.querySelector('.cos-worker-session-progress span').style.width = `${percent}%`;
    sessionOverlay.querySelector('[data-session-progress-text]').textContent = `${done} of ${activePlan.tasks.length} tasks complete · ${percent}%`;
    sessionOverlay.querySelector('[data-session-focus]').innerHTML = done === activePlan.tasks.length
      ? `<strong>Session complete.</strong><span>Add a brief captain’s log, then finish the session.</span>`
      : `<strong>Current focus:</strong><span>${escapeHtml(activePlan.tasks.find((task) => !task.done)?.title || '')}</span>`;
    sessionOverlay.querySelector('[data-session-tasks]').innerHTML = activePlan.tasks.map((task) => `<article class="cos-worker-session-task${task.done ? ' done' : ''}" data-session-task-id="${escapeHtml(task.id)}">
      <label><input type="checkbox" data-session-task-toggle="${escapeHtml(task.id)}"${task.done ? ' checked' : ''}><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.meta)}</small></span></label>
      <details><summary>Why this task?</summary><p>${escapeHtml(task.why || '')}</p></details>
      ${task.recordId ? `<button type="button" data-session-open-record="${escapeHtml(task.recordId)}">${escapeHtml(task.actionLabel || 'Open record')}</button>` : ''}
    </article>`).join('');
    persistActiveSession();
  }

  function persistActiveSession() {
    if (!activePlan) return;
    activePlan.notes = sessionOverlay.querySelector('textarea').value;
    localStorage.setItem(SESSION_KEY, JSON.stringify(activePlan));
  }

  function readSession() {
    try {
      const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return value?.version === 2 && Array.isArray(value.tasks) ? value : null;
    } catch {
      return null;
    }
  }

  function closeSession({ discard = false } = {}) {
    if (discard) localStorage.removeItem(SESSION_KEY);
    else persistActiveSession();
    sessionOverlay.hidden = true;
    activePlan = null;
    sessionOverlay.querySelector('[data-session-result]').textContent = '';
  }

  root.addEventListener('curatoros:worker-view', (event) => {
    developer.hidden = event.detail?.view !== 'developer';
    if (!developer.hidden) renderDeveloper();
  });

  developer.addEventListener('click', (event) => {
    if (event.target.closest('[data-dev-validate]')) {
      try {
        globalThis.CuratorDatabase.assertDatabase(globalThis.CuratorDatabase.createDatabase(context.recordService.all()));
        alert('The local CuratorOS database passed validation.');
      } catch (error) { alert(error instanceof Error ? error.message : String(error)); }
    }
    if (event.target.closest('[data-dev-debug]')) {
      const records = context.recordService.all();
      downloadJson({ exportedAt:new Date().toISOString(), schemaVersion:globalThis.CuratorDatabase?.SCHEMA_VERSION, counts:countBy(records,'type'), records }, `curatoros-debug-${new Date().toISOString().slice(0,10)}.json`);
    }
    if (event.target.closest('[data-dev-session]')) openSession();
  });

  sessionOverlay.addEventListener('change', (event) => {
    const toggle = event.target.closest('[data-session-task-toggle]');
    if (toggle && activePlan) {
      const task = activePlan.tasks.find((item) => item.id === toggle.dataset.sessionTaskToggle);
      if (task) task.done = toggle.checked;
      renderSession();
      return;
    }
    if (event.target.matches('[data-session-size]') && !activePlan) openSession();
  });

  sessionOverlay.addEventListener('input', (event) => {
    if (event.target.matches('textarea') && activePlan) persistActiveSession();
  });

  sessionOverlay.addEventListener('click', (event) => {
    if (event.target === sessionOverlay || event.target.closest('[data-session-close]')) closeSession();
    if (event.target.closest('[data-session-abandon]')) closeSession({ discard: true });
    if (event.target.closest('[data-session-regenerate]')) {
      const limit = Number(sessionOverlay.querySelector('[data-session-size]').value || 5);
      activePlan = buildPlan(limit);
      sessionOverlay.querySelector('[data-session-mission]').textContent = activePlan.mission;
      sessionOverlay.querySelector('textarea').value = '';
      renderSession();
    }
    const openRecord = event.target.closest('[data-session-open-record]');
    if (openRecord) {
      persistActiveSession();
      sessionOverlay.hidden = true;
      root.dispatchEvent(new CustomEvent('curatoros:worker-view-request', { detail: { view: 'registry', recordId: openRecord.dataset.sessionOpenRecord } }));
    }
    if (event.target.closest('[data-session-finish]') && activePlan) {
      const completed = activePlan.tasks.filter((task) => task.done).length;
      const notes = sessionOverlay.querySelector('textarea').value.trim();
      const payload = { ...activePlan, finishedAt:new Date().toISOString(), completed, notes };
      localStorage.setItem(LATEST_KEY, JSON.stringify(payload));
      localStorage.removeItem(SESSION_KEY);
      downloadJson(payload, `curatoros-session-${new Date().toISOString().slice(0,10)}.json`);
      sessionOverlay.querySelector('[data-session-result]').textContent = `Session saved: ${completed} of ${activePlan.tasks.length} tasks completed.`;
    }
  });

  const unsubscribe = context.recordService?.subscribe?.(() => { if (!developer.hidden) renderDeveloper(); }) || (() => {});
  return { renderDeveloper, openSession, destroy() { unsubscribe(); developer.remove(); sessionOverlay.remove(); } };
}

function countBy(values, key) { return values.reduce((out, item) => { const value = item[key] || 'unknown'; out[value] = (out[value] || 0) + 1; return out; }, {}); }
function card(label, value) { return `<div class="cos-worker-dev-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`; }
function escapeHtml(value) { return String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function downloadJson(payload, filename) { const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
