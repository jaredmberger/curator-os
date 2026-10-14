import test from 'node:test';
import assert from 'node:assert/strict';
import {buildShipStewardshipInventory} from '../tools/stewardship/ship-guide-inventory.mjs';
import {readFileSync} from 'node:fs';
test('known ship chronology is an unverified candidate, not a verified error',()=>{
 const r=buildShipStewardshipInventory({shipPaths:['/ships/rms-olympic','/ships/rms-berengaria'],observedAt:'2026-10-14T04:00:00Z',chronologyFindings:[{level:'review',subject:'rms-olympic',issue:'test date discrepancy'},{level:'review',subject:'Imperator / Berengaria',issue:'same-hull conflict'}]});
 assert.equal(r.coverage.historicalAuditSupplied,true);
 assert.equal(r.guides[0].candidates.length,0);
 assert.equal(r.guides[1].candidates[0].verification,'unverified');
 assert.equal(r.guides[1].checks.historicalAccuracy,'not-assessed');
});
test('workflow invokes source chronology monitor and supplies normalized CSV',()=>{
 const w=readFileSync(new URL('../.github/workflows/ship-stewardship-export.yml',import.meta.url),'utf8');
 assert.match(w,/historical-consistency-monitor\.py/);
 assert.match(w,/normalize-chronology-csv\.py/);
 assert.match(w,/--chronology \.\.\/output\/chronology-normalized\.json/);
});
