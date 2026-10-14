// Read-only ship-guide stewardship projection for offline audit exports.
// No network calls, write actions, historical truth claims, or production bindings.
const pathPattern=/^\/ships\/[a-z0-9][a-z0-9-]{0,120}$/;
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000;
function normalizePath(value){
 if(typeof value!=='string')return null;
 let path=value;
 if(/^https:\/\//.test(value)){
  let url;try{url=new URL(value);}catch{return null;}
  if(!['oceanliners.net','www.oceanliners.net'].includes(url.hostname)||url.search||url.hash)return null;
  path=url.pathname;
 }
 path=path.replace(/\.html$/,'').replace(/\/$/,'');
 return pathPattern.test(path)?path:null;
}
export function buildShipStewardshipInventory({shipPaths,linkAudit=null,chronologyFindings=null,observedAt,revision=null}){
 if(!Array.isArray(shipPaths)||!shipPaths.length||shipPaths.length>10000||!shipPaths.every(x=>normalizePath(x)))throw new TypeError('Invalid ship-guide inventory');
 if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw new TypeError('Missing observation timestamp');
 if(revision!==null&&(typeof revision!=='string'||!/^[0-9a-f]{7,40}$/.test(revision)))throw new TypeError('Invalid revision');
 const paths=shipPaths.map(normalizePath);
 if(new Set(paths).size!==paths.length)throw new TypeError('Duplicate guide path');
 const links=new Map();
 if(linkAudit!==null){
  if(!linkAudit||!Array.isArray(linkAudit.pages)||linkAudit.pages.length>50000)throw new TypeError('Invalid link audit');
  for(const row of linkAudit.pages){
   const path=normalizePath(row?.path);
   if(!path)continue; // Non-ship pages are outside this inventory.
   if(!count(row.incoming)||!count(row.contextual)||row.contextual>row.incoming||links.has(path))throw new TypeError('Invalid ship link observation');
   links.set(path,{incoming:row.incoming,contextual:row.contextual});
  }
 }
 const chronology=new Map();
 if(chronologyFindings!==null){
  if(!Array.isArray(chronologyFindings)||chronologyFindings.length>10000)throw new TypeError('Invalid chronology findings');
  for(const finding of chronologyFindings){
   if(!finding||!['review','inventory'].includes(finding.level)||typeof finding.issue!=='string'||finding.issue.length>200||typeof finding.subject!=='string')throw new TypeError('Invalid chronology finding');
   // Same-hull group findings may reference more than one guide and cannot safely
   // be assigned to a single ship from the subject field alone.
   const path=normalizePath('/ships/'+finding.subject);
   if(!path||!paths.includes(path))continue;
   const items=chronology.get(path)||[];
   items.push({level:finding.level,issue:finding.issue,verification:'unverified'});
   chronology.set(path,items);
  }
 }
 const guides=paths.sort().map(path=>{
  const link=links.get(path);
  const historical=chronology.get(path)||[];
  const candidates=[];
  if(link&&link.contextual===0)candidates.push({kind:'contextual-link-review',verification:'unverified',note:'No static contextual incoming links found; script-generated links are excluded.'});
  for(const f of historical)candidates.push({kind:f.level==='inventory'?'inventory-notice':'historical-consistency-review',verification:'unverified',note:f.issue});
  return {path,sourceUrl:'https://oceanliners.net'+path,checks:{
   archiveInventory:'listed',
   staticLinkAudit:link?'observed':'unknown',
   contextualIncoming:link?link.contextual:null,
   historicalConsistency:chronologyFindings===null?'unknown':'narrow-rules-only',
   historicalAccuracy:'not-assessed',externalCitationValidity:'not-assessed'
  },candidates};
 });
 return {contractVersion:1,scope:'ship-guide-stewardship-offline-inventory',observedAt,revision,coverage:{
   listedGuides:guides.length,linkObservations:guides.filter(g=>g.checks.staticLinkAudit==='observed').length,
   historicalAuditSupplied:chronologyFindings!==null,
   completeness:'export-scoped-not-live-certification'
 },guides};
}
