const picker=document.querySelector('#files');
const search=document.querySelector('#search');
const status=document.querySelector('#status');
const cards=document.querySelector('#cards');
let entries=[];
const allowedTypes=new Set(['contemporary_primary','archival_catalog','scholarly_secondary','general_secondary','derivative','unknown']);
function node(tag,text,parent,cls){const item=document.createElement(tag);if(cls)item.className=cls;if(text!=null)item.textContent=String(text);parent.append(item);return item}
function field(dl,name,value){node('dt',name,dl);node('dd',value||'Not specified',dl)}
function render(){
  cards.replaceChildren();
  const query=search.value.trim().toLowerCase();
  const selected=entries.filter(c=>JSON.stringify(c).toLowerCase().includes(query));
  status.textContent=entries.length?selected.length+' of '+entries.length+' unverified claims shown':'No evidence registers loaded.';
  for(const item of selected){
    const box=node('article',null,cards,'card');
    node('small',item.guide,box);
    node('h2',item.claim||'Unspecified claim',box);
    node('p','UNVERIFIED · AWAITING HUMAN EDITORIAL REVIEW',box,'muted');
    const dl=node('dl',null,box);
    field(dl,'Baseline comparison',item.guide_comparison);
    field(dl,'Source classification',item.source_type);
    field(dl,'Model-reported source access',item.access_status);
    field(dl,'Source allegedly supports',item.source_support);
    field(dl,'Ship identity and era',item.identity_and_period);
    field(dl,'Uncertainty',item.uncertainty);
    field(dl,'Further verification',item.verification_needed);
    if(item.source_url && /^https?:\/\//i.test(item.source_url)){
      const p=node('p',null,box);
      const a=node('a',item.source_title||item.source_url,p);a.href=item.source_url;a.target='_blank';a.rel='noopener noreferrer';
    }else node('p','Source URL not provided',box,'muted');
  }
}
picker.addEventListener('change',async()=>{
  entries=[];const errors=[];
  for(const file of picker.files){
    if(!file.name.endsWith('.evidence.json')){errors.push(file.name+': not an evidence-register file');continue}
    if(file.size>1024*1024){errors.push(file.name+': file too large');continue}
    try{
      const data=JSON.parse(await file.text());
      if(data.schema_version!==1||typeof data.guide!=='string'||!Array.isArray(data.claims)||data.claims.length>20)throw Error('Invalid evidence register');
      for(const claim of data.claims){
        if(!claim||typeof claim!=='object'||typeof claim.claim!=='string')throw Error('Invalid claim');
        entries.push({...claim,guide:data.guide,source_type:allowedTypes.has(claim.source_type)?claim.source_type:'unknown'});
      }
    }catch(e){errors.push(file.name+': '+e.message)}
  }
  render();
  if(errors.length)node('p',errors.join('; '),cards,'error');
});
search.addEventListener('input',render);
render();
