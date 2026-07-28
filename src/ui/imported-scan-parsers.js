export function detectScanSource(value, isCsv = false) {
  if (isCsv) return 'Site Health CSV';
  if (value?.type === 'curator-performance-scan') return 'Curator Speed JSON';
  return 'JSON scan/index';
}

export function parseCuratorSpeedReport(value) {
  if (!value || value.type !== 'curator-performance-scan' || !Array.isArray(value.findings)) {
    throw new Error('Expected a Curator Speed performance report.');
  }

  const pageUrl = value.page?.finalUrl || value.page?.requestedUrl || '';
  const pageTitle = value.page?.title || pageUrl || 'Curator Speed scan';
  const context = buildSpeedContext(value);

  return value.findings.map((finding, index) => ({
    id: finding.id || `speed:${stableId(`${pageUrl}|${finding.category || ''}|${finding.title || index}`)}`,
    recordType: 'performance finding',
    category: finding.category || 'performance',
    severity: normalizeSeverity(finding.severity),
    title: finding.title || pageTitle,
    summary: finding.summary || 'Curator Speed detected a performance issue.',
    recommendation: finding.recommendation || 'Review the affected page and rerun Curator Speed after making changes.',
    action: 'Open analyzed page',
    pageUrl,
    context: [context, finding.estimatedImpact ? `Estimated impact: ${finding.estimatedImpact}` : ''].filter(Boolean).join(' · ')
  }));
}

function buildSpeedContext(value) {
  const metrics = value.metrics || {};
  const parts = [];
  if (Number.isFinite(Number(metrics.responseTimeMs))) parts.push(`Response ${Number(metrics.responseTimeMs).toLocaleString()} ms`);
  if (Number.isFinite(Number(metrics.htmlBytes))) parts.push(`HTML ${formatBytes(Number(metrics.htmlBytes))}`);
  if (Number.isFinite(Number(metrics.imageCount))) parts.push(`${Number(metrics.imageCount).toLocaleString()} images`);
  if (Number.isFinite(Number(metrics.scriptCount))) parts.push(`${Number(metrics.scriptCount).toLocaleString()} scripts`);
  return parts.join(' · ');
}

function normalizeSeverity(value) {
  return ['high', 'medium', 'low'].includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'medium';
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function stableId(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
