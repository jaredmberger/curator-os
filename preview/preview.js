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
import { installWorkerEraShell } from '../src/ui/worker-era-shell.js?v=20260730-1035';
import { installNativeNavigationControls } from '../src/ui/native-navigation-controls.js?v=20260730-1035';
import { installWorkerEraKnowledgeWorkspaces } from '../src/ui/worker-era-graph-intelligence.js';
import { installWorkerEraDeveloperSessions } from '../src/ui/worker-era-developer-sessions.js';
import { installPageStudioHandoff } from '../src/ui/page-studio-handoff.js?v=20260730-1035';
import { installCoverageGapIntelligence } from '../src/ui/coverage-gap-intelligence.js';
import { installSiteAssuranceReadiness } from '../src/ui/site-assurance-readiness.js?v=20260730-1035';
import { installRedirectInformationSummary } from '../src/ui/redirect-information-summary.js';
import { installFindingCollapseControls } from '../src/ui/finding-collapse-controls.js?v=20260730-1035';

const seedRecords = [
  { id:'ship.olympic',type:'ship',title:'RMS Olympic',summary:'Lead ship of the Olympic class and a central reference record for the CuratorOS preview.',status:'published',tags:['White Star Line','Olympic class'],relationships:[{target:'company.harland-wolff',relationship:'built_by',confidence:'verified',sourceIds:['source.builder-records'],note:'Documented in builder records.'},{target:'company.white-star-line',relationship:'operated_by',confidence:'verified',sourceIds:['source.builder-records'],note:'Documented in builder and company records.'}],sources:[{id:'source.builder-records',title:'Builder records',type:'archive'}],media:[],notes:[{body:'Developer preview seed record.',kind:'curatorial'}],data:{builder:'company.harland-wolff',operator:'company.white-star-line',yardNumber:'400',launchDate:'1910-10-20',maidenVoyage:'1911-06-14',grossTonnage:'45,324 GRT',length:'882 ft 9 in',beam:'92 ft 6 in',speed:'21 knots'},metadata:{confidence:'verified',reviewed:'2026-07-25'}},
  { id:'company.white-star-line',type:'company',title:'White Star Line',summary:'British shipping company associated with the Olympic-class liners.',status:'review',tags:['Shipping line'],relationships:[],sources:[{id:'source.builder-records',title:'Builder records',type:'archive'}],media:[],notes:[],data:{country:'United Kingdom',headquarters:'Liverpool',founded:'1845',ceased:'1934',parentCompany:'International Mercantile Marine Company',successor:'Cunard-White Star Line',routeFocus:'North Atlantic passenger service',houseFlag:'Red swallowtail with a white star'},metadata:{confidence:'probable',reviewed:'2026-07-25'}},
  { id:'company.harland-wolff',type:'company',title:'Harland and Wolff',summary:'Belfast shipbuilder associated with many White Star Line vessels.',status:'review',tags:['Shipbuilder'],relationships:[],sources:[{id:'source.builder-records',title:'Builder records',type:'archive'}],media:[],notes:[],data:{city:'Belfast',country:'United Kingdom',founded:'1861',yard:'Queen’s Island'},metadata:{confidence:'probable',reviewed:'2026-07-25'}},
  { id:'source.builder-records',type:'source',title:'Builder records',summary:'Primary shipbuilder documentation used for relationship provenance.',status:'published',tags:['Primary source'],relationships:[],sources:[],media:[],notes:[],data:{creator:'Harland and Wolff',publisher:'Builder archive',sourceType:'archive',date:'1910',identifier:'Yard no. 400',citation:'Harland and Wolff builder records for yard number 400.',rights:'Reference use only.'},metadata:{confidence:'verified',reviewed:'2026-07-25'}},
  { id:'object.olympic-menu-1929',type:'object',title:'RMS Olympic Breakfast Menu',summary:'Breakfast menu dated 2 June 1929 from RMS Olympic.',status:'review',tags:['Reference object','Menu','RMS Olympic'],relationships:[{target:'ship.olympic',relationship:'associated_with',confidence:'verified',sourceIds:[],note:''}],sources:[],media:[],notes:[],data:{category:'menu',associatedRecord:'ship.olympic',date:'1929-06-02',dimensions:'4-3/4 × 7-1/4 in',material:'paper',condition:'mint',storageLocation:'Archive box A',curatorNotes:'Reference Object RO-0001.'},metadata:{confidence:'verified'}},
  { id:'photo.olympic-profile',type:'photo',title:'RMS Olympic profile view',summary:'A cataloged photographic reference showing RMS Olympic in profile.',status:'review',tags:['Photographic reference','RMS Olympic'],relationships:[{target:'ship.olympic',relationship:'depicts',confidence:'probable',sourceIds:[],note:''},{target:'source.builder-records',relationship:'sourced_from',confidence:'probable',sourceIds:[],note:''}],sources:[],media:[],notes:[],data:{mediaType:'photograph',date:'1911',creator:'Unknown photographer',depictedSubject:'ship.olympic',sourceRecord:'source.builder-records',caption:'RMS Olympic in profile.',altText:'RMS Olympic seen in profile at sea',rights:'Reference use only.',attribution:'Ocean Liner Curator photographic reference.'},metadata:{confidence:'probable'}}
];

const root = document.querySelector('#curatoros-preview');
const recordService = new RecordService({ seedRecords });
const app = mountCollectionCatalogShell(root, { recordService });

