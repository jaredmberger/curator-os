import { StructuredRecordAuthoringService } from './structured-record-authoring.js';

const CONFIDENCE = ['unknown', 'tentative', 'probable', 'verified'];
const STATUSES = ['draft', 'review', 'published', 'archived'];

export class PhotoMediaAuthoringController {
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
    if (!['photo', 'media'].includes(existing.type)) throw new Error(`${id} is not a photo or media record.`);
    const values = new FormData(form);
    const input = this.recordInput(values, existing);
    return this.recordService.update(id, {
      title: input.title,
      summary: input.summary,
      status: input.status,
      tags: input.tags,
      relationships: input.relationships,
      data: input.data,
      metadata: { ...existing.metadata, confidence: input.metadata.confidence }
    });
  }

  recordInput(values, existing = {}) {
    const associatedRecord = text(values.get('associatedRecord'));
    const depictedSubject = text(values.get('depictedSubject'));
    const sourceRecord = text(values.get('sourceRecord'));
    const confidence = text(values.get('confidence')) || existing.metadata?.confidence || 'unknown';
    const preserved = (existing.relationships || []).filter((item) => !['associated_with', 'depicts', 'sourced_from'].includes(item.relationship));
    const relationships = [
      associatedRecord ? relationship(associatedRecord, 'associated_with', confidence) : null,
      depictedSubject ? relationship(depictedSubject, 'depicts', confidence) : null,
      sourceRecord ? relationship(sourceRecord, 'sourced_from', confidence) : null
    ].filter(Boolean);

    return {
      id: text(values.get('id')) || existing.id,
      type: existing.type || 'photo',
      title: text(values.get('title')),
      summary: text(values.get('summary')),
      status: text(values.get('status')) || 'draft',
      tags: splitTags(values.get('tags')),
      relationships: [...preserved, ...relationships],
      data: compact({
        ...(existing.data || {}),
        mediaType: text(values.get('mediaType')),
        date: text(values.get('date')),
        creator: text(values.get('creator')),
        depictedSubject,
        associatedRecord,
        sourceRecord,
        rights: text(values.get('rights')),
        attribution: text(values.get('attribution')),
        caption: text(values.get('caption')),
        altText: text(values.get('altText')),
        url: text(values.get('url')),
        notes: text(values.get('mediaNotes'))
      }),
      metadata: { confidence }
    };
  }
}

