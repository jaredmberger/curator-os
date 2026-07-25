import { mountCollectionCatalogShell, RecordService } from '../src/ui/collection-catalog-shell.js';
import { LocalMockSyncProvider } from '../src/core/mock-sync-provider.js';
import { installSyncStatus } from '../src/ui/sync-status.js';

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
installSyncStatus(root, {
  recordService,
  provider: new LocalMockSyncProvider()
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}

function installDataPortability(rootElement, service, mountedApp) {
  const toolbar = rootElement.querySelector('.cos-toolbar-actions');
  if (!toolbar) return;

  toolbar.insertAdjacentHTML('beforeend', `
    <button type="button" data-export-data>Export</button>
    <button type="button" data-import-data>Import</button>
    <button type="button" data-create-snapshot>Snapshot</button>
    <button type="button" data-restore-snapshot>Restore</button>
    <input type="file" accept="application/json,.json" data-import-file hidden>
  `);

  const fileInput = toolbar.querySelector('[data-import-file]');

  toolbar.querySelector('[data-export-data]').addEventListener('click', () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: CuratorDatabase.SCHEMA_VERSION,
      records: service.all()
    };
    downloadJson(payload, `curatoros-export-${new Date().toISOString().slice(0, 10)}.json`);
  });

  toolbar.querySelector('[data-import-data]').addEventListener('click', () => fileInput.click());

  toolbar.querySelector('[data-create-snapshot]').addEventListener('click', () => {
    const snapshot = {
      createdAt: new Date().toISOString(),
      schemaVersion: CuratorDatabase.SCHEMA_VERSION,
      records: service.all()
    };
    localStorage.setItem('curatoros.snapshot.latest', JSON.stringify(snapshot));
    alert(`Saved local snapshot with ${snapshot.records.length} record${snapshot.records.length === 1 ? '' : 's'}.`);
  });

  toolbar.querySelector('[data-restore-snapshot]').addEventListener('click', () => {
    const stored = localStorage.getItem('curatoros.snapshot.latest');
    if (!stored) return alert('No local snapshot is available.');
    try {
      const snapshot = JSON.parse(stored);
      const records = snapshot.records;
      if (!Array.isArray(records)) throw new Error('Stored snapshot does not contain a records array.');
      CuratorDatabase.assertDatabase(CuratorDatabase.createDatabase(records));
      const confirmed = confirm(`Restore the snapshot from ${formatDate(snapshot.createdAt)}? This will replace the current local database.`);
      if (!confirmed) return;
      service.replace(records);
      resetMountedState(mountedApp);
      alert(`Restored ${records.length} record${records.length === 1 ? '' : 's'} from the local snapshot.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  });

  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const records = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(records)) throw new Error('Import file does not contain a records array.');
      CuratorDatabase.assertDatabase(CuratorDatabase.createDatabase(records));

      const existingCount = service.all().length;
      const confirmed = confirm(`Import ${records.length} record${records.length === 1 ? '' : 's'} and replace the current ${existingCount}-record local database?`);
      if (!confirmed) return;

      localStorage.setItem('curatoros.snapshot.before-import', JSON.stringify({
        createdAt: new Date().toISOString(),
        schemaVersion: CuratorDatabase.SCHEMA_VERSION,
        records: service.all()
      }));
      service.replace(records);
      resetMountedState(mountedApp);
      alert(`Imported ${records.length} record${records.length === 1 ? '' : 's'}. A pre-import snapshot was saved locally.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      fileInput.value = '';
    }
  });
}

function resetMountedState(mountedApp) {
  mountedApp.state.selectedId = null;
  mountedApp.state.editing = false;
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'an unknown date' : date.toLocaleString();
}
