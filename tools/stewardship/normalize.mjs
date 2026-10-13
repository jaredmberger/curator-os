// Offline-only Stewardship Mode prototype. No I/O, imports, network, or mutations.
// Fixtures must be sanitized; real source schemas require separate verification.
const severities = new Set(['info','notice','warning','error']);
const confidences = new Set(['confirmed','heuristic','unknown']);
const states = new Set(['active','cleared','stale','unavailable']);
const safeString = (x) => typeof x === 'string' ? x : '';
const validTime = (x) => typeof x === 'string' && Number.isFinite(Date.parse(x)) ? Date.parse(x) : null;
const sanitized = (v) => typeof v === 'string' ? v.slice(0,500) : '';
export function normalizeStewardshipSnapshots(snapshots, { now, expectedSources = [] } = {}) {
  const clock = validTime(now);
  if (clock === null) throw new TypeError('A valid explicit now timestamp is required');
  if (!Array.isArray(snapshots) || !Array.isArray(expectedSources)) throw new TypeError('Arrays required');
  const sources = [];
  const findings = new Map();
  const seenSources = new Set();
  for (const raw of snapshots) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Invalid snapshot');
    const source = safeString(raw.source_system);
    if (!source || seenSources.has(source)) throw new TypeError('Missing or duplicate source_system');
    seenSources.add(source);
    const checked = validTime(raw.checked_at);
    const maxAge = raw.max_age_ms;
    if (!Number.isSafeInteger(maxAge) || maxAge < 0) throw new TypeError('Explicit source max_age_ms required');
    const age = checked === null ? null : clock - checked;
    const fresh = raw.available === true && age !== null && age >= 0 && age <= maxAge;
    const state = raw.available !== true ? 'unavailable' : checked === null ? 'not_checked' : !fresh ? 'stale' : 'current';
    sources.push({ source_system: source, state, checked_at: safeString(raw.checked_at)||null, age_ms: age, reason: state==='current' ? null : state==='stale' ? 'outside source-specific freshness window' : state==='unavailable' ? 'source unavailable' : 'check timestamp absent' });
    if (!fresh) continue;
    if (!Array.isArray(raw.findings)) throw new TypeError('Current snapshot findings must be an array');
    for (const f of raw.findings) {
      if (!f || typeof f !== 'object' || Array.isArray(f)) throw new TypeError('Invalid finding');
      const id = safeString(f.source_finding_id);
      if (!id) throw new TypeError('Stable source_finding_id required');
      const key = source + ':' + id;
      const observed = validTime(f.observed_at);
      if (observed === null || observed > clock) throw new TypeError('Invalid observed_at');
      if (!severities.has(f.severity) || !confidences.has(f.confidence) || !states.has(f.state)) throw new TypeError('Invalid classification');
      const record = { key, source_system: source, source_finding_id: id, rule_id: safeString(f.rule_id), observed_at: f.observed_at, severity: f.severity, confidence: f.confidence, state: f.state, subject: sanitized(f.subject), evidence: sanitized(f.evidence), recommended_review: sanitized(f.recommended_review) };
      const old = findings.get(key);
      if (!old || observed > validTime(old.observed_at)) findings.set(key, record);
      else if (observed === validTime(old.observed_at) && JSON.stringify(old) !== JSON.stringify(record)) throw new Error('Contradictory same-timestamp finding: '+key);
    }
  }
  for (const source of expectedSources) {
    if (typeof source !== 'string' || !source) throw new TypeError('Invalid expected source');
    if (!seenSources.has(source)) sources.push({source_system:source,state:'not_checked',checked_at:null,age_ms:null,reason:'no snapshot supplied'});
  }
  sources.sort((a,b)=>a.source_system.localeCompare(b.source_system));
  const rows = [...findings.values()].sort((a,b)=>a.key.localeCompare(b.key));
  return { sources, findings:rows, summary:{current:sources.filter(s=>s.state==='current').length, stale:sources.filter(s=>s.state==='stale').length, unavailable:sources.filter(s=>s.state==='unavailable').length, not_checked:sources.filter(s=>s.state==='not_checked').length, active:rows.filter(f=>f.state==='active').length, review_candidates:rows.filter(f=>f.state==='active'&&f.confidence!=='confirmed').length}, disclaimer:'An empty finding list does not prove historical correctness or overall health.' };
}