export function renderPhotoMediaAuthoringDialog(options = {}) {
  const records = Array.isArray(options.records) ? options.records : [];
  const record = options.record || null;
  const editing = Boolean(record);
  const data = record?.data || {};
  const mode = editing ? 'edit' : 'create';
  const associatedRecord = data.associatedRecord || relationshipTarget(record, 'associated_with');
  const depictedSubject = data.depictedSubject || relationshipTarget(record, 'depicts');
  const sourceRecord = data.sourceRecord || relationshipTarget(record, 'sourced_from');
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-${mode}-photo-media-dialog>
    <form method="dialog" class="cos-authoring-form" data-${mode}-photo-media-form>
      <header><div><span class="cos-eyebrow">Media catalog</span><h2>${editing ? 'Edit photo or media' : 'Create photo or media'}</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">${editing ? 'Update the canonical media record and its managed links.' : 'Catalog a photographic reference or other media record with rights and attribution.'}</p>
      <div class="cos-authoring-grid"><label>Permanent ID<input name="id" value="${attr(record?.id)}" placeholder="photo.olympic-profile" required${editing ? ' readonly' : ''}></label><label>Title<input name="title" value="${attr(record?.title)}" required></label></div>
      <label>Summary<textarea name="summary" rows="3">${escapeHtml(record?.summary || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Media type<input name="mediaType" value="${attr(data.mediaType)}" placeholder="photograph, postcard, plan, scan…"></label><label>Date<input name="date" value="${attr(data.date)}"></label></div>
      <div class="cos-authoring-grid"><label>Creator or photographer<input name="creator" value="${attr(data.creator)}"></label><label>Depicted subject<input name="depictedSubject" list="cos-photo-record-options" value="${attr(depictedSubject)}"></label></div>
      <div class="cos-authoring-grid"><label>Associated record<input name="associatedRecord" list="cos-photo-record-options" value="${attr(associatedRecord)}"></label><label>Source record<input name="sourceRecord" list="cos-photo-source-options" value="${attr(sourceRecord)}"></label></div>
      <label>URL or file reference<input name="url" type="url" value="${attr(data.url)}"></label>
      <label>Caption<textarea name="caption" rows="3">${escapeHtml(data.caption || '')}</textarea></label>
      <label>Alt text<input name="altText" value="${attr(data.altText)}"></label>
      <div class="cos-authoring-grid"><label>Rights<textarea name="rights" rows="2">${escapeHtml(data.rights || '')}</textarea></label><label>Attribution<textarea name="attribution" rows="2">${escapeHtml(data.attribution || '')}</textarea></label></div>
      <label>Media notes<textarea name="mediaNotes" rows="3">${escapeHtml(data.notes || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Status<select name="status">${STATUSES.map((value) => `<option value="${value}"${(record?.status || 'draft') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label>Confidence<select name="confidence">${CONFIDENCE.map((value) => `<option value="${value}"${(record?.metadata?.confidence || 'unknown') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div>
      <label>Tags<input name="tags" value="${attr((record?.tags || []).join(', '))}" placeholder="Photographic reference, RMS Olympic"></label>
      <datalist id="cos-photo-record-options">${records.filter((item) => item.type !== 'source').map((item) => `<option value="${attr(item.id)}">${escapeHtml(item.title || item.id)}</option>`).join('')}</datalist>
      <datalist id="cos-photo-source-options">${records.filter((item) => item.type === 'source').map((item) => `<option value="${attr(item.id)}">${escapeHtml(item.title || item.id)}</option>`).join('')}</datalist>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">${editing ? 'Save media' : 'Create media'}</button></footer>
    </form>
  </dialog>`;
}

export function installPhotoMediaAuthoring(root, context) {
  const controller = context.controller || new PhotoMediaAuthoringController(context.recordService);
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };
  toolbar.insertAdjacentHTML('afterbegin', '<button type="button" data-new-photo-media>New media</button>');

  function selectedRecord() {
    const id = context.getSelectedId?.();
    const record = id ? context.recordService.get(id) : null;
    return record && ['photo', 'media'].includes(record.type) ? record : null;
  }

  function mount(record = null) {
    root.querySelector('[data-create-photo-media-dialog], [data-edit-photo-media-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderPhotoMediaAuthoringDialog({ records: context.recordService.all(), record }));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-photo-media]')) {
      mount();
      root.querySelector('[data-create-photo-media-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-edit-photo-media]')) {
      const record = selectedRecord();
      if (!record) return;
      mount(record);
      root.querySelector('[data-edit-photo-media-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  root.addEventListener('submit', (event) => {
    const createForm = event.target.closest('[data-create-photo-media-form]');
    const editForm = event.target.closest('[data-edit-photo-media-form]');
    if (!createForm && !editForm) return;
    event.preventDefault();
    const form = createForm || editForm;
    const error = form.querySelector('[data-authoring-error]');
    try {
      const saved = createForm ? controller.createFromForm(form) : controller.updateFromForm(selectedRecord()?.id, form);
      createForm ? context.onCreated?.(saved) : context.onUpdated?.(saved);
      form.closest('dialog')?.close();
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  });

  return { refresh: mount, destroy() { root.querySelector('[data-new-photo-media]')?.remove(); root.querySelector('[data-create-photo-media-dialog], [data-edit-photo-media-dialog]')?.remove(); } };
}

function relationship(target, kind, confidence) { return { target, relationship: kind, confidence, sourceIds: [], note: '' }; }
function relationshipTarget(record, kind) { return record?.relationships?.find((item) => item.relationship === kind)?.target || ''; }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '')); }
function splitTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function text(value) { return String(value || '').trim(); }
function attr(value) { return escapeHtml(value || ''); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
