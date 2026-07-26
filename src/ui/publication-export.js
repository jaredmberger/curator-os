import { assessPublicationReadiness, buildPublicationPreview } from './publication-preview.js';

const EXPORTABLE_TYPES = new Set(['ship', 'company', 'organization']);

export function buildPublicationPayload(record = {}, records = []) {
  if (!record?.id) throw new Error('A canonical record is required.');
  if (!EXPORTABLE_TYPES.has(record.type)) throw new Error(`${record.type || 'Unknown'} records are not supported by the publication exporter.`);

  const readiness = assessPublicationReadiness(record);
  if (!readiness.ready) throw new Error(`Publication is blocked: ${readiness.blockers.join('; ')}`);

  const preview = buildPublicationPreview(record, records);
  const byId = new Map(records.map((item) => [item.id, item]));
  const relationships = (record.relationships || []).map((relationship) => ({
    relationship: relationship.relationship || 'related_to',
    confidence: relationship.confidence || 'unknown',
    target: relationship.target,
    targetTitle: byId.get(relationship.target)?.title || relationship.target,
    sourceIds: [...(relationship.sourceIds || [])],
    note: relationship.note || ''
  }));

  return {
    format: 'curatoros-publication-record',
    formatVersion: 1,
    record: {
      id: record.id,
      type: publicationType(record),
      title: record.title,
      summary: record.summary,
      status: record.status,
      confidence: record.metadata?.confidence || 'unknown',
      reviewed: record.metadata?.reviewed || null,
      tags: [...(record.tags || [])],
      details: Object.fromEntries(preview.details),
      relationships,
      sources: preview.sources.map((source) => ({
        id: source.id,
        title: source.title || source.id,
        type: source.type || source.data?.sourceType || 'source',
        citation: source.data?.citation || '',
        url: source.data?.url || ''
      }))
    },
    structuredData: buildStructuredData(record, preview, relationships),
    readiness
  };
}

export function buildPublicationPackage(records = []) {
  const eligible = records.filter((record) => EXPORTABLE_TYPES.has(record.type));
  const ready = [];
  const blocked = [];

  eligible.forEach((record) => {
    const readiness = assessPublicationReadiness(record);
    if (!readiness.ready) {
      blocked.push({ id: record.id, title: record.title, blockers: readiness.blockers, warnings: readiness.warnings });
      return;
    }
    ready.push(buildPublicationPayload(record, records));
  });

  return {
    format: 'curatoros-publication-package',
    formatVersion: 1,
    records: ready,
    blocked,
    summary: { eligible: eligible.length, exported: ready.length, blocked: blocked.length }
  };
}

export function renderPublicationExportDialog(records = [], selectedId = null) {
  const selected = selectedId ? records.find((record) => record.id === selectedId) : null;
  const selectedSupported = selected && EXPORTABLE_TYPES.has(selected.type);
  const packageSummary = buildPublicationPackage(records).summary;
  return `<dialog class="cos-authoring-dialog cos-authoring-dialog-wide" data-publication-export-dialog>
    <div class="cos-authoring-form cos-publication-export">
      <header><div><span class="cos-eyebrow">Publication workspace</span><h2>Export publication data</h2></div><button type="button" data-close-dialog aria-label="Close">×</button></header>
      <p class="cos-authoring-help">Generate provider-neutral JSON from canonical records. No site files are changed and nothing is deployed.</p>
      <section><h3>Selected record</h3><p>${selectedSupported ? `${escapeHtml(selected.title)} can be exported after readiness validation.` : 'Select a ship, builder, or shipping line to export one record.'}</p><button type="button" data-export-selected-publication${selectedSupported ? '' : ' disabled'}>Export selected JSON</button></section>
      <section><h3>Batch package</h3><p>${packageSummary.exported} ready · ${packageSummary.blocked} blocked · ${packageSummary.eligible} eligible</p><button type="button" data-export-publication-package${packageSummary.exported ? '' : ' disabled'}>Export ready records</button></section>
      <footer><button type="button" data-close-dialog>Close</button></footer>
    </div>
  </dialog>`;
}

export function installPublicationExport(root, context) {
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return { destroy() {} };
  toolbar.insertAdjacentHTML('beforeend', '<button type="button" data-open-publication-export>Publish export</button>');

  function mount() {
    root.querySelector('[data-publication-export-dialog]')?.remove();
    root.insertAdjacentHTML('beforeend', renderPublicationExportDialog(context.recordService.all(), context.getSelectedId?.()));
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-publication-export]')) {
      mount();
      root.querySelector('[data-publication-export-dialog]')?.showModal();
      return;
    }
    if (event.target.closest('[data-export-selected-publication]')) {
      const id = context.getSelectedId?.();
      const record = id ? context.recordService.get(id) : null;
      try {
        downloadJson(buildPublicationPayload(record, context.recordService.all()), `${safeName(record?.id || 'publication')}.publication.json`);
      } catch (error) {
        alert(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (event.target.closest('[data-export-publication-package]')) {
      const payload = buildPublicationPackage(context.recordService.all());
      downloadJson(payload, 'curatoros-publication-package.json');
      return;
    }
    if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog')?.close();
  });

  return { destroy() { root.querySelector('[data-open-publication-export]')?.remove(); root.querySelector('[data-publication-export-dialog]')?.remove(); } };
}

function buildStructuredData(record, preview, relationships) {
  const common = {
    '@context': 'https://schema.org',
    '@id': record.id,
    name: record.title,
    description: record.summary
  };
  if (record.type === 'ship') {
    return {
      ...common,
      '@type': 'Vehicle',
      vehicleType: 'Ocean liner',
      manufacturer: relationshipName(relationships, 'built_by'),
      provider: relationshipName(relationships, 'operated_by')
    };
  }
  return {
    ...common,
    '@type': 'Organization',
    foundingDate: record.data?.founded || undefined,
    location: record.data?.headquarters || record.data?.city || undefined,
    additionalProperty: preview.details.map(([name, value]) => ({ '@type': 'PropertyValue', name, value }))
  };
}

function relationshipName(relationships, kind) { return relationships.find((item) => item.relationship === kind)?.targetTitle || undefined; }
function publicationType(record) { if (record.type === 'ship') return 'ship'; return (record.tags || []).some((tag) => tag.toLowerCase() === 'shipbuilder') ? 'builder' : 'shipping-line'; }
function safeName(value) { return String(value).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase(); }
function downloadJson(payload, filename) { const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function escapeHtml(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
