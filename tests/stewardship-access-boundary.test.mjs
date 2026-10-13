import test from 'node:test';
import assert from 'node:assert/strict';

// Inventory of reviewed Cloudflare Access bypass patterns, NOT an enforcement
// engine or claim about deployed policy precedence.
const reviewedBypasses=[
 '/api/device/v1/status','/api/runtime','/api/harware-errors-recheck',
 '/api/random-ship','/api/ship-image*','/api/on-this-day*',
 '/api/project-records','/api/link-map','/health','/api/hardware-status'
];
const inPattern=(path,pattern)=>pattern.endsWith('*')
  ? path.startsWith(pattern.slice(0,-1)) : path===pattern;
const matchesReviewedBypass=path=>reviewedBypasses.some(p=>inPattern(path,p));

test('planned stewardship paths are not in inspected bypass list',()=>{
 for(const path of ['/api/stewardship','/api/stewardship/status','/api/stewardship-ops','/api/stewardship/review']){
  assert.equal(matchesReviewedBypass(path),false,path);
 }
});
test('test harness recognizes known exact and wildcard exceptions',()=>{
 assert.equal(matchesReviewedBypass('/api/runtime'),true);
 assert.equal(matchesReviewedBypass('/api/ship-image/example'),true);
 assert.equal(matchesReviewedBypass('/api/on-this-day/1940'),true);
});
test('similar prefixes do not qualify as reviewed exact-match bypasses',()=>{
 assert.equal(matchesReviewedBypass('/api/runtime-private'),false);
 assert.equal(matchesReviewedBypass('/api/project-records-secret'),false);
});
