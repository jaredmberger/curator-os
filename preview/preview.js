import { mountCollectionCatalogShell, RecordService } from '../src/ui/collection-catalog-shell.js';

const seedRecords = [
  {
    id: 'ship.olympic',
    type: 'ship',
    title: 'RMS Olympic',
    summary: 'Lead ship of the Olympic class and a central reference record for the CuratorOS preview.',
    status: 'published',
    tags: ['White Star Line', 'Olympic class'],
    relationships: [{
      target: 'company.white-star-line',
      relationship: 'operated_by',
      confidence: 'verified',
      sourceIds: ['source.builder-records'],
      note: 'Documented in builder and company records.'
    }],
    sources: [{ id: 'source.builder-records', title: 'Builder records', type: 'archive' }],
    media: [],
    notes: [{ body: 'Developer preview seed record.', kind: 'curatorial' }],
    metadata: { confidence: 'verified', reviewed: '2026-07-25' }
  },
  {
    id: 'company.white-star-line',
    type: 'company',
    title: 'White Star Line',
    summary: 'British shipping company associated with the Olympic-class liners.',
    status: 'review',
    tags: ['Shipping line'],
    relationships: [],
    sources: [],
    media: [],
    notes: [],
    metadata: { confidence: 'probable' }
  },
  {
    id: 'source.builder-records',
    type: 'source',
    title: 'Builder records',
    summary: 'Primary shipbuilder documentation used for relationship provenance.',
    status: 'published',
    tags: ['Primary source'],
    relationships: [],
    sources: [],
    media: [],
    notes: [],
    metadata: { confidence: 'verified' }
  }
];

const root = document.querySelector('#curatoros-preview');
const recordService = new RecordService({ seedRecords });
const app = mountCollectionCatalogShell(root, { recordService });

installDataPortability(root, recordService, app);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}

function installDataPortability(rootElement, service, mountedApp) {
  const toolbar = rootElement.querySelector('.cos-toolbar-actions');
  if (!toolbar) return;

  toolbar.insertAdjacentHTML('beforeend', `
    <button type="button" data-export-data>Export</button>
    <button type="button" data-import-data>Import</button>
    <input type="file" accept="application/json,.json" data-import-file hidden>
  `);

  const fileInput = toolbar.querySelector('[data-import-file]');

  toolbar.querySelector('[data-export-data]').addEventListener('click', () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: CuratorDatabase.SCHEMA_VERSION,
      records: service.all()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `curatoros-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  toolbar.querySelector('[data-import-data]').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const records = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(records)) throw new Error('Import file does not contain a records array.');
      CuratorDatabase.assertDatabase(CuratorDatabase.createDatabase(records));
      service.replace(records);
      mountedApp.state.selectedId = null;
      mountedApp.state.editing = false;
      alert(`Imported ${records.length} record${records.length === 1 ? '' : 's'}.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      fileInput.value = '';
    }
  });
}
