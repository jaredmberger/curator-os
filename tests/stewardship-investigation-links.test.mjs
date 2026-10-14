import test from 'node:test';
import assert from 'node:assert/strict';
import {investigationDestination,referenceDashboards} from '../tools/stewardship/investigation-destinations.mjs';
import {readFileSync} from 'node:fs';
test('Curator Ops candidates navigate only to fixed authoritative dashboard',()=>{
 const destination=investigationDestination('Curator Ops');
 assert.equal(destination.href,'https://ops.oceanlinercurator.com/operational-state');
 assert.equal(investigationDestination('Site Health'),null);
 assert.equal(investigationDestination('https://evil.example'),null);
 assert.equal(investigationDestination(''),null);
});
test('all destinations are fixed HTTPS origins without query or hash input',()=>{
 for(const entry of referenceDashboards()){
  const url=new URL(entry.href);
  assert.equal(url.protocol,'https:');assert.equal(url.pathname,'/');
  assert.equal(url.search,'');assert.equal(url.hash,'');
  assert.ok(['ops.oceanlinercurator.com','site-health.oceanliners.net','integrity.oceanliners.net'].includes(url.hostname));
 }
});
test('dashboard uses DOM-owned links with safe new-tab isolation, not finding IDs',()=>{
 const content=readFileSync(new URL('../preview/stewardship.js',import.meta.url),'utf8');
 assert.match(content,/investigationDestination\(f.source\)/);
 assert.match(content,/link\.href=destination\.href/);
 assert.match(content,/noopener noreferrer/);
 assert.equal(content.includes('innerHTML'),false);
});
