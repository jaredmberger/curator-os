"use strict";
const LEDGER="https://raw.githubusercontent.com/jaredmberger/Ocean-Liner-Curator/main/research/agent-ledger.json";
const source="https://github.com/jaredmberger/Ocean-Liner-Curator/blob/main/research/agent-ledger.json";
const cards=document.getElementById("cards"),search=document.getElementById("search");
const filter=document.getElementById("status-filter"),summary=document.getElementById("summary");
let entries=[];
function append(tag,value,parent,className){const el=document.createElement(tag);if(className)el.className=className;if(value!==null)el.textContent=String(value);parent.append(el);return el;}
function safeRunUrl(url){try{const u=new URL(url);return u.protocol==="https:"&&u.hostname==="github.com"&&u.pathname.startsWith("/jaredmberger/Ocean-Liner-Curator/actions/runs/")?u.href:null}catch{return null}}
function render(){
 cards.replaceChildren();
 const q=search.value.trim().toLowerCase();
 const selected=entries.filter(e=>(!filter.value||e.review_status===filter.value)&&(!q||[e.guide,e.notes,e.review_status].join(" ").toLowerCase().includes(q)));
 summary.textContent=selected.length+" of "+entries.length+" investigations";
 for(const item of selected){
   const box=append("article",null,cards,"card");append("div",item.review_status?.replaceAll("_"," ")||"Unverified",box,"status");
   append("h2",item.guide.replace(/\.html$/,"").replaceAll("-"," "),box);
   append("small","Investigated: "+(item.investigated_at||"Unknown"),box);
   append("p",item.notes||"Evidence requires editorial review.",box,"muted");
   const links=append("div",null,box,"actions"),url=safeRunUrl(item.dossier);
   if(url){const a=append("a","Research run / dossier artifact",links);a.href=url;a.rel="noopener noreferrer";a.target="_blank"}
 }
 if(!selected.length)append("p","No investigations match your search.",cards,"muted");
}
async function load(){
 try{
  const response=await fetch(LEDGER,{cache:"no-store"});
  if(!response.ok)throw Error("Research ledger unavailable (HTTP "+response.status+")");
  const ledger=await response.json();
  if(ledger.schema_version!==1||!ledger.entries||typeof ledger.entries!=="object")throw Error("Unexpected research ledger format");
  entries=Object.entries(ledger.entries).map(([guide,v])=>({guide,...v})).sort((a,b)=>(b.investigated_at||"").localeCompare(a.investigated_at||"")||a.guide.localeCompare(b.guide));
  render();
 }catch(err){
  summary.textContent="Unable to load the research ledger.";
  cards.replaceChildren();
  const p=append("p",err.message+" — ",cards,"muted");const a=append("a","Open the ledger on GitHub",p);a.href=source;a.rel="noopener noreferrer";
 }
}
search.addEventListener("input",render);filter.addEventListener("change",render);load();
