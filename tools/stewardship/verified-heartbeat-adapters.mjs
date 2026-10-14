// Offline allowlisted mapping of VERIFIED /api/ops-health schema.
// This is NOT a live integration: no network calls or deployment bindings.
const SERVICES=Object.freeze({'site-health':'Site Health','curator-integrity':'Curator Integrity'});
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));
const validPositive=x=>Number.isFinite(x)&&x>0&&x<=1440;
export function projectOpsHeartbeat(raw,source,{nowMs=Date.now()}={}){
 if(!Object.hasOwn(SERVICES,source))throw new TypeError('Unregistered source');
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.service!==SERVICES[source]||
   typeof raw.ok!=='boolean'||!['healthy','stale','unknown'].includes(raw.status)||
   !raw.schedule||raw.schedule.cadence!=='hourly'||
   !Number.isSafeInteger(raw.schedule.minute)||raw.schedule.minute<0||raw.schedule.minute>59||
   !validPositive(raw.maxAgeMinutes)||!validDate(raw.checkedAt)||
   !(raw.lastSuccessAt===null||validDate(raw.lastSuccessAt))||
   !(raw.stale===null||typeof raw.stale==='boolean'))
  throw new TypeError('Invalid authoritative monitor heartbeat');
 if(!Number.isFinite(nowMs))throw new TypeError('Invalid evaluation time');
 const checkedAge=nowMs-Date.parse(raw.checkedAt);
 const checkedCurrent=checkedAge>=-60000&&checkedAge<=20*60000;
 const successAge=raw.lastSuccessAt===null?null:(nowMs-Date.parse(raw.lastSuccessAt))/60000;
 const heartbeatCurrent=successAge!==null&&successAge>=-1&&successAge<=raw.maxAgeMinutes;
 // Fail closed: a fresh *query* is not proof that the monitor actually ran.
 const consistent=raw.status===(raw.lastSuccessAt===null?'unknown':raw.stale===true?'stale':'healthy')&&
   (raw.lastSuccessAt===null?raw.stale===null:typeof raw.stale==='boolean')&&
   (raw.lastSuccessAt===null||raw.stale===(successAge>raw.maxAgeMinutes));
 const freshness=checkedCurrent&&consistent&&raw.ok===true&&heartbeatCurrent?'fresh':raw.lastSuccessAt===null?'missing':'stale';
 return {
  source,scope:'scheduled-monitor-heartbeat-only',checkedAt:raw.checkedAt,
  lastSuccessAt:raw.lastSuccessAt,frequency:'hourly',
  freshness,state:freshness==='fresh'?'healthy':'unknown',
  maxAgeMinutes:raw.maxAgeMinutes,
  coverage:{reportedChecks:null,listedChecks:null,completeness:'unknown'},
  findings:{count:null,completeness:'unknown'},
  reviewRequired:freshness!=='fresh',
 };
}
export function disconnectedHeartbeat(source){
 if(!Object.hasOwn(SERVICES,source))throw new TypeError('Unregistered source');
 return {source,scope:'scheduled-monitor-heartbeat-only',state:'unknown',freshness:'unknown',
 coverage:{reportedChecks:null,listedChecks:null,completeness:'unknown'},findings:{count:null,completeness:'unknown'},connected:false};
}
