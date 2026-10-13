// Staging-only rejection classifier. NEVER grants access; not a JWT validator.
// Do not expose token, key, claims or identifying values in responses.
const parsePart = s => {
 if(!/^[A-Za-z0-9_-]+$/.test(s||'')||s.length>11000) return null;
 try { return JSON.parse(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'='))); }
 catch { return null; }
};
export function classifyStagingRejection(assertion, env, keyService) {
 if(keyService==='not_checked') return 'before_key_fetch';
 const parts=typeof assertion==='string'?assertion.split('.'):[];
 if(parts.length!==3)return 'jwt_shape';
 const h=parsePart(parts[0]),c=parsePart(parts[1]);
 if(!h||!c||h.alg!=='RS256'||typeof h.kid!=='string')return 'jwt_header';
 if(c.iss!==env.STEWARDSHIP_ACCESS_ISSUER)return 'issuer_mismatch';
 const aud=env.STEWARDSHIP_ACCESS_AUDIENCE;
 if(!(typeof c.aud==='string'?c.aud===aud:Array.isArray(c.aud)&&c.aud.includes(aud)))return 'audience_mismatch';
 const now=Math.floor(Date.now()/1000);
 if(!Number.isSafeInteger(c.iat)||!Number.isSafeInteger(c.exp)||c.iat>now+60||c.exp<=now||c.exp>now+86400||c.exp<=c.iat||(c.nbf!==undefined&&c.nbf>now))return 'token_time';
 if(typeof c.email!=='string'||c.email.toLowerCase()!==env.STEWARDSHIP_OPERATOR_EMAIL.toLowerCase())return 'operator_identity_mismatch';
 return 'key_or_signature';
}
