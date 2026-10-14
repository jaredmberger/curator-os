// Fixed, locally owned destinations. Never form URLs using source or finding input.
// Findings currently originate only from the sanitized Curator Ops contract.
// The /operational-state route is verified from the active Ops Worker.\n// It lists findings but has no stable per-finding anchors; IDs remain opaque.
const DESTINATIONS=Object.freeze({
 'curator-ops':Object.freeze({label:'Review operational findings in Curator Ops',href:'https://ops.oceanlinercurator.com/operational-state'}),
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
