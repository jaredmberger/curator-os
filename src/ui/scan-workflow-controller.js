import { renderToolWorkflowCards, toolAccept } from './tool-workflows.js';
import { parseExternalScan } from './scan-import-adapter.js';

export function createScanWorkflowController({ root, findingsInput, parseAuditCsv, parseImportedJson }) {
  const onClick = (event) => {
    const button = event.target.closest('[data-tool-import]');
    if (!button) return;
    const source = button.dataset.toolImport || '';
    findingsInput.dataset.requestedSource = source;
    findingsInput.accept = toolAccept(source);
    findingsInput.click();
  };

  root.addEventListener('click', onClick);

  return {
    renderCards: renderToolWorkflowCards,
    async parse(file) {
      const text = await file.text();
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      const value = isCsv ? null : JSON.parse(text);
      const requestedSource = findingsInput.dataset.requestedSource || '';

      if (value?.records && Array.isArray(value.records)) {
        throw new Error('This is a CuratorOS catalog. Use Load catalog instead.');
      }
      if (requestedSource === 'site-health' && !isCsv) {
        throw new Error('Choose the CSV exported by Site Health.');
      }
      if (requestedSource === 'speed' && value?.type !== 'curator-performance-scan') {
        throw new Error('Choose a Curator Speed JSON report.');
      }
      if (requestedSource === 'indexer' && value?.type === 'curator-performance-scan') {
        throw new Error('Choose site-index.json from Curator Indexer.');
      }

      return parseExternalScan(value, isCsv, () => parseAuditCsv(text), parseImportedJson);
    },
    reset() {
      findingsInput.accept = '.json,.csv,application/json,text/csv';
      findingsInput.dataset.requestedSource = '';
    },
    destroy() {
      root.removeEventListener('click', onClick);
    }
  };
}
