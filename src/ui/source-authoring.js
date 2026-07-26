import { StructuredRecordAuthoringService } from './structured-record-authoring.js';

const CONFIDENCE = ['unknown', 'tentative', 'probable', 'verified'];
const STATUSES = ['draft', 'review', 'published', 'archived'];

export class SourceAuthoringController {
  constructor(recordService, options = {}) {
    if (!recordService) throw new Error('RecordService is required.');
    this.recordService = recordService;
    this.authoringService = options.authoringService || new StructuredRecordAuthoringService(recordService);
  }

  createFromForm(form) {
    const values = new FormData(form);
    return this.authoringService.createRecord(this.recordInput(values));
  }

  updateFromForm(id, form) {
    const existing = this.recordService.get(id);
    if (!existing) throw new Error(`Record not found: ${id}`);
    if (existing.type !== 'source') throw new Error(`${id} is not a source record.`);
    const values = new FormData(form);
    const input = this.recordInput(values, existing);
    return this.recordService.update(id, {
      title: input.title,
      summary: input.summary,
      status: input.status,
      tags: input.tags,
      data: input.data,
      metadata: { ...existing.metadata, confidence: input.metadata.confidence }
    });
  }

  recordInput(values, existing = {}) {
    return {
      id: text(values.get('id')) || existing.id,
      type: 'source',
      title: text(values.get('title')),
      summary: text(values.get('summary')),
      status: text(values.get('status')) || 'draft',
      tags: splitTags(values.get('tags')),
      data: compact({
        ...(existing.data || {}),
        creator: text(values.get('creator')),
        publisher: text(values.get('publisher')),
        sourceType: text(values.get('sourceType')),
        date: text(values.get('date')),
        url: text(values.get('url')),
        identifier: text(values.get('identifier')),
        accessDate: text(values.get('accessDate')),
        citation: text(values.get('citation')),
        rights: text(values.get('rights')),
        notes: text(values.get('sourceNotes'))
      }),
      metadata: { confidence: text(values.get('confidence')) || existing.metadata?.confidence || 'unknown' }
    };
  }
}

export function renderSourceAuthoringDialog(options = {}) {
  const record = options.record || null;
  const editing = Boolean(record);
  const data = record?.data || {};
  const mode = editing ? 'edit' : 'create';
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-${mode}-source-dialog>
    <form method="dialog" class="cos-authoring-form" data-${mode}-source-form>
      <header><div><span class="cos-eyebrow">Source catalog</span><h2>${editing ? 'Edit source' : 'Create source'}</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">${editing ? 'Update the canonical source record.' : 'Create a canonical source record for citations and evidence links.'}</p>
      <div class="cos-authoring-grid"><label>Permanent ID<input name="id" value="${attr(record?.id)}" placeholder="source.builder-records" required${editing ? ' readonly' : ''}></label><label>Source title<input name="title" value="${attr(record?.title)}" required></label></div>
      <label>Summary<textarea name="summary" rows="3">${escapeHtml(record?.summary || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Creator or author<input name="creator" value="${attr(data.creator)}"></label><label>Publisher or archive<input name="publisher" value="${attr(data.publisher)}"></label></div>
      <div class="cos-authoring-grid"><label>Source type<input name="sourceType" value="${attr(data.sourceType)}" placeholder="archive, book, article, website…"></label><label>Date<input name="date" value="${attr(data.date)}"></label></div>
      <div class="cos-authoring-grid"><label>Identifier or call number<input name="identifier" value="${attr(data.identifier)}"></label><label>Access date<input name="accessDate" type="date" value="${attr(data.accessDate)}"></label></div>
      <label>URL<input name="url" type="url" value="${attr(data.url)}"></label>
      <label>Citation text<textarea name="citation" rows="3">${escapeHtml(data.citation || '')}</textarea></label>
      <label>Rights or usage note<textarea name="rights" rows="2">${escapeHtml(data.rights || '')}</textarea></label>
      <label>Source notes<textarea name="sourceNotes" rows="3">${escapeHtml(data.notes || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Status<select name="status">${STATUSES.map((value) => `<option value="${value}"${(record?.status || 'draft') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label>Confidence<select name="confidence">${CONFIDENCE.map((value) => `<option value="${value}"${(record?.metadata?.confidence || 'unknown') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div>
      <label>Tags<input name="tags" value="${attr((record?.tags || []).join(', '))}" placeholder="Primary source, Builder records"></label>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">${editing ? 'Save source' : 'Create source'}</button></footer>
    </form>
  </dialog>`;
}

export function installSourceAuthoring(root, context) {
  const controller = context.controller || new SourceAuthoringController(context.recordService);
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };
  toolbar.insertAdjacentHTML('afterbegin', '<button type="button" data-new-source>New source</button>');

  function selectedSource() {
    const id = context.getSelectedId?.();
    const record = id ? context.recordService.get(id) : null;
    return record?.type === 'source' ? record : null;
  }

  function mount(record = null) {
    root.querySelector('[data-create-source-dialog], [data-edit-source-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderSourceAuthoringDialog({ record }));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-source]')) {
      mount();
      root.querySelector('[data-create-source-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-edit-source]')) {
      const record = selectedSource();
      if (!record) return;
      mount(record);
      root.querySelector('[data-edit-source-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  root.addEventListener('submit', (event) => {
    const createForm = event.target.closest('[data-create-source-form]');
    const editForm = event.target.closest('[data-edit-source-form]');
    if (!createForm && !editForm) return;
    event.preventDefault();
    const form = createForm || editForm;
    const error = form.querySelector('[data-authoring-error]');
    try {
      const saved = createForm ? controller.createFromForm(form) : controller.updateFromForm(selectedSource()?.id, form);
      createForm ? context.onCreated?.(saved) : context.onUpdated?.(saved);
      form.closest('dialog')?.close();
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  });

  return { refresh: mount, destroy() { root.querySelector('[data-new-source]')?.remove(); root.querySelector('[data-create-source-dialog], [data-edit-source-dialog]')?.remove(); } };
}

function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '')); }
function splitTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function text(value) { return String(value || '').trim(); }
function attr(value) { return escapeHtml(value || ''); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
