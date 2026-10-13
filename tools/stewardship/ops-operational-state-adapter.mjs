// Offline-only adapter for Curator Ops /api/operational-state.
// Ops remains authoritative for correlation, freshness, and incidents.
// No fetch, KV, scheduling, persistence, or incident state changes.
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && value.includes('T');
const severityMap = { attention:'error', degraded:'warning' };
export function opsOperationalStateToSnapshot(input,{maxAgeMs}={}){
 if(!Number.isSafeInteger(maxAgeMs)||maxAgeMs<0) throw new TypeError('Explicit maxAgeMs required');
 if(!input || input.ok!==true || !input.snapshot || typeof input.snapshot!=='object') throw new TypeError('Invalid Ops response');
 const s=input.snapshot;
 if(!validDate(s.generatedAt) || !['healthy','degraded','attention'].includes(s.status) || !Array.isArray(s.sources) || !Array.isArray(s.findings)) throw new TypeError('Invalid Ops snapshot');
 if(!s.summary || !Number.isSafeInteger(s.summary.sources) || !Number.isSafeInteger(s.summary.activeFindings) || s.summary.activeFindings!==s.findings.length) throw new TypeError('Incomplete Ops summary');
 if(s.summary.sources < s.sources.length) throw new TypeError('Invalid source coverage');
 const sources=s.sources.map(source=>{
  if(!source || typeof source.id!=='string' || !['fresh','stale','missing'].includes(source.freshnessState)) throw new TypeError('Invalid Ops source');
  return {id:source.id,freshness:source.freshnessState,generated_at:validDate(source.generatedAt)?source.generatedAt:null};
 });
 const findings=s.findings.map(f=>{
  if(!f || typeof f.id!=='string' || !f.id || !['root','independent','symptom'].includes(f.role) || !Object.hasOwn(severityMap,f.severity)) throw new TypeError('Invalid Ops finding');
  return {source_finding_id:f.id,rule_id:'ops-'+f.role,observed_at:s.generatedAt,
   severity:severityMap[f.severity],confidence:'confirmed',state:'active',
   subject:typeof f.name==='string'?f.name:f.id,
   evidence:`Ops correlation role: ${f.role}; ${typeof f.message==='string'?f.message.slice(0,300):'See authoritative Ops detail'}`,
   recommended_review:'Review the authoritative Curator Ops operational-state/diagnostics view'};
 });
 return {source_system:'curator-ops',checked_at:s.generatedAt,max_age_ms:maxAgeMs,available:true,findings,
  coverage:{complete_findings:true,scope:'operational-state findings only; not every Error Bus incident',source_count:s.summary.sources,reported_monitor_sources:s.sources.length,source_freshness:sources,ops_status:s.status,authoritative_correlation:true}};
}
