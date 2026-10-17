// Conservative Watchtower triage: current ranking events are NOT technical incidents.
export const TECHNICAL_TYPES=new Set(['indexing-blocked','robots-blocked','fetch-error','canonical-mismatch','sitemap-error']);
export function classifyWatchtower(raw,latestDate){
 const events=Array.isArray(raw?.events)?raw.events:[];
 const technical=[],ranking=[],other=[];
 const seen=new Set();
 for(const e of events){
  if(!e||typeof e.type!=='string')continue;
  const item={type:e.type,title:String(e.title||e.label||e.type).slice(0,240),
   detail:String(e.detail||e.description||'').slice(0,600),
   page:String(e.page||e.path||'').slice(0,500),query:String(e.query||'').slice(0,250),
   snapshotDate:e.snapshotDate||latestDate||null,score:Number(e.score)||0};
  const key=[item.type,item.page,item.query,item.snapshotDate].join('|');
  if(seen.has(key))continue;seen.add(key);
  if(TECHNICAL_TYPES.has(item.type)) technical.push({...item,classification:'technical-review-candidate'});
  else if(['top10-enter','top10-exit','rank-rise','rank-drop','impression-surge','new-query','query-top10'].includes(item.type))ranking.push({...item,classification:'ranking-observation'});
  else other.push({...item,classification:'unclassified'});
 }
 return {technical,ranking,other,policy:'Ranking changes are not indexing errors. Unclassified events are not promoted to review automatically.'};
}
