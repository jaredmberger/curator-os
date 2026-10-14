import test from 'node:test';
import assert from 'node:assert/strict';
import {createShipSnapshotHandler} from '../functions/api/stewardship-ship-snapshot.js';
import {buildShipStewardshipInventory} from '../tools/stewardship/ship-guide-inventory.mjs';
const req=()=>({request:new Request('https://curator.oceanliners.net/api/stewardship-ship-snapshot')});
const fakeAuth=allowed=>()=>({authorize:async()=>allowed});
const fixture=()=>{
 const paths=Array.from({length:301},(_,i)=>'/ships/test-'+i);
 const report=buildShipStewardshipInventory({shipPaths:paths,linkAudit:{pages:paths.map(path=>({path,incoming:1,contextual:1}))},chronologyFindings:[],observedAt:new Date().toISOString(),revision:'a'.repeat(40)});
 return JSON.stringify(report);
};
test('disabled route rejects before authorization or reading storage',async()=>{
 const handler=createShipSnapshotHandler(()=>{throw Error('should not authorize')});
 const response=await handler({...req(),env:{}});
 assert.equal(response.status,404);
});
test('denied operator cannot access snapshot',async()=>{
 let read=false;
 const response=await createShipSnapshotHandler(fakeAuth(false))({...req(),env:{STEWARDSHIP_SHIP_READ_ENABLED:'true',STEWARDSHIP_SHIP_SNAPSHOTS:{get:async()=>{read=true;return fixture();}}}});
 assert.equal(response.status,403);assert.equal(read,false);
});
test('verified, timely snapshot is available only to authorized operator',async()=>{
 const response=await createShipSnapshotHandler(fakeAuth(true))({...req(),env:{STEWARDSHIP_SHIP_READ_ENABLED:'true',STEWARDSHIP_SHIP_SNAPSHOTS:{get:async key=>key==='verified:ship-stewardship:v1'?fixture():null}}});
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.snapshot.coverage.listedGuides,301);
});
test('stale snapshot fails closed',async()=>{
 const old=JSON.parse(fixture());old.observedAt='2020-01-01T00:00:00Z';
 const response=await createShipSnapshotHandler(fakeAuth(true))({...req(),env:{STEWARDSHIP_SHIP_READ_ENABLED:'true',STEWARDSHIP_SHIP_SNAPSHOTS:{get:async()=>JSON.stringify(old)}}});
 assert.equal(response.status,503);
});
test('unsupported mutation is rejected',async()=>{
 const response=await createShipSnapshotHandler(fakeAuth(true))({request:new Request('https://curator.oceanliners.net/api/stewardship-ship-snapshot',{method:'POST'}),env:{STEWARDSHIP_SHIP_READ_ENABLED:'true'}});
 assert.equal(response.status,405);
});
