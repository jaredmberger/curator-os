const DELETE_STORAGE_KEY='curatoros.rebuilt.catalog';
const DELETE_OPEN_KEY='curatoros.openRecordId';
const DELETE_FOCUS_KEY='curatoros.recordFieldFocus';

const observer=new MutationObserver(()=>enhanceDeleteAction());
observer.observe(document.body,{childList:true,subtree:true});
setTimeout(enhanceDeleteAction,0);

function readRecords(){try{const value=JSON.parse(localStorage.getItem(DELETE_STORAGE_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function recordIdFromInspector(dialog){const row=[...dialog.querySelectorAll('dt')].find(node=>node.textContent.trim().toLowerCase()==='record id');return row?.nextElementSibling?.textContent?.trim()||'';}
function recordTitle(record){return record?.title||record?.name||record?.id||'Untitled record'}
function targetOf(rel){return rel?.target||rel?.id||rel?.recordId||''}

function enhanceDeleteAction(){
  const dialog=document.querySelector('#project-record-inspector');
  if(!dialog||dialog.dataset.deleteEnhanced)return;
  const recordId=recordIdFromInspector(dialog);if(!recordId)return;
  const record=readRecords().find(item=>item.id===recordId);if(!record)return;
  const actions=dialog.querySelector('.record-inspector-actions');if(!actions)return;
  dialog.dataset.deleteEnhanced='true';
  const button=document.createElement('button');
  button.type='button';button.className='record-delete-button';button.textContent='Delete Record';button.dataset.deleteRecord=recordId;
  button.addEventListener('click',()=>deleteRecord(record,button));
  actions.prepend(button);
}

async function deleteRecord(record,button){
  const records=readRecords();
  const inbound=records.flatMap(source=>(Array.isArray(source.relationships)?source.relationships:[]).filter(rel=>targetOf(rel)===record.id).map(rel=>({source,rel})));
  const warning=[
    `Permanently delete “${recordTitle(record)}”?`,
    `Record ID: ${record.id}`,
    '',
    'This removes the record from permanent CuratorOS Project Records and cannot be undone.'
  ];
  if(inbound.length)warning.push('',`${inbound.length} relationship${inbound.length===1?'':'s'} in other record${inbound.length===1?'':'s'} point to this record. Those direct relationships will be removed too so the graph does not keep broken targets.`);
  if(!window.confirm(warning.join('\n')))return;

  button.disabled=true;button.textContent='Deleting…';
  try{
    const next=records.filter(item=>item.id!==record.id).map(item=>{
      if(!Array.isArray(item.relationships))return item;
      const relationships=item.relationships.filter(rel=>targetOf(rel)!==record.id);
      return relationships.length===item.relationships.length?item:{...item,relationships};
    });
    const store=window.CuratorOSProjectRecordsStore;
    if(!store?.save)throw new Error('Permanent Project Records store is not available.');
    await store.save(next,`delete:${record.id}`);
    try{if(sessionStorage.getItem(DELETE_OPEN_KEY)===record.id)sessionStorage.removeItem(DELETE_OPEN_KEY);sessionStorage.removeItem(DELETE_FOCUS_KEY);}catch{}
    const dialog=document.querySelector('#project-record-inspector');if(dialog){try{dialog.close()}catch{}dialog.remove();}
    window.dispatchEvent(new CustomEvent('curatoros:records-changed',{detail:{source:'record-delete',recordId:record.id,removedRelationships:inbound.length}}));
  }catch(error){
    button.disabled=false;button.textContent='Delete Record';
    alert(`The record could not be deleted.\n\n${error instanceof Error?error.message:String(error)}`);
  }
}
