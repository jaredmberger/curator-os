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
    const builder = text(values.get('builder'));
    const operator = text(values.get('operator'));
    const relationships = [
      builder ? relationship(builder, 'built_by', values.get('confidence')) : null,
      operator ? relationship(operator, 'operated_by', values.get('confidence')) : null
    ].filter(Boolean);

    return this.authoringService.createRecord({
      id: text(values.get('id')),
      type: 'ship',
      title: text(values.get('title')),
      summary: text(values.get('summary')),
      status: text(values.get('status')) || 'draft',
      tags: splitTags(values.get('tags')),
      relationships,
      data: compact({
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
      metadata: { confidence: text(values.get('confidence')) || 'unknown' }
    });
  }
}

export function renderShipAuthoringDialog(options = {}) {
  const records = Array.isArray(options.records) ? options.records : [];
  const organizations = records.filter((record) => ['company', 'organization'].includes(record.type));
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-create-ship-dialog>
    <form method="dialog" class="cos-authoring-form" data-create-ship-form>
      <header><div><span class="cos-eyebrow">Ship catalog</span><h2>Create ship</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">Create a canonical ship record and automatically link its builder and operator.</p>
      <div class="cos-authoring-grid"><label>Permanent ID<input name="id" placeholder="ship.rms-olympic" required></label><label>Ship name<input name="title" required></label></div>
      <label>Summary<textarea name="summary" rows="3"></textarea></label>
      <div class="cos-authoring-grid"><label>Builder record<input name="builder" list="cos-ship-organization-options" placeholder="company.harland-wolff"></label><label>Operator record<input name="operator" list="cos-ship-organization-options" placeholder="company.white-star-line"></label></div>
      <div class="cos-authoring-grid"><label>Yard number<input name="yardNumber"></label><label>Launch date<input name="launchDate" type="date"></label></div>
      <div class="cos-authoring-grid"><label>Maiden voyage<input name="maidenVoyage" type="date"></label><label>Fate<input name="fate" placeholder="Scrapped, sunk, preserved…"></label></div>
      <div class="cos-authoring-grid"><label>Gross tonnage<input name="grossTonnage"></label><label>Length<input name="length"></label></div>
      <div class="cos-authoring-grid"><label>Beam<input name="beam"></label><label>Service speed<input name="speed"></label></div>
      <div class="cos-authoring-grid"><label>Status<select name="status">${STATUSES.map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label><label>Confidence<select name="confidence">${CONFIDENCE.map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label></div>
      <label>Tags<input name="tags" placeholder="White Star Line, Olympic class"></label>
      <datalist id="cos-ship-organization-options">${organizations.map((record) => `<option value="${attr(record.id)}">${escapeHtml(record.title || record.id)}</option>`).join('')}</datalist>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">Create ship</button></footer>
    </form>
  </dialog>`;
}

export function installShipAuthoring(root, context) {
  const controller = context.controller || new ShipAuthoringController(context.recordService);
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { refresh() {}, destroy() {} };

  toolbar.insertAdjacentHTML('afterbegin', '<button type="button" data-new-ship>New ship</button>');

  function mount() {
    root.querySelector('[data-create-ship-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderShipAuthoringDialog({ records: context.recordService.all() }));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-ship]')) {
      mount();
      root.querySelector('[data-create-ship-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  root.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-create-ship-form]');
    if (!form) return;
    event.preventDefault();
    const error = form.querySelector('[data-authoring-error]');
    try {
      const created = controller.createFromForm(form);
      context.onCreated?.(created);
      form.closest('dialog')?.close();
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : String(caught);
    }
  });

  return { refresh: mount, destroy() { root.querySelector('[data-new-ship]')?.remove(); root.querySelector('[data-create-ship-dialog]')?.remove(); } };
}

function relationship(target, kind, confidence) {
  return { target, relationship: kind, confidence: text(confidence) || 'unknown', sourceIds: [], note: '' };
}
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '')); }
function splitTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function text(value) { return String(value || '').trim(); }
function attr(value) { return escapeHtml(value || ''); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
