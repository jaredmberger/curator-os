const CATALOG_KEY = 'curatoros.rebuilt.catalog';
const CHANGE_KEY = 'curatoros.project.pendingChanges';
const BASELINE_KEY = 'curatoros.project.editBaseline';
const app = document.querySelector('#app');

let observer;
start();

function start() {
  observer = new MutationObserver(() => {
    enhanceInspector();
    enhanceRecordsView();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('curatoros:records-changed', enhanceRecordsView);
  enhanceRecordsView();
}

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readRecords() {
  const records = readJson(CATALOG_KEY, []);
  return Array.isArray(records) ? records : [];
}

function readChanges() {
  const changes = readJson(CHANGE_KEY, []);
  return Array.isArray(changes) ? changes : [];
}

function enhanceInspector() {
  const dialog = document.querySelector('#project-record-inspector');
  if (!dialog || dialog.dataset.editingEnhanced === 'true') return;
  dialog.dataset.editingEnhanced = 'true';
  const actions = dialog.querySelector('.record-inspector-actions');
  const recordId = inferRecordId(dialog);
  if (!actions || !recordId) return;
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.textContent = 'Edit permanent record';
  edit.dataset.editLocalRecord = recordId;
  edit.addEventListener('click', () => openEditor(recordId));
  actions.prepend(edit);
}

function inferRecordId(dialog) {
  const identity = [...dialog.querySelectorAll('.record-detail-grid dt')].find((node) => node.textContent.trim().toLowerCase() === 'record id');
  return identity?.nextElementSibling?.textContent?.trim() || '';
}

function enhanceRecordsView() {
  const panel = document.querySelector('.project-records-panel');
  if (!panel || panel.dataset.editingEnhanced === 'true') return;
  panel.dataset.editingEnhanced = 'true';

  const changes = readChanges();
  const section = document.createElement('section');
  section.className = 'pending-change-panel';
  section.innerHTML = `<div><span class="eyebrow">Permanent records workspace</span><h4>${changes.length} recent change${changes.length === 1 ? '' : 's'}</h4><p>Create new Project Records here or edit existing ones. Successful saves are written to the permanent CuratorOS Project Records store; the browser copy is only a cache.</p></div><div class="pending-change-actions"><button type="button" data-create-record>Create Project Record</button><button type="button" data-review-changes${changes.length ? '' : ' disabled'}>Review recent changes</button><button type="button" data-export-changes${changes.length ? '' : ' disabled'}>Export change set</button></div>`;
  panel.prepend(section);

  section.querySelector('[data-create-record]')?.addEventListener('click', openCreateRecord);
  section.querySelector('[data-review-changes]')?.addEventListener('click', openChangeReview);
  section.querySelector('[data-export-changes]')?.addEventListener('click', exportChangeSet);

  const list = panel.querySelector('.project-record-list');
  if (list && readRecords().length === 0) {
    list.innerHTML = `<div class="empty"><p>No permanent Project Records exist yet.</p><button type="button" data-create-first-record>Create your first Project Record</button></div>`;
    list.querySelector('[data-create-first-record]')?.addEventListener('click', openCreateRecord);
  }
}

function openCreateRecord() {
  closeDialog('#project-record-editor');
  const dialog = document.createElement('dialog');
  dialog.id = 'project-record-editor';
  dialog.innerHTML = `<form class="record-editor-card"><header class="record-editor-header"><div><span class="eyebrow">New permanent Project Record</span><h3>Create Project Record</h3></div><button type="button" data-close-editor aria-label="Close editor">×</button></header><p class="record-editor-safety">Saving creates a new permanent Project Record in CuratorOS. The record is only treated as saved after the permanent store confirms the write.</p><div class="record-editor-grid">${field('Title', 'edit-title', '')}${field('Type', 'edit-type', 'record')}${selectField('Status', 'edit-status', 'review', ['draft','review','published','archived'])}${field('Record ID', 'edit-id', '')}</div>${textarea('Summary', 'edit-summary', '', 4)}${textarea('Tags — one per line', 'edit-tags', '', 4)}${textarea('Structured data — JSON object', 'edit-data', '{}', 10, 'json')}${textarea('Sources — JSON array', 'edit-sources', '[]', 8, 'json')}${textarea('Relationships — JSON array', 'edit-relationships', '[]', 8, 'json')}${textarea('Curatorial notes — JSON array', 'edit-notes', '[]', 8, 'json')}<div class="record-editor-error" role="alert" hidden></div><footer class="record-editor-actions"><button type="button" data-close-editor>Cancel</button><button type="submit">Create permanent record</button></footer></form>`;
  document.body.append(dialog);
  dialog.querySelectorAll('[data-close-editor]').forEach((button) => button.addEventListener('click', () => closeDialog('#project-record-editor')));
  dialog.querySelector('form')?.addEventListener('submit', (event) => { event.preventDefault(); saveNewRecord(dialog); });
  dialog.addEventListener('cancel', () => closeDialog('#project-record-editor'));
  dialog.showModal();
}

async function saveNewRecord(dialog) {
  const errorBox = dialog.querySelector('.record-editor-error');
  try {
    const title = value(dialog, '#edit-title').trim();
    const type = value(dialog, '#edit-type').trim() || 'record';
    const enteredId = value(dialog, '#edit-id').trim();
    if (!title) throw new Error('Title is required.');

    const id = enteredId || makeRecordId(type, title);
    const existing = readRecords();
    if (existing.some((record) => record.id === id)) throw new Error(`A Project Record with ID ${id} already exists.`);

    const now = new Date().toISOString();
    const record = {
      id,
      title,
      type,
      status: value(dialog, '#edit-status'),
      summary: value(dialog, '#edit-summary').trim(),
      tags: value(dialog, '#edit-tags').split('\n').map((item) => item.trim()).filter(Boolean),
      data: parseObject(value(dialog, '#edit-data'), 'Structured data'),
      sources: parseArray(value(dialog, '#edit-sources'), 'Sources'),
      relationships: parseArray(value(dialog, '#edit-relationships'), 'Relationships'),
      notes: parseArray(value(dialog, '#edit-notes'), 'Curatorial notes'),
      metadata: { permanentlyCreatedAt: now },
      origin: { kind: 'curatoros-native', createdAt: now }
    };

    const records = [...existing, record];
    const store = window.CuratorOSProjectRecordsStore;
    if (!store) throw new Error('Permanent Project Records store is not available.');
    await store.save(records, `create:${id}`);

    const changes = readChanges();
    changes.push({ id: `change:${id}:${Date.now()}`, recordId: id, title, changedAt: now, origin: record.origin, before: null, after: record, fields: ['created'], permanent: true });
    localStorage.setItem(CHANGE_KEY, JSON.stringify(changes));
    closeDialog('#project-record-editor');
    window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'permanent-create'}}));
  } catch (error) {
    if (errorBox) { errorBox.hidden = false; errorBox.textContent = error instanceof Error ? error.message : String(error); }
  }
}

