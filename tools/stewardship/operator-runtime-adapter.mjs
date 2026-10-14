// Deployment-neutral, NOT YET INSTALLED bridge between trusted Pages bindings
// and the offline Cloudflare Access verifier. This module exports a factory;
// it does not create a Pages route, change Access, or enable any feature.
import { createStewardshipOperatorAuthorizer } from './access-key-provider.mjs';

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const formatEmail = x => typeof x === 'string' && /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(x);
const readConfig = env => {
 if (!env || typeof env !== 'object') return null;
 // All three settings must be explicitly owned by the deployment bindings;
 // neither a request header nor a JWT claim is accepted as configuration.
 const fields=['STEWARDSHIP_ACCESS_ISSUER','STEWARDSHIP_ACCESS_AUDIENCE','STEWARDSHIP_OPERATOR_EMAIL'];
 if (!fields.every(key => own(env,key) && typeof env[key] === 'string')) return null;
 const issuer=env.STEWARDSHIP_ACCESS_ISSUER;
 const audience=env.STEWARDSHIP_ACCESS_AUDIENCE;
 const email=env.STEWARDSHIP_OPERATOR_EMAIL;
 if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
     !/^[A-Za-z0-9_-]{8,160}$/.test(audience) || !formatEmail(email)) return null;
 return {issuer,audience,allowedEmails:[email]};
};

// A boolean-only status used when an already-denied protected request needs
// a coarse diagnosis. Never return configured values or identity information.
export const hasTrustedOperatorConfiguration = env => readConfig(env)!==null;

// An injected fetch is intended for isolated test fixtures only.
// In actual Cloudflare deployment omit options; runtime uses global fetch.
export function createOperatorAuthorizationFromBindings(env, options={}) {
 try {
  const policy=readConfig(env);
  if (!policy) return Object.freeze({authorize:async()=>false});
  const config={policy};
  if (own(options,'fetchKeys')) config.fetchKeys=options.fetchKeys;
  if (own(options,'timeoutMs')) config.timeoutMs=options.timeoutMs;
  return createStewardshipOperatorAuthorizer(config);
 } catch { return Object.freeze({authorize:async()=>false}); }
}
