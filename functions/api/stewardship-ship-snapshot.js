// Protected, read-only ship snapshot gateway. No publish/update methods.
// The binding and the operator-controlled enable flag are deliberately absent
// by default; deployment alone never activates access.
import {createOperatorAuthorizationFromBindings,hasTrustedOperatorConfiguration} from '../../tools/stewardship/operator-runtime-adapter.mjs';
import {validateInventory} from '../../preview/ship-inspector.js';
const h={'cache-control':'private, no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow, noarchive'};
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...h,'content-type':'application/json; charset=utf-8'}});
export const createShipSnapshotHandler=(authorizerFactory=createOperatorAuthorizationFromBindings)=>async ({request,env})=>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...h,allow:'GET'}});
 if(env?.STEWARDSHIP_SHIP_READ_ENABLED!=='true')return json(404,{available:false,reason:'disabled'});
 let allowed=false;
 try{allowed=(await authorizerFactory(env).authorize(request))===true;}
 catch{return json(403,{available:false,reason:'authorization_unavailable'});}
 if(!allowed){
  // Only coarse failure categories, on a request that was already denied.
  // Never reveal bound secrets, JWTs, emails, signing keys, or claim details.
  const validConfig=hasTrustedOperatorConfiguration(env);
  const hasHeader=!!request.headers.get('Cf-Access-Jwt-Assertion');
  const hasCookie=/(?:^|;\s*)CF_Authorization=/.test(request.headers.get('cookie')||'');
  return json(403,{available:false,reason:!validConfig?'trusted_configuration_unavailable':!hasHeader&&!hasCookie?'signed_assertion_missing':'signed_assertion_not_accepted'});
 }
 if(typeof env?.STEWARDSHIP_SHIP_SNAPSHOTS?.get!=='function')return json(503,{available:false,reason:'snapshot_binding_unavailable'});
 try{
  const raw=await env.STEWARDSHIP_SHIP_SNAPSHOTS.get('verified:ship-stewardship:v1');
  if(typeof raw!=='string'||raw.length>3000000)return json(503,{available:false,reason:'snapshot_unavailable'});
  const snapshot=JSON.parse(raw);
  if(!validateInventory(snapshot)||!(/^[0-9a-f]{40}$/).test(snapshot.revision||'')||snapshot.coverage.listedGuides<300||snapshot.coverage.linkObservations<300||snapshot.coverage.historicalAuditSupplied!==true||!snapshot.guides.every(x=>x.checks.historicalConsistency==='narrow-rules-only'))return json(503,{available:false,reason:'snapshot_invalid'});
  const age=Date.now()-Date.parse(snapshot.observedAt);
  if(!Number.isFinite(age)||age< -60000||age>7*24*60*60*1000)return json(503,{available:false,reason:'snapshot_stale'});
  // This is an archive export, not live page health or verified historical truth.
  return json(200,{available:true,snapshot});
 }catch{return json(503,{available:false,reason:'snapshot_unavailable'});}
};
export const onRequest=createShipSnapshotHandler();
