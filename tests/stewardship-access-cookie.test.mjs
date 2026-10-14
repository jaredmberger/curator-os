import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createStewardshipOperatorAuthorizer} from '../tools/stewardship/access-key-provider.mjs';
const policy={issuer:'https://test-team.cloudflareaccess.com',audience:'trusted-audience',allowedEmails:['reviewer@example.com']};
const enc=new TextEncoder();
const b64=x=>Buffer.from(x).toString('base64url');
const keyset=async()=>{
 const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await webcrypto.subtle.exportKey('jwk',pair.publicKey);
 return {privateKey:pair.privateKey,jwk:{...jwk,kid:'test-key',alg:'RS256',use:'sig'}};
};
const jwt=async(key,claims)=>{
 const head=b64(JSON.stringify({alg:'RS256',kid:'test-key'})),payload=b64(JSON.stringify(claims));
 return head+'.'+payload+'.'+b64(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(head+'.'+payload)));
};
const request=headers=>new Request('https://curator.oceanliners.net/api/stewardship-ship-snapshot',{headers});
test('valid signed cookie JWT authorizes with the identical operator policy',async()=>{
 const {privateKey,jwk}=await keyset(),now=Math.floor(Date.now()/1000);
 const token=await jwt(privateKey,{iss:policy.issuer,aud:policy.audience,email:'reviewer@example.com',iat:now-30,exp:now+600});
 const authorizer=createStewardshipOperatorAuthorizer({policy,fetchKeys:async()=>new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}})});
 assert.equal(await authorizer.authorize(request({cookie:'CF_Authorization='+token})),true);
 assert.equal(await authorizer.authorize(request({'Cf-Access-Jwt-Assertion':token})),true);
 assert.equal(await authorizer.authorize(request({cookie:'CF_Authorization='+token,'Cf-Access-Jwt-Assertion':token})),false);
 assert.equal(await authorizer.authorize(request({cookie:'CF_Authorization='+token+'; CF_Authorization='+token})),false);
});
test('signed cookie for other identity or audience stays denied',async()=>{
 const {privateKey,jwk}=await keyset(),now=Math.floor(Date.now()/1000);
 const authorizer=createStewardshipOperatorAuthorizer({policy,fetchKeys:async()=>new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}})});
 for(const change of [{email:'intruder@example.com'},{aud:'wrong-audience'}]){
  const token=await jwt(privateKey,{iss:policy.issuer,aud:policy.audience,email:'reviewer@example.com',iat:now-30,exp:now+600,...change});
  assert.equal(await authorizer.authorize(request({cookie:'CF_Authorization='+token})),false);
 }
});
