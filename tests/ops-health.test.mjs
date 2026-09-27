import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../functions/api/ops-health.js', import.meta.url), 'utf8');
const { onRequest } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const request = new Request('https://curator.oceanliners.net/api/ops-health?url=https://untrusted.invalid', {headers:{authorization:'do-not-forward',cookie:'private'}});
const snapshot = (state='healthy', age=0) => ({ok:true,snapshot:{effectiveState:state,generatedAt:new Date(Date.now()-age).toISOString(),privateDetail:'never expose'}});
const response = payload => Response.json(payload);
const run = async fetch => (await onRequest({request,env:{CURATOR_OPS:{fetch}}})).json();

test('fixed GET routes return only summaries, without forwarding caller data', async () => {
  const paths=[];
  const data=await run(async req=>{
    paths.push(new URL(req.url).pathname);
    assert.equal(req.method,'GET'); assert.equal(req.redirect,'manual');
    assert.equal(req.headers.get('authorization'),null); assert.equal(req.headers.get('cookie'),null);
    assert.equal(new URL(req.url).search,'');
    return response(snapshot());
  });
  assert.deepEqual(paths.sort(),['/api/browser-search-journey','/api/public-site-journey','/api/self-test']);
  assert.equal(data.available,true);
  assert.equal(data.checks.journey.state,'healthy');
  assert.ok(!JSON.stringify(data).includes('never expose'));
});
test('missing binding gives setup state; write methods cannot reach Ops',async()=>{
  const res=await onRequest({request,env:{}});
  assert.equal(res.headers.get('cache-control'),'no-store');
  assert.equal(res.headers.get('access-control-allow-origin'),null);
  assert.equal((await res.json()).checks.journey.reason,'not_configured');
  for(const method of ['POST','PUT','DELETE','OPTIONS']){
    const res=await onRequest({request:new Request(request.url,{method}),env:{CURATOR_OPS:{fetch(){throw Error('must not call')}}}});
    assert.equal(res.status,405);
  }
});
test('an unavailable check does not discard valid results or failure states',async()=>{
  const data=await run(async req=>{
    if(req.url.endsWith('/api/self-test'))throw Error('private failure text');
    return response(snapshot(req.url.endsWith('/api/browser-search-journey')?'persistent':'healthy'));
  });
  assert.equal(data.available,false);
  assert.equal(data.checks.journey.state,'healthy');
  assert.equal(data.checks['browser-search'].state,'persistent');
  assert.equal(data.checks['self-test'].available,false);
  assert.ok(!JSON.stringify(data).includes('private failure text'));
});
test('redirects, login HTML, malformed payloads and unknown states fail honestly',async()=>{
  for(const res of [new Response(null,{status:302}),new Response(null,{status:403}),new Response('<html>login</html>'),response({ok:true}),response({ok:false,snapshot:snapshot().snapshot}),new Response('{',{headers:{'content-type':'application/json'}})]){
    const data=await run(async()=>res.clone());
    assert.equal(data.checks.journey.available,false);
  }
  const data=await run(async()=>response(snapshot('invented')));
  assert.equal(data.checks.journey.state,'unknown');
});
test('old, missing and future timestamps never produce a current healthy result',async()=>{
  const old=await run(async()=>response(snapshot('healthy',21*60000)));
  assert.equal(old.checks.journey.stale,true);
  for(const generatedAt of [null,'invalid',new Date(Date.now()+3600000).toISOString()]){
    const data=await run(async()=>response({ok:true,snapshot:{effectiveState:'healthy',generatedAt}}));
    assert.equal(data.checks.journey.state,'unknown');
    assert.equal(data.checks.journey.checkedAt,null);
  }
  const warming=await run(async()=>response({ok:true,snapshot:{effectiveState:'warming',generatedAt:null}}));
  assert.equal(warming.checks.journey.state,'warming');
});
test('a service that never resolves is bounded and preserves other results',async()=>{
  const data=await run(async req=>req.url.endsWith('/api/self-test')?new Promise(()=>{}):response(snapshot()));
  assert.equal(data.checks['self-test'].reason,'timeout');
  assert.equal(data.checks.journey.state,'healthy');
});

const appSource=await readFile(new URL('../preview/app-shell.js',import.meta.url),'utf8');
const healthSource=appSource.slice(appSource.indexOf('async function loadOpsHealth('),appSource.indexOf('function escapeHtml('));
function card(){
  const nodes={'.ops-health-dot':{},'[data-ops-state]':{}};
  return {dataset:{opsHealth:'journey'},querySelector:key=>nodes[key]||null,append:el=>{nodes['.ops-health-detail']=el},nodes};
}
test('display distinguishes setup, stale, partial failure and recovery; uses same-origin fetch',async()=>{
  const c=card(); let next;
  const context=vm.createContext({AbortController,Date,setTimeout,clearTimeout,document:{createElement:()=>({})},fetch:async(url,options)=>{
    assert.equal(url,'/api/ops-health');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');
    if(next instanceof Error)throw next;return Response.json(next);
  }});
  vm.runInContext(healthSource,context);
  const strip={querySelectorAll:()=>[c]};
  for(const [check,label] of [
    [{available:false,reason:'not_configured'},'Setup needed'],
    [{available:true,state:'healthy',stale:true,checkedAt:new Date(Date.now()-21*60000).toISOString()},'Stale'],
    [{available:true,state:'degraded',checkedAt:new Date().toISOString()},'Degraded'],
    [{available:true,state:'healthy',checkedAt:new Date().toISOString()},'Healthy']
  ]){
    next={schemaVersion:1,checks:{journey:check}};await context.loadOpsHealth(strip);
    assert.equal(c.nodes['[data-ops-state]'].textContent,label);
    assert.ok(c.nodes['.ops-health-detail'].textContent);
  }
  next=new Error('network unavailable');await context.loadOpsHealth(strip);
  assert.equal(c.nodes['[data-ops-state]'].textContent,'Unavailable');
  assert.equal(c.nodes['.ops-health-dot'].className,'ops-health-dot unknown');
});
