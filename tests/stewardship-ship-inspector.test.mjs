import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateInventory} from '../preview/ship-inspector.js';
const fixture=()=>({contractVersion:1,scope:'ship-guide-stewardship-offline-inventory',observedAt:'2026-10-14T04:30:00Z',coverage:{listedGuides:1,linkObservations:1,historicalAuditSupplied:false,completeness:'export-scoped-not-live-certification'},guides:[{path:'/ships/rms-olympic',sourceUrl:'https://oceanliners.net/ships/rms-olympic',checks:{archiveInventory:'listed',staticLinkAudit:'observed',contextualIncoming:0,historicalConsistency:'unknown',historicalAccuracy:'not-assessed',externalCitationValidity:'not-assessed'},candidates:[{kind:'contextual-link-review',verification:'unverified',note:'No static contextual incoming links found; script-generated links are excluded.'}]}]});
test('valid source-scoped ship export accepted without historical claims',()=>assert.equal(validateInventory(fixture()),true));
test('rejects unsafe URLs and invalid claims',()=>{
 const a=fixture();a.guides[0].sourceUrl='https://evil.example/ships/rms-olympic';assert.equal(validateInventory(a),false);
 const b=fixture();b.guides[0].checks.historicalAccuracy='verified';assert.equal(validateInventory(b),false);
 const c=fixture();c.guides[0].candidates[0].verification='confirmed';assert.equal(validateInventory(c),false);
});
test('rejects duplicate guide paths and inconsistent coverage',()=>{
 const a=fixture();a.guides.push(a.guides[0]);a.coverage.listedGuides=2;assert.equal(validateInventory(a),false);
 const b=fixture();b.coverage.linkObservations=0;assert.equal(validateInventory(b),false);
});
test('browser inspector only reads user-selected local file, never uploads',()=>{
 const s=readFileSync(new URL('../preview/ship-inspector.js',import.meta.url),'utf8');
 assert.ok(s.includes('await file.text()'));
 assert.equal(s.includes('fetch('),false);
 assert.equal(s.includes('innerHTML'),false);
});
