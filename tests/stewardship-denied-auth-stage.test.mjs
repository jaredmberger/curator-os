import test from 'node:test';
import assert from 'node:assert/strict';
import {createShipSnapshotHandler} from '../functions/api/stewardship-ship-snapshot.js';
const env={STEWARDSHIP_SHIP_READ_ENABLED:'true',STEWARDSHIP_ACCESS_ISSUER:'https://test-team.cloudflareaccess.com',STEWARDSHIP_ACCESS_AUDIENCE:'test-audience',STEWARDSHIP_OPERATOR_EMAIL:'operator@example.com'};
const denied=createShipSnapshotHandler(()=>({authorize:async()=>false}));
const req=headers=>new Request('https://curator.oceanliners.net/api/stewardship-ship-snapshot',{headers});
test('denied requests identify invalid runtime configuration without returning values',async()=>{
 const r=await denied({request:req({'Cf-Access-Jwt-Assertion':'a.b.c'}),env:{...env,STEWARDSHIP_OPERATOR_EMAIL:''}});
 assert.equal(r.status,403);assert.equal((await r.json()).reason,'trusted_configuration_unavailable');
});
test('denied requests distinguish missing assertion from rejected assertion',async()=>{
 const missing=await denied({request:req(),env});
 assert.equal((await missing.json()).reason,'signed_assertion_missing');
 const invalid=await denied({request:req({'Cf-Access-Jwt-Assertion':'a.b.c'}),env});
 assert.equal((await invalid.json()).reason,'signed_assertion_not_accepted');
 assert.equal(invalid.headers.get('cache-control'),'private, no-store');
});
