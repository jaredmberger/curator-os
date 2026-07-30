export const TOOL_WORKFLOWS = [
  {
    id: 'site-health',
    title: 'Site Health',
    description: 'Run a broken-link scan, export the CSV, then import that report into CuratorOS.',
    href: 'https://site-health.oceanliners.net/',
    openLabel: 'Run Site Health',
    importLabel: 'Import Site Health CSV',
    accept: '.csv,text/csv',
    source: 'site-health'
  },
  {
    id: 'curator-indexer',
    title: 'Curator Indexer',
    description: 'Build a fresh site index, export site-index.json, then import it for coverage and linking findings.',
    href: 'https://curator-indexer.oceanliners.net/',
    openLabel: 'Run Curator Indexer',
    importLabel: 'Import site-index.json',
    accept: '.json,application/json',
    source: 'indexer'
  },
  {
    id: 'curator-speed',
    title: 'Performance Intelligence',
    description: 'Analyze an OceanLiners.net page, export the Curator Speed JSON report, then import its performance findings.',
    href: 'https://speed.oceanliners.net/',
    openLabel: 'Run Curator Speed',
    importLabel: 'Import Speed report',
    accept: '.json,application/json',
    source: 'speed'
  }
];

export function renderToolWorkflowCards() {
  return TOOL_WORKFLOWS.map((tool) => `<article class="cos-worker-scan-card cos-worker-tool-card" data-tool-workflow="${escapeHtml(tool.id)}">
    <span>${escapeHtml(tool.title)}</span>
    <p>${escapeHtml(tool.description)}</p>
    <div class="cos-worker-actions">
      <a class="cos-worker-action-link" href="${escapeHtml(tool.href)}">${escapeHtml(tool.openLabel)}</a>
      <button type="button" data-tool-import="${escapeHtml(tool.source)}">${escapeHtml(tool.importLabel)}</button>
    </div>
  </article>`).join('');
}

export function toolAccept(source) {
  return TOOL_WORKFLOWS.find((tool) => tool.source === source)?.accept || '.json,.csv,application/json,text/csv';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
