#!/usr/bin/env node
// Offline, read-only export from existing Ocean Liner Curator audit outputs.
// Usage: node tools/stewardship/build-ship-guide-inventory.mjs --sitemap /path/sitemaps/sitemap-ships.xml [--links /path/internal-link-audit.json] [--output /path/ship-stewardship.json]
import {readFileSync,writeFileSync} from 'node:fs';
import {buildShipStewardshipInventory} from './ship-guide-inventory.mjs';
const arg=key=>{const i=process.argv.indexOf(key);return i<0?null:process.argv[i+1]||null;};
const sitemap=arg('--sitemap');
if(!sitemap)throw new Error('--sitemap required: explicit local source file; no network requests');
const xml=readFileSync(sitemap,'utf8');
const locs=[...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(x=>x[1].trim().replace(/&amp;/g,'&'));
if(!locs.length)throw new Error('No sitemap locations, refusing empty or clean report');
const linksFile=arg('--links');
const links=linksFile?JSON.parse(readFileSync(linksFile,'utf8')):null;
const chronologyFile=arg('--chronology');
const chronology=chronologyFile?JSON.parse(readFileSync(chronologyFile,'utf8')):null;
if(chronology!==null&&!Array.isArray(chronology))throw new Error('Chronology export must be an array');
const result=buildShipStewardshipInventory({
 shipPaths:locs,linkAudit:links,chronologyFindings:chronology,observedAt:new Date().toISOString(),revision:arg('--revision')
});
const out=JSON.stringify(result,null,2)+'\n';
if(arg('--output'))writeFileSync(arg('--output'),out,'utf8');else process.stdout.write(out);
