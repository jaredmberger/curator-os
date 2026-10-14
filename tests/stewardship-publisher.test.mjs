import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/ship-stewardship-export.yml',import.meta.url),'utf8');
test('snapshot publication is manual, main-only and has a protected approval environment',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/default: false/);
 assert.match(workflow,/github\.event_name == 'workflow_dispatch'/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/environment: stewardship-snapshot-publishing/);
 assert.match(workflow,/needs: export/);
});
test('publication uses an independent scoped credential and a fixed storage key',()=>{
 assert.match(workflow,/secrets\.STEWARDSHIP_SNAPSHOT_KV_WRITE_TOKEN/);
 assert.match(workflow,/vars\.STEWARDSHIP_SHIP_KV_NAMESPACE_ID/);
 assert.match(workflow,/verify-ship-export\.mjs output\/ship-stewardship\.json/);
 assert.match(workflow,/verified%3Aship-stewardship%3Av1/);
 assert.match(workflow,/r\.success!==true/);
 assert.doesNotMatch(workflow,/pull_request_target:/);
 assert.doesNotMatch(workflow,/git push/);
});
