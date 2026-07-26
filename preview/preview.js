import { mountCollectionCatalogShell, RecordService } from '../src/ui/collection-catalog-shell.js';
import { LocalMockSyncProvider } from '../src/core/mock-sync-provider.js';
import { installSyncStatus } from '../src/ui/sync-status.js';
import { installShipAuthoring } from '../src/ui/ship-authoring.js';
import { installBuilderAuthoring } from '../src/ui/builder-authoring.js';
import { installShippingLineAuthoring } from '../src/ui/shipping-line-authoring.js';
import { installSourceAuthoring } from '../src/ui/source-authoring.js';
import { installReferenceObjectAuthoring } from '../src/ui/reference-object-authoring.js';
import { installPhotoMediaAuthoring } from '../src/ui/photo-media-authoring.js';
import { installReviewDashboard } from '../src/ui/review-dashboard.js';

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
    data: {
      builder: 'company.harland-wolff',
      operator: 'company.white-star-line',
      yardNumber: '400',
      launchDate: '1910-10-20',
      maidenVoyage: '1911-06-14',
      grossTonnage: '45,324 GRT',
      length: '882 ft 9 in',
      beam: '92 ft 6 in',
      speed: '21 knots'
    },
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
    data: {
      country: 'United Kingdom',
      headquarters: 'Liverpool',
      founded: '1845',
      ceased: '1934',
      parentCompany: 'International Mercantile Marine Company',
      successor: 'Cunard-White Star Line',
      routeFocus: 'North Atlantic passenger service',
      houseFlag: 'Red swallowtail with a white star'
    },
    metadata: { confidence: 'probable' }
  },
  {
    id: 'company.harland-wolff',
    type: 'company',
    title: 'Harland and Wolff',
    summary: 'Belfast shipbuilder associated with many White Star Line vessels.',
    status: 'review',
    tags: ['Shipbuilder'],
    relationships: [],
    sources: [],
    media: [],
    notes: [],
    data: {
      city: 'Belfast',
      country: 'United Kingdom',
      founded: '1861',
      yard: 'Queen’s Island'
    },
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
    data: {
      creator: 'Harland and Wolff',
      publisher: 'Builder archive',
      sourceType: 'archive',
      date: '1910',
      identifier: 'Yard no. 400',
      citation: 'Harland and Wolff builder records for yard number 400.',
      rights: 'Reference use only.'
    },
    metadata: { confidence: 'verified' }
  },
  {
    id: 'object.olympic-menu-1929',
    type: 'object',
    title: 'RMS Olympic Breakfast Menu',
    summary: 'Breakfast menu dated 2 June 1929 from RMS Olympic.',
    status: 'review',
    tags: ['Reference object', 'Menu', 'RMS Olympic'],
    relationships: [{
      target: 'ship.olympic',
      relationship: 'associated_with',
      confidence: 'verified',
      sourceIds: [],
      note: ''
    }],
    sources: [],
    media: [],
    notes: [],
    data: {
      category: 'menu',
      associatedRecord: 'ship.olympic',
      date: '1929-06-02',
      dimensions: '4-3/4 × 7-1/4 in',
      material: 'paper',
      condition: 'mint',
      storageLocation: 'Archive box A',
      curatorNotes: 'Reference Object RO-0001.'
    },
    metadata: { confidence: 'verified' }
  },
  {
    id: 'photo.olympic-profile',
    type: 'photo',
    title: 'RMS Olympic profile view',
    summary: 'A cataloged photographic reference showing RMS Olympic in profile.',
    status: 'review',
    tags: ['Photographic reference', 'RMS Olympic'],
    relationships: [
      { target: 'ship.olympic', relationship: 'depicts', confidence: 'probable', sourceIds: [], note: '' },
      { target: 'source.builder-records', relationship: 'sourced_from', confidence: 'probable', sourceIds: [], note: '' }
    ],
    sources: [],
    media: [],
    notes: [],
    data: {
      mediaType: 'photograph',
      date: '1911',
      creator: 'Unknown photographer',
      depictedSubject: 'ship.olympic',
      sourceRecord: 'source.builder-records',
      caption: 'RMS Olympic in profile.',
      altText: 'RMS Olympic seen in profile at sea',
      rights: 'Reference use only.',
      attribution: 'Ocean Liner Curator photographic reference.'
    },
    metadata: { confidence: 'probable' }
  }
];

const root = document.querySelector('#curatoros-preview');
const recordService = new RecordService({ seedRecords });
const app = mountCollectionCatalogShell(root, { recordService });

const authoringContext = {
  recordService,
  getSelectedId() { return app.state.selectedId; },
  onCreated(created) {
    app.state.selectedId = created.id;
    app.state.editing = false;
    app.updateResults();
  },
  onUpdated(updated) {
    app.state.selectedId = updated.id;
    app.state.editing = false;
    app.updateResults();
  }
};

installShipAuthoring(root, authoringContext);
installBuilderAuthoring(root, authoringContext);
installShippingLineAuthoring(root, authoringContext);
installSourceAuthoring(root, authoringContext);
installReferenceObjectAuthoring(root, authoringContext);
installPhotoMediaAuthoring(root, authoringContext);
installReviewDashboard(root, {
  recordService,
  onSelect(id) {
    app.state.selectedId = id;
    app.state.editing = false;
    app.updateResults();
  }
});
installDataPortability(root, recordService, app);
installSyncStatus(root, {
  recordService,
  provider: new LocalMockSyncProvider(),
  onDatabaseReplaced() {
    resetMountedState(app);
  }
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
  mountedApp.updateResults?.();
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
