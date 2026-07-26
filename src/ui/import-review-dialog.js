import { buildImportPlan, applyImportPlan, summarizeImportPlan } from '../core/import-merge-planner.js';

const GROUPS = [
  ['ship', 'Ships'],
  ['company', 'Companies'],
  ['organization', 'Organizations'],
  ['source', 'Sources'],
  ['object', 'Reference objects'],
  ['photo', 'Photos'],
  ['media', 'Media'],
  ['person', 'People']
];

export function reviewAndApplyImport({ root, recordService, incomingRecords, sourceLabel = 'import', report = {}, onApplied }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'cos-authoring-dialog cos-authoring-dialog-wide';
    dialog.innerHTML = renderDialog(incomingRecords, report, sourceLabel);
    root.appendChild(dialog);

    const form = dialog.querySelector('form');
    const refresh = () => {
      const selectedTypes = [...form.querySelectorAll('[data-import-type]:checked')].map((input) => input.value);
      const mode = form.elements.mode.value;
      const resolution = form.elements.resolution.value;
      const plan = buildImportPlan(recordService.all(), incomingRecords, { selectedTypes, resolution });
      const summary = summarizeImportPlan(plan);
      dialog.querySelector('[data-plan-summary]').textContent = mode === 'replace'
        ? `${plan.add.length + plan.identical.length + plan.conflicts.length} selected records will replace the local database.`
        : `${summary.added} new · ${summary.identical} identical · ${summary.conflicts} conflicts`;
      dialog.querySelector('[data-conflict-controls]').hidden = mode !== 'merge';
      return { plan, mode, selectedTypes, resolution };
    };

    form.addEventListener('change', refresh);
    dialog.querySelector('[data-cancel]').addEventListener('click', () => close(false));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const { plan, mode, selectedTypes, resolution } = refresh();
      if (!selectedTypes.length) return alert('Select at least one record type.');
      const selected = incomingRecords.filter((record) => selectedTypes.includes(record.type));
      const nextRecords = mode === 'replace' ? selected : applyImportPlan(recordService.all(), plan);
      const database = CuratorDatabase.createDatabase(nextRecords);
      CuratorDatabase.assertDatabase(database);
      const summary = summarizeImportPlan(plan);
      const confirmation = mode === 'replace'
        ? `Replace the current ${recordService.all().length}-record database with ${selected.length} reviewed records?`
        : `Merge ${summary.added} new records with ${summary.conflicts} conflict${summary.conflicts === 1 ? '' : 's'} resolved as “${resolution}”?`;
      if (!confirm(confirmation)) return;

      const existing = recordService.all();
      localStorage.setItem('curatoros.snapshot.before-import', JSON.stringify({ createdAt: new Date().toISOString(), schemaVersion: CuratorDatabase.SCHEMA_VERSION, records: existing }));
      downloadJson({ exportedAt: new Date().toISOString(), schemaVersion: CuratorDatabase.SCHEMA_VERSION, records: existing }, `curatoros-pre-import-backup-${dateStamp()}.json`);
      downloadJson({ sourceLabel, mode, selectedTypes, resolution, report, planSummary: summary }, `curatoros-reviewed-import-plan-${dateStamp()}.json`);
      recordService.replace(nextRecords);
      onApplied?.();
      close({ mode, count: nextRecords.length, summary });
    });

    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(false); });
    dialog.showModal();
    refresh();

    function close(result) {
      dialog.close();
      dialog.remove();
      resolve(result);
    }
  });
}

function renderDialog(records, report, sourceLabel) {
  const counts = new Map();
  records.forEach((record) => counts.set(record.type, (counts.get(record.type) || 0) + 1));
  const groups = GROUPS.filter(([type]) => counts.has(type)).map(([type, label]) => `<label><input type="checkbox" value="${type}" data-import-type checked> ${label} <span>${counts.get(type)}</span></label>`).join('');
  const warnings = report.warnings?.length || 0;
  const skipped = report.skipped?.length || 0;
  const duplicates = report.duplicates?.length || 0;
  const errors = report.errors?.length || report.fetchErrors?.length || 0;
  return `<form method="dialog" class="cos-authoring-form">
    <header><div><span class="cos-eyebrow">Reviewed import</span><h2>${escapeHtml(sourceLabel)}</h2><p>${records.length} converted records · ${warnings} warnings · ${skipped} skipped · ${duplicates} duplicates · ${errors} errors</p></div><button type="button" data-cancel aria-label="Close">×</button></header>
    <section class="cos-structured-section"><div class="cos-structured-heading"><h3>Include record groups</h3></div><div class="cos-import-type-grid">${groups}</div></section>
    <section class="cos-structured-section"><div class="cos-structured-heading"><h3>Import mode</h3></div><label><input type="radio" name="mode" value="merge" checked> Merge with local catalog</label><label><input type="radio" name="mode" value="replace"> Replace local database</label></section>
    <section class="cos-structured-section" data-conflict-controls><div class="cos-structured-heading"><h3>Conflict handling</h3></div><label><select name="resolution"><option value="keep-local">Keep local record</option><option value="use-incoming">Use incoming record</option><option value="skip">Skip conflicting record</option></select></label><p class="cos-authoring-help">Conflicting records are never overwritten silently.</p></section>
    <section class="cos-structured-section"><div class="cos-structured-heading"><h3>Planned result</h3></div><p data-plan-summary class="cos-authoring-help"></p></section>
    <footer><button type="button" data-cancel>Cancel</button><button type="submit">Apply reviewed import</button></footer>
  </form>`;
}

function downloadJson(payload, filename) { const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function dateStamp() { return new Date().toISOString().slice(0, 10); }
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
