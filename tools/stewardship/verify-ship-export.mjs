#!/usr/bin/env node
// Verify offline archive audit artifact before making it available to operators.
import {readFileSync} from 'node:fs';
import {validateInventory} from '../../preview/ship-inspector.js';
const file=process.argv[2];if(!file)throw new Error('Export filename is required');
const report=JSON.parse(readFileSync(file,'utf8'));
if(!validateInventory(report))throw new Error('Invalid ship stewardship report contract');
if(report.coverage.listedGuides<300)throw new Error('Suspiciously incomplete ship inventory: '+report.coverage.listedGuides);
if(report.coverage.linkObservations<300)throw new Error('Missing or substantially incomplete link observations: '+report.coverage.linkObservations);
if(!/^[0-9a-f]{40}$/.test(report.revision||''))throw new Error('Missing 40-character source archive Git revision');
if(report.coverage.historicalAuditSupplied!==false)throw new Error('Unreviewed chronology import was not expected');
if(!report.guides.every(g=>g.checks.historicalAccuracy==='not-assessed'&&g.checks.externalCitationValidity==='not-assessed'))throw new Error('Unsupported audit assurance');
console.log('Validated read-only ship audit export:',report.coverage.listedGuides,'guides,',report.coverage.linkObservations,'static-link observations, revision',report.revision);
