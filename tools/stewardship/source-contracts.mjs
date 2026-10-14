// Stewardship source contracts v1: pure, offline validation only.
// A source is NOT connected merely because its contract exists.
// No HTTP requests, production bindings, discovery or write operations.
const SOURCES=Object.freeze(['site-health','curator-integrity']);
const STATES=new Set(['healthy','degraded','attention','unknown']);
const FRESHNESS=new Set(['fresh','stale','missing','unknown']);
const SEVERITIES=new Set(['attention','degraded']);
const ID=/^[a-zA-Z0-9_:.-]{1,100}$/;
const validTime=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(x)&&Number.isFinite(Date.parse(x));
const validCount=x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000;
const validId=x=>typeof x==='string'&&ID.test(x);
export const SOURCE_IDS=SOURCES;
export function projectStewardshipSource(payload,expectedSource,{nowMs=Date.now(),maxAgeMinutes=20}={}){
 if(!SOURCES.includes(expectedSource))throw new TypeError('Unregistered source');
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.contractVersion!==1||payload.source!==expectedSource||
    !validTime(payload.generatedAt)||!STATES.has(payload.state)||!FRESHNESS.has(payload.freshness)||
    !payload.coverage||typeof payload.coverage!=='object'||Array.isArray(payload.coverage)||
    !validCount(payload.coverage.reportedChecks)||!validCount(payload.coverage.listedChecks)||
    payload.coverage.listedChecks>payload.coverage.reportedChecks||
    payload.coverage.completeness!=='source-specific-only'||!Array.isArray(payload.findings)||payload.findings.length>100)
  throw new TypeError('Invalid Stewardship source contract');
 if(!payload.findings.every(f=>f&&validId(f.id)&&SEVERITIES.has(f.severity)))
  throw new TypeError('Invalid source findings');
 const age=nowMs-Date.parse(payload.generatedAt);
 if(!Number.isFinite(nowMs)||!Number.isFinite(maxAgeMinutes)||maxAgeMinutes<=0)throw new TypeError('Invalid evaluation');
 // An old or future-dated upstream report cannot substantiate a healthy state.
 const trustworthyTime=age>=-60000&&age<=maxAgeMinutes*60000;
 const safeFreshness=trustworthyTime?payload.freshness:'stale';
 const safeState=trustworthyTime&&safeFreshness==='fresh'?payload.state:'unknown';
 return Object.freeze({
  contractVersion:1,source:expectedSource,generatedAt:payload.generatedAt,
  state:safeState,freshness:safeFreshness,
  coverage:{reportedChecks:payload.coverage.reportedChecks,listedChecks:payload.coverage.listedChecks,completeness:'source-specific-only'},
  findings:payload.findings.map(f=>({id:f.id,severity:f.severity})),
  reviewRequired:safeState!=='healthy'||payload.coverage.listedChecks<payload.coverage.reportedChecks||payload.findings.length>0
 });
}
export function unconnectedStewardshipSource(source){
 if(!SOURCES.includes(source))throw new TypeError('Unregistered source');
 return {source,connected:false,state:'unknown',freshness:'unknown',reason:'no_verified_source_binding'};
}
