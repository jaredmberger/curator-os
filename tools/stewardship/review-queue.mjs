// Pure, non-persistent review candidates from the already-sanitized Ops report.
// Never imply verification, ownership, resolution or archival completeness.
import {validateReport,assessReport} from '../../preview/stewardship.js';
const rank={degraded:0,attention:1};
export function deriveReviewQueue(report,nowMs=Date.now()){
 if(!validateReport(report))throw new TypeError('Invalid operational report');
 const assessment=assessReport(report,nowMs);
 const reliable=!assessment.stale&&!assessment.clockSkew;
 const items=report.findings.map(f=>({
  id:f.id,source:'Curator Ops',kind:'operational-signal',severity:f.severity,
  correlation:f.role,verification:'unverified',freshness:reliable?'report-current':'report-unreliable',
  nextStep:'Verify the finding in its authoritative operational source before making changes.'
 })).sort((a,b)=>rank[a.severity]-rank[b.severity]||a.id.localeCompare(b.id));
 return {items,reportReliable:reliable,reportedFindings:report.coverage.reportedFindings,
  note:reliable?'Operational candidates only; not confirmed problems.':'Report timestamp is stale or inconsistent; independently refresh before trusting these candidates.'};
}
