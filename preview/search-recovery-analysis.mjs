// Pure search-visibility calculations; no indexing or penalty inference.
export const BASELINE={preStart:'20260918',preEnd:'20260923',postStart:'20260924',postEnd:'20261014'};
const num=(rows,key)=>rows.reduce((s,r)=>s+Number(r[key]||0),0)/rows.length;
const isConsecutive=rows=>rows.every((r,i)=>!i||Date.parse(r.date.slice(0,4)+'-'+r.date.slice(4,6)+'-'+r.date.slice(6,8))-
 Date.parse(rows[i-1].date.slice(0,4)+'-'+rows[i-1].date.slice(4,6)+'-'+rows[i-1].date.slice(6,8))===86400000);
const window=(rows,n)=>{const s=rows.slice(-n);return s.length===n&&isConsecutive(s)?s:null};
export function analyzeSearch(d,clock=new Date()){
 const rows=[...(d.rows||[])].sort((a,b)=>a.date.localeCompare(b.date));
 const latest=rows.at(-1)||null,w7=window(rows,7),w14=window(rows,14);
 const pre=rows.filter(r=>r.date>=BASELINE.preStart&&r.date<=BASELINE.preEnd);
 const post=rows.filter(r=>r.date>=BASELINE.postStart&&r.date<=BASELINE.postEnd);
 const preMean=pre.length===6&&isConsecutive(pre)?num(pre,'impressions'):null;
 // Early post-collapse anchor is the first week; incomplete anchor is withheld.
 const initial=post.filter(r=>r.date<='20260930');
 const postMean=initial.length===7&&isConsecutive(initial)?num(initial,'impressions'):null;
 const reportDate=latest?Date.parse(latest.date.slice(0,4)+'-'+latest.date.slice(4,6)+'-'+latest.date.slice(6,8)+'T00:00:00Z'):NaN;
 const todayUTC=Date.UTC(clock.getUTCFullYear(),clock.getUTCMonth(),clock.getUTCDate());
 const dataAgeDays=Number.isFinite(reportDate)?Math.floor((todayUTC-reportDate)/86400000):null;
 const ingestAgeHours=d.updatedAt?Math.max(0,(clock-Date.parse(d.updatedAt))/3600000):null;
 const freshness=dataAgeDays===null?'no-data':dataAgeDays>6||ingestAgeHours!==null&&ingestAgeHours>48?'stale':'current';
 const recent7=w7?num(w7,'impressions'):null,prior7=w14?num(w14.slice(0,7),'impressions'):null;
 const clicks7=w7?num(w7,'clicks'):null,priorClicks7=w14?num(w14.slice(0,7),'clicks'):null;
 const ratio=preMean&&recent7!==null?recent7/preMean:null;
 const change=prior7&&recent7!==null?(recent7-prior7)/prior7:null;
 let milestone='insufficient-data';
 if(freshness==='current'&&change!==null){
  milestone=change>=.5&&recent7>=100?'sustained-gain-candidate':change<=-.3?'sustained-decline-candidate':'no-clear-shift';
 }
 return {latest,preMean,postMean,recent7,prior7,clicks7,priorClicks7,
   ratio,change,dataAgeDays,ingestAgeHours,freshness,milestone,
   caveat:'Seven-day comparisons require 14 consecutive recorded dates; performance changes do not establish indexing errors or Google penalties.'};
}
