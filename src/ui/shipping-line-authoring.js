import { StructuredRecordAuthoringService } from './structured-record-authoring.js';

const CONFIDENCE = ['unknown', 'tentative', 'probable', 'verified'];
const STATUSES = ['draft', 'review', 'published', 'archived'];

export class ShippingLineAuthoringController {
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
    if (!['company', 'organization'].includes(existing.type)) throw new Error(`${id} is not a shipping line record.`);
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
      type: existing.type || 'company',
      title: text(values.get('title')),
      summary: text(values.get('summary')),
      status: text(values.get('status')) || 'draft',
      tags: splitTags(values.get('tags')),
      data: compact({
        ...(existing.data || {}),
        country: text(values.get('country')),
        headquarters: text(values.get('headquarters')),
        founded: text(values.get('founded')),
        ceased: text(values.get('ceased')),
        parentCompany: text(values.get('parentCompany')),
        successor: text(values.get('successor')),
        routeFocus: text(values.get('routeFocus')),
        houseFlag: text(values.get('houseFlag')),
        notes: text(values.get('lineNotes'))
      }),
      metadata: { confidence: text(values.get('confidence')) || existing.metadata?.confidence || 'unknown' }
    };
  }
}

export function renderShippingLineAuthoringDialog(options = {}) {
  const record = options.record || null;
  const editing = Boolean(record);
  const data = record?.data || {};
  const mode = editing ? 'edit' : 'create';
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-${mode}-shipping-line-dialog>
    <form method="dialog" class="cos-authoring-form" data-${mode}-shipping-line-form>
      <header><div><span class="cos-eyebrow">Shipping line catalog</span><h2>${editing ? 'Edit shipping line' : 'Create shipping line'}</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">${editing ? 'Update the canonical shipping-line record.' : 'Create a canonical shipping-line record for ship relationships and future publication.'}</p>
      <div class="cos-authoring-grid"><label>Permanent ID<input name="id" value="${attr(record?.id)}" placeholder="company.white-star-line" required${editing ? ' readonly' : ''}></label><label>Line name<input name="title" value="${attr(record?.title)}" required></label></div>
      <label>Summary<textarea name="summary" rows="3">${escapeHtml(record?.summary || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Country<input name="country" value="${attr(data.country)}"></label><label>Headquarters<input name="headquarters" value="${attr(data.headquarters)}"></label></div>
      <div class="cos-authoring-grid"><label>Founded<input name="founded" value="${attr(data.founded)}"></label><label>Ceased<input name="ceased" value="${attr(data.ceased)}"></label></div>
      <div class="cos-authoring-grid"><label>Parent company<input name="parentCompany" value="${attr(data.parentCompany)}"></label><label>Successor<input name="successor" value="${attr(data.successor)}"></label></div>
      <div class="cos-authoring-grid"><label>Primary route or trade<input name="routeFocus" value="${attr(data.routeFocus)}"></label><label>House flag description<input name="houseFlag" value="${attr(data.houseFlag)}"></label></div>
      <label>Shipping line notes<textarea name="lineNotes" rows="3">${escapeHtml(data.notes || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Status<select name="status">${STATUSES.map((value) => `<option value="${value}"${(record?.status || 'draft') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label>Confidence<select name="confidence">${CONFIDENCE.map((value) => `<option value="${value}"${(record?.metadata?.confidence || 'unknown') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div>
      <label>Tags<input name="tags" value="${attr((record?.tags || []).join(', '))}" placeholder="Shipping line, Transatlantic"></label>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">${editing ? 'Save shipping line' : 'Create shipping line'}</button></footer>
    </form>
  </dialog>`;
}

export function installShippingLineAuthoring(root, context) {
  const controller = context.controller || new ShippingLineAuthoringController(context.recordService);
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };

  toolbar.insertAdjacentHTML('afterbegin', '<button type="button" data-new-shipping-line>New shipping line</button>');

  function selectedShippingLine() {
    const id = context.getSelectedId?.();
    const record = id ? context.recordService.get(id) : null;
    return record && ['company', 'organization'].includes(record.type) && (record.tags || []).some((tag) => tag.toLowerCase() === 'shipping line') ? record : null;
  }

  function mount(record = null) {
    root.querySelector('[data-create-shipping-line-dialog], [data-edit-shipping-line-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderShippingLineAuthoringDialog({ record }));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-shipping-line]')) {
      mount();
      root.querySelector('[data-create-shipping-line-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-edit-shipping-line]')) {
      const record = selectedShippingLine();
      if (!record) return;
      mount(record);
      root.querySelector('[data-edit-shipping-line-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  root.addEventListener('submit', (event) => {
    const createForm = event.target.closest('[data-create-shipping-line-form]');
    const editForm = event.target.closest('[data-edit-shipping-line-form]');
    if (!createForm && !editForm) return;
    event.preventDefault();
    const form = createForm || editForm;
    const error = form.querySelector('[data-authoring-error]');
    try {
      const saved = createForm ? controller.createFromForm(form) : controller.updateFromForm(selectedShippingLine()?.id, form);
      createForm ? context.onCreated?.(saved) : context.onUpdated?.(saved);
      form.closest('dialog')?.close();
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  });

  return { refresh: mount, destroy() { root.querySelector('[data-new-shipping-line]')?.remove(); root.querySelector('[data-create-shipping-line-dialog], [data-edit-shipping-line-dialog]')?.remove(); } };
}

function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '')); }
function splitTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function text(value) { return String(value || '').trim(); }
function attr(value) { return escapeHtml(value || ''); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
