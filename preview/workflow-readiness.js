const FLOW_KEY='curatoros.guidedWorkflow';
const CATALOG_KEY='curatoros.rebuilt.catalog';
const MANIFEST_KEY='curatoros.siteSync.currentManifest';
const EXTRACTION_KEY='curatoros.extraction.lastSession';
const COLLECTIONS_KEY='curatoros.knowledge.collections';
const DRAFTS_KEY='curatoros.publication.drafts';
const CONFIRM_KEY='curatoros.workspace.confirmations';

const WORKSPACE_MAP={
  ingest:['site-sync','extract-knowledge','extract-knowledge','extract-knowledge','entity-resolution','evidence-ledger','records'],
  create:['knowledge-explorer','knowledge-explorer','publication-composer','publication-composer','page-assembly','page-assembly'],
  update:['site-sync','records','evidence-ledger','knowledge-explorer','publication-composer','page-assembly','page-assembly'],
  review:['records','records','entity-resolution','knowledge-graph','evidence-ledger','records'],
  explore:['knowledge-graph','knowledge-graph','knowledge-intelligence','knowledge-intelligence','knowledge-explorer','knowledge-explorer']
};

window.CuratorOSWorkflowReadiness={forStep,summary};

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function arr(key){const v=readJson(key,[]);return Array.isArray(v)?v:[]}
function state(){return readJson(FLOW_KEY,{workflow:'',step:0,subject:''})}
function confirmations(){const v=readJson(CONFIRM_KEY,{});return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}

function forStep(workflow,step){
  const workspace=(WORKSPACE_MAP[workflow]||[])[step]||'';
  const s=state();
  const checks=[];
  const manifest=arr(MANIFEST_KEY);
  const records=arr(CATALOG_KEY);
  const extraction=readJson(EXTRACTION_KEY,null);
  const collections=arr(COLLECTIONS_KEY);
  const drafts=arr(DRAFTS_KEY);
  const confirmation=confirmations()[workspace]||null;

  if(workspace==='site-sync')checks.push(check('Site manifest loaded',manifest.length>0,manifest.length?`${manifest.length} indexed pages are available.`:'Load site-index.json before reviewing this step.','import'));
  if(workspace==='extract-knowledge'){
    checks.push(check('Webpage loaded for extraction',!!extraction,extraction?`${extraction.title||extraction.filename||'Extraction session'} is loaded.`:'Choose or paste one HTML page.','import'));
    if(extraction)checks.push(check('Candidate facts available',Array.isArray(extraction.candidates)&&extraction.candidates.length>0,`${extraction.candidates?.length||0} candidate facts found.`,'review'));
    if(step>=3&&workflow==='ingest')checks.push(check('Extraction approved',!!extraction?.approvedAt,extraction?.approvedAt?'Approved into Project Records.':'Use “Approve selected knowledge” before moving on.','save'));
  }
  if(workspace==='records')checks.push(check('Project Records available',records.length>0,records.length?`${records.length} records are available.`:'Import or create Project Records first.','review'));
  if(workspace==='knowledge-explorer')checks.push(check('Reusable collection available',collections.length>0,collections.length?`${collections.length} saved collection${collections.length===1?'':'s'} available.`:'Save a collection before Publication Composer can use it.','save'));
  if(workspace==='publication-composer')checks.push(check('Saved publication brief available',drafts.length>0,drafts.length?`${drafts.length} saved brief${drafts.length===1?'':'s'} available.`:'Build and save a publication brief before Page Assembly.','save'));
  if(workspace==='page-assembly')checks.push(check('Publication brief ready for assembly',drafts.length>0,drafts.length?'A saved brief can be selected in Page Assembly.':'No saved publication brief is available yet.','import'));
  if(['entity-resolution','knowledge-graph','knowledge-intelligence','evidence-ledger'].includes(workspace))checks.push(check('Project Records available',records.length>0,records.length?`${records.length} records can be reviewed.`:'This workspace needs Project Records first.','review'));
  if(confirmation)checks.push(check('Workspace task confirmed',true,`${confirmation.status==='skipped'?'Skipped / not applicable':'Confirmed'} ${formatDate(confirmation.at)}.`,'confirm'));

  return {workspace,subject:s.subject||'',checks,ready:checks.every(c=>c.ok||c.kind==='confirm')};
}

function summary(workflow,step){const r=forStep(workflow,step);const missing=r.checks.filter(c=>!c.ok);return{...r,missingCount:missing.length,nextMissing:missing[0]||null}}
function check(labelText,ok,detail,kind){return{label:labelText,ok:!!ok,detail,kind}}
function formatDate(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString()}
