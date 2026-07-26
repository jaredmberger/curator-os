import { ingestGitHubCatalog } from '../core/github-catalog-ingestion.js';
import { importOlcCatalog } from '../core/olc-catalog-importer.js';

export function installGitHubCatalogIngestion(root, context = {}) {
  const toolbar = root.querySelector('.cos-toolbar-actions');
  if (!toolbar) return;

  toolbar.insertAdjacentHTML('beforeend', '<button type="button" data-import-github>Import GitHub</button>');
  const button = toolbar.querySelector('[data-import-github]');
  button.addEventListener('click', async () => {
    const repository = prompt('Public GitHub repository (owner/name):', 'jaredmberger/ocean-liner-curator');
    if (!repository) return;
    const [owner, repo] = repository.trim().split('/');
    if (!owner || !repo) return alert('Use the format owner/repository.');
    const branch = prompt('Branch:', 'main') || 'main';

    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Connecting…';
    try {
      const result = await ingestGitHubCatalog({
        owner,
        repo,
        branch,
        onProgress(progress) { button.textContent = `GitHub ${progress.completed}/${progress.total}`; }
      });
      const manifest = result.manifest;
      const report = manifest.report;
      const counts = ['ships', 'builders', 'shippingLines', 'sources', 'objects', 'photos']
        .map((group) => `${group}: ${manifest[group]?.length || 0}`)
        .join(' · ');
      const summary = `${counts}\nRecognized ${report.recognized}/${report.files} files · ${report.skipped.length} skipped · ${report.duplicates.length} duplicates · ${report.warnings.length} warnings · ${(report.fetchErrors || []).length} download errors`;
      downloadJson(manifest, `olc-github-manifest-${new Date().toISOString().slice(0, 10)}.json`);
      if (!confirm(`${summary}\n\nThe manifest has been downloaded. Convert and import it now?`)) return;

      const migration = importOlcCatalog(manifest);
      if (!migration.records.length) throw new Error('The repository manifest produced no importable records.');
      const database = CuratorDatabase.createDatabase(migration.records);
      CuratorDatabase.assertDatabase(database);
      const importSummary = `${migration.report.converted} converted · ${migration.report.skipped.length} skipped · ${migration.report.warnings.length} warnings · ${migration.report.errors.length} errors`;
      if (!confirm(`Import review: ${importSummary}. Replace the current ${context.recordService.all().length}-record local database?`)) return;

      localStorage.setItem('curatoros.snapshot.before-import', JSON.stringify({ createdAt: new Date().toISOString(), schemaVersion: CuratorDatabase.SCHEMA_VERSION, records: context.recordService.all() }));
      downloadJson({ exportedAt: new Date().toISOString(), schemaVersion: CuratorDatabase.SCHEMA_VERSION, records: context.recordService.all() }, `curatoros-pre-import-backup-${new Date().toISOString().slice(0, 10)}.json`);
      downloadJson({ ...migration, records: undefined }, `curatoros-github-import-review-${new Date().toISOString().slice(0, 10)}.json`);
      context.recordService.replace(migration.records);
      context.onDatabaseReplaced?.();
      alert(`Imported ${migration.records.length} records from ${owner}/${repo}. ${importSummary}.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      button.disabled = false;
      button.textContent = original;
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
