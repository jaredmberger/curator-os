import { StructuredRecordAuthoringService } from './structured-record-authoring.js';

const CONFIDENCE = ['unknown', 'tentative', 'probable', 'verified'];
const STATUSES = ['draft', 'review', 'published', 'archived'];

export class BuilderAuthoringController {
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
    if (!['company', 'organization'].includes(existing.type)) throw new Error(`${id} is not a builder record.`);
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
        city: text(values.get('city')),
        country: text(values.get('country')),
        founded: text(values.get('founded')),
        closed: text(values.get('closed')),
        yard: text(values.get('yard')),
        parentCompany: text(values.get('parentCompany')),
        notes: text(values.get('builderNotes'))
      }),
      metadata: { confidence: text(values.get('confidence')) || existing.metadata?.confidence || 'unknown' }
    };
  }
}

export function renderBuilderAuthoringDialog(options = {}) {
  const record = options.record || null;
  const editing = Boolean(record);
  const data = record?.data || {};
  const mode = editing ? 'edit' : 'create';
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-${mode}-builder-dialog>
    <form method="dialog" class="cos-authoring-form" data-${mode}-builder-form>
      <header><div><span class="cos-eyebrow">Builder catalog</span><h2>${editing ? 'Edit builder' : 'Create builder'}</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">${editing ? 'Update the canonical shipbuilder record.' : 'Create a canonical shipbuilder record for use in ship relationships.'}</p>
      <div class="cos-authoring-grid"><label>Permanent ID<input name="id" value="${attr(record?.id)}" placeholder="company.harland-wolff" required${editing ? ' readonly' : ''}></label><label>Builder name<input name="title" value="${attr(record?.title)}" required></label></div>
      <label>Summary<textarea name="summary" rows="3">${escapeHtml(record?.summary || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>City<input name="city" value="${attr(data.city)}"></label><label>Country<input name="country" value="${attr(data.country)}"></label></div>
      <div class="cos-authoring-grid"><label>Founded<input name="founded" value="${attr(data.founded)}"></label><label>Closed<input name="closed" value="${attr(data.closed)}"></label></div>
      <div class="cos-authoring-grid"><label>Primary yard<input name="yard" value="${attr(data.yard)}"></label><label>Parent company<input name="parentCompany" value="${attr(data.parentCompany)}"></label></div>
      <label>Builder notes<textarea name="builderNotes" rows="3">${escapeHtml(data.notes || '')}</textarea></label>
      <div class="cos-authoring-grid"><label>Status<select name="status">${STATUSES.map((value) => `<option value="${value}"${(record?.status || 'draft') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label>Confidence<select name="confidence">${CONFIDENCE.map((value) => `<option value="${value}"${(record?.metadata?.confidence || 'unknown') === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div>
      <label>Tags<input name="tags" value="${attr((record?.tags || []).join(', '))}" placeholder="Shipbuilder, Belfast"></label>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">${editing ? 'Save builder' : 'Create builder'}</button></footer>
    </form>
  </dialog>`;
}

export function installBuilderAuthoring(root, context) {
  const controller = context.controller || new BuilderAuthoringController(context.recordService);
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };

  toolbar.insertAdjacentHTML('afterbegin', '<button type="button" data-new-builder>New builder</button>');

  function selectedBuilder() {
    const id = context.getSelectedId?.();
    const record = id ? context.recordService.get(id) : null;
    return record && ['company', 'organization'].includes(record.type) && (record.tags || []).some((tag) => tag.toLowerCase() === 'shipbuilder') ? record : null;
  }

  function mount(record = null) {
    root.querySelector('[data-create-builder-dialog], [data-edit-builder-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderBuilderAuthoringDialog({ record }));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-builder]')) {
      mount();
      root.querySelector('[data-create-builder-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-edit-builder]')) {
      const record = selectedBuilder();
      if (!record) return;
      mount(record);
      root.querySelector('[data-edit-builder-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  root.addEventListener('submit', (event) => {
    const createForm = event.target.closest('[data-create-builder-form]');
    const editForm = event.target.closest('[data-edit-builder-form]');
    if (!createForm && !editForm) return;
    event.preventDefault();
    const form = createForm || editForm;
    const error = form.querySelector('[data-authoring-error]');
    try {
      const saved = createForm ? controller.createFromForm(form) : controller.updateFromForm(selectedBuilder()?.id, form);
      createForm ? context.onCreated?.(saved) : context.onUpdated?.(saved);
      form.closest('dialog')?.close();
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  });

  return { refresh: mount, destroy() { root.querySelector('[data-new-builder]')?.remove(); root.querySelector('[data-create-builder-dialog], [data-edit-builder-dialog]')?.remove(); } };
}

function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '')); }
function splitTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function text(value) { return String(value || '').trim(); }
function attr(value) { return escapeHtml(value || ''); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
