import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,putDecision,decisionFor,mergeLedger,validLedger,readLedger,saveLedger,LEDGER_STORAGE_KEY} from '../tools/stewardship/editorial-ledger.mjs';
const path='/ships/rms-olympic',c={kind:'contextual-link-review',note:'Review incoming links'};
test('review decisions are candidate-specific and do not change original observation',()=>{
 const original=emptyLedger();
 const result=putDecision(original,path,c,'needs-research','Check company history','2026-10-15T06:00:00Z');
 assert.equal(original.entries.length,0);assert.equal(result.entries.length,1);
 assert.equal(decisionFor(result,path,c).status,'needs-research');
 assert.equal(decisionFor(result,path,{...c,note:'Different observation'}),null);
});
test('reject invalid status and oversized notes',()=>{
 assert.throws(()=>putDecision(emptyLedger(),path,c,'verified',''));
 assert.throws(()=>putDecision(emptyLedger(),path,c,'resolved','x'.repeat(2001)));
 assert.equal(validLedger({version:1,entries:[{path,kind:c.kind,candidateNote:c.note,status:'accepted',note:'',updatedAt:'2026-10-15T06:00:00Z'},{path,kind:c.kind,candidateNote:c.note,status:'resolved',note:'',updatedAt:'2026-10-15T07:00:00Z'}]}),false);
});
test('backup merge picks more recent recorded review for same candidate',()=>{
 const old=putDecision(emptyLedger(),path,c,'needs-research','Earlier','2026-10-15T06:00:00Z');
 const newer=putDecision(emptyLedger(),path,c,'resolved','Reviewed','2026-10-15T07:00:00Z');
 assert.equal(decisionFor(mergeLedger(old,newer),path,c).status,'resolved');
 assert.equal(decisionFor(mergeLedger(newer,old),path,c).status,'resolved');
});
test('browser save/reload accepts only validated decisions',()=>{
 const db=new Map(),storage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v)};
 const data=putDecision(emptyLedger(),path,c,'not-warranted','Historically unrelated');
 saveLedger(storage,data);assert.equal(readLedger(storage).entries.length,1);
 db.set(LEDGER_STORAGE_KEY,'not-json');assert.equal(readLedger(storage).entries.length,0);
});
