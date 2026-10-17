import assert from 'node:assert/strict';
import {classifyWatchtower} from '../functions/lib/watchtower-triage.js';
const sample={events:[
 {type:'rank-drop',page:'/ships/a',title:'Ranking decline',snapshotDate:'20261017'},
 {type:'indexing-blocked',page:'/ships/b',title:'Blocked',snapshotDate:'20261017'},
 {type:'indexing-blocked',page:'/ships/b',title:'Duplicate',snapshotDate:'20261017'},
 {type:'unknown-future',page:'/ships/c',snapshotDate:'20261017'},
 {type:'rank-rise',page:'/ships/a',snapshotDate:'20261017'}
]};
const r=classifyWatchtower(sample,'20261017');
assert.equal(r.technical.length,1);assert.equal(r.ranking.length,2);assert.equal(r.other.length,1);
assert.equal(r.technical[0].page,'/ships/b');
assert.equal(classifyWatchtower({events:[]}).technical.length,0);
console.log('Watchtower technical triage tests passed');
