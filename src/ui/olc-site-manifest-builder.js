import { buildOlcManifest } from '../core/olc-site-manifest-builder.js';
import { importOlcCatalog } from '../core/olc-catalog-importer.js';

export function installOlcSiteManifestBuilder(root, context = {}) {
  const toolbar = root?.querySelector('.cos-toolbar-actions');
  if (!toolbar) return;

  toolbar.insertAdjacentHTML('beforeend', `<button type="button" data-build-olc-manifest>Build OLC manifest</button><input type="file" multiple accept=".html,.htm,.json,.js,text/html,application/json,text/javascript,application/javascript" data-olc-site-files hidden>`);
  const button = toolbar.querySelector('[data-build-olc-manifest]');
  const input = toolbar.querySelector('[data-olc-site-files]');
  button.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const files = [...input.files];
    if (!files.length) return;
    button.disabled = true;
    button.textContent = 'Building…';
    try {
      const manifest = await buildOlcManifest(files);
      const counts = ['ships','builders','shippingLines','sources','objects','photos'].map((key) => `${manifest[key].length} ${key}`).join(' · ');
      const summary = `${manifest.report.recognized}/${manifest.report.files} files recognized · ${manifest.report.skipped.length} skipped · ${manifest.report.warnings.length} warnings · ${manifest.report.duplicates.length} duplicates`;
      downloadJson(manifest, `olc-site-manifest-${today()}.json`);

      const migration = importOlcCatalog(manifest);
      if (!migration.records.length) {
        alert(`Manifest built and downloaded. ${counts}. ${summary}. No canonical records were ready to import.`);
        return;
      }

      const importNow = confirm(`Manifest built and downloaded. ${counts}. ${summary}. Import ${migration.records.length} converted records into CuratorOS now? This will replace the current local catalog after a backup.`);
      if (!importNow) return;

      const service = context.recordService;
      if (!service) throw new Error('Record service is unavailable.');
      const database = CuratorDatabase.createDatabase(migration.records);
      CuratorDatabase.assertDatabase(database);
      localStorage.setItem('curatoros.snapshot.before-import', JSON.stringify({ createdAt: new Date().toISOString(), schemaVersion: CuratorDatabase.SCHEMA_VERSION, records: service.all() }));
      downloadJson({ exportedAt: new Date().toISOString(), schemaVersion: CuratorDatabase.SCHEMA_VERSION, records: service.all() }, `curatoros-pre-import-backup-${today()}.json`);
      downloadJson({ ...migration, records: undefined }, `curatoros-import-review-${today()}.json`);
      service.replace(migration.records);
      context.onDatabaseReplaced?.();
      alert(`Imported ${migration.records.length} records from the generated OLC manifest. Backup and review files were downloaded.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      button.disabled = false;
      button.textContent = 'Build OLC manifest';
      input.value = '';
    }
  });
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
function today() { return new Date().toISOString().slice(0, 10); }
