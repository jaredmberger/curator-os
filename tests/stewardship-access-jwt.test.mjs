import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {verifyStewardshipAccessJwt as verify} from '../tools/stewardship/access-jwt-verifier.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
const policy={issuer:'https://example-team.cloudflareaccess.com',audience:'stewardship-test-aud',allowedEmails:['owner@example.com']};
async function fixture(){
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
 const now=Math.floor(Date.now()/1000);
 const claims={iss:policy.issuer,aud:policy.audience,email:'owner@example.com',iat:now-5,exp:now+300};
 const sign=async(c=claims,h={alg:'RS256',kid:'test-key'})=>{
  const head=b64(h),body=b64(c);const bytes=new TextEncoder().encode(head+'.'+body);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,bytes);
  return head+'.'+body+'.'+b64(Buffer.from(signature));
 };
 return {sign,claims,jwks:{keys:[jwk]}};
}
test('accepts only valid signature, matching issuer/audience and allowlisted human',async()=>{
 const f=await fixture();assert.equal(await verify(await f.sign(),policy,f.jwks),true);
 assert.equal(await verify(await f.sign({...f.claims,email:'other@example.com'}),policy,f.jwks),false);
 assert.equal(await verify(await f.sign({...f.claims,email:undefined,common_name:'service-token'}),policy,f.jwks),false);
 assert.equal(await verify(await f.sign({...f.claims,iss:'https://other.cloudflareaccess.com'}),policy,f.jwks),false);
 assert.equal(await verify(await f.sign({...f.claims,aud:'another-audience'}),policy,f.jwks),false);
});
test('rejects forged/altered signatures and untrusted keys',async()=>{
 const f=await fixture(),token=await f.sign();
 assert.equal(await verify(token.replace(/.$/,token.endsWith('A')?'B':'A'),policy,f.jwks),false);
 assert.equal(await verify(token,policy,{keys:[]}),false);
 assert.equal(await verify(token,policy,{keys:[f.jwks.keys[0],f.jwks.keys[0]]}),false);
 assert.equal(await verify(await f.sign(f.claims,{alg:'none',kid:'test-key'}),policy,f.jwks),false);
 assert.equal(await verify(await f.sign(f.claims,{alg:'RS256',kid:'test-key',jku:'https://evil.example/keys'}),policy,f.jwks),false);
});
test('rejects expired, future and malformed tokens, missing trusted policy',async()=>{
 const f=await fixture(),now=Math.floor(Date.now()/1000);
 assert.equal(await verify(await f.sign({...f.claims,exp:now-1}),policy,f.jwks),false);
 assert.equal(await verify(await f.sign({...f.claims,nbf:now+300}),policy,f.jwks),false);
 assert.equal(await verify(await f.sign({...f.claims,iat:now+300}),policy,f.jwks),false);
 assert.equal(await verify('not-a-jwt',policy,f.jwks),false);
 assert.equal(await verify(await f.sign(),{...policy,allowedEmails:[]},f.jwks),false);
});
