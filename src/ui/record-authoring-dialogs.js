import {
  StructuredRecordAuthoringService,
  parseStructuredList,
  stringifyStructuredList
} from './structured-record-authoring.js';

const TYPES = ['ship', 'company', 'organization', 'person', 'object', 'photo', 'source'];

export class RecordAuthoringController {
  constructor(recordService, options = {}) {
    if (!recordService) throw new Error('RecordService is required.');
    this.recordService = recordService;
    this.authoringService = options.authoringService || new StructuredRecordAuthoringService(recordService);
  }

  createFromForm(form) {
    const values = new FormData(form);
    return this.authoringService.createRecord({
      id: String(values.get('id') || '').trim(),
      type: String(values.get('type') || '').trim(),
      title: String(values.get('title') || '').trim(),
      summary: String(values.get('summary') || '').trim(),
      status: String(values.get('status') || 'draft'),
      tags: splitTags(values.get('tags')),
      metadata: { confidence: String(values.get('confidence') || 'unknown') }
    });
  }

  updateStructuredFromForm(id, form) {
    const values = new FormData(form);
    const relationships = parseStructuredList(String(values.get('relationships') || ''));
    const sources = parseStructuredList(String(values.get('sources') || ''));
    const media = parseStructuredList(String(values.get('media') || ''));
    const notes = parseStructuredList(String(values.get('notes') || ''));

    this.authoringService.updateRelationships(id, relationships);
    this.authoringService.updateSources(id, sources);
    this.authoringService.updateMedia(id, media);
    return this.authoringService.updateNotes(id, notes);
  }
}

export function renderCreateRecordDialog() {
  return `<dialog class="cos-authoring-dialog" data-create-record-dialog>
    <form method="dialog" class="cos-authoring-form" data-create-record-form>
      <header><div><span class="cos-eyebrow">Collection Catalog</span><h2>Create record</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <label>Permanent ID<input name="id" placeholder="ship.example" required></label>
      <label>Record type<select name="type">${TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}</select></label>
      <label>Title<input name="title" required></label>
      <label>Summary<textarea name="summary" rows="4"></textarea></label>
      <div class="cos-authoring-grid">
        <label>Status<select name="status"><option value="draft">draft</option><option value="review">review</option><option value="published">published</option><option value="archived">archived</option></select></label>
        <label>Confidence<select name="confidence"><option value="unknown">unknown</option><option value="tentative">tentative</option><option value="probable">probable</option><option value="verified">verified</option></select></label>
      </div>
      <label>Tags<input name="tags" placeholder="comma separated"></label>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">Create record</button></footer>
    </form>
  </dialog>`;
}

export function renderStructuredAuthoringDialog(record) {
  if (!record) return '';
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-structured-record-dialog>
    <form method="dialog" class="cos-authoring-form" data-structured-record-form>
      <header><div><span class="cos-eyebrow">Structured authoring</span><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.id)}</p></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">Enter one JSON object per line. These fields write through the canonical authoring service.</p>
      <label>Relationships<textarea name="relationships" rows="7" spellcheck="false">${escapeHtml(stringifyStructuredList(record.relationships || []))}</textarea></label>
      <label>Sources<textarea name="sources" rows="7" spellcheck="false">${escapeHtml(stringifyStructuredList(record.sources || []))}</textarea></label>
      <label>Media<textarea name="media" rows="7" spellcheck="false">${escapeHtml(stringifyStructuredList(record.media || []))}</textarea></label>
      <label>Notes<textarea name="notes" rows="7" spellcheck="false">${escapeHtml(stringifyStructuredList(record.notes || []))}</textarea></label>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">Save structured data</button></footer>
    </form>
  </dialog>`;
}

export function installRecordAuthoringDialogs(root, context) {
  const controller = context.controller || new RecordAuthoringController(context.recordService);
  let selectedId = context.selectedId || null;

  function currentRecord() {
    return context.recordService.get(selectedId);
  }

  function mountDialogs() {
    root.querySelectorAll('[data-create-record-dialog], [data-structured-record-dialog]').forEach((dialog) => dialog.remove());
    root.insertAdjacentHTML('beforeend', renderCreateRecordDialog());
    const record = currentRecord();
    if (record) root.insertAdjacentHTML('beforeend', renderStructuredAuthoringDialog(record));
  }

  function show(selector) {
    mountDialogs();
    root.querySelector(selector)?.showModal();
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-record]')) {
      show('[data-create-record-dialog]');
      return;
    }
    if (event.target.closest('[data-edit-structured]') && currentRecord()) {
      show('[data-structured-record-dialog]');
      return;
    }
    if (event.target.closest('[data-close-dialog]')) {
      event.target.closest('dialog')?.close();
    }
  });

  root.addEventListener('submit', (event) => {
    const createForm = event.target.closest('[data-create-record-form]');
    const structuredForm = event.target.closest('[data-structured-record-form]');
    if (!createForm && !structuredForm) return;
    event.preventDefault();

    const error = event.target.querySelector('[data-authoring-error]');
    try {
      if (createForm) {
        const created = controller.createFromForm(createForm);
        selectedId = created.id;
        context.onCreated?.(created);
      } else {
        const updated = controller.updateStructuredFromForm(selectedId, structuredForm);
        context.onUpdated?.(updated);
      }
      event.target.closest('dialog')?.close();
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  });

  return {
    setSelectedId(id) { selectedId = id || null; },
    refresh() { mountDialogs(); },
    destroy() { root.querySelectorAll('[data-create-record-dialog], [data-structured-record-dialog]').forEach((dialog) => dialog.remove()); }
  };
}

function splitTags(value) {
  return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
