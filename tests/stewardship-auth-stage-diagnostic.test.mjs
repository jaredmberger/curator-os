import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiagnosticHandler} from '../functions/api/stewardship-auth-diagnostic.js';
import {diagnoseAccessRequest} from '../tools/stewardship/access-stage-diagnostic.mjs';
const env={STEWARDSHIP_AUTH_DIAGNOSTIC_ENABLED:'true',STEWARDSHIP_ACCESS_ISSUER:'https://test-team.cloudflareaccess.com',STEWARDSHIP_ACCESS_AUDIENCE:'test-audience',STEWARDSHIP_OPERATOR_EMAIL:'operator@example.com'};
const req=(headers={})=>new Request('https://curator.oceanliners.net/api/stewardship-auth-diagnostic',{headers});
test('diagnostics disabled unless operator opt-in exists',async()=>{
 const response=await createDiagnosticHandler()({request:req(),env:{}});
 assert.equal(response.status,404);
});
test('stage-only diagnostics distinguish missing, ambiguous, and config',async()=>{
 const a=await diagnoseAccessRequest(req(),env,()=>({authorize:async()=>false}));
 assert.equal(a.stage,'signed_assertion_missing');
 const b=await diagnoseAccessRequest(req({'Cf-Access-Jwt-Assertion':'a.b.c',cookie:'CF_Authorization=a.b.c'}),env,()=>({authorize:async()=>false}));
 assert.equal(b.stage,'ambiguous_credentials');
 const c=await diagnoseAccessRequest(req(),{},()=>({authorize:async()=>false}));
 assert.equal(c.stage,'trusted_configuration_unavailable');
 for(const x of [a,b,c])assert.deepEqual(Object.keys(x).sort(),['available','stage']);
});
test('invalid signed token stages never expose token or identity',async()=>{
 const token='a.b.c';
 const result=await diagnoseAccessRequest(req({cookie:'CF_Authorization='+token}),env,()=>({authorize:async()=>false}),async()=>new Response(JSON.stringify({keys:[]}),{headers:{'content-type':'application/json'}}));
 assert.equal(result.stage,'signed_assertion_not_accepted');
 assert.equal(JSON.stringify(result).includes(token),false);
 assert.equal(JSON.stringify(result).includes('operator@example.com'),false);
});
test('unavailable key endpoint gives bounded status',async()=>{
 const result=await diagnoseAccessRequest(req({'Cf-Access-Jwt-Assertion':'a.b.c'}),env,()=>({authorize:async()=>false}),async()=>new Response(null,{status:503}));
 assert.equal(result.stage,'signing_keys_unavailable');
});
