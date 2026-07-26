import { ingestGitHubCatalog } from '../core/github-catalog-ingestion.js';
import { importOlcCatalog } from '../core/olc-catalog-importer.js';
import { reviewAndApplyImport } from './import-review-dialog.js';

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
      downloadJson(manifest, `olc-github-manifest-${new Date().toISOString().slice(0, 10)}.json`);

      const migration = importOlcCatalog(manifest);
      if (!migration.records.length) throw new Error('The repository manifest produced no importable records.');
      const database = CuratorDatabase.createDatabase(migration.records);
      CuratorDatabase.assertDatabase(database);

      const resultApplied = await reviewAndApplyImport({
        root,
        recordService: context.recordService,
        incomingRecords: migration.records,
        sourceLabel: `${owner}/${repo}@${branch}`,
        report: {
          ...migration.report,
          duplicates: report.duplicates,
          fetchErrors: report.fetchErrors,
          repositoryFiles: report.files,
          recognizedFiles: report.recognized
        },
        onApplied: context.onDatabaseReplaced
      });
      if (resultApplied) alert(`GitHub import applied in ${resultApplied.mode} mode. The catalog now contains ${resultApplied.count} records.`);
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