function makeRecordId(type, title) {
  const prefix = String(type || 'record').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'record';
  const slug = String(title || 'untitled').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
  return `${prefix}:${slug}`;
}

function openEditor(recordId) {
  const records = readRecords();
  const record = records.find((item) => item.id === recordId);
  if (!record) return alert('This record could not be found.');
  closeDialog('#project-record-editor');
  const dialog = document.createElement('dialog');
  dialog.id = 'project-record-editor';
  dialog.innerHTML = `<form class="record-editor-card"><header class="record-editor-header"><div><span class="eyebrow">Permanent record editor</span><h3>${escapeHtml(record.title || record.id)}</h3></div><button type="button" data-close-editor aria-label="Close editor">×</button></header><p class="record-editor-safety">Saving here updates the permanent CuratorOS Project Records store. The local browser copy is refreshed as a cache.</p><div class="record-editor-grid">${field('Title', 'edit-title', record.title || '')}${field('Type', 'edit-type', record.type || 'record')}${selectField('Status', 'edit-status', record.status || 'review', ['draft','review','published','archived'])}${field('Record ID', 'edit-id', record.id || '', true)}</div>${textarea('Summary', 'edit-summary', record.summary || '', 4)}${textarea('Tags — one per line', 'edit-tags', (record.tags || []).join('\n'), 4)}${textarea('Structured data — JSON object', 'edit-data', JSON.stringify(record.data || {}, null, 2), 10, 'json')}${textarea('Sources — JSON array', 'edit-sources', JSON.stringify(record.sources || [], null, 2), 8, 'json')}${textarea('Relationships — JSON array', 'edit-relationships', JSON.stringify(record.relationships || [], null, 2), 8, 'json')}${textarea('Curatorial notes — JSON array', 'edit-notes', JSON.stringify(record.notes || [], null, 2), 8, 'json')}<div class="record-editor-error" role="alert" hidden></div><footer class="record-editor-actions"><button type="button" data-close-editor>Cancel</button><button type="submit">Save permanent record</button></footer></form>`;
  document.body.append(dialog);
  dialog.querySelectorAll('[data-close-editor]').forEach((button) => button.addEventListener('click', () => closeDialog('#project-record-editor')));
  dialog.querySelector('form')?.addEventListener('submit', (event) => { event.preventDefault(); saveRecordEdit(record, dialog); });
  dialog.addEventListener('cancel', () => closeDialog('#project-record-editor'));
  dialog.showModal();
}

