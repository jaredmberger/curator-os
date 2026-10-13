import test from 'node:test';
import assert from 'node:assert/strict';
import {createStewardshipOperatorAuthorizer as create} from '../tools/stewardship/access-key-provider.mjs';
const policy={issuer:'https://test-team.cloudflareaccess.com',audience:'test-aud',allowedEmails:['owner@example.com']};
const token='a.b.c';
const req=(headers={'Cf-Access-Jwt-Assertion':token},method='GET')=>new Request('https://example.invalid/api/stewardship-ops',{method,headers});
test('without assertion, denies before network request',async()=>{
 let calls=0;
 const a=create({policy,fetchKeys:()=>{calls++;throw Error('must not call')}});
 assert.equal(await a.authorize(req({})),false);assert.equal(calls,0);
});
test('fetch always uses fixed trusted team issuer and cannot follow redirects',async()=>{
 let called;
 const a=create({policy,fetchKeys:async(url,opts)=>{
  called={url,opts};return new Response(null,{status:302,headers:{location:'https://attacker.invalid/'}});
 }});
 assert.equal(await a.authorize(req()),false);
 assert.equal(called.url,'https://test-team.cloudflareaccess.com/cdn-cgi/access/certs');
 assert.equal(called.opts.redirect,'manual');
 assert.equal(called.opts.method,'GET');
});
test('denies on denied, non-json, oversized or invalid key responses',async()=>{
 for(const response of [
  new Response(null,{status:403}),
  new Response('<html/>',{headers:{'content-type':'text/html'}}),
  new Response('{}',{headers:{'content-type':'application/json','content-length':'70000'}}),
  new Response('not-json',{headers:{'content-type':'application/json'}}),
  new Response(JSON.stringify({keys:Array(21).fill({})}),{headers:{'content-type':'application/json'}})
 ]){
  const a=create({policy,fetchKeys:async()=>response});assert.equal(await a.authorize(req()),false);
 }
});
test('rejects malformed policy and unsafe HTTP methods',async()=>{
 assert.throws(()=>create({policy:{...policy,issuer:'https://attacker.invalid'}}));
 assert.throws(()=>create({policy:{...policy,allowedEmails:[]}}));
 const a=create({policy,fetchKeys:async()=>{throw Error('must not fetch')}});
 assert.equal(await a.authorize(req({'Cf-Access-Jwt-Assertion':token},'POST')),false);
});
test('JWT must verify against returned keys; forged claims alone are insufficient',async()=>{
 const a=create({policy,fetchKeys:async()=>new Response(JSON.stringify({keys:[]}),{headers:{'content-type':'application/json'}})});
 assert.equal(await a.authorize(req()),false);
});
