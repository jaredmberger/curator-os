import { StructuredRecordAuthoringService } from './structured-record-authoring.js';

const CONFIDENCE = ['unknown', 'tentative', 'probable', 'verified'];
const STATUSES = ['draft', 'review', 'published', 'archived'];

export class ReferenceObjectAuthoringController {
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
    if (existing.type !== 'object') throw new Error(`${id} is not a reference object record.`);
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
    const managed = associatedRecord ? [relationship(associatedRecord, 'associated_with', values.get('confidence'))] : [];
    const preserved = (existing.relationships || []).filter((item) => item.relationship !== 'associated_with');
    return {
      id: text(values.get('id')) || existing.id,
      type: 'object',
      title: text(values.get('title')),
      summary: text(values.get('summary')),
      status: text(values.get('status')) || 'draft',
      tags: splitTags(values.get('tags')),
      relationships: [...preserved, ...managed],
      data: compact({
        ...(existing.data || {}),
        category: text(values.get('category')),
        associatedRecord,
        date: text(values.get('date')),
        maker: text(values.get('maker')),
        dimensions: text(values.get('dimensions')),
        material: text(values.get('material')),
        condition: text(values.get('condition')),
        provenance: text(values.get('provenance')),
        acquisition: text(values.get('acquisition')),
        storageLocation: text(values.get('storageLocation')),
        insuranceNotes: text(values.get('insuranceNotes')),
        curatorNotes: text(values.get('curatorNotes'))
      }),
      metadata: { confidence: text(values.get('confidence')) || existing.metadata?.confidence || 'unknown' }
    };
  }
}

export function renderReferenceObjectAuthoringDialog(options = {}) {
  const records = Array.isArray(options.records) ? options.records : [];
  const record = options.record || null;
  const editing = Boolean(record);
  const data = record?.data || {};
  const associatedRecord = data.associatedRecord || relationshipTarget(record, 'associated_with');
  const mode = editing ? 'edit' : 'create';
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-${mode}-reference-object-dialog>
    <form method="dialog" class="cos-authoring-form" data-${mode}-reference-object-form>
      <header><div><span class="cos-eyebrow">Reference object catalog</span><h2>${editing ? 'Edit reference object' : 'Create reference object'}</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">Catalog a physical collection object and link it to a ship, line, builder, or other canonical record.</p>
      <div class="cos-authoring-grid"><label>Permanent ID<input name="id" value="${attr(record?.id)}" placeholder="object.olympic-menu-1929" required${editing ? ' readonly' : ''}></label><label>Object title<input name="title" value="${attr(record?.title)}" required></label></div>
      <label>Summary<textarea name="summary" rows="3">${escapeHtml(record?.summary || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Object category<input name="category" value="${attr(data.category)}" placeholder="menu, passenger list, china, key, model…"></label><label>Associated record<input name="associatedRecord" list="cos-reference-object-record-options" value="${attr(associatedRecord)}" placeholder="ship.olympic"></label></div>
      <div class="cos-authoring-grid"><label>Date<input name="date" value="${attr(data.date)}"></label><label>Maker or issuer<input name="maker" value="${attr(data.maker)}"></label></div>
      <div class="cos-authoring-grid"><label>Dimensions<input name="dimensions" value="${attr(data.dimensions)}"></label><label>Material<input name="material" value="${attr(data.material)}"></label></div>
      <label>Condition<input name="condition" value="${attr(data.condition)}" placeholder="mint, excellent, good…"></label>
      <label>Provenance<textarea name="provenance" rows="3">${escapeHtml(data.provenance || '')}</textarea></label>
      <label>Acquisition details<textarea name="acquisition" rows="2">${escapeHtml(data.acquisition || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Storage location<input name="storageLocation" value="${attr(data.storageLocation)}"></label><label>Insurance or value notes<input name="insuranceNotes" value="${attr(data.insuranceNotes)}"></label></div>
      <label>Curator notes<textarea name="curatorNotes" rows="3">${escapeHtml(data.curatorNotes || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Status<select name="status">${STATUSES.map((value) => `<option value="${value}"${(record?.status || 'draft') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label>Confidence<select name="confidence">${CONFIDENCE.map((value) => `<option value="${value}"${(record?.metadata?.confidence || 'unknown') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div>
      <label>Tags<input name="tags" value="${attr((record?.tags || []).join(', '))}" placeholder="Reference object, Menu, RMS Olympic"></label>
      <datalist id="cos-reference-object-record-options">${records.filter((item) => item.type !== 'object').map((item) => `<option value="${attr(item.id)}">${escapeHtml(item.title || item.id)}</option>`).join('')}</datalist>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">${editing ? 'Save reference object' : 'Create reference object'}</button></footer>
    </form>
  </dialog>`;
}

export function installReferenceObjectAuthoring(root, context) {
  const controller = context.controller || new ReferenceObjectAuthoringController(context.recordService);
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };
  toolbar.insertAdjacentHTML('afterbegin', '<button type="button" data-new-reference-object>New object</button>');

  function selectedObject() {
    const id = context.getSelectedId?.();
    const record = id ? context.recordService.get(id) : null;
    return record?.type === 'object' ? record : null;
  }

  function mount(record = null) {
    root.querySelector('[data-create-reference-object-dialog], [data-edit-reference-object-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderReferenceObjectAuthoringDialog({ records: context.recordService.all(), record }));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-reference-object]')) {
      mount();
      root.querySelector('[data-create-reference-object-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-edit-reference-object]')) {
      const record = selectedObject();
      if (!record) return;
      mount(record);
      root.querySelector('[data-edit-reference-object-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  root.addEventListener('submit', (event) => {
    const createForm = event.target.closest('[data-create-reference-object-form]');
    const editForm = event.target.closest('[data-edit-reference-object-form]');
    if (!createForm && !editForm) return;
    event.preventDefault();
    const form = createForm || editForm;
    const error = form.querySelector('[data-authoring-error]');
    try {
      const saved = createForm ? controller.createFromForm(form) : controller.updateFromForm(selectedObject()?.id, form);
      createForm ? context.onCreated?.(saved) : context.onUpdated?.(saved);
      form.closest('dialog')?.close();
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  });

  return { refresh: mount, destroy() { root.querySelector('[data-new-reference-object]')?.remove(); root.querySelector('[data-create-reference-object-dialog], [data-edit-reference-object-dialog]')?.remove(); } };
}

function relationship(target, kind, confidence) { return { target, relationship: kind, confidence: text(confidence) || 'unknown', sourceIds: [], note: '' }; }
function relationshipTarget(record, kind) { return record?.relationships?.find((item) => item.relationship === kind)?.target || ''; }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '')); }
function splitTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function text(value) { return String(value || '').trim(); }
function attr(value) { return escapeHtml(value || ''); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
