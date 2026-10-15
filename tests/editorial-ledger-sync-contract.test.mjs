import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,putDecision} from '../tools/stewardship/editorial-ledger.mjs';
import {createInitialSyncEnvelope,validateSyncEnvelope,planLedgerSync,validateMutationProposal} from '../tools/stewardship/editorial-ledger-sync-contract.mjs';
const c={kind:'contextual-link-review',note:'Review contextual relationship'};
test('initial sync envelope is explicit and empty, never an implied clean archive',()=>{
 const x=createInitialSyncEnvelope();assert.equal(validateSyncEnvelope(x),true);assert.equal(x.ledger.entries.length,0);
 assert.equal(validateSyncEnvelope({...x,scope:'public-archive'}),false);
});
test('sync proposal merges offline evidence without overwriting a newer remote decision',()=>{
 const remote=createInitialSyncEnvelope();
 const local=putDecision(emptyLedger(),'/ships/rms-olympic',c,'needs-research','Examine service history','2026-10-15T07:00:00Z');
 const result=planLedgerSync({local,remote,expectedRevision:'initial'});
 assert.equal(result.action,'propose');assert.equal(result.merged.entries.length,1);
 assert.equal(result.merged.entries[0].status,'needs-research');
});
test('revision mismatch always causes conflict, not a silent overwrite',()=>{
 const x=createInitialSyncEnvelope();
 assert.deepEqual(planLedgerSync({local:emptyLedger(),remote:x,expectedRevision:'a'.repeat(64)}),{action:'conflict',remoteRevision:'initial'});
});
test('unchanged ledger requires no proposal',()=>{
 const x=createInitialSyncEnvelope();
 assert.equal(planLedgerSync({local:emptyLedger(),remote:x,expectedRevision:'initial'}).action,'unchanged');
});
test('write proposals require strict revision, request id and validated decision list',()=>{
 const good={contractVersion:1,scope:'operator-editorial-ledger',expectedRevision:'initial',requestId:'a'.repeat(16),ledger:emptyLedger()};
 assert.equal(validateMutationProposal(good),true);
 assert.equal(validateMutationProposal({...good,requestId:'tiny'}),false);
 assert.equal(validateMutationProposal({...good,expectedRevision:'none'}),false);
 assert.equal(validateMutationProposal({...good,ledger:{version:1,entries:[{invalid:true}]}}),false);
});
