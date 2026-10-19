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
   if(url){const a=append("a","Original GitHub research run",links);a.href=url;a.rel="noopener noreferrer";a.target="_blank";const found=new URL(url).pathname.match(/^\/jaredmberger\/Ocean-Liner-Curator\/actions\/runs\/([0-9]+)(?:\/|$)/);if(found){const archive=append("button","View archived dossier",links);archive.type="button";archive.addEventListener("click",()=>showArchive(found[1],item.guide,box));}}
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

async function showArchive(run,guide,box){
 const existing=box.querySelector(".archive-preview");
 if(existing){existing.remove();return}
 const panel=append("div",null,box,"archive-preview");
 append("p","Checking private archived dossier…",panel,"muted");
 try{
  const manifestRes=await fetch("/api/research-library/file?"+new URLSearchParams({run,file:"manifest.json"}),{cache:"no-store"});
  if(!manifestRes.ok)throw Error(manifestRes.status===404?"Not archived yet":"Archive unavailable (HTTP "+manifestRes.status+")");
  const manifest=await manifestRes.json();
  if(manifest.run_id!==run||!Array.isArray(manifest.files))throw Error("Invalid archive manifest");
  const base=guide.replace(/\\.html$/,"");
  const selected=manifest.files.find(f=>f.name===base+".md");
  if(!selected)throw Error("No matching dossier in archive");
  const fileRes=await fetch("/api/research-library/file?"+new URLSearchParams({run,file:selected.name}),{cache:"no-store"});
  if(!fileRes.ok)throw Error("Unable to retrieve dossier (HTTP "+fileRes.status+")");
  const content=await fileRes.text();
  if(content.length>1024*1024)throw Error("Dossier exceeds display limit");
  panel.replaceChildren();
  append("p","UNVERIFIED RESEARCH · READ-ONLY",panel,"status");
  const pre=append("pre",content,panel);pre.style.whiteSpace="pre-wrap";pre.style.overflowWrap="anywhere";pre.style.maxHeight="540px";pre.style.overflowY="auto";
 }catch(error){panel.replaceChildren();append("p",error.message,panel,"muted")}
}
