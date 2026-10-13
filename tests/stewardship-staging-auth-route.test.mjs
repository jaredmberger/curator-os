import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/stewardship-auth-test.js';
const req=(headers={},method='GET')=>new Request('https://preview.example/api/stewardship-auth-test',{headers,method});
test('default disabled regardless of Access header',async()=>{
 for(const env of [{}, {STAGING_STEWARDSHIP_AUTH_TEST_ENABLED:'false'}]){
  const r=await onRequest({request:req({'Cf-Access-Jwt-Assertion':'a.b.c'}),env});
  assert.equal(r.status,404);assert.equal((await r.text()).includes('authorized'),false);
 }
});
test('enabled without trusted deployment identity settings denies',async()=>{
 const r=await onRequest({request:req(),env:{STAGING_STEWARDSHIP_AUTH_TEST_ENABLED:'true'}});
 assert.equal(r.status,403);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('unverified caller-provided operator info and fake JWT cannot authorize',async()=>{
 const env={STAGING_STEWARDSHIP_AUTH_TEST_ENABLED:'true',STEWARDSHIP_ACCESS_ISSUER:'https://example-team.cloudflareaccess.com',STEWARDSHIP_ACCESS_AUDIENCE:'example-audience',STEWARDSHIP_OPERATOR_EMAIL:'operator@example.org'};
 const request=req({'Cf-Access-Jwt-Assertion':'a.b.c','X-Operator-Email':'operator@example.org','X-CF-Access-Authenticated-User-Email':'operator@example.org'});
 const r=await onRequest({request,env});assert.equal(r.status,403);
});
test('disallow write methods before any auth or upstream activity',async()=>{
 const r=await onRequest({request:req({},'POST'),env:{STAGING_STEWARDSHIP_AUTH_TEST_ENABLED:'true'}});
 assert.equal(r.status,405);
});