async function saveRecordEdit(before, dialog) {
  const errorBox = dialog.querySelector('.record-editor-error');
  try {
    const after = { ...before, title: value(dialog, '#edit-title').trim(), type: value(dialog, '#edit-type').trim() || 'record', status: value(dialog, '#edit-status'), summary: value(dialog, '#edit-summary').trim(), tags: value(dialog, '#edit-tags').split('\n').map((item) => item.trim()).filter(Boolean), data: parseObject(value(dialog, '#edit-data'), 'Structured data'), sources: parseArray(value(dialog, '#edit-sources'), 'Sources'), relationships: parseArray(value(dialog, '#edit-relationships'), 'Relationships'), notes: parseArray(value(dialog, '#edit-notes'), 'Curatorial notes'), metadata: { ...(before.metadata || {}), permanentlyEditedAt: new Date().toISOString() } };
    if (!after.title) throw new Error('Title is required.');
    const records = readRecords().map((record) => record.id === before.id ? after : record);
    const store = window.CuratorOSProjectRecordsStore;
    if (!store) throw new Error('Permanent Project Records store is not available.');
    await store.save(records, `edit:${before.id}`);
    const changes = readChanges().filter((change) => change.recordId !== before.id);
    changes.push({ id: `change:${before.id}`, recordId: before.id, title: after.title, changedAt: new Date().toISOString(), origin: before.origin || null, before, after, fields: changedFields(before, after), permanent: true });
    localStorage.setItem(CHANGE_KEY, JSON.stringify(changes));
    closeDialog('#project-record-editor');
    closeDialog('#project-record-inspector');
    window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'permanent-save'}}));
  } catch (error) {
    if (errorBox) { errorBox.hidden = false; errorBox.textContent = error instanceof Error ? error.message : String(error); }
  }
}

function openChangeReview() {
  const changes = readChanges();
  if (!changes.length) return;
  closeDialog('#project-change-review');
  const dialog = document.createElement('dialog');
  dialog.id = 'project-change-review';
  dialog.innerHTML = `<section class="change-review-card"><header class="record-editor-header"><div><span class="eyebrow">Recent permanent changes</span><h3>${changes.length} changed record${changes.length === 1 ? '' : 's'}</h3></div><button type="button" data-close-change-review aria-label="Close">×</button></header><div class="change-review-list">${changes.map((change) => `<article><div><strong>${escapeHtml(change.title || change.recordId)}</strong><p>${escapeHtml(change.recordId)}</p></div><p><strong>Changed:</strong> ${escapeHtml((change.fields || []).join(', ') || 'record content')}</p><p><small>${escapeHtml(formatDate(change.changedAt))}</small></p></article>`).join('')}</div><footer class="record-editor-actions"><button type="button" data-close-change-review>Close</button><button type="button" data-export-review>Export change set</button></footer></section>`;
  document.body.append(dialog);
  dialog.querySelectorAll('[data-close-change-review]').forEach((button) => button.addEventListener('click', () => closeDialog('#project-change-review')));
  dialog.querySelector('[data-export-review]')?.addEventListener('click', exportChangeSet);
  dialog.addEventListener('cancel', () => closeDialog('#project-change-review'));
  dialog.showModal();
}

function exportChangeSet() {
  const changes = readChanges(); if (!changes.length) return;
  const imported = readJson('curatoros.project.lastImport', null);
  const payload = { format: 'curatoros-project-change-set', formatVersion: 2, project: 'Ocean Liner Curator', createdAt: new Date().toISOString(), sourceImport: imported, changeCount: changes.length, permanentStore: true, changes };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `curatoros-change-set-${new Date().toISOString().slice(0,10)}.json`; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}

function changedFields(before, after) { const fields = ['title','type','status','summary','tags','data','sources','relationships','notes']; return fields.filter((field) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null)); }
function parseObject(text, label) { const value = JSON.parse(text || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`${label} must be a JSON object.`); return value; }
function parseArray(text, label) { const value = JSON.parse(text || '[]'); if (!Array.isArray(value)) throw new Error(`${label} must be a JSON array.`); return value; }
function value(dialog, selector) { return dialog.querySelector(selector)?.value || ''; }
function closeDialog(selector) { const dialog = document.querySelector(selector); if (!dialog) return; try { dialog.close(); } catch {} dialog.remove(); }
function field(label, id, value, readonly = false) { return `<label><span>${escapeHtml(label)}</span><input id="${id}" value="${escapeHtml(value)}"${readonly ? ' readonly' : ''}></label>`; }
function selectField(label, id, value, options) { return `<label><span>${escapeHtml(label)}</span><select id="${id}">${options.map((option) => `<option value="${option}"${option === value ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`; }
function textarea(label, id, value, rows, kind = '') { return `<label class="record-editor-wide"><span>${escapeHtml(label)}</span><textarea id="${id}" rows="${rows}"${kind ? ` data-kind="${kind}"` : ''}>${escapeHtml(value)}</textarea></label>`; }
function formatDate(value) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[character])); }
