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
  sessionOverlay.innerHTML = `<div class="cos-worker-session-card" role="dialog" aria-modal="true" aria-label="Guided curator session"><div class="cos-worker-session-head"><div><span class="cos-eyebrow">Voyage IV · Guided work</span><h2>Tonight’s Session</h2></div><button type="button" data-session-close>Close</button></div><p data-session-mission></p><div class="cos-worker-session-progress"><span></span></div><div data-session-progress-text class="cos-worker-muted"></div><div data-session-tasks></div><label class="cos-worker-session-notes">Captain’s log<textarea rows="5" placeholder="Notes for this session…"></textarea></label><div class="cos-worker-actions"><button type="button" data-session-finish>Finish Session</button><button type="button" data-session-abandon>End Without Saving</button></div><div data-session-result></div></div>`;
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

  function buildPlan() {
    const records = context.recordService?.all?.() || [];
    const tasks = [];
    const review = records.filter((record) => record.status === 'review').slice(0, 4);
    review.forEach((record) => tasks.push({ id: `review:${record.id}`, title: `Review ${record.title}`, meta: 'Confirm status, confidence, and summary.', done: false }));
    const unsourced = records.filter((record) => !(record.sources || []).length).slice(0, 3);
    unsourced.forEach((record) => tasks.push({ id: `source:${record.id}`, title: `Strengthen provenance for ${record.title}`, meta: 'Attach a direct source or curatorial note.', done: false }));
    if (!tasks.length) tasks.push({ id: 'maintenance:backup', title: 'Create a fresh archive backup', meta: 'Preserve the current local catalog before the next work session.', done: false });
    return { startedAt: new Date().toISOString(), mission: tasks.length === 1 ? 'Complete one focused maintenance task.' : `Complete ${tasks.length} focused curatorial tasks.`, tasks };
  }

  function openSession() {
    activePlan = buildPlan();
    sessionOverlay.hidden = false;
    sessionOverlay.querySelector('[data-session-mission]').textContent = activePlan.mission;
    renderSession();
  }

  function renderSession() {
    if (!activePlan) return;
    const done = activePlan.tasks.filter((task) => task.done).length;
    const percent = Math.round((done / activePlan.tasks.length) * 100);
    sessionOverlay.querySelector('.cos-worker-session-progress span').style.width = `${percent}%`;
    sessionOverlay.querySelector('[data-session-progress-text]').textContent = `${done} of ${activePlan.tasks.length} tasks complete`;
    sessionOverlay.querySelector('[data-session-tasks]').innerHTML = activePlan.tasks.map((task, index) => `<label class="cos-worker-session-task${task.done ? ' done' : ''}"><input type="checkbox" data-session-task="${index}"${task.done ? ' checked' : ''}><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.meta)}</small></span></label>`).join('');
  }

  function closeSession() {
    sessionOverlay.hidden = true;
    activePlan = null;
    sessionOverlay.querySelector('textarea').value = '';
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
    if (!event.target.matches('[data-session-task]') || !activePlan) return;
    activePlan.tasks[Number(event.target.dataset.sessionTask)].done = event.target.checked;
    renderSession();
  });
  sessionOverlay.addEventListener('click', (event) => {
    if (event.target === sessionOverlay || event.target.closest('[data-session-close]') || event.target.closest('[data-session-abandon]')) closeSession();
    if (event.target.closest('[data-session-finish]') && activePlan) {
      const completed = activePlan.tasks.filter((task) => task.done).length;
      const notes = sessionOverlay.querySelector('textarea').value.trim();
      const payload = { ...activePlan, finishedAt:new Date().toISOString(), completed, notes };
      localStorage.setItem('curatoros.session.latest', JSON.stringify(payload));
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
function downloadJson(payload, filename) { const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
