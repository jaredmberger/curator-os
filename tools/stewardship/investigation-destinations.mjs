// Fixed, locally owned destinations. Never form URLs using source or finding input.
// Findings currently originate only from the sanitized Curator Ops contract.
// A finding ID is opaque; no source-specific deep link is implied.
const DESTINATIONS=Object.freeze({
 'curator-ops':Object.freeze({label:'Open Curator Ops',href:'https://ops.oceanlinercurator.com/'}),
 'site-health':Object.freeze({label:'Open Site Health',href:'https://site-health.oceanliners.net/'}),
 'curator-integrity':Object.freeze({label:'Open Curator Integrity',href:'https://integrity.oceanliners.net/'})
});
export function investigationDestination(source){
 if(source==='Curator Ops')return DESTINATIONS['curator-ops'];
 return null;
}
export function referenceDashboards(){
 return [DESTINATIONS['curator-ops'],DESTINATIONS['site-health'],DESTINATIONS['curator-integrity']];
}
