import { readFile } from 'node:fs/promises';

const manifest=JSON.parse(await readFile(new URL('../recovery/infrastructure.json',import.meta.url),'utf8'));
const errors=[];

if(manifest.schemaVersion!==1)errors.push('schemaVersion must be 1.');
if(!Array.isArray(manifest.services)||!manifest.services.length)errors.push('services must be a non-empty array.');
if(!Array.isArray(manifest.recoveryOrder)||!manifest.recoveryOrder.length)errors.push('recoveryOrder must be a non-empty array.');

const ids=new Set();
const repos=new Set();
const hosts=new Set();
const bindingIds=new Map();
const recoveryOwners=new Set();

for(const service of manifest.services||[]){
  if(!service.id)errors.push('Every service must have an id.');
  if(ids.has(service.id))errors.push(`Duplicate service id: ${service.id}`);
  ids.add(service.id);

  if(!service.repository)errors.push(`${service.id}: repository is required.`);
  if(service.repository&&repos.has(service.repository))errors.push(`Duplicate repository: ${service.repository}`);
  if(service.repository)repos.add(service.repository);

  if(service.host){
    if(hosts.has(service.host))errors.push(`Duplicate host: ${service.host}`);
    hosts.add(service.host);
  }

  for(const secret of service.secrets||[]){
    if(typeof secret!=='string'||!secret.trim())errors.push(`${service.id}: invalid secret name.`);
    if(/token|key|secret/i.test(secret)===false)errors.push(`${service.id}: unusual secret name ${secret}; verify it is a name, not a value.`);
  }

  if(service.runtimeIdentity){
    const identity=service.runtimeIdentity;
    if(identity.runtime==='static-assets'){
      if(identity.contractVersion!==null)errors.push(`${service.id}: static runtimeIdentity contractVersion must be null.`);
    }else{
      if(identity.contractVersion!==1)errors.push(`${service.id}: runtimeIdentity contractVersion must be 1.`);
      if(!['cloudflare-workers','cloudflare-pages'].includes(identity.runtime))errors.push(`${service.id}: invalid runtimeIdentity runtime ${identity.runtime}.`);
      if(!identity.endpoint&&!identity.path)errors.push(`${service.id}: runtimeIdentity requires endpoint or path.`);
      if(identity.endpoint&&!/^https:\/\//.test(identity.endpoint))errors.push(`${service.id}: runtimeIdentity endpoint must be https.`);
    }
  }

  for(const kv of service.kvBindings||[]){
    if(!kv.binding)errors.push(`${service.id}: KV binding name is required.`);
    if(kv.namespaceId!==null&&!/^[a-f0-9]{32}$/i.test(kv.namespaceId||''))errors.push(`${service.id}/${kv.binding}: namespaceId must be null or 32 hex chars.`);
    if(!kv.recoveryOwner)errors.push(`${service.id}/${kv.binding}: recoveryOwner is required.`);
    recoveryOwners.add(kv.recoveryOwner);

    if(kv.namespaceId){
      const previous=bindingIds.get(kv.binding);
      if(previous&&previous!==kv.namespaceId)errors.push(`Binding ${kv.binding} has conflicting namespace IDs.`);
      bindingIds.set(kv.binding,kv.namespaceId);
    }

    if(kv.shared===true&&kv.recoveryExport)errors.push(`${service.id}/${kv.binding}: shared consumer must not advertise its own recovery export.`);
  }
}

for(const id of manifest.recoveryOrder||[]){
  if(!ids.has(id))errors.push(`recoveryOrder references unknown service: ${id}`);
}
for(const id of ids){
  if(!manifest.recoveryOrder.includes(id))errors.push(`Service missing from recoveryOrder: ${id}`);
}
for(const owner of recoveryOwners){
  if(!ids.has(owner))errors.push(`KV recoveryOwner references unknown service: ${owner}`);
}

const recoveryTokenUsers=(manifest.services||[]).filter(s=>(s.secrets||[]).includes('RECOVERY_EXPORT_TOKEN'));
for(const service of recoveryTokenUsers){
  const owned=(service.kvBindings||[]).filter(kv=>kv.recoveryOwner===service.id&&kv.recoveryExport);
  if(!owned.length)errors.push(`${service.id}: RECOVERY_EXPORT_TOKEN declared but no owned recovery export is present.`);
}

const curatorOs=(manifest.services||[]).find(s=>s.id==='curator-os');
const institutional=curatorOs?.kvBindings?.find(kv=>kv.binding==='CURATOROS_RECORDS');
if(!institutional)errors.push('CuratorOS must declare CURATOROS_RECORDS.');
if(institutional?.namespaceId!==null)errors.push('CURATOROS_RECORDS namespaceId must remain null until explicitly verified and intentionally recorded.');

if(errors.length){
  console.error('Recovery infrastructure manifest validation failed:');
  for(const error of errors)console.error(`- ${error}`);
  process.exit(1);
}

console.log('Recovery infrastructure manifest is valid.');
console.log(`Services: ${manifest.services.length}`);
console.log(`Known KV bindings: ${[...bindingIds.keys()].length}`);
console.log(`Unique production hosts recorded: ${hosts.size}`);
