// Pure adapter for the documented Site Health findings.json v1.0 export.
// Intentionally no fetch, filesystem, KV, or live service access.
const SCHEMA = 'https://oceanliners.net/curatoros/findings.schema.json';
const severities = { info:'info', warning:'warning', broken:'error' };
const statuses = { open:'active', reviewing:'active', resolved:'cleared', ignored:'active' };
const requireDate = (value, field) => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || !/T/.test(value))
    throw new TypeError('Invalid '+field);
  return value;
};
const requireString = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Invalid '+field);
  return value;
};
const requireUrl = (value, field) => {
  requireString(value,field);
  const url = new URL(value);
  if (!['https:','http:'].includes(url.protocol)) throw new TypeError('Invalid '+field);
  return value;
};
export function siteHealthExportToSnapshot(exportData, { maxAgeMs } = {}) {
  if (!exportData || typeof exportData !== 'object' || Array.isArray(exportData)) throw new TypeError('Invalid export');
  if (exportData.schema !== SCHEMA || exportData.schemaVersion !== '1.0') throw new TypeError('Unsupported Site Health schema');
  if (exportData.generator?.name !== 'OceanLiners.net Site Health Auditor' ||
      typeof exportData.generator?.version !== 'string') throw new TypeError('Unexpected generator');
  const generatedAt = requireDate(exportData.generatedAt,'generatedAt');
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 0) throw new TypeError('Explicit maxAgeMs required');
  if (!exportData.summary || !['pagesScanned','linksChecked','findings'].every(k=>Number.isSafeInteger(exportData.summary[k])&&exportData.summary[k]>=0))
    throw new TypeError('Invalid summary');
  if (!Array.isArray(exportData.findings) || exportData.summary.findings !== exportData.findings.length)
    throw new TypeError('Incomplete findings export');
  const findings = exportData.findings.map(f => {
    if (!f || typeof f !== 'object' || Array.isArray(f)) throw new TypeError('Invalid finding');
    const id = requireString(f.id,'id');
    const type = requireString(f.type,'type');
    if (!Object.hasOwn(severities,f.severity) || !Object.hasOwn(statuses,f.status)) throw new TypeError('Unrecognized classification');
    const page = requireUrl(f.pageUrl,'pageUrl'), target=requireUrl(f.targetUrl,'targetUrl');
    const detectedAt = requireDate(f.detectedAt,'detectedAt');
    // Reviewing and ignored are *not* resolutions. Preserve lifecycle in evidence.
    return {
      source_finding_id:id, rule_id:type, observed_at:detectedAt,
      severity:severities[f.severity], confidence:'heuristic',
      state:statuses[f.status], subject:page,
      evidence:`Site Health status: ${f.status}; target: ${target}; HTTP: ${Number.isInteger(f.httpStatus)?f.httpStatus:'unverified'}`,
      recommended_review:f.status==='ignored'?'Check upstream ignored disposition; not proof of repair':
        f.status==='reviewing'?'Continue upstream investigation':
        f.status==='resolved'?'Verify upstream resolution evidence':'Review Site Health finding'
    };
  });
  return {source_system:'site-health',checked_at:generatedAt,max_age_ms:maxAgeMs,available:true,findings};
}
