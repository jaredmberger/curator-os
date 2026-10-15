// Phase 2 contract only: no network or storage writes.
// Optimistic revision tokens prevent silent overwrites by another device.
import {validLedger,mergeLedger} from './editorial-ledger.mjs';
export const SYNC_SCOPE='operator-editorial-ledger';
export const SYNC_VERSION=1;
const revisionOK=x=>typeof x==='string'&&(/^[a-f0-9]{64}$/.test(x)||x==='initial');
export function validateSyncEnvelope(x){
 return !!x&&x.contractVersion===SYNC_VERSION&&x.scope===SYNC_SCOPE&&
 revisionOK(x.revision)&&Number.isFinite(Date.parse(x.updatedAt))&&validLedger(x.ledger);
}
export function createInitialSyncEnvelope(updatedAt='1970-01-01T00:00:00.000Z'){
 const x={contractVersion:SYNC_VERSION,scope:SYNC_SCOPE,revision:'initial',updatedAt,ledger:{version:1,entries:[]}};
 if(!validateSyncEnvelope(x))throw Error('invalid initial envelope');
 return x;
}
export function planLedgerSync({local,remote,expectedRevision}){
 if(!validLedger(local)||!validateSyncEnvelope(remote)||!revisionOK(expectedRevision))throw Error('invalid sync input');
 if(expectedRevision!==remote.revision)return {action:'conflict',remoteRevision:remote.revision};
 const merged=mergeLedger(remote.ledger,local);
 const same=JSON.stringify(merged.entries.sort((a,b)=>JSON.stringify([a.path,a.kind,a.candidateNote]).localeCompare(JSON.stringify([b.path,b.kind,b.candidateNote]))))===
  JSON.stringify([...remote.ledger.entries].sort((a,b)=>JSON.stringify([a.path,a.kind,a.candidateNote]).localeCompare(JSON.stringify([b.path,b.kind,b.candidateNote]))));
 return same?{action:'unchanged',remoteRevision:remote.revision}:{action:'propose',expectedRevision:remote.revision,merged};
}
export function validateMutationProposal(x){
 return !!x&&x.contractVersion===1&&x.scope===SYNC_SCOPE&&revisionOK(x.expectedRevision)&&
 typeof x.requestId==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(x.requestId)&&validLedger(x.ledger);
}
