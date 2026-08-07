const NativeDOMParser=window.DOMParser;

class CuratorOSDOMParser extends NativeDOMParser{
  parseFromString(input,type){
    const doc=super.parseFromString(input,type);
    try{injectSyntheticShipFactTable(doc);}catch(error){console.warn('CuratorOS fact-table compatibility parser skipped a block.',error);}
    return doc;
  }
}

window.DOMParser=CuratorOSDOMParser;

function injectSyntheticShipFactTable(doc){
  const factRows=[...doc.querySelectorAll('.facts .fact-row, [role="table"] [role="row"]')];
  if(!factRows.length)return;

  const table=doc.createElement('table');
  table.dataset.curatorosSyntheticFacts='true';
  table.hidden=true;

  const seen=new Set();
  const add=(label,value)=>{
    label=compact(label);value=compact(value);
    if(!label||!value)return;
    const key=`${label.toLowerCase()}|${value.toLowerCase()}`;
    if(seen.has(key))return;
    seen.add(key);
    const tr=doc.createElement('tr');
    const th=doc.createElement('th');
    const td=doc.createElement('td');
    th.textContent=label;td.textContent=value;
    tr.append(th,td);table.append(tr);
  };

  for(const row of factRows){
    const labelNode=row.querySelector('.fact-label,[role="cell"]:first-child');
    const valueNode=row.querySelector('.fact-value,[role="cell"]:last-child');
    const label=compact(labelNode?.textContent);
    const value=compact(valueNode?.textContent);
    if(!label||!value)continue;

    const normalized=label.toLowerCase();
    if(/^operator\s*\(as built\)/i.test(label)){add('Operator',value);continue;}
    if(/owner\s*\/\s*later operator|later operator/i.test(label)){add('Operator later',value);continue;}
    if(/^completed$/i.test(label)){add('Launch date completed',value);continue;}
    if(/^primary route/i.test(label)){add('Route',value);continue;}
    if(/^length\s*\/\s*beam$/i.test(label)){
      const parts=value.split(/\s*\/\s*/);
      if(parts[0])add('Length',parts[0]);
      if(parts[1])add('Beam',parts.slice(1).join(' / '));
      continue;
    }
    if(/^service period$/i.test(label)){add('Service period',value);continue;}
    if(/^type$/i.test(label)){add('Service type',value);continue;}
    if(/^nickname/i.test(label)){add('Service nickname',value);continue;}

    add(label,value);
  }

  (doc.body||doc.documentElement).append(table);
}

function compact(value){return String(value??'').replace(/\s+/g,' ').trim();}
