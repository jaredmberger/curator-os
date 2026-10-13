// Pure offline adapter for Curator Integrity /api/integrity-snapshot.
// This endpoint exposes a bounded summary (top 25 problem pages), NOT full findings.
// No network access, persistence, mutation, or claims of complete site health.
const validDate = x => typeof x === 'string' && Number.isFinite(Date.parse(x));
const count = (v,k) => { if (!Number.isSafeInteger(v)||v<0) throw new TypeError('Invalid '+k);return v; };
const severity = { critical:'error',error:'error',warning:'warning',notice:'notice',info:'info',none:'info' };
export function integritySummaryToStewardship(input,{maxAgeMs}={}){
 if (!Number.isSafeInteger(maxAgeMs)||maxAgeMs<0) throw new TypeError('Explicit maxAgeMs required');
 const s = input?.snapshot ?? input;
 if (!s||s.ok!==true||s.mode!=='incremental-site-monitor'||!validDate(s.generatedAt)) throw new TypeError('Invalid integrity snapshot');
 const inventory=count(s.inventoryCount,'inventoryCount'), audited=count(s.auditedPageCount,'auditedPageCount'), pending=count(s.pendingInitialAuditCount,'pendingInitialAuditCount'), total=count(s.findingCount,'findingCount');
 if (audited>inventory||pending!==inventory-audited) throw new TypeError('Inconsistent audit coverage');
 if (!Array.isArray(s.problemPages)||s.problemPages.length>25) throw new TypeError('Expected bounded problemPages');
 const findings=s.problemPages.map(p=>{
  if (!p||typeof p.path!=='string'||!p.path.startsWith('/')||!validDate(p.checkedAt)) throw new TypeError('Invalid problem page');
  if (!Object.hasOwn(severity,p.highestSeverity)) throw new TypeError('Invalid severity');
  count(p.findingCount,'findingCount');
  return {source_finding_id:'summary:'+p.path,rule_id:'integrity-summary-problem-page',observed_at:p.checkedAt,severity:severity[p.highestSeverity],confidence:'heuristic',state:'active',subject:p.path,evidence:`Summary only; reported page findings: ${p.findingCount}; error: ${typeof p.error==='string'?p.error.slice(0,140):'none reported'}`,recommended_review:'Open authoritative Curator Integrity detail; summary is not a full finding inventory'};
 });
 return {source_system:'curator-integrity',checked_at:s.generatedAt,max_age_ms:maxAgeMs,available:true,findings,
  coverage:{inventory_count:inventory,audited_page_count:audited,pending_initial_audit_count:pending,reported_finding_count:total,returned_problem_pages:s.problemPages.length,complete_findings:false,coverage_note:'Incremental rollup; problemPages is capped at 25. Do not infer missing rows resolved.'}};
}
