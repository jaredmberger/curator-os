import { StructuredRecordAuthoringService } from './structured-record-authoring.js';

const CONFIDENCE = ['unknown', 'tentative', 'probable', 'verified'];
const STATUSES = ['draft', 'review', 'published', 'archived'];

export class ShipAuthoringController {
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
    if (existing.type !== 'ship') throw new Error(`${id} is not a ship record.`);
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
    const builder = text(values.get('builder'));
    const operator = text(values.get('operator'));
    const relationshipConfidence = text(values.get('confidence')) || existing.metadata?.confidence || 'unknown';
    const preserved = (existing.relationships || []).filter((item) => !['built_by', 'operated_by'].includes(item.relationship));
    const relationships = [
      builder ? relationship(builder, 'built_by', relationshipConfidence) : null,
      operator ? relationship(operator, 'operated_by', relationshipConfidence) : null
    ].filter(Boolean);

    return {
      id: text(values.get('id')) || existing.id,
      type: 'ship',
      title: text(values.get('title')),
      summary: text(values.get('summary')),
      status: text(values.get('status')) || 'draft',
      tags: splitTags(values.get('tags')),
      relationships: [...preserved, ...relationships],
      data: compact({
        ...(existing.data || {}),
        builder,
        operator,
        yardNumber: text(values.get('yardNumber')),
        launchDate: text(values.get('launchDate')),
        maidenVoyage: text(values.get('maidenVoyage')),
        fate: text(values.get('fate')),
        grossTonnage: text(values.get('grossTonnage')),
        length: text(values.get('length')),
        beam: text(values.get('beam')),
        speed: text(values.get('speed'))
      }),
      metadata: { confidence: relationshipConfidence }
    };
  }
}

export function renderShipAuthoringDialog(options = {}) {
  const records = Array.isArray(options.records) ? options.records : [];
  const record = options.record || null;
  const editing = Boolean(record);
  const organizations = records.filter((item) => ['company', 'organization'].includes(item.type));
  const data = record?.data || {};
  const builder = data.builder || relationshipTarget(record, 'built_by');
  const operator = data.operator || relationshipTarget(record, 'operated_by');
  const mode = editing ? 'edit' : 'create';
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-${mode}-ship-dialog>
    <form method="dialog" class="cos-authoring-form" data-${mode}-ship-form>
      <header><div><span class="cos-eyebrow">Ship catalog</span><h2>${editing ? 'Edit ship' : 'Create ship'}</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">${editing ? 'Update the canonical ship facts and managed builder/operator relationships.' : 'Create a canonical ship record and automatically link its builder and operator.'}</p>
      <div class="cos-authoring-grid"><label>Permanent ID<input name="id" value="${attr(record?.id)}" placeholder="ship.rms-olympic" required${editing ? ' readonly' : ''}></label><label>Ship name<input name="title" value="${attr(record?.title)}" required></label></div>
      <label>Summary<textarea name="summary" rows="3">${escapeHtml(record?.summary || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Builder record<input name="builder" list="cos-ship-organization-options" value="${attr(builder)}" placeholder="company.harland-wolff"></label><label>Operator record<input name="operator" list="cos-ship-organization-options" value="${attr(operator)}" placeholder="company.white-star-line"></label></div>
      <div class="cos-authoring-grid"><label>Yard number<input name="yardNumber" value="${attr(data.yardNumber)}"></label><label>Launch date<input name="launchDate" type="date" value="${attr(data.launchDate)}"></label></div>
      <div class="cos-authoring-grid"><label>Maiden voyage<input name="maidenVoyage" type="date" value="${attr(data.maidenVoyage)}"></label><label>Fate<input name="fate" value="${attr(data.fate)}" placeholder="Scrapped, sunk, preserved…"></label></div>
      <div class="cos-authoring-grid"><label>Gross tonnage<input name="grossTonnage" value="${attr(data.grossTonnage)}"></label><label>Length<input name="length" value="${attr(data.length)}"></label></div>
      <div class="cos-authoring-grid"><label>Beam<input name="beam" value="${attr(data.beam)}"></label><label>Service speed<input name="speed" value="${attr(data.speed)}"></label></div>
      <div class="cos-authoring-grid"><label>Status<select name="status">${STATUSES.map((value) => `<option value="${value}"${(record?.status || 'draft') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label>Confidence<select name="confidence">${CONFIDENCE.map((value) => `<option value="${value}"${(record?.metadata?.confidence || 'unknown') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div>
      <label>Tags<input name="tags" value="${attr((record?.tags || []).join(', '))}" placeholder="White Star Line, Olympic class"></label>
      <datalist id="cos-ship-organization-options">${organizations.map((item) => `<option value="${attr(item.id)}">${escapeHtml(item.title || item.id)}</option>`).join('')}</datalist>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">${editing ? 'Save ship' : 'Create ship'}</button></footer>
    </form>
  </dialog>`;
}

export function installShipAuthoring(root, context) {
  const controller = context.controller || new ShipAuthoringController(context.recordService);
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };

  toolbar.insertAdjacentHTML('afterbegin', '<button type="button" data-new-ship>New ship</button>');

  function selectedShip() {
    const id = context.getSelectedId?.();
    const record = id ? context.recordService.get(id) : null;
    return record?.type === 'ship' ? record : null;
  }
  function mount(record = null) {
    root.querySelector('[data-create-ship-dialog], [data-edit-ship-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderShipAuthoringDialog({ records: context.recordService.all(), record }));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-ship]')) {
      mount();
      root.querySelector('[data-create-ship-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-edit-ship]')) {
      const record = selectedShip();
      if (!record) return;
      mount(record);
      root.querySelector('[data-edit-ship-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  root.addEventListener('submit', (event) => {
    const createForm = event.target.closest('[data-create-ship-form]');
    const editForm = event.target.closest('[data-edit-ship-form]');
    if (!createForm && !editForm) return;
    event.preventDefault();
    const form = createForm || editForm;
    const error = form.querySelector('[data-authoring-error]');
    try {
      const saved = createForm
        ? controller.createFromForm(form)
        : controller.updateFromForm(selectedShip()?.id, form);
      createForm ? context.onCreated?.(saved) : context.onUpdated?.(saved);
      form.closest('dialog')?.close();
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  });

  return { refresh: mount, destroy() { root.querySelector('[data-new-ship]')?.remove(); root.querySelector('[data-create-ship-dialog], [data-edit-ship-dialog]')?.remove(); } };
}

function relationship(target, kind, confidence) {
  return { target, relationship: kind, confidence: text(confidence) || 'unknown', sourceIds: [], note: '' };
}
function relationshipTarget(record, kind) { return record?.relationships?.find((item) => item.relationship === kind)?.target || ''; }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '')); }
function splitTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function text(value) { return String(value || '').trim(); }
function attr(value) { return escapeHtml(value || ''); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
