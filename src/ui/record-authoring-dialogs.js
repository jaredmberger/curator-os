import { StructuredRecordAuthoringService } from './structured-record-authoring.js';

const TYPES = ['ship', 'company', 'organization', 'person', 'object', 'photo', 'source'];
const CONFIDENCE = ['unknown', 'tentative', 'probable', 'verified'];

export class RecordAuthoringController {
  constructor(recordService, options = {}) {
    if (!recordService) throw new Error('RecordService is required.');
    this.recordService = recordService;
    this.authoringService = options.authoringService || new StructuredRecordAuthoringService(recordService);
  }

  createFromForm(form) {
    const values = new FormData(form);
    return this.authoringService.createRecord({
      id: text(values.get('id')),
      type: text(values.get('type')),
      title: text(values.get('title')),
      summary: text(values.get('summary')),
      status: text(values.get('status')) || 'draft',
      tags: splitTags(values.get('tags')),
      metadata: { confidence: text(values.get('confidence')) || 'unknown' }
    });
  }

  updateStructuredFromForm(id, form) {
    const relationships = rows(form, 'relationship').map((row) => ({
      target: text(row.querySelector('[name="relationship.target"]')?.value),
      relationship: text(row.querySelector('[name="relationship.kind"]')?.value),
      confidence: text(row.querySelector('[name="relationship.confidence"]')?.value) || 'unknown',
      sourceIds: splitTags(row.querySelector('[name="relationship.sourceIds"]')?.value),
      note: text(row.querySelector('[name="relationship.note"]')?.value)
    }));
    const sources = rows(form, 'source').map((row) => ({
      id: text(row.querySelector('[name="source.id"]')?.value),
      title: text(row.querySelector('[name="source.title"]')?.value),
      type: text(row.querySelector('[name="source.type"]')?.value),
      date: text(row.querySelector('[name="source.date"]')?.value),
      url: text(row.querySelector('[name="source.url"]')?.value),
      note: text(row.querySelector('[name="source.note"]')?.value)
    }));
    const media = rows(form, 'media').map((row) => ({
      id: text(row.querySelector('[name="media.id"]')?.value),
      title: text(row.querySelector('[name="media.title"]')?.value),
      type: text(row.querySelector('[name="media.type"]')?.value),
      url: text(row.querySelector('[name="media.url"]')?.value),
      alt: text(row.querySelector('[name="media.alt"]')?.value),
      note: text(row.querySelector('[name="media.note"]')?.value)
    }));
    const notes = rows(form, 'note').map((row) => ({
      body: text(row.querySelector('[name="note.body"]')?.value),
      kind: text(row.querySelector('[name="note.kind"]')?.value) || 'curatorial',
      author: text(row.querySelector('[name="note.author"]')?.value),
      created: text(row.querySelector('[name="note.created"]')?.value) || new Date().toISOString()
    }));

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
        <label>Confidence<select name="confidence">${CONFIDENCE.map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label>
      </div>
      <label>Tags<input name="tags" placeholder="comma separated"></label>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">Create record</button></footer>
    </form>
  </dialog>`;
}

export function renderStructuredAuthoringDialog(record, options = {}) {
  if (!record) return '';
  const records = Array.isArray(options.records) ? options.records : [];
  const sourceRecords = records.filter((item) => item.type === 'source');
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-structured-record-dialog>
    <form method="dialog" class="cos-authoring-form" data-structured-record-form>
      <header><div><span class="cos-eyebrow">Structured authoring</span><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.id)}</p></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">Add and edit canonical relationships, sources, media, and notes through guided fields. Empty rows are ignored.</p>
      ${renderSection('Relationships', 'relationship', record.relationships || [], (value) => renderRelationshipRow(value, records, sourceRecords))}
      ${renderSection('Sources', 'source', record.sources || [], renderSourceRow)}
      ${renderSection('Media', 'media', record.media || [], renderMediaRow)}
      ${renderSection('Notes', 'note', record.notes || [], renderNoteRow)}
      <datalist id="cos-record-options">${records.map((item) => `<option value="${attr(item.id)}">${escapeHtml(item.title || item.id)}</option>`).join('')}</datalist>
      <datalist id="cos-source-options">${sourceRecords.map((item) => `<option value="${attr(item.id)}">${escapeHtml(item.title || item.id)}</option>`).join('')}</datalist>
      <p class="cos-form-error" data-authoring-error hidden></p>
      <footer><button type="button" data-close-dialog>Cancel</button><button type="submit">Save structured data</button></footer>
    </form>
  </dialog>`;
}

export function installRecordAuthoringDialogs(root, context) {
  const controller = context.controller || new RecordAuthoringController(context.recordService);
  let selectedId = context.selectedId || null;

  function currentRecord() { return context.recordService.get(selectedId); }
  function mountDialogs() {
    root.querySelectorAll('[data-create-record-dialog], [data-structured-record-dialog]').forEach((dialog) => dialog.remove());
    root.insertAdjacentHTML('beforeend', renderCreateRecordDialog());
    const record = currentRecord();
    if (record) root.insertAdjacentHTML('beforeend', renderStructuredAuthoringDialog(record, { records: context.recordService.all() }));
  }
  function show(selector) { mountDialogs(); root.querySelector(selector)?.showModal(); }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-record]')) return show('[data-create-record-dialog]');
    if (event.target.closest('[data-edit-structured]') && currentRecord()) return show('[data-structured-record-dialog]');
    const add = event.target.closest('[data-add-row]');
    if (add) {
      const section = add.closest('[data-structured-section]');
      const type = add.dataset.addRow;
      section.querySelector('[data-row-list]').insertAdjacentHTML('beforeend', rowRenderer(type)({}, context.recordService.all()));
      return;
    }
    const remove = event.target.closest('[data-remove-row]');
    if (remove) { remove.closest('[data-structured-row]')?.remove(); return; }
    const appendSource = event.target.closest('[data-append-source]');
    if (appendSource) {
      const row = appendSource.closest('[data-structured-row="relationship"]');
      const picker = row?.querySelector('[data-source-picker]');
      const input = row?.querySelector('[name="relationship.sourceIds"]');
      const selected = text(picker?.value);
      if (selected && input) {
        input.value = [...new Set([...splitTags(input.value), selected])].join(', ');
        picker.value = '';
      }
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
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

function renderSection(title, type, values, renderer) {
  const rowsHtml = values.length ? values.map(renderer).join('') : renderer({});
  return `<section class="cos-structured-section" data-structured-section>
    <div class="cos-structured-heading"><h3>${title}</h3><button type="button" data-add-row="${type}">Add ${type}</button></div>
    <div class="cos-structured-rows" data-row-list>${rowsHtml}</div>
  </section>`;
}

function renderRelationshipRow(value = {}, records = [], sourceRecords = records.filter((item) => item.type === 'source')) {
  return row('relationship', `
    <div class="cos-authoring-grid"><label>Target record ID<input name="relationship.target" list="cos-record-options" value="${attr(value.target)}" placeholder="Start typing a record ID"></label><label>Relationship<input name="relationship.kind" value="${attr(value.relationship)}" placeholder="operated_by"></label></div>
    <div class="cos-authoring-grid"><label>Confidence<select name="relationship.confidence">${confidenceOptions(value.confidence)}</select></label><label>Source IDs<input name="relationship.sourceIds" list="cos-source-options" value="${attr((value.sourceIds || []).join(', '))}" placeholder="source.one, source.two"></label></div>
    <div class="cos-source-assist"><label>Attach source<select data-source-picker><option value="">Choose a source record</option>${sourceRecords.map((item) => `<option value="${attr(item.id)}">${escapeHtml(item.title || item.id)}</option>`).join('')}</select></label><button type="button" data-append-source>Add source ID</button></div>
    <label>Note<textarea name="relationship.note" rows="2">${escapeHtml(value.note || '')}</textarea></label>`);
}
function renderSourceRow(value = {}) {
  return row('source', `<div class="cos-authoring-grid"><label>Source ID<input name="source.id" value="${attr(value.id)}"></label><label>Title<input name="source.title" value="${attr(value.title)}"></label></div><div class="cos-authoring-grid"><label>Type<input name="source.type" value="${attr(value.type)}"></label><label>Date<input name="source.date" value="${attr(value.date)}"></label></div><label>URL<input name="source.url" type="url" value="${attr(value.url)}"></label><label>Note<textarea name="source.note" rows="2">${escapeHtml(value.note || '')}</textarea></label>`);
}
function renderMediaRow(value = {}) {
  return row('media', `<div class="cos-authoring-grid"><label>Media ID<input name="media.id" value="${attr(value.id)}"></label><label>Title<input name="media.title" value="${attr(value.title)}"></label></div><div class="cos-authoring-grid"><label>Type<input name="media.type" value="${attr(value.type)}"></label><label>URL<input name="media.url" type="url" value="${attr(value.url)}"></label></div><label>Alt text<input name="media.alt" value="${attr(value.alt)}"></label><label>Note<textarea name="media.note" rows="2">${escapeHtml(value.note || '')}</textarea></label>`);
}
function renderNoteRow(value = {}) {
  return row('note', `<label>Note<textarea name="note.body" rows="3">${escapeHtml(value.body || '')}</textarea></label><div class="cos-authoring-grid"><label>Kind<input name="note.kind" value="${attr(value.kind || 'curatorial')}"></label><label>Author<input name="note.author" value="${attr(value.author)}"></label></div><label>Created<input name="note.created" value="${attr(value.created)}" placeholder="ISO date"></label>`);
}
function row(type, fields) { return `<article class="cos-structured-row" data-structured-row="${type}">${fields}<button class="cos-remove-row" type="button" data-remove-row>Remove</button></article>`; }
function rowRenderer(type) { return ({ relationship: renderRelationshipRow, source: renderSourceRow, media: renderMediaRow, note: renderNoteRow })[type]; }
function rows(form, type) { return [...form.querySelectorAll(`[data-structured-row="${type}"]`)].filter((row) => [...row.querySelectorAll('input, textarea, select')].some((field) => text(field.value) && !['unknown', 'curatorial'].includes(text(field.value)))); }
function confidenceOptions(selected = 'unknown') { return CONFIDENCE.map((value) => `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`).join(''); }
function splitTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function text(value) { return String(value || '').trim(); }
function attr(value) { return escapeHtml(value || ''); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
