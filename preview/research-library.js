const $=id=>document.getElementById(id);const runs=[];let cursor=null,loading=false,selectedRun=null;
const status=t=>{$('status').textContent=t;};
async function request(params={}){const u=new URL('/api/research-library',location.origin);for(const [k,v]of Object.entries(params))if(v)u.searchParams.set(k,v);const r=await fetch(u,{credentials:'same-origin',cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'HTTP '+r.status);return j;}
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function showList(){const list=$('runs');list.replaceChildren();const filter=$('search').value.toLowerCase();for(const item of runs.filter(x=>(x.run_id+' '+(x.files||[]).map(f=>f.name).join(' ')).toLowerCase().includes(filter))){const li=el('li');const button=el('button','Run '+item.run_id);button.onclick=()=>selectRun(item.run_id);li.append(button,el('div',item.error||item.files.length+' archived files'));list.append(li);}$('more').hidden=!cursor;}
async function loadMore(reset=false){if(loading)return;loading=true;$('more').disabled=true;try{if(reset){runs.length=0;cursor=null;}status('Reading archive index…');const data=await request(cursor?{cursor}:{});runs.push(...data.runs);cursor=data.next_cursor;showList();status(runs.length+' archived runs loaded'+(cursor?' (more available)':''));}catch(e){status('Library unavailable: '+e.message);}finally{loading=false;$('more').disabled=false;}}
async function selectRun(id){selectedRun=id;const panel=$('detail');panel.replaceChildren(el('h2','Run '+id),el('p','Reading manifest…'));try{const data=await request({run:id});if(selectedRun!==id)return;panel.replaceChildren(el('h2','Research run '+id),el('p','Unverified · pending editorial review'));const ul=el('ul');for(const f of data.manifest.files){const li=el('li');const b=el('button',f.name);b.onclick=()=>loadFile(id,f.name);li.append(b);ul.append(li);}panel.append(ul);if(!data.manifest.files.length)panel.append(el('p','No supported research files in this manifest.'));}catch(e){panel.append(el('p',e.message));}}
async function loadFile(id,file){const panel=$('detail');panel.replaceChildren(el('h2',file),el('p','Checking archive checksum…'));try{const data=await request({run:id,file});if(selectedRun!==id)return;const back=el('button','← Run files');back.onclick=()=>selectRun(id);const copy=el('button','Copy for ChatGPT review');copy.onclick=async()=>{try{await navigator.clipboard.writeText('Ocean Liner Curator — unverified historical research dossier\\nRun: '+id+'\\nFile: '+file+'\\n\\n'+data.content+'\\n\\nPlease review claims against primary sources and the existing ship guide; do not treat this dossier as verified evidence.');status('Copied dossier for ChatGPT review.');}catch{status('Clipboard unavailable; select and copy the displayed text.');}};panel.replaceChildren(el('h2',file),back,copy,el('p','Unverified working material. Do not incorporate into ship guides without independent review.'),el('pre',data.content));if(file.endsWith('.evidence.json'))await renderReview(id,file,data.content,panel);}catch(e){panel.append(el('p','Could not read file: '+e.message));}}
$('refresh').onclick=()=>loadMore(true);$('more').onclick=()=>loadMore();$('search').oninput=showList;loadMore(true);
async function reviewRequest(run,file,claim,body){
 const u=new URL('/api/research-review',location.origin);
 u.searchParams.set('run',run);u.searchParams.set('file',file);u.searchParams.set('claim',String(claim));
 const r=await fetch(u,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'HTTP '+r.status);return j;
}
async function renderReview(run,file,content,panel){
 let register;try{register=JSON.parse(content)}catch{panel.append(el('p','Evidence register is not valid JSON.'));return;}
 if(!Array.isArray(register.claims))return;
 const section=el('section');section.append(el('h3','Editorial claim review'),el('p','Source checked means an original source was inspected. Verified additionally requires a written explanation supporting the specific claim. Nothing here changes a ship guide.'));
 panel.append(section);
 const prepare=el('button','Prepare reviewed research package');
 const pkgStatus=el('p','Only saved, source-checked verified claims are included. This does not publish or create a PR.');
 section.append(prepare,pkgStatus);
 prepare.onclick=async()=>{
  prepare.disabled=true;
  try{
   const u=new URL('/api/research-incorporation',location.origin);u.searchParams.set('run',run);u.searchParams.set('file',file);
   const r=await fetch(u,{credentials:'same-origin',cache:'no-store'}),packageData=await r.json();
   if(!r.ok||!packageData.ok)throw Error(packageData.error||'Unable to prepare package');
   if(!packageData.eligible_count){pkgStatus.textContent='No qualifying verified claims are saved in CuratorOS yet.';return;}
   const payload='Ocean Liner Curator — reviewed research incorporation proposal\\nDo not edit or publish without explicit user authorization. Compare proposed changes with the current guide, cite original evidence, and prepare a diff for human review.\\n\\n'+JSON.stringify(packageData,null,2);
   await navigator.clipboard.writeText(payload);
   pkgStatus.textContent=packageData.eligible_count+' verified findings copied. Paste into ChatGPT to develop an editorial proposal.';
  }catch(error){pkgStatus.textContent='Package not copied: '+error.message;}finally{prepare.disabled=false;}
 };
 for(const [i,claim] of register.claims.entries()){
  const block=el('article');block.style.cssText='padding:1rem;margin:1rem 0;border:1px solid #485447;border-radius:10px;';
  const heading=el('h4','Claim '+(i+1)+': '+String(claim.claim||''));
  const source=el('p','Source lead: '+String(claim.source_title||'Not supplied'));
  block.append(heading,source);
  if(typeof claim.source_url==='string'&&/^https:\/\//.test(claim.source_url)){try{const u=new URL(claim.source_url);const a=el('a','Open original source ↗');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';block.append(a);}catch{}}
  const state=el('p','Loading review…');block.append(state);section.append(block);
  try{
   const initial=await reviewRequest(run,file,i);let version=initial.review.version||0;
   const sourceStatus=el('select');for(const [value,label] of [['unverified','Source not independently checked'],['source_checked','Original source checked']]){const o=el('option',label);o.value=value;sourceStatus.append(o);}
   sourceStatus.value=initial.review.source_status||'unverified';
   const decision=el('select');for(const [value,label]of [['pending','Pending'],['needs_research','Needs more research'],['rejected','Rejected'],['verified','Verified claim']]){const o=el('option',label);o.value=value;decision.append(o);}
   decision.value=initial.review.status||'pending';
   const reviewer=el('input');reviewer.placeholder='Reviewer name';reviewer.maxLength=120;
   const notes=el('textarea');notes.rows=4;notes.maxLength=4000;notes.placeholder='Evidence examined, citation details, limitations and editorial reasoning';notes.style.cssText='width:100%;margin:.6rem 0;background:#0b1411;color:#eee;';
   const save=el('button','Save editorial decision');const history=el('details');history.append(el('summary','Review history'));const log=el('ol');history.append(log);
   const showHistory=review=>{log.replaceChildren();for(const event of review.events||[])log.append(el('li',event.at+' · '+event.reviewer+' · '+event.status+' · '+event.source_status+' — '+event.notes));};
   showHistory(initial.review);state.textContent='Current: '+(initial.review.status||'pending')+' (version '+version+')';
   save.onclick=async()=>{save.disabled=true;try{const data=await reviewRequest(run,file,i,{status:decision.value,source_status:sourceStatus.value,notes:notes.value,reviewer:reviewer.value,expected_version:version});version=data.review.version;state.textContent='Saved: '+data.review.status+' (version '+version+')';showHistory(data.review);}catch(e){state.textContent='Not saved: '+e.message;}finally{save.disabled=false;}};
   block.append(el('p','Source verification'),sourceStatus,el('p','Claim decision'),decision,el('p','Reviewer'),reviewer,notes,save,history);
   const incorporation=el('details'),summary=el('summary','Guide incorporation / publication record');incorporation.append(summary);
   const pubState=el('p','Loading incorporation history…');incorporation.append(pubState);block.append(incorporation);
   const pubUrl=new URL('/api/research-publication',location.origin);pubUrl.searchParams.set('run',run);pubUrl.searchParams.set('file',file);pubUrl.searchParams.set('claim',String(i));
   try{
    const response=await fetch(pubUrl,{credentials:'same-origin',cache:'no-store'}),initialPub=await response.json();
    if(!response.ok||!initialPub.ok)throw Error(initialPub.error||'Unable to read status');
    let pubVersion=initialPub.incorporation.version||0;
    const pubSelect=el('select');for(const [code,title] of [['not_started','Not incorporated'],['pr_open','PR proposed'],['merged','PR merged (manually confirmed)'],['deployed','Deployment confirmed manually']]){const option=el('option',title);option.value=code;pubSelect.append(option);}
    pubSelect.value=initialPub.incorporation.status;
    const pubPR=el('input');pubPR.placeholder='https://github.com/jaredmberger/Ocean-Liner-Curator/pull/…';pubPR.style.width='100%';pubPR.value=initialPub.incorporation.pr_url||'';
    const pubReviewer=el('input');pubReviewer.placeholder='Person recording this status';
    const pubNotes=el('textarea');pubNotes.rows=3;pubNotes.style.width='100%';pubNotes.placeholder='Which assertion was incorporated? How was merge/deployment confirmed?';
    const checkButton=el('button','Check GitHub PR');const checkResult=el('p','Live GitHub verification not yet requested.');
    checkButton.onclick=async()=>{checkButton.disabled=true;try{
     const u=new URL('/api/research-pr-check',location.origin);u.searchParams.set('pr',pubPR.value.trim());
     const response=await fetch(u,{credentials:'same-origin',cache:'no-store'}),result=await response.json();
     if(!response.ok||!result.ok)throw Error(result.error||'Unable to check GitHub');
     checkResult.textContent='GitHub reports: '+(result.merged?'Merged on '+result.merged_at:result.draft?'Draft PR':'Open PR')+'; base '+result.base+'. This does NOT verify deployment or save an incorporation status.';
    }catch(e){checkResult.textContent='Live status unavailable: '+e.message;}finally{checkButton.disabled=false;}};
    const pubButton=el('button','Record incorporation status');const pubLog=el('ol');const pubHistory=el('details');pubHistory.append(el('summary','Incorporation history'),pubLog);
    const renderPub=x=>{pubState.textContent='Recorded: '+x.status+' (manual attestation; deployment is not checked automatically)';pubLog.replaceChildren();for(const event of x.history||[])pubLog.append(el('li',event.recorded_at+' · '+event.reviewer+' · '+event.status+' · '+(event.pr_url||'no PR')+' — '+event.notes));};
    renderPub(initialPub.incorporation);
    pubButton.onclick=async()=>{pubButton.disabled=true;try{
     const response=await fetch(pubUrl,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({status:pubSelect.value,pr_url:pubPR.value.trim(),reviewer:pubReviewer.value,notes:pubNotes.value,expected_version:pubVersion})});
     const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Unable to save status');
     pubVersion=result.incorporation.version;renderPub(result.incorporation);
    }catch(e){pubState.textContent='Not recorded: '+e.message;}finally{pubButton.disabled=false;}};
    incorporation.append(el('p','Tracking only: this never verifies GitHub status, edits a guide, or triggers deployment.'),pubSelect,pubPR,checkButton,checkResult,pubReviewer,pubNotes,pubButton,pubHistory);
   }catch(e){pubState.textContent='Incorporation status unavailable: '+e.message;}

  }catch(e){state.textContent='Review unavailable: '+e.message;}
 }
}
