// Pure Cloudflare Access identity verifier; NO request handler or live binding.
// JWKS and policy MUST come from trusted deployment configuration, never a caller.
const enc = new TextEncoder();
const decoder = new TextDecoder('utf-8',{fatal:true});
const strictBase64 = value => {
 if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('malformed token');
 const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
 // WebCrypto-compatible base64url conversion, usable in Workers and Node 20.
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 let bits=0,count=0,output=[];
 for(const c of normalized){const n=alphabet.indexOf(c);if(n<0)throw Error('malformed token');bits=(bits<<6)|n;count+=6;if(count>=8){count-=8;output.push((bits>>count)&255);}}
 if(count && (bits&((1<<count)-1))!==0)throw Error('malformed token');
 return new Uint8Array(output);
};
const jsonPart = part => {
 const bytes=strictBase64(part);
 if(bytes.length>8192)throw Error('token section too large');
 return JSON.parse(decoder.decode(bytes));
};
export async function verifyStewardshipAccessJwt(jwt, policy, jwks, options={}) {
 try {
  if(typeof jwt!=='string'||jwt.length>16384)return false;
  const parts=jwt.split('.');if(parts.length!==3)return false;
  const [h,p,s]=parts;const header=jsonPart(h),claims=jsonPart(p);
  if(!header||header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||header.crit||header.jku||header.jwk||header.x5u)return false;
  if(!policy||typeof policy.issuer!=='string'||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(policy.issuer)||typeof policy.audience!=='string'||!policy.audience||!Array.isArray(policy.allowedEmails)||!policy.allowedEmails.length)return false;
  if(claims.iss!==policy.issuer||!(typeof claims.aud==='string'?claims.aud===policy.audience:Array.isArray(claims.aud)&&claims.aud.includes(policy.audience)))return false;
  const now=Math.floor((options.nowMs??Date.now())/1000);
  if(!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.iat>now+60||claims.exp<=now||claims.exp>now+86400||claims.exp<=claims.iat)return false;
  if(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>now))return false;
  // Access service tokens do not meet the email-identified human operator policy.
  if(typeof claims.email!=='string'||!claims.email||!policy.allowedEmails.some(e=>typeof e==='string'&&e.toLowerCase()===claims.email.toLowerCase()))return false;
  if(!jwks||!Array.isArray(jwks.keys))return false;
  const matches=jwks.keys.filter(k=>k&&k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256'&&(!k.use||k.use==='sig')&&typeof k.n==='string'&&typeof k.e==='string');
  if(matches.length!==1)return false;
  const key=await crypto.subtle.importKey('jwk',matches[0],{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,strictBase64(s),enc.encode(h+'.'+p));
 }catch{return false;}
}
