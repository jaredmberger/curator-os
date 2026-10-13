import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorAuthorizationFromBindings as create} from '../tools/stewardship/operator-runtime-adapter.mjs';

const valid=()=>({
 STEWARDSHIP_ACCESS_ISSUER:'https://curator-team.cloudflareaccess.com',
 STEWARDSHIP_ACCESS_AUDIENCE:'example-test-audience',
 STEWARDSHIP_OPERATOR_EMAIL:'operator@example.org'
});
const request=(token)=>new Request('https://example.org/api/stewardship-ops',{headers:token?{'Cf-Access-Jwt-Assertion':token}:{}});
test('absent, incomplete and invalid trusted bindings always deny',async()=>{
 const inputs=[{},null,{...valid(),STEWARDSHIP_OPERATOR_EMAIL:''},
 {...valid(),STEWARDSHIP_ACCESS_ISSUER:'https://attacker.example'},
 {...valid(),STEWARDSHIP_ACCESS_AUDIENCE:' '},
 {...valid(),STEWARDSHIP_OPERATOR_EMAIL:'a@example.org,b@example.org'}];
 for(const bindings of inputs){
  let attempts=0;const guard=create(bindings,{fetchKeys:()=>{attempts++;throw Error('should never fetch')}});
  assert.equal(await guard.authorize(request('a.b.c')),false);
  assert.equal(attempts,0);
 }
});
test('config does not trust a caller-supplied audience, issuer or email',async()=>{
 const trusted=valid();let inspected;
 const guard=create(trusted,{fetchKeys:async(url,init)=>{
  inspected={url,init};return new Response(null,{status:403});
 }});
 const r=new Request('https://example.org/api/stewardship-ops?issuer=https://evil.example&email=intruder@example.org',{
  headers:{'Cf-Access-Jwt-Assertion':'a.b.c','X-Operator-Email':'intruder@example.org'}
 });
 assert.equal(await guard.authorize(r),false);
 assert.equal(inspected.url,'https://curator-team.cloudflareaccess.com/cdn-cgi/access/certs');
 assert.equal(inspected.init.redirect,'manual');
});
test('missing Access assertion denies before external keys are fetched',async()=>{
 let attempts=0;
 const guard=create(valid(),{fetchKeys:async()=>{attempts++;return new Response(null,{status:500})}});
 assert.equal(await guard.authorize(request()),false);
 assert.equal(attempts,0);
});
test('malformed deployment config cannot silently produce an allow rule',async()=>{
 const env=Object.create({STEWARDSHIP_ACCESS_ISSUER:valid().STEWARDSHIP_ACCESS_ISSUER});
 Object.assign(env,{STEWARDSHIP_ACCESS_AUDIENCE:valid().STEWARDSHIP_ACCESS_AUDIENCE,STEWARDSHIP_OPERATOR_EMAIL:valid().STEWARDSHIP_OPERATOR_EMAIL});
 assert.equal(await create(env).authorize(request('a.b.c')),false);
});