const authoringContext = {
  recordService,
  getSelectedId() { return app.state.selectedId; },
  onCreated(created) { app.state.selectedId = created.id; app.state.editing = false; app.updateResults(); },
  onUpdated(updated) { app.state.selectedId = updated.id; app.state.editing = false; app.updateResults(); }
};

installShipAuthoring(root, authoringContext);
installBuilderAuthoring(root, authoringContext);
installShippingLineAuthoring(root, authoringContext);
installSourceAuthoring(root, authoringContext);
installReferenceObjectAuthoring(root, authoringContext);
installPhotoMediaAuthoring(root, authoringContext);
installPublicationPreview(root, authoringContext);
installPublicationExport(root, authoringContext);
installPagePackagePreview(root, authoringContext);
installRelationshipExplorer(root, { recordService, getSelectedId() { return app.state.selectedId; }, onSelect(id) { app.state.selectedId = id; app.state.editing = false; app.updateResults(); } });
installReviewDashboard(root, { recordService, onSelect(id) { app.state.selectedId = id; app.state.editing = false; app.updateResults(); } });
installAdvancedSearch(root, { recordService, onSelect(id) { app.state.selectedId = id; app.state.editing = false; app.updateResults(); } });
installFirstUseOnboarding(root, { recordService });
installDataPortability(root, recordService, app);
installOlcSiteManifestBuilder(root, { recordService, onDatabaseReplaced() { resetMountedState(app); } });
installGitHubCatalogIngestion(root, { recordService, onDatabaseReplaced() { resetMountedState(app); } });
installSyncStatus(root, { recordService, provider: new LocalMockSyncProvider(), onDatabaseReplaced() { resetMountedState(app); } });
installWorkerEraShell(root, {
  recordService,
  onQuickBackup() {
    downloadJson({ exportedAt:new Date().toISOString(),schemaVersion:CuratorDatabase.SCHEMA_VERSION,records:recordService.all() }, `curatoros-quick-backup-${new Date().toISOString().slice(0,10)}.json`);
  }
});
installNativeNavigationControls(root);
installRedirectInformationSummary(root);
installPageStudioHandoff(root);
installCoverageGapIntelligence(root, { recordService });
installWorkerEraKnowledgeWorkspaces(root, { recordService });
installWorkerEraDeveloperSessions(root, { recordService });
installSiteAssuranceReadiness(root);
installFindingCollapseControls(root);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.filter((key) => key.startsWith('curatoros-preview-')).map((key) => caches.delete(key)));
    } catch (error) {
      console.warn('CuratorOS service-worker cleanup failed.', error);
    }
  }, { once: true });
}

function installDataPortability(rootElement, service, mountedApp) {
  const toolbar = rootElement.querySelector('.cos-toolbar-actions');
  if (!toolbar) return;
  toolbar.insertAdjacentHTML('beforeend', `<button type="button" data-export-data>Export</button><button type="button" data-import-data>Import</button><button type="button" data-create-snapshot>Snapshot</button><button type="button" data-restore-snapshot>Restore</button><input type="file" accept="application/json,.json" data-import-file hidden>`);
  const fileInput = toolbar.querySelector('[data-import-file]');
  toolbar.querySelector('[data-export-data]').addEventListener('click', () => downloadJson({ exportedAt:new Date().toISOString(),schemaVersion:CuratorDatabase.SCHEMA_VERSION,records:service.all() }, `curatoros-export-${new Date().toISOString().slice(0,10)}.json`));
  toolbar.querySelector('[data-import-data]').addEventListener('click', () => fileInput.click());
  toolbar.querySelector('[data-create-snapshot]').addEventListener('click', () => {
    const snapshot = { createdAt:new Date().toISOString(),schemaVersion:CuratorDatabase.SCHEMA_VERSION,records:service.all() };
    localStorage.setItem('curatoros.snapshot.latest', JSON.stringify(snapshot));
    alert(`Saved local snapshot with ${snapshot.records.length} record${snapshot.records.length===1?'':'s'}.`);
  });
  toolbar.querySelector('[data-restore-snapshot]').addEventListener('click', () => {
    const stored = localStorage.getItem('curatoros.snapshot.latest');
    if (!stored) return alert('No local snapshot is available.');
    try {
      const snapshot = JSON.parse(stored);
      if (!Array.isArray(snapshot.records)) throw new Error('Stored snapshot does not contain a records array.');
      CuratorDatabase.assertDatabase(CuratorDatabase.createDatabase(snapshot.records));
      if (!confirm(`Restore the snapshot from ${formatDate(snapshot.createdAt)}? This will replace the current local database.`)) return;
      service.replace(snapshot.records); resetMountedState(mountedApp);
      alert(`Restored ${snapshot.records.length} record${snapshot.records.length===1?'':'s'} from the local snapshot.`);
    } catch (error) { alert(error instanceof Error ? error.message : String(error)); }
  });
  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = importOlcCatalog(parsed);
      service.replace(imported.records); resetMountedState(mountedApp);
      alert(`Imported ${imported.records.length} record${imported.records.length===1?'':'s'}.`);
    } catch (error) { alert(error instanceof Error ? error.message : String(error)); }
    finally { fileInput.value = ''; }
  });
}

function resetMountedState(mountedApp) {
  mountedApp.state.selectedId = null;
  mountedApp.state.editing = false;
  mountedApp.updateResults();
}

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

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'an unknown date' : date.toLocaleString();
}
