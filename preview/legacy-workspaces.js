import { mountCollectionCatalogShell, RecordService } from '../src/ui/collection-catalog-shell.js';
import { LocalMockSyncProvider } from '../src/core/mock-sync-provider.js';
import { importOlcCatalog } from '../src/core/olc-catalog-importer.js';
import { installSyncStatus } from '../src/ui/sync-status.js';
import { installShipAuthoring } from '../src/ui/ship-authoring.js';
import { installBuilderAuthoring } from '../src/ui/builder-authoring.js';
import { installShippingLineAuthoring } from '../src/ui/shipping-line-authoring.js';
import { installSourceAuthoring } from '../src/ui/source-authoring.js';
import { installReferenceObjectAuthoring } from '../src/ui/reference-object-authoring.js';
import { installPhotoMediaAuthoring } from '../src/ui/photo-media-authoring.js';
import { installReviewDashboard } from '../src/ui/review-dashboard.js';
import { installPublicationPreview } from '../src/ui/publication-preview.js';
import { installPublicationExport } from '../src/ui/publication-export.js';
import { installPagePackagePreview } from '../src/ui/page-package-preview.js';
import { installRelationshipExplorer } from '../src/ui/relationship-explorer.js';
import { installAdvancedSearch } from '../src/ui/advanced-search.js';
import { installFirstUseOnboarding } from '../src/ui/first-use-onboarding.js';
import { installOlcSiteManifestBuilder } from '../src/ui/olc-site-manifest-builder.js';
import { installGitHubCatalogIngestion } from '../src/ui/github-catalog-ingestion.js';
import { installCoverageGapIntelligence } from '../src/ui/coverage-gap-intelligence.js';
import { installSiteAssuranceReadiness } from '../src/ui/site-assurance-readiness.js';
import { installWorkerEraKnowledgeWorkspaces } from '../src/ui/worker-era-graph-intelligence.js';
import { installWorkerEraDeveloperSessions } from '../src/ui/worker-era-developer-sessions.js';

const STORAGE_KEY = 'curatoros.rebuilt.catalog';
const fallbackRecords = [];
const root = document.querySelector('#legacy-workspaces-root');
const launcher = document.querySelector('#legacy-workspaces-launcher');

launcher?.addEventListener('click', () => {
  root.hidden = !root.hidden;
  launcher.setAttribute('aria-expanded', String(!root.hidden));
  if (!root.hidden && !root.dataset.mounted) mountLegacyWorkspaces();
});

function readRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(parsed) ? parsed : fallbackRecords;
  } catch {
    return fallbackRecords;
  }
}

function mountLegacyWorkspaces() {
  root.dataset.mounted = 'true';
  const recordService = new RecordService({ seedRecords: readRecords() });
  const app = mountCollectionCatalogShell(root, { recordService });
  const context = {
    recordService,
    getSelectedId() { return app.state.selectedId; },
    onCreated(created) { app.state.selectedId = created.id; app.state.editing = false; app.updateResults(); persist(recordService); },
    onUpdated(updated) { app.state.selectedId = updated.id; app.state.editing = false; app.updateResults(); persist(recordService); }
  };

  installShipAuthoring(root, context);
  installBuilderAuthoring(root, context);
  installShippingLineAuthoring(root, context);
  installSourceAuthoring(root, context);
  installReferenceObjectAuthoring(root, context);
  installPhotoMediaAuthoring(root, context);
  installPublicationPreview(root, context);
  installPublicationExport(root, context);
  installPagePackagePreview(root, context);
  installRelationshipExplorer(root, { recordService, getSelectedId: context.getSelectedId, onSelect(id) { app.state.selectedId = id; app.state.editing = false; app.updateResults(); } });
  installReviewDashboard(root, { recordService, onSelect(id) { app.state.selectedId = id; app.state.editing = false; app.updateResults(); } });
  installAdvancedSearch(root, { recordService, onSelect(id) { app.state.selectedId = id; app.state.editing = false; app.updateResults(); } });
  installFirstUseOnboarding(root, { recordService });
  installOlcSiteManifestBuilder(root, { recordService, onDatabaseReplaced() { reset(app); persist(recordService); } });
  installGitHubCatalogIngestion(root, { recordService, onDatabaseReplaced() { reset(app); persist(recordService); } });
  installSyncStatus(root, { recordService, provider: new LocalMockSyncProvider(), onDatabaseReplaced() { reset(app); persist(recordService); } });
  installCoverageGapIntelligence(root, { recordService });
  installWorkerEraKnowledgeWorkspaces(root, { recordService });
  installWorkerEraDeveloperSessions(root, { recordService });
  installSiteAssuranceReadiness(root);
  installDataPortability(root, recordService, app);
}

function installDataPortability(rootElement, service, mountedApp) {
  const toolbar = rootElement.querySelector('.cos-toolbar-actions');
  if (!toolbar) return;
  toolbar.insertAdjacentHTML('beforeend', '<button type="button" data-export-data>Export</button><button type="button" data-import-data>Import</button><button type="button" data-create-snapshot>Snapshot</button><button type="button" data-restore-snapshot>Restore</button><input type="file" accept="application/json,.json" data-import-file hidden>');
  const input = toolbar.querySelector('[data-import-file]');
  toolbar.querySelector('[data-export-data]')?.addEventListener('click', () => downloadJson({ exportedAt:new Date().toISOString(), records:service.all() }, `curatoros-export-${new Date().toISOString().slice(0,10)}.json`));
  toolbar.querySelector('[data-import-data]')?.addEventListener('click', () => input.click());
  toolbar.querySelector('[data-create-snapshot]')?.addEventListener('click', () => {
    localStorage.setItem('curatoros.snapshot.latest', JSON.stringify({ createdAt:new Date().toISOString(), records:service.all() }));
    alert('Local snapshot saved.');
  });
  toolbar.querySelector('[data-restore-snapshot]')?.addEventListener('click', () => {
    try {
      const snapshot = JSON.parse(localStorage.getItem('curatoros.snapshot.latest') || 'null');
      if (!Array.isArray(snapshot?.records)) return alert('No local snapshot is available.');
      if (!confirm('Restore the latest local snapshot? This replaces the current local catalog.')) return;
      service.replace(snapshot.records); reset(mountedApp); persist(service);
    } catch (error) { alert(error instanceof Error ? error.message : String(error)); }
  });
  input?.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = importOlcCatalog(JSON.parse(await file.text()));
      service.replace(imported.records); reset(mountedApp); persist(service);
    } catch (error) { alert(error instanceof Error ? error.message : String(error)); }
    finally { input.value = ''; }
  });
}

function persist(service) { localStorage.setItem(STORAGE_KEY, JSON.stringify(service.all())); }
function reset(app) { app.state.selectedId = null; app.state.editing = false; app.updateResults(); }
function downloadJson(payload, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
