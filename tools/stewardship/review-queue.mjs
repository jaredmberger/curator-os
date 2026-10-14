// Pure, non-persistent review candidates from the already-sanitized Ops report.
// Never imply verification, ownership, resolution or archival completeness.
// Validation is performed by the dashboard before this pure projection is called.
// Retain independent bounds here to avoid circular dependencies and fail closed.
const rank={degraded:0,attention:1};
export function deriveReviewQueue(report,nowMs=Date.now()){
 if(!report||report.available!==true||report.contractVersion!==1||report.scope!=='ops-operational-state-summary'||!Array.isArray(report.findings)||!report.coverage||report.findings.length!==report.coverage.reportedFindings||report.findings.length>1000||!Number.isFinite(Date.parse(report.generatedAt)))throw new TypeError('Invalid operational report');
 if(!report.findings.every(f=>f&&typeof f.id==='string'&&/^[a-zA-Z0-9_:.-]{1,100}$/.test(f.id)&&['attention','degraded'].includes(f.severity)&&['root','independent','symptom'].includes(f.role)))throw new TypeError('Invalid findings');
 const age=nowMs-Date.parse(report.generatedAt);
 const reliable=Number.isFinite(age)&&age>=-60000&&age<=20*60000;
 const items=report.findings.map(f=>({
  id:f.id,source:'Curator Ops',kind:'operational-signal',severity:f.severity,
  correlation:f.role,verification:'unverified',freshness:reliable?'report-current':'report-unreliable',
  nextStep:'Verify the finding in its authoritative operational source before making changes.'
 })).sort((a,b)=>rank[a.severity]-rank[b.severity]||a.id.localeCompare(b.id));
 return {items,reportReliable:reliable,reportedFindings:report.coverage.reportedFindings,
  note:reliable?'Operational candidates only; not confirmed problems.':'Report timestamp is stale or inconsistent; independently refresh before trusting these candidates.'};
}
