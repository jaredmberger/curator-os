import test from 'node:test';
import assert from 'node:assert/strict';
import {buildShipStewardshipInventory} from '../tools/stewardship/ship-guide-inventory.mjs';
const source=()=>({shipPaths:['https://oceanliners.net/ships/rms-olympic','/ships/ss-united-states'],observedAt:'2026-10-14T04:35:00Z',revision:'1234567',linkAudit:{pages:[{path:'/ships/rms-olympic',incoming:1,contextual:0,fromShipIndex:true},{path:'/other',incoming:7,contextual:3}]}});
test('per-ship inventory preserves missing observations as unknown',()=>{
 const result=buildShipStewardshipInventory(source());
 assert.equal(result.coverage.listedGuides,2);assert.equal(result.coverage.linkObservations,1);
 const olympic=result.guides.find(x=>x.path==='/ships/rms-olympic');
 assert.equal(olympic.candidates[0].kind,'contextual-link-review');
 assert.equal(olympic.candidates[0].verification,'unverified');
 assert.equal(result.guides.find(x=>x.path==='/ships/ss-united-states').checks.staticLinkAudit,'unknown');
 assert.equal(olympic.checks.historicalAccuracy,'not-assessed');
});
test('known chronology notice attaches only to exact slug',()=>{
 const x=source();x.chronologyFindings=[{level:'review',subject:'rms-olympic',issue:'test chronology'},{level:'review',subject:'Imperator / Berengaria',issue:'same hull group'}];
 const result=buildShipStewardshipInventory(x);
 const one=result.guides.find(y=>y.path==='/ships/rms-olympic');
 assert.equal(one.candidates.length,2);
 assert.equal(result.guides.reduce((n,y)=>n+y.candidates.length,0),2);
});
test('rejects duplicate, unsafe or offsite paths',()=>{
 const x=source();x.shipPaths.push('/ships/rms-olympic');assert.throws(()=>buildShipStewardshipInventory(x));
 for(const bad of ['https://example.org/ships/test','/ships/../admin','/ships/ss-test?delete=1']){
  const y=source();y.shipPaths=[bad];assert.throws(()=>buildShipStewardshipInventory(y));
 }
});
test('invalid link counts fail closed',()=>{
 const x=source();x.linkAudit.pages[0].contextual=4;assert.throws(()=>buildShipStewardshipInventory(x));
});
test('no exports never imply zero external errors',()=>{
 const x=source();x.linkAudit=null;
 const r=buildShipStewardshipInventory(x);
 assert.equal(r.coverage.linkObservations,0);
 assert.ok(r.guides.every(g=>g.checks.staticLinkAudit==='unknown'&&g.checks.externalCitationValidity==='not-assessed'));
});
