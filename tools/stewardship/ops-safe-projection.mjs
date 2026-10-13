// Pure, offline allowlist projection for sanitized Curator Ops operational state.
// NOT an authorization layer or a browser endpoint; no I/O, dependencies, or side effects.
const STATUS = new Set(['healthy','degraded','attention']);
const FRESHNESS = new Set(['fresh','stale','missing']);
const SEVERITY = new Set(['attention','degraded']);
const ROLE = new Set(['root','independent','symptom']);
const safeId = x => typeof x === 'string' && /^[a-zA-Z0-9_:.-]{1,100}$/.test(x);
const safeCount = x => Number.isSafeInteger(x) && x >= 0 && x <= 1000000;
const safeTime = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x) && Number.isFinite(Date.parse(x));

export function projectSafeOperationalState(payload) {
  if (!payload || payload.ok !== true || !payload.snapshot || typeof payload.snapshot !== 'object' || Array.isArray(payload.snapshot)) throw new TypeError('Invalid Ops envelope');
  const s = payload.snapshot;
  if (!safeTime(s.generatedAt) || !STATUS.has(s.status) || !s.summary || !Array.isArray(s.sources) || !Array.isArray(s.findings)) throw new TypeError('Invalid Ops snapshot');
  if (!safeCount(s.summary.sources) || !safeCount(s.summary.activeFindings) || s.summary.activeFindings !== s.findings.length || s.sources.length > s.summary.sources || s.sources.length > 100 || s.findings.length > 1000) throw new TypeError('Invalid Ops coverage');
  const sources = s.sources.map(row => {
    if (!row || !safeId(row.id) || !FRESHNESS.has(row.freshnessState)) throw new TypeError('Invalid Ops source');
    return { id: row.id, freshness: row.freshnessState };
  });
  const findings = s.findings.map(row => {
    if (!row || !safeId(row.id) || !ROLE.has(row.role) || !SEVERITY.has(row.severity)) throw new TypeError('Invalid Ops finding');
    return { id: row.id, role: row.role, severity: row.severity };
  });
  // Intentionally omit names, messages, evidence, raw source data, keys,
  // URLs, tokens, private service diagnostics, and arbitrary extra fields.
  return {
    contractVersion: 1,
    scope: 'ops-operational-state-summary',
    generatedAt: s.generatedAt,
    state: s.status,
    coverage: { reportedSources: s.summary.sources, listedSources: sources.length, reportedFindings: s.summary.activeFindings, completeness: 'operational-state-only' },
    sources,
    findings,
  };
}
