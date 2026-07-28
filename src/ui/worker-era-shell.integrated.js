import { renderToolWorkflowCards, toolAccept } from './tool-workflows.js';
import { parseExternalScan } from './scan-import-adapter.js';

export function installScannerWorkflowIntegration({ root, dashboard, findingsInput, parseAuditCsv, parseImportedJson, handleParsedScan }) {
  root.addEventListener('click', (event) => {
    const importButton = event.target.closest('[data-tool-import]');
    if (!importButton) return;
    findingsInput.dataset.requestedSource = importButton.dataset.toolImport || '';
    findingsInput.accept = toolAccept(importButton.dataset.toolImport || '');
    findingsInput.click();
  });

  return {
    renderCards: renderToolWorkflowCards,
    async parseFile(file) {
      const text = await file.text();
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      const value = isCsv ? null : JSON.parse(text);
      if (value?.records && Array.isArray(value.records)) {
        throw new Error('This is a CuratorOS catalog. Use Load catalog instead.');
      }
      const requestedSource = findingsInput.dataset.requestedSource || '';
      if (requestedSource === 'site-health' && !isCsv) throw new Error('Choose the CSV exported by Site Health.');
      if (requestedSource === 'speed' && value?.type !== 'curator-performance-scan') throw new Error('Choose a Curator Speed JSON report.');
      if (requestedSource === 'indexer' && value?.type === 'curator-performance-scan') throw new Error('Choose site-index.json from Curator Indexer.');
      const parsed = parseExternalScan(value, isCsv, () => parseAuditCsv(text), parseImportedJson);
      return handleParsedScan(parsed, file);
    },
    reset() {
      findingsInput.accept = '.json,.csv,application/json,text/csv';
      findingsInput.dataset.requestedSource = '';
    }
  };
}
